/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
 */
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser, type Page } from '@playwright/test'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { rotationFromTarget } from '@/lib/spatial-previs/camera'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import {
  applySpatialPrevisBeatPatch,
  canMutateSpatialPrevisEditor,
  createSpatialPrevisSaveGuard,
  isSpatialWhiteboxToolbarDisabled,
  nextSpatialPrevisEditorMode,
  selectSpatialPrevisEditorMode,
  SpatialPrevisDirectorPanel,
} from './SpatialPrevisDirectorPanel'
import { clampSpatialPrevisTime, commitSpatialNumericDraft } from './SpatialPrevisTimeline'
import { replaceWhiteboxDraft } from '@/lib/spatial-previs/whitebox'
import type { SpatialPrevisState, SpatialSceneReference } from '@/lib/spatial-previs/types'
import * as directorPanelModule from './SpatialPrevisDirectorPanel'

Object.assign(globalThis, { React })

declare global {
  interface Window {
    __spatialPrevisPanelHarness: {
      mount: (state: SpatialPrevisState) => void
    }
  }
}

let browser: Browser | undefined
let temporaryDirectory: string | undefined
let bundlePath: string | undefined

async function findEsbuildBinary() {
  const pnpmDirectory = path.resolve(process.cwd(), '../..', 'node_modules/.pnpm')
  const entries = (await readdir(pnpmDirectory)).filter((entry) => entry.startsWith('tsx@')).sort()
  for (const entry of entries) {
    const candidate = path.join(pnpmDirectory, entry, 'node_modules/esbuild/bin/esbuild')
    try {
      await readdir(path.dirname(candidate))
      return candidate
    } catch {
      // Keep looking for the tsx installation that owns esbuild.
    }
  }
  throw new Error('Unable to locate the existing tsx esbuild binary')
}

function renderedPanelHarnessSource() {
  const componentPath = path.resolve(process.cwd(), 'src/components/create/spatial-previs/SpatialPrevisDirectorPanel.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { SpatialPrevisDirectorPanel } from ${JSON.stringify(componentPath)}

    let root = null
    window.__spatialPrevisPanelHarness = {
      mount(state) {
        root?.unmount()
        const container = document.getElementById('root')
        container.replaceChildren()
        root = createRoot(container)
        root.render(React.createElement(SpatialPrevisDirectorPanel, {
          initialState: state,
          onSave: () => undefined,
          onClose: () => undefined,
        }))
      },
    }
  `
}

async function prepareRenderedPanel(page: Page) {
  assert.ok(bundlePath)
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addStyleTag({ content: 'html, body, #root { min-height: 900px; } #root { width: 1200px; }' })
  await page.addScriptTag({ path: bundlePath })
}

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'spatial-previs-panel-'))
  const entryPath = path.join(temporaryDirectory, 'entry.tsx')
  bundlePath = path.join(temporaryDirectory, 'bundle.js')
  await writeFile(entryPath, renderedPanelHarnessSource(), 'utf8')

  const bundle = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--jsx=automatic',
    '--outfile=' + bundlePath,
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(bundle.status, 0, bundle.stderr || bundle.stdout)
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

const state: SpatialPrevisState = {
  version: 4,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'take-1',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-lead',
      anchorId: 'lead-performer',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'enter' },
        { id: 'actor-mid', timeSec: 6, position: { x: 0, y: 0, z: -1 }, action: 'turn' },
        { id: 'actor-end', timeSec: 12, position: { x: 2, y: 0, z: -2 }, action: 'exit' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: -2, y: 1, z: 1 }, rotation: rotationFromTarget({ x: 0, y: 1.6, z: 8 }, { x: -2, y: 1, z: 1 }), focalLengthMm: 35, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'camera-mid', timeSec: 6, position: { x: 0, y: 1.8, z: 5 }, target: { x: 0, y: 1, z: -1 }, rotation: rotationFromTarget({ x: 0, y: 1.8, z: 5 }, { x: 0, y: 1, z: -1 }), focalLengthMm: 50, shotScale: 'medium', motionBaseline: 'push', intent: 'push' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2.4, z: 4 }, target: { x: 2, y: 1, z: -2 }, rotation: rotationFromTarget({ x: 2, y: 2.4, z: 4 }, { x: 2, y: 1, z: -2 }), focalLengthMm: 65, shotScale: 'wide', motionBaseline: 'follow', intent: 'follow' },
      ],
    },
    aerialCameraTrack: {
      id: 'aerial-camera-track',
      keyframes: [
        { id: 'aerial-start', timeSec: 0, position: { x: 0, y: 9, z: 8 }, target: { x: -2, y: 1, z: 1 }, rotation: rotationFromTarget({ x: 0, y: 9, z: 8 }, { x: -2, y: 1, z: 1 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
        { id: 'aerial-mid', timeSec: 6, position: { x: 0, y: 9, z: 5 }, target: { x: 0, y: 1, z: -1 }, rotation: rotationFromTarget({ x: 0, y: 9, z: 5 }, { x: 0, y: 1, z: -1 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
        { id: 'aerial-end', timeSec: 12, position: { x: 2, y: 9, z: 4 }, target: { x: 2, y: 1, z: -2 }, rotation: rotationFromTarget({ x: 2, y: 9, z: 4 }, { x: 2, y: 1, z: -2 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
      ],
    },
    beats: [{ id: 'beat-01', label: 'Arrival', startSec: 0, endSec: 12 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-09T00:00:00.000Z',
}

test('renders both synchronized timeline tabs for the supplied master take', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: state,
    onSave: () => undefined,
    onClose: () => undefined,
  }))

  assert.match(markup, /连续走位/)
  assert.match(markup, /剧情节拍/)
  assert.match(markup, /data-master-take-id="take-1"/)
  assert.match(markup, /role="tab"/)
  assert.match(markup, /role="tabpanel"/)
  assert.match(markup, /aria-controls="[^"]+"/)
  assert.match(markup, /tabindex="0"/)
  assert.match(markup, /tabindex="-1"/)
})

test('composes the compact whitebox toolbar at the top of the spatial workspace', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: state,
    onSave: () => undefined,
    onClose: () => undefined,
  }))

  const toolbarIndex = markup.indexOf('aria-label="白模搭建工具"')
  const viewportIndex = markup.indexOf('data-spatial-previs-viewport="true"')
  assert.ok(toolbarIndex >= 0)
  assert.ok(viewportIndex > toolbarIndex)
  assert.match(markup, /添加地面/)
  assert.match(markup, /添加墙体/)
  assert.match(markup, /添加开口/)
  assert.match(markup, /添加家具/)
  assert.match(markup, /添加道具/)
})

test('locks whitebox additions while saving, reloading, or uploading', () => {
  assert.equal(isSpatialWhiteboxToolbarDisabled(false, false, false), false)
  assert.equal(isSpatialWhiteboxToolbarDisabled(true, false, false), true)
  assert.equal(isSpatialWhiteboxToolbarDisabled(false, true, false), true)
  assert.equal(isSpatialWhiteboxToolbarDisabled(false, false, true), true)
})

test('switches only the editor mode while retaining the one master take', () => {
  const next = selectSpatialPrevisEditorMode(state, 'beats')

  assert.equal(next.editorMode, 'beats')
  assert.equal(next.masterTake, state.masterTake)
  assert.equal(next.masterTake.id, 'take-1')
  assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
})

test('patches a beat camera keyframe in the existing master take without duplicate collections', () => {
  const next = applyBeatPatch(state, 'beat-01', {
    position: { x: 3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })

  assert.equal(next.masterTake.id, state.masterTake.id)
  assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.cameraTrack.id, state.masterTake.cameraTrack.id)
  assert.notEqual(next.masterTake.cameraTrack.keyframes, state.masterTake.cameraTrack.keyframes)
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[1]?.position, { x: 3, y: 2, z: 4 })
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[1]?.target, { x: 1, y: 1, z: -2 })
})

test('clamps shared timeline time to the master take duration', () => {
  assert.equal(clampSpatialPrevisTime(-2, state.masterTake.durationSec), 0)
  assert.equal(clampSpatialPrevisTime(18, state.masterTake.durationSec), state.masterTake.durationSec)
  assert.equal(clampSpatialPrevisTime(Number.NaN, state.masterTake.durationSec), 0)
})

test('commits the expanded duration and remapped panel playhead against the destination duration', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate((initialState) => window.__spatialPrevisPanelHarness.mount(initialState), state)
    const playhead = page.locator('#spatial-previs-current-time')
    await playhead.evaluate((element, value) => {
      const input = element as HTMLInputElement
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (!valueSetter) throw new Error('Expected the native range value setter')
      valueSetter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }, '6')
    await page.getByText('6s / 12s', { exact: true }).waitFor()
    assert.equal(await playhead.inputValue(), '6')
    await page.getByRole('button', { name: '调整时长' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '180s', exact: true }).focus()
    await page.keyboard.press('Enter')

    await page.getByText('90s / 180s', { exact: true }).waitFor({ timeout: 2_000 })
    assert.equal(await playhead.inputValue(), '90')

    await page.getByRole('button', { name: '调整时长' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '10s', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('output[aria-live="polite"]')?.textContent === '5s / 10s')
    assert.equal(await page.locator('output[aria-live="polite"]').innerText(), '5s / 10s')
    assert.equal(await playhead.inputValue(), '5')
  } finally {
    await page.close()
  }
})

test('retimes a rendered camera curve point through pointer capture', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate((initialState) => window.__spatialPrevisPanelHarness.mount(initialState), state)
    const cameraPoint = page.getByLabel('调整相机关键帧 2，6s')
    await cameraPoint.scrollIntoViewIfNeeded()
    const before = await cameraPoint.getAttribute('style')
    const box = await cameraPoint.boundingBox()
    assert.ok(box)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 96, box.y + box.height / 2, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction((initialStyle) => {
      const point = document.querySelector<HTMLButtonElement>('button[aria-label^="调整相机关键帧 2，"]')
      return point?.getAttribute('style') !== initialStyle
    }, before)

    assert.notEqual(await page.locator('button[aria-label^="调整相机关键帧 2，"]').getAttribute('style'), before)
  } finally {
    await page.mouse.up().catch(() => undefined)
    await page.close()
  }
})

test('retimes a rendered camera curve point through the keyboard', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate((initialState) => window.__spatialPrevisPanelHarness.mount(initialState), state)
    await page.getByLabel('调整相机关键帧 2，6s').focus()
    await page.keyboard.press('ArrowRight')

    await page.getByLabel('调整相机关键帧 2，6.5s').waitFor({ timeout: 2_000 })
    await page.getByText('6.5s / 12s', { exact: true }).waitFor({ timeout: 2_000 })
  } finally {
    await page.close()
  }
})

test('exports the rendered live camera canvas as a local WebM without creating a provider delivery', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate(`(() => {
      const initialState = ${JSON.stringify(state)}
      class FakeMediaRecorder {
        static isTypeSupported() { return true }
        state = 'inactive'
        listeners = new Map()
        constructor(_stream, _options) {}
        addEventListener(type, listener) {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
        }
        removeEventListener(type, listener) {
          this.listeners.set(type, (this.listeners.get(type) ?? []).filter((current) => current !== listener))
        }
        emit(type, event) {
          for (const listener of this.listeners.get(type) ?? []) listener(event)
        }
        start() {
          this.state = 'recording'
          queueMicrotask(() => this.emit('dataavailable', { data: new Blob(['previs'], { type: 'video/webm' }) }))
        }
        stop() {
          if (this.state === 'inactive') return
          this.state = 'inactive'
          this.emit('stop', {})
        }
      }
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, writable: true, value: FakeMediaRecorder })
      Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
        configurable: true,
        value: () => ({}),
      })
      URL.createObjectURL = () => 'blob:spatial-previs-test'
      URL.revokeObjectURL = () => undefined
      HTMLAnchorElement.prototype.click = function click() {
        document.documentElement.dataset.download = this.download
      }
      window.__spatialPrevisPanelHarness.mount({
        ...initialState,
        masterTake: { ...initialState.masterTake, durationSec: 1 },
      })
    })()`)

    const exportButton = page.getByRole('button', { name: '导出预演视频' })
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((element) => element.textContent === '导出预演视频')
      return button && !button.disabled
    })
    await exportButton.click()

    await page.getByText('正在导出预演视频，编辑已锁定。', { exact: true }).waitFor({ timeout: 2_000 })
    assert.equal(await page.getByRole('button', { name: '添加墙体' }).isDisabled(), true)

    await page.getByText('预演视频已导出。', { exact: true }).waitFor({ timeout: 2_000 })
    assert.equal(await page.evaluate(() => document.documentElement.dataset.download), 'spatial-previs-take-1.webm')
  } finally {
    await page.close()
  }
})

test('aborts an active live-camera export when the director panel unmounts', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate(`(() => {
      const initialState = ${JSON.stringify(state)}
      class FakeMediaRecorder {
        static isTypeSupported() { return true }
        state = 'inactive'
        listeners = new Map()
        constructor(_stream, _options) {}
        addEventListener(type, listener) {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
        }
        removeEventListener(type, listener) {
          this.listeners.set(type, (this.listeners.get(type) ?? []).filter((current) => current !== listener))
        }
        emit(type, event) {
          for (const listener of this.listeners.get(type) ?? []) listener(event)
        }
        start() { this.state = 'recording' }
        stop() {
          if (this.state === 'inactive') return
          this.state = 'inactive'
          document.documentElement.dataset.recorderStopped = 'true'
          this.emit('stop', {})
        }
      }
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, writable: true, value: FakeMediaRecorder })
      Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
        configurable: true,
        value: () => ({}),
      })
      window.__spatialPrevisPanelHarness.mount({
        ...initialState,
        masterTake: { ...initialState.masterTake, durationSec: 10 },
      })
    })()`)

    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((element) => element.textContent === '导出预演视频')
      return button && !button.disabled
    })
    await page.getByRole('button', { name: '导出预演视频' }).click()
    await page.getByText('正在导出预演视频，编辑已锁定。', { exact: true }).waitFor({ timeout: 2_000 })
    await page.evaluate((initialState) => window.__spatialPrevisPanelHarness.mount(initialState), state)

    await page.waitForFunction(() => document.documentElement.dataset.recorderStopped === 'true')
  } finally {
    await page.close()
  }
})

test('records a nonempty WebM from the actual rendered live camera canvas', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedPanel(page)
    await page.evaluate(`(() => {
      const initialState = ${JSON.stringify(state)}
      const createObjectURL = URL.createObjectURL.bind(URL)
      URL.createObjectURL = (blob) => {
        document.documentElement.dataset.webmSize = String(blob.size)
        return createObjectURL(blob)
      }
      HTMLAnchorElement.prototype.click = function() {
        document.documentElement.dataset.download = this.download
      }
      window.__spatialPrevisPanelHarness.mount({
        ...initialState,
        masterTake: { ...initialState.masterTake, durationSec: 0.2 },
      })
    })()`)

    const supported = await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-spatial-camera-preview="true"] canvas')
      return Boolean(canvas && typeof canvas.captureStream === 'function' && typeof MediaRecorder === 'function' && MediaRecorder.isTypeSupported('video/webm'))
    }, { timeout: 5_000 }).then(() => true, () => false)
    assert.equal(supported, true)
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .find((element) => element.textContent === '导出预演视频')
      return button && !button.disabled
    })
    await page.getByRole('button', { name: '导出预演视频' }).click()

    await page.getByText('预演视频已导出。', { exact: true }).waitFor({ timeout: 5_000 })
    assert.ok(Number(await page.evaluate(() => document.documentElement.dataset.webmSize)) > 0)
    assert.equal(await page.evaluate(() => document.documentElement.dataset.download), 'spatial-previs-take-1.webm')
  } finally {
    await page.close()
  }
})

test('keeps incomplete numeric drafts local and commits only complete finite coordinates', () => {
  assert.equal(commitSpatialNumericDraft('', 4), 4)
  assert.equal(commitSpatialNumericDraft('-', 4), 4)
  assert.equal(commitSpatialNumericDraft('3x', 4), 4)
  assert.equal(commitSpatialNumericDraft('-2.5', 4), -2.5)
})

test('maps roving tab keys to the next persistent editor mode', () => {
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'ArrowRight'), 'beats')
  assert.equal(nextSpatialPrevisEditorMode('beats', 'ArrowLeft'), 'continuous')
  assert.equal(nextSpatialPrevisEditorMode('beats', 'Home'), 'continuous')
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'End'), 'beats')
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'Enter'), null)
})

test('reports save success, failure, and a pending guard without concurrent calls', async () => {
  const guard = createSpatialPrevisSaveGuard()
  let saveCalls = 0
  let resolveFirst: ((value: 'success') => void) | undefined
  const first = guard.save(state, () => {
    saveCalls += 1
    return new Promise<'success'>((resolve) => { resolveFirst = resolve })
  })

  assert.equal(guard.isPending(), true)
  assert.equal(await guard.save(state, () => {
    saveCalls += 1
    return 'success'
  }), 'pending')
  assert.equal(saveCalls, 1)

  resolveFirst?.('success')
  assert.equal(await first, 'success')
  assert.equal(guard.isPending(), false)
  assert.equal(await guard.save(state, () => 'failed'), 'failed')
  assert.equal(await guard.save(state, () => 'conflict'), 'conflict')
  assert.equal(await guard.save(state, () => Promise.reject(new Error('save failed'))), 'failed')
})

test('blocks all editor mutations while the accepted save snapshot is pending', async () => {
  const guard = createSpatialPrevisSaveGuard()
  let resolveSave: ((value: 'success') => void) | undefined
  let acceptedSnapshot: SpatialPrevisState | null = null
  const pendingSave = guard.save(state, (next) => {
    acceptedSnapshot = next
    return new Promise<'success'>((resolve) => { resolveSave = resolve })
  })

  assert.equal(canMutateSpatialPrevisEditor(guard.isPending()), false)
  assert.equal(acceptedSnapshot, state)
  resolveSave?.('success')
  assert.equal(await pendingSave, 'success')
  assert.equal(canMutateSpatialPrevisEditor(guard.isPending()), true)
})

test('treats a scene-asset upload as busy for save, close, and editor mutation guards', () => {
  type BusyGuard = (isSaving: boolean, isReloading: boolean, isSceneAssetsUploading: boolean) => boolean
  const isSpatialPrevisBusy = (directorPanelModule as unknown as {
    isSpatialPrevisBusy?: BusyGuard
  }).isSpatialPrevisBusy

  assert.equal(typeof isSpatialPrevisBusy, 'function')
  const isBusy = isSpatialPrevisBusy?.(false, false, true)
  assert.equal(isBusy, true)
  assert.equal(canMutateSpatialPrevisEditor(isBusy ?? false), false)
})

test('accepts completed scene references during upload but rejects them while saving or reloading', () => {
  type SceneReferenceGuard = (isSaving: boolean, isReloading: boolean) => boolean
  const canReplaceSpatialPrevisSceneReferences = (directorPanelModule as unknown as {
    canReplaceSpatialPrevisSceneReferences?: SceneReferenceGuard
  }).canReplaceSpatialPrevisSceneReferences
  const completedReference: SpatialSceneReference = {
    id: 'scene-upload-completed',
    assetId: 'asset-upload-completed',
    title: 'Completed scene reference',
    mediaType: 'image',
    url: '/api/assets/asset-upload-completed/file',
    source: 'upload',
  }

  assert.equal(typeof canReplaceSpatialPrevisSceneReferences, 'function')
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(false, false), true)
  const updated = canReplaceSpatialPrevisSceneReferences?.(false, false)
    ? replaceWhiteboxDraft(state, [completedReference])
    : state
  assert.deepEqual(updated.scene.references, [completedReference])
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(true, false), false)
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(false, true), false)
})

test('keeps a failed beat patch state intact and provides an inline error message', () => {
  const ambiguousMidpointState: SpatialPrevisState = {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes: [...state.masterTake.cameraTrack.keyframes, { ...state.masterTake.cameraTrack.keyframes[1]!, id: 'camera-mid-duplicate' }],
      },
    },
  }

  const result = applySpatialPrevisBeatPatch(ambiguousMidpointState, 'beat-01', {
    position: { x: 3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })

  assert.equal(result.state, ambiguousMidpointState)
  assert.equal(result.error, '无法更新节拍。')
})

test('keeps unavailable coverage advisory-only while beat fields remain editable', () => {
  const unavailableState: SpatialPrevisState = {
    ...state,
    scene: {
      ...state.scene,
      coverage: { mode: 'unavailable', cameraFreedom: 'disabled' },
    },
    editorMode: 'beats',
  }
  const result = applySpatialPrevisBeatPatch(unavailableState, 'beat-01', {
    position: { x: -3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: unavailableState,
    onSave: () => undefined,
    onClose: () => undefined,
  }))
  const [risk] = assessAuthoringRisks(
    unavailableState.scene.coverage,
    unavailableState.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.position),
  )

  assert.notEqual(result.state, unavailableState)
  assert.equal(risk?.blocking, false)
  assert.match(markup, /Camera positions cannot be validated/)
  assert.match(markup, /aria-label="相机位置 X"/)
  assert.doesNotMatch(markup, /aria-label="相机位置 X"[^>]*disabled=/)
})

test('renders neutral delivery actions and keeps provider delivery inside an advanced disclosure', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: state,
    onSave: () => undefined,
    onCreateDeliveryNode: () => undefined,
    onDownloadDeliveryPackage: () => undefined,
    onSaveDeliveryPackageToAssets: async () => undefined,
    onDeliverToSeedance: async () => ({ success: true, message: 'submitted' }),
    onClose: () => undefined,
  }))
  const footerMarkup = markup.slice(markup.lastIndexOf('<footer'))

  assert.match(footerMarkup, /生成预演节点/)
  assert.match(markup, /导出预演视频/)
  assert.match(markup, /下载交付包/)
  assert.match(markup, /保存到素材库/)
  assert.match(markup, /<details/)
  assert.match(markup, /高级交付/)
  assert.doesNotMatch(footerMarkup, /Seedance|seedance-2\.5|生成到 Seedance/)
})
