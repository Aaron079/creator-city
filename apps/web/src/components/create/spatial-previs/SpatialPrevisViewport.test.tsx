/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser, type Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { applySpatialCameraAction } from './SpatialCameraControlStrip'
import { applySpatialNudge, SpatialPrevisViewport } from './SpatialPrevisViewport'
import { applyWhiteboxGroundDrag } from '@/lib/spatial-previs/whitebox-edit'
import type { SpatialPrevisState, Vec3, WhiteboxEntity } from '@/lib/spatial-previs/types'

const viewportSource = readFileSync(new URL('./SpatialPrevisViewport.tsx', import.meta.url), 'utf8')

declare global {
  interface Window {
    __spatialPrevisViewportHarness: {
      mount: (state: SpatialPrevisState, disabled?: boolean) => void
      mountRigProof: (state: SpatialPrevisState, showCameraRig: boolean) => void
      lastChange: () => SpatialPrevisState | null
    }
  }
}

const state: SpatialPrevisState = {
  version: 3,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'master-take-01',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-lead',
      anchorId: 'lead-performer',
      keyframes: [
        { id: 'actor-lead-start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'enter' },
        { id: 'actor-lead-beat', timeSec: 6, position: { x: 0, y: 0, z: -1 }, action: 'turn' },
        { id: 'actor-lead-end', timeSec: 12, position: { x: 2, y: 0, z: -2 }, action: 'exit' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: -2, y: 1, z: 1 }, focalLengthMm: 35, intent: 'static' },
        { id: 'camera-beat', timeSec: 6, position: { x: 0, y: 1.8, z: 5 }, target: { x: 0, y: 1, z: -1 }, focalLengthMm: 50, intent: 'push' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2.4, z: 4 }, target: { x: 2, y: 1, z: -2 }, focalLengthMm: 65, intent: 'follow' },
      ],
    },
    beats: [{ id: 'beat-01', label: 'Arrival', startSec: 0, endSec: 12 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-09T00:00:00.000Z',
}

function stateWithTwoActors(): SpatialPrevisState {
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: [
        state.masterTake.actorTracks[0]!,
        {
          id: 'actor-track-support',
          anchorId: 'support-performer',
          keyframes: [
            { id: 'actor-support-start', timeSec: 0, position: { x: 3, y: 0, z: 2 }, action: 'wait' },
            { id: 'actor-support-beat', timeSec: 6, position: { x: 2, y: 0, z: 0 }, action: 'react' },
            { id: 'actor-support-end', timeSec: 12, position: { x: 1, y: 0, z: -2 }, action: 'leave' },
          ],
        },
      ],
    },
  }
}

function stateWithWhitebox(): SpatialPrevisState {
  return {
    ...state,
    scene: {
      ...state.scene,
      whitebox: {
        entities: [
          { id: 'floor-main', label: 'floor-main', confidence: 1, kind: 'floor', position: { x: 0, y: -0.75, z: 0 }, rotationY: 0, size: { x: 16, y: 0.2, z: 12 }, sourceAssetIds: ['reference-1'] },
          { id: 'wall-back', label: 'wall-back', confidence: 1, kind: 'wall', position: { x: 0, y: 2, z: -4 }, rotationY: 0, size: { x: 8, y: 4, z: 0.25 }, sourceAssetIds: ['reference-1'] },
          { id: 'opening-left', label: 'opening-left', confidence: 1, kind: 'opening', position: { x: -3, y: 1.3, z: -3.8 }, rotationY: 0, size: { x: 1.4, y: 2.6, z: 0.16 }, sourceAssetIds: ['reference-1'] },
          { id: 'volume-stage', label: 'volume-stage', confidence: 1, kind: 'volume', position: { x: 2, y: 0.5, z: 0 }, rotationY: 0.4, size: { x: 2, y: 1, z: 2 }, sourceAssetIds: ['reference-1'] },
          { id: 'furniture-table', label: 'furniture-table', confidence: 1, kind: 'furniture', position: { x: -2, y: 0.45, z: 1 }, rotationY: -0.2, size: { x: 1.6, y: 0.9, z: 0.8 }, sourceAssetIds: ['reference-1'] },
          { id: 'prop-pedestal', label: 'prop-pedestal', confidence: 1, kind: 'prop', position: { x: 1, y: 0.6, z: 2 }, rotationY: 0, size: { x: 1, y: 1.2, z: 1 }, sourceAssetIds: ['reference-1'] },
          { id: 'reference-plane', label: 'reference-plane', confidence: 1, kind: 'referencePlane', position: { x: 4, y: 2, z: -2 }, rotationY: 0.2, size: { x: 3, y: 2, z: 0.08 }, sourceAssetIds: ['reference-1'] },
        ],
      },
    },
  }
}

function stateWithLowConfidenceWhitebox(): SpatialPrevisState {
  const fullWorld = stateWithWhitebox()
  return {
    ...fullWorld,
    scene: {
      ...fullWorld.scene,
      whitebox: {
        entities: fullWorld.scene.whitebox.entities.map((entity) => entity.id === 'wall-back'
          ? { ...entity, confidence: 0.45 }
          : entity),
      },
    },
  }
}

function stateWithoutWhitebox(): SpatialPrevisState {
  const fullWorld = stateWithWhitebox()
  return {
    ...fullWorld,
    scene: {
      ...fullWorld.scene,
      whitebox: { entities: [] },
    },
  }
}

function stateWithoutActors(): SpatialPrevisState {
  const fullWorld = stateWithWhitebox()
  return {
    ...fullWorld,
    masterTake: {
      ...fullWorld.masterTake,
      actorTracks: [],
    },
  }
}

function stateWithNearDegenerateCameraGuide(): SpatialPrevisState {
  const fullWorld = stateWithWhitebox()
  return {
    ...fullWorld,
    masterTake: {
      ...fullWorld.masterTake,
      // One frame deliberately eliminates the overview camera-path line. The target is
      // only 0.035 scene units away, leaving a sub-pixel guide rather than evidence for
      // the physical camera rig tested below.
      cameraTrack: {
        ...fullWorld.masterTake.cameraTrack,
        keyframes: [{
          id: 'camera-rig-single-frame',
          timeSec: 6,
          position: { x: 0, y: 1.8, z: 5 },
          target: { x: 0, y: 1.8, z: 4.965 },
          focalLengthMm: 50,
          intent: 'static',
        }],
      },
    },
  }
}

function stateWithoutCameraRig(): SpatialPrevisState {
  const rigWorld = stateWithNearDegenerateCameraGuide()
  return {
    ...rigWorld,
    masterTake: {
      ...rigWorld.masterTake,
      cameraTrack: {
        ...rigWorld.masterTake.cameraTrack,
        keyframes: [],
      },
    },
  }
}

let browser: Browser | null = null
let temporaryDirectory = ''
let bundlePath = ''
let stylesPath = ''

type Rectangle = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type RenderedViewportEvidence = {
  viewport: Rectangle
  livePreview: Rectangle
  canvases: Array<{
    bufferWidth: number
    bufferHeight: number
    rect: Rectangle
  }>
}

type ScreenshotPixelEvidence = {
  colorBuckets: number
  lumaRange: number
  samples: number
}

type NormalizedScreenshotCrop = {
  left: number
  top: number
  right: number
  bottom: number
}

type ScreenshotDifference = {
  comparedPixels: number
  changedPixels: number
  accumulatedColorDifference: number
  accumulatedLumaDifference: number
}

function worldPointInCanvas(point: Vec3, canvas: Rectangle) {
  const camera = new PerspectiveCamera(48, canvas.width / canvas.height, 0.1, 100)
  camera.position.set(10, 8, 12)
  camera.lookAt(0, 1, 0)
  camera.updateMatrixWorld()

  const projected = new Vector3(point.x, point.y, point.z).project(camera)
  return {
    x: canvas.left + ((projected.x + 1) / 2) * canvas.width,
    y: canvas.top + ((1 - projected.y) / 2) * canvas.height,
  }
}

const FEATURE_PIXEL_DELTA = 42
const FEATURE_LUMA_DELTA = 14
// Pixel-level floors are measured after a 42-channel/14-luma per-pixel filter, which
// excludes routine antialiasing. They sit below the observed solid-geometry deltas but
// above the contribution of the stable grid/background and the one-pixel guide lines.
const FEATURE_RENDER_FLOORS = {
  whiteboxOverview: { changedPixels: 25_000, accumulatedColorDifference: 3_000_000 },
  whiteboxLive: { changedPixels: 3_500, accumulatedColorDifference: 400_000 },
  actorOverview: { changedPixels: 1_400, accumulatedColorDifference: 250_000 },
  actorLive: { changedPixels: 800, accumulatedColorDifference: 150_000 },
  cameraRigOverview: { changedPixels: 1_000, accumulatedColorDifference: 200_000 },
}

function assertMaterialRenderDifference(
  difference: ScreenshotDifference,
  name: string,
  minimumChangedPixels: number,
  minimumAccumulatedColorDifference: number,
) {
  const summary = `${name}: ${difference.changedPixels}/${difference.comparedPixels} pixels changed, color delta ${difference.accumulatedColorDifference}, luma delta ${difference.accumulatedLumaDifference}`
  assert.ok(difference.changedPixels >= minimumChangedPixels, summary)
  assert.ok(difference.accumulatedColorDifference >= minimumAccumulatedColorDifference, summary)
}

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

function renderedHarnessSource() {
  const componentPath = path.resolve(process.cwd(), 'src/components/create/spatial-previs/SpatialPrevisViewport.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { Canvas } from '@react-three/fiber'
    import { SpatialPrevisViewport, SpatialPrevisWorldGeometry } from ${JSON.stringify(componentPath)}

    let root = null
    let latestState = null

    window.fetch = () => {
      throw new Error('SpatialPrevisViewport harness must not make authenticated API requests')
    }

    window.__spatialPrevisViewportHarness = {
      mount(state, disabled = true) {
        root?.unmount()
        const container = document.getElementById('root')
        container.replaceChildren()
        root = createRoot(container)
        root.render(React.createElement(SpatialPrevisViewport, {
          state,
          currentTimeSec: 6,
          disabled,
          onChange: (nextState) => { latestState = nextState },
        }))
      },
      mountRigProof(state, showCameraRig) {
        root?.unmount()
        const container = document.getElementById('root')
        container.replaceChildren()
        root = createRoot(container)
        root.render(React.createElement('div', { id: 'spatial-rig-proof-root' },
          React.createElement(Canvas, {
            camera: { position: [10, 8, 12], fov: 48, near: 0.1, far: 100 },
            dpr: [1, 1.5],
            gl: { antialias: true },
            style: { width: '100%', height: '100%' },
          }, React.createElement(SpatialPrevisWorldGeometry, {
            state,
            currentTimeSec: 6,
            sampledCamera: state.masterTake.cameraTrack.keyframes[0],
            manipulationEnabled: false,
            showCameraRig,
          })),
        ))
      },
      lastChange() {
        return latestState
      },
    }
  `
}

async function prepareRenderedViewport(page: Page) {
  await page.setContent('<!doctype html><html><head></head><body><div id="root"></div></body></html>')
  await page.addStyleTag({ path: stylesPath })
  await page.addStyleTag({ content: `
    html, body, #root { min-height: 100%; }
    body { min-width: 0; padding: 12px; }
    #root { width: 100%; min-height: calc(100vh - 24px); }
    #spatial-rig-proof-root { width: 100%; height: 520px; }
  ` })
  await page.addScriptTag({ path: bundlePath })
}

async function mountRenderedViewport(page: Page, state: SpatialPrevisState, expectedCanvases = 2, disabled = true) {
  await page.evaluate(({ nextState, nextDisabled }) => {
    window.__spatialPrevisViewportHarness.mount(nextState, nextDisabled)
  }, { nextState: state, nextDisabled: disabled })
  await page.waitForFunction(() => {
    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('[data-spatial-previs-viewport="true"] canvas'))
    return canvases.every((canvas) => canvas.width > 0 && canvas.height > 0 && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0)
  }, { polling: 'raf' })
  await page.waitForFunction((count) => document.querySelectorAll('[data-spatial-previs-viewport="true"] canvas').length === count, expectedCanvases)
  await page.waitForTimeout(150)
}

async function renderedViewportEvidence(page: Page): Promise<RenderedViewportEvidence> {
  return page.evaluate(`(() => {
    const viewport = document.querySelector('[data-spatial-previs-viewport="true"]')
    const livePreview = document.querySelector('[data-spatial-camera-preview="true"]')
    const canvases = Array.from(document.querySelectorAll('[data-spatial-previs-viewport="true"] canvas'))
    if (!viewport || !livePreview || canvases.length !== 2) throw new Error('Spatial previs viewport did not mount its overview and live canvases')

    const rectangle = (element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
    }
    const canvasSummary = (canvas) => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      if (!gl) throw new Error('Expected a WebGL context for spatial previs canvas')
      return {
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
        rect: rectangle(canvas),
      }
    }

    return {
      viewport: rectangle(viewport),
      livePreview: rectangle(livePreview),
      canvases: canvases.map(canvasSummary),
    }
  })()`) as Promise<RenderedViewportEvidence>
}

async function screenshotPixelEvidence(page: Page, screenshot: Buffer): Promise<ScreenshotPixelEvidence> {
  return page.evaluate(`(async () => {
    const base64 = ${JSON.stringify(screenshot.toString('base64'))}
    const image = new Image()
    image.src = 'data:image/png;base64,' + base64
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Unable to inspect spatial previs screenshot pixels')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const stride = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 40_000)))
    const colors = new Set()
    let samples = 0
    let minLuma = 255
    let maxLuma = 0
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const offset = (y * canvas.width + x) * 4
        const red = pixels[offset] ?? 0
        const green = pixels[offset + 1] ?? 0
        const blue = pixels[offset + 2] ?? 0
        const luma = Math.round(red * 0.2126 + green * 0.7152 + blue * 0.0722)
        minLuma = Math.min(minLuma, luma)
        maxLuma = Math.max(maxLuma, luma)
        colors.add((red >> 4) + ':' + (green >> 4) + ':' + (blue >> 4))
        samples += 1
      }
    }
    return { colorBuckets: colors.size, lumaRange: maxLuma - minLuma, samples }
  })()`) as Promise<ScreenshotPixelEvidence>
}

async function canvasScreenshots(page: Page, expectedCanvases: number) {
  const canvases = page.locator('[data-spatial-previs-viewport="true"] canvas')
  assert.equal(await canvases.count(), expectedCanvases, `expected ${expectedCanvases} WebGL canvases`)

  const screenshots: Buffer[] = []
  for (let index = 0; index < expectedCanvases; index += 1) {
    screenshots.push(await canvases.nth(index).screenshot())
  }
  return screenshots
}

async function screenshotPixelDifference(
  page: Page,
  baseline: Buffer,
  variant: Buffer,
  crop?: NormalizedScreenshotCrop,
): Promise<ScreenshotDifference> {
  return page.evaluate(`(async () => {
    const baseline = ${JSON.stringify(baseline.toString('base64'))}
    const variant = ${JSON.stringify(variant.toString('base64'))}
    const crop = ${JSON.stringify(crop)}
    const featurePixelDelta = ${FEATURE_PIXEL_DELTA}
    const featureLumaDelta = ${FEATURE_LUMA_DELTA}
    const decode = async (encoded) => {
      const image = new Image()
      image.src = 'data:image/png;base64,' + encoded
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Unable to decode spatial previs screenshot pixels')
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, canvas.width, canvas.height)
    }

    const [baselinePixels, variantPixels] = await Promise.all([decode(baseline), decode(variant)])
    if (baselinePixels.width !== variantPixels.width || baselinePixels.height !== variantPixels.height) {
      throw new Error('Spatial previs screenshots have different dimensions: ' + baselinePixels.width + 'x' + baselinePixels.height + ' vs ' + variantPixels.width + 'x' + variantPixels.height)
    }

    const { width, height } = baselinePixels
    const left = Math.floor((crop?.left ?? 0) * width)
    const top = Math.floor((crop?.top ?? 0) * height)
    const right = Math.ceil((crop?.right ?? 1) * width)
    const bottom = Math.ceil((crop?.bottom ?? 1) * height)
    if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) {
      throw new Error('Spatial previs screenshot crop is outside the canvas')
    }

    let changedPixels = 0
    let accumulatedColorDifference = 0
    let accumulatedLumaDifference = 0
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * width + x) * 4
        const redDifference = Math.abs(baselinePixels.data[offset] - variantPixels.data[offset])
        const greenDifference = Math.abs(baselinePixels.data[offset + 1] - variantPixels.data[offset + 1])
        const blueDifference = Math.abs(baselinePixels.data[offset + 2] - variantPixels.data[offset + 2])
        const colorDifference = redDifference + greenDifference + blueDifference
        const baselineLuma = baselinePixels.data[offset] * 0.2126 + baselinePixels.data[offset + 1] * 0.7152 + baselinePixels.data[offset + 2] * 0.0722
        const variantLuma = variantPixels.data[offset] * 0.2126 + variantPixels.data[offset + 1] * 0.7152 + variantPixels.data[offset + 2] * 0.0722
        const lumaDifference = Math.abs(baselineLuma - variantLuma)

        if (colorDifference >= featurePixelDelta || lumaDifference >= featureLumaDelta) {
          changedPixels += 1
          accumulatedColorDifference += colorDifference
          accumulatedLumaDifference += lumaDifference
        }
      }
    }

    return {
      comparedPixels: (right - left) * (bottom - top),
      changedPixels,
      accumulatedColorDifference,
      accumulatedLumaDifference,
    }
  })()`) as Promise<ScreenshotDifference>
}

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'spatial-previs-viewport-'))
  const entryPath = path.join(temporaryDirectory, 'entry.tsx')
  bundlePath = path.join(temporaryDirectory, 'bundle.js')
  stylesPath = path.join(temporaryDirectory, 'styles.css')
  await writeFile(entryPath, renderedHarnessSource(), 'utf8')

  const bundle = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    `--outfile=${bundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(bundle.status, 0, bundle.stderr || bundle.stdout)

  const styles = spawnSync(path.resolve(process.cwd(), 'node_modules/.bin/tailwindcss'), [
    '--input', path.resolve(process.cwd(), 'src/app/globals.css'),
    '--output', stylesPath,
    '--config', path.resolve(process.cwd(), 'tailwind.config.ts'),
    '--minify',
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(styles.status, 0, styles.stderr || styles.stdout)
  browser = await chromium.launch({ headless: true })
})

test.after(async () => {
  await browser?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test('renders an actual nonblank overview and live WebGL world at desktop and mobile sizes', async () => {
  assert.ok(browser)
  const viewportSizes = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]

  for (const viewportSize of viewportSizes) {
    const page = await browser.newPage({ viewport: viewportSize })
    const browserFailures: string[] = []
    const requests: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') browserFailures.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => browserFailures.push(`page: ${error.message}`))
    page.on('request', (request) => requests.push(request.url()))

    try {
      await prepareRenderedViewport(page)
      await mountRenderedViewport(page, stateWithWhitebox())
      const evidence = await renderedViewportEvidence(page)
      assert.equal(evidence.canvases.length, 2, `${viewportSize.name}: expected overview and live canvases`)

      const [overview, live] = evidence.canvases
      assert.ok(overview && live)
      for (const [name, canvas] of [['overview', overview], ['live', live]] as const) {
        assert.ok(canvas.bufferWidth > 0 && canvas.bufferHeight > 0, `${viewportSize.name} ${name}: zero-sized WebGL buffer`)
        assert.ok(canvas.rect.width > 0 && canvas.rect.height > 0, `${viewportSize.name} ${name}: zero-sized canvas layout`)
      }

      assert.ok(live.rect.left >= overview.rect.left && live.rect.top >= overview.rect.top, `${viewportSize.name}: live preview escapes overview bounds`)
      assert.ok(live.rect.right <= overview.rect.right && live.rect.bottom <= overview.rect.bottom, `${viewportSize.name}: live preview is not framed inside overview`)
      assert.ok(live.rect.left >= evidence.livePreview.left && live.rect.top >= evidence.livePreview.top, `${viewportSize.name}: live canvas escapes its preview frame`)
      assert.ok(live.rect.right <= evidence.livePreview.right && live.rect.bottom <= evidence.livePreview.bottom, `${viewportSize.name}: live canvas exceeds its preview frame`)
      assert.ok(live.rect.width >= 160 && live.rect.height >= 96, `${viewportSize.name}: live preview lost its usable overlay framing`)
      assert.ok(live.rect.width < overview.rect.width && live.rect.height < overview.rect.height, `${viewportSize.name}: live preview obscures the overview canvas`)

      const screenshots = await canvasScreenshots(page, 2)
      for (const [index, name] of ['overview', 'live'].entries()) {
        const screenshotBuffer = screenshots[index]
        assert.ok(screenshotBuffer)
        const pixels = await screenshotPixelEvidence(page, screenshotBuffer)
        assert.ok(pixels.lumaRange >= 24, `${viewportSize.name} ${name}: visible canvas pixels are too uniform`)
        assert.ok(pixels.colorBuckets >= 12, `${viewportSize.name} ${name}: visible canvas pixels lack scene detail`)
      }

      assert.deepEqual(requests, [], `${viewportSize.name}: viewport harness must not make API requests`)
      assert.deepEqual(browserFailures, [], `${viewportSize.name}: browser reported rendering errors`)
    } finally {
      await page.close()
    }
  }
})

test('changes actual overview and live WebGL pixels when whitebox or actor geometry is removed', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const browserFailures: string[] = []
  const requests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserFailures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserFailures.push(`page: ${error.message}`))
  page.on('request', (request) => requests.push(request.url()))

  try {
    await prepareRenderedViewport(page)
    await mountRenderedViewport(page, stateWithWhitebox())
    const fullWorld = await canvasScreenshots(page, 2)

    await mountRenderedViewport(page, stateWithoutWhitebox())
    const withoutWhitebox = await canvasScreenshots(page, 2)

    // Hold the local selection at camera in both actor variants so the overview cannot
    // count the selected-camera color as actor evidence.
    await mountRenderedViewport(page, stateWithWhitebox(), 2, false)
    await page.getByRole('button', { name: '相机' }).click()
    await page.waitForTimeout(150)
    const actorWorld = await canvasScreenshots(page, 2)

    await mountRenderedViewport(page, stateWithoutActors(), 2, false)
    const withoutActors = await canvasScreenshots(page, 2)

    const differences = {
      whiteboxOverview: await screenshotPixelDifference(page, fullWorld[0]!, withoutWhitebox[0]!),
      whiteboxLive: await screenshotPixelDifference(page, fullWorld[1]!, withoutWhitebox[1]!),
      actorOverview: await screenshotPixelDifference(page, actorWorld[0]!, withoutActors[0]!),
      actorLive: await screenshotPixelDifference(page, actorWorld[1]!, withoutActors[1]!),
    }
    assertMaterialRenderDifference(differences.whiteboxOverview, 'whitebox overview', FEATURE_RENDER_FLOORS.whiteboxOverview.changedPixels, FEATURE_RENDER_FLOORS.whiteboxOverview.accumulatedColorDifference)
    assertMaterialRenderDifference(differences.whiteboxLive, 'whitebox live', FEATURE_RENDER_FLOORS.whiteboxLive.changedPixels, FEATURE_RENDER_FLOORS.whiteboxLive.accumulatedColorDifference)
    assertMaterialRenderDifference(differences.actorOverview, 'actor overview', FEATURE_RENDER_FLOORS.actorOverview.changedPixels, FEATURE_RENDER_FLOORS.actorOverview.accumulatedColorDifference)
    assertMaterialRenderDifference(differences.actorLive, 'actor live', FEATURE_RENDER_FLOORS.actorLive.changedPixels, FEATURE_RENDER_FLOORS.actorLive.accumulatedColorDifference)

    assert.deepEqual(requests, [], 'feature-evidence harness must not make API requests')
    assert.deepEqual(browserFailures, [], 'feature-evidence harness reported rendering errors')
  } finally {
    await page.close()
  }
})

test('changes the overview crop around the physical camera rig against a no-camera baseline', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const browserFailures: string[] = []
  const requests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserFailures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserFailures.push(`page: ${error.message}`))
  page.on('request', (request) => requests.push(request.url()))

  try {
    await prepareRenderedViewport(page)
    await mountRenderedViewport(page, stateWithNearDegenerateCameraGuide())
    const withRig = (await canvasScreenshots(page, 2))[0]!

    await mountRenderedViewport(page, stateWithoutCameraRig(), 1)
    const withoutRig = (await canvasScreenshots(page, 1))[0]!

    // The fixed overview camera projects the rig at (0, 1.8, 5) into this central-left
    // region. The single-frame state has no camera path and a 0.035-unit target line, so
    // this crop cannot pass merely because overview guide/path lines changed.
    const difference = await screenshotPixelDifference(page, withRig, withoutRig, {
      left: 0.18,
      top: 0.36,
      right: 0.58,
      bottom: 0.78,
    })
    assertMaterialRenderDifference(
      difference,
      'physical camera rig overview crop',
      FEATURE_RENDER_FLOORS.cameraRigOverview.changedPixels,
      FEATURE_RENDER_FLOORS.cameraRigOverview.accumulatedColorDifference,
    )

    assert.deepEqual(requests, [], 'camera-rig harness must not make API requests')
    assert.deepEqual(browserFailures, [], 'camera-rig harness reported rendering errors')
  } finally {
    await page.close()
  }
})

test('renders the physical camera rig in the overview world only', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const rigState = stateWithNearDegenerateCameraGuide()
    await page.evaluate((state) => window.__spatialPrevisViewportHarness.mountRigProof(state, true), rigState)
    const rigProofCanvas = page.locator('#spatial-rig-proof-root canvas')
    await rigProofCanvas.waitFor()
    await page.waitForTimeout(150)
    const withRig = await rigProofCanvas.screenshot()

    await page.evaluate((state) => window.__spatialPrevisViewportHarness.mountRigProof(state, false), rigState)
    await rigProofCanvas.waitFor()
    await page.waitForTimeout(150)
    const withoutRig = await rigProofCanvas.screenshot()
    const difference = await screenshotPixelDifference(page, withRig, withoutRig)
    assertMaterialRenderDifference(
      difference,
      'overview camera rig visibility toggle',
      FEATURE_RENDER_FLOORS.cameraRigOverview.changedPixels,
      FEATURE_RENDER_FLOORS.cameraRigOverview.accumulatedColorDifference,
    )
  } finally {
    await page.close()
  }
})

test('moves the selected whitebox actor through an actual overview-canvas pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    const evidence = await renderedViewportEvidence(page)
    const overviewCanvas = evidence.canvases[0]?.rect
    assert.ok(overviewCanvas)

    const actorStart = worldPointInCanvas({ x: 0, y: 0.5, z: -1 }, overviewCanvas)
    const actorDestination = worldPointInCanvas({ x: 1.8, y: 0, z: -2.4 }, overviewCanvas)
    assert.ok(actorStart.x > overviewCanvas.left && actorStart.x < overviewCanvas.right)
    assert.ok(actorStart.y > overviewCanvas.top && actorStart.y < overviewCanvas.bottom)

    await page.mouse.move(actorStart.x, actorStart.y)
    await page.mouse.down()
    await page.mouse.move(actorDestination.x, actorDestination.y, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null)

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const changedActor = changed.masterTake.actorTracks[0]?.keyframes.find((keyframe) => keyframe.timeSec === 6)
    const originalActor = interactiveState.masterTake.actorTracks[0]?.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.ok(changedActor)
    assert.ok(originalActor)
    assert.notDeepEqual(changedActor.position, originalActor.position)
    assert.equal(changedActor.position.y, originalActor.position.y)
    assertOtherActorFramesUnchanged(changed, interactiveState, 'actor-track-lead')
    assert.deepEqual(changed.masterTake.cameraTrack, interactiveState.masterTake.cameraTrack)
    assert.equal(
      await page.locator('[data-spatial-previs-viewport="true"] canvas').first().evaluate((canvas) => getComputedStyle(canvas.parentElement ?? canvas).cursor),
      'grab',
    )
  } finally {
    await page.close()
  }
})

test('moves a selected whitebox solid through an actual overview-canvas pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)

    const solidStart = worldPointInCanvas({ x: 0, y: 3, z: -4 }, overviewCanvas)
    const solidDestination = worldPointInCanvas({ x: 4, y: 0, z: -2 }, overviewCanvas)
    await page.mouse.click(solidStart.x, solidStart.y)
    await page.getByText('当前：wall-back', { exact: true }).waitFor({ timeout: 3_000 })
    await page.mouse.move(solidStart.x, solidStart.y)
    await page.mouse.down()
    await page.mouse.move(solidDestination.x, solidDestination.y, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null, undefined, { timeout: 3_000 })

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const originalSolid = interactiveState.scene.whitebox.entities.find((entity) => entity.id === 'wall-back')
    const changedSolid = changed.scene.whitebox.entities.find((entity) => entity.id === 'wall-back')
    assert.ok(originalSolid)
    assert.ok(changedSolid)
    assert.notDeepEqual(changedSolid.position, originalSolid.position)
    assert.equal(changedSolid.position.y, originalSolid.position.y)
    assert.deepEqual(
      changed.scene.whitebox.entities.filter((entity) => entity.id !== 'wall-back'),
      interactiveState.scene.whitebox.entities.filter((entity) => entity.id !== 'wall-back'),
    )
    assert.deepEqual(changed.masterTake, interactiveState.masterTake)
    await page.getByText('当前：wall-back', { exact: true }).waitFor()
    assert.equal(
      await page.locator('[data-spatial-previs-viewport="true"] canvas').first().evaluate((canvas) => getComputedStyle(canvas.parentElement ?? canvas).cursor),
      'grab',
    )
  } finally {
    await page.close()
  }
})

test('raises the selected actor through an actual overview-canvas pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)

    const actorGuide = worldPointInCanvas({ x: 0, y: 1.55, z: -1 }, overviewCanvas)
    await page.mouse.move(actorGuide.x, actorGuide.y)
    await page.mouse.down()
    await page.mouse.move(actorGuide.x, actorGuide.y - 52, { steps: 4 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null)

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const changedActor = changed.masterTake.actorTracks[0]?.keyframes.find((keyframe) => keyframe.timeSec === 6)
    const originalActor = interactiveState.masterTake.actorTracks[0]?.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.ok(changedActor)
    assert.ok(originalActor)
    assert.equal(changedActor.position.x, originalActor.position.x)
    assert.equal(changedActor.position.z, originalActor.position.z)
    assert.ok(changedActor.position.y > originalActor.position.y)
    assertOtherActorFramesUnchanged(changed, interactiveState, 'actor-track-lead')
    assert.deepEqual(changed.masterTake.cameraTrack, interactiveState.masterTake.cameraTrack)
  } finally {
    await page.close()
  }
})

test('releases an actual overview pointer drag when the browser cancels it', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    await mountRenderedViewport(page, stateWithWhitebox(), 2, false)
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)
    const actorStart = worldPointInCanvas({ x: 0, y: 0.5, z: -1 }, overviewCanvas)
    const canvas = page.locator('[data-spatial-previs-viewport="true"] canvas').first()

    await page.mouse.move(actorStart.x, actorStart.y)
    await page.mouse.down()
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-spatial-previs-viewport="true"] canvas')
      return canvas && getComputedStyle(canvas.parentElement ?? canvas).cursor === 'grabbing'
    })
    await canvas.evaluate((element, point) => {
      element.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        clientX: point.x,
        clientY: point.y,
        pointerId: 1,
      }))
    }, actorStart)
    await page.waitForFunction(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-spatial-previs-viewport="true"] canvas')
      return canvas && getComputedStyle(canvas.parentElement ?? canvas).cursor === 'grab'
    })
  } finally {
    await page.mouse.up().catch(() => undefined)
    await page.close()
  }
})

test('moves the selected physical camera over the overview ground with a pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    await page.getByRole('button', { name: '相机', exact: true }).click()
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)

    const cameraBody = worldPointInCanvas({ x: 0, y: 1.98, z: 4.98 }, overviewCanvas)
    const cameraDestination = worldPointInCanvas({ x: 1.8, y: 0, z: 2.5 }, overviewCanvas)
    await page.mouse.move(cameraBody.x, cameraBody.y)
    await page.mouse.down()
    await page.mouse.move(cameraDestination.x, cameraDestination.y, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null)

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const changedCamera = changed.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    const originalCamera = interactiveState.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.ok(changedCamera)
    assert.ok(originalCamera)
    assert.notDeepEqual(changedCamera.position, originalCamera.position)
    assert.equal(changedCamera.position.y, originalCamera.position.y)
    assert.deepEqual(changedCamera.target, originalCamera.target)
    assert.equal(changedCamera.intent, originalCamera.intent)
    assertOtherCameraFramesUnchanged(changed, interactiveState)
  } finally {
    await page.close()
  }
})

test('raises the selected physical camera with an overview-canvas pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    await page.getByRole('button', { name: '相机', exact: true }).click()
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)

    const cameraGuide = worldPointInCanvas({ x: 0, y: 3.35, z: 5 }, overviewCanvas)
    await page.mouse.move(cameraGuide.x, cameraGuide.y)
    await page.mouse.down()
    await page.mouse.move(cameraGuide.x, cameraGuide.y - 52, { steps: 4 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null)

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const changedCamera = changed.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    const originalCamera = interactiveState.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.ok(changedCamera)
    assert.ok(originalCamera)
    assert.equal(changedCamera.position.x, originalCamera.position.x)
    assert.equal(changedCamera.position.z, originalCamera.position.z)
    assert.ok(changedCamera.position.y > originalCamera.position.y)
    assert.deepEqual(changedCamera.target, originalCamera.target)
    assert.equal(changedCamera.intent, originalCamera.intent)
    assertOtherCameraFramesUnchanged(changed, interactiveState)
  } finally {
    await page.close()
  }
})

test('moves the selected camera target through an actual overview-canvas pointer drag', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  try {
    await prepareRenderedViewport(page)
    const interactiveState = stateWithWhitebox()
    await mountRenderedViewport(page, interactiveState, 2, false)
    await page.getByRole('button', { name: '目标', exact: true }).click()
    const overviewCanvas = (await renderedViewportEvidence(page)).canvases[0]?.rect
    assert.ok(overviewCanvas)

    const targetStart = worldPointInCanvas({ x: 0, y: 1, z: -1 }, overviewCanvas)
    const targetDestination = worldPointInCanvas({ x: 1.8, y: 0, z: -2.4 }, overviewCanvas)
    await page.mouse.move(targetStart.x, targetStart.y)
    await page.mouse.down()
    await page.mouse.move(targetDestination.x, targetDestination.y, { steps: 5 })
    await page.mouse.up()
    await page.waitForFunction(() => window.__spatialPrevisViewportHarness.lastChange() !== null)

    const changed = await page.evaluate(() => window.__spatialPrevisViewportHarness.lastChange())
    assert.ok(changed)
    const changedCamera = changed.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    const originalCamera = interactiveState.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.ok(changedCamera)
    assert.ok(originalCamera)
    assert.notDeepEqual(changedCamera.target, originalCamera.target)
    assert.equal(changedCamera.target.y, originalCamera.target.y)
    assert.deepEqual(changedCamera.position, originalCamera.position)
    assert.equal(changedCamera.focalLengthMm, originalCamera.focalLengthMm)
    assert.equal(changedCamera.intent, 'pan-tilt')
    assertOtherCameraFramesUnchanged(changed, interactiveState)
  } finally {
    await page.close()
  }
})

function assertOtherCameraFramesUnchanged(next: SpatialPrevisState, source: SpatialPrevisState) {
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[0], source.masterTake.cameraTrack.keyframes[0])
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[2], source.masterTake.cameraTrack.keyframes[2])
}

function assertOtherActorFramesUnchanged(next: SpatialPrevisState, source: SpatialPrevisState, actorTrackId: string) {
  const nextTrack = next.masterTake.actorTracks.find((track) => track.id === actorTrackId)
  const sourceTrack = source.masterTake.actorTracks.find((track) => track.id === actorTrackId)
  assert.ok(nextTrack)
  assert.ok(sourceTrack)
  assert.deepEqual(nextTrack.keyframes[0], sourceTrack.keyframes[0])
  assert.deepEqual(nextTrack.keyframes[2], sourceTrack.keyframes[2])
}

describe('SpatialPrevisViewport', () => {
  test('announces low-confidence whitebox geometry as an editable advisory', () => {
    const markup = renderToStaticMarkup(createElement(SpatialPrevisViewport, {
      state: stateWithLowConfidenceWhitebox(),
      currentTimeSec: 6,
      onChange: () => undefined,
    }))

    assert.match(markup, /role="status"/)
    assert.match(markup, /aria-label="低置信度白模：1 个，仍可编辑"/)
    assert.match(markup, /低置信度 1/)
  })

  test('applies the stable whitebox ground-drag contract without touching take data', () => {
    const source = stateWithWhitebox()
    const next = applyWhiteboxGroundDrag(source, 'wall-back', { x: 4, z: -2 })
    const wall = next.scene.whitebox.entities.find((entity) => entity.id === 'wall-back')

    assert.deepEqual(wall?.position, { x: 4, y: 2, z: -2 })
    assert.equal(wall?.kind, 'wall')
    assert.equal(wall?.label, 'wall-back')
    assert.equal(wall?.confidence, 1)
    assert.deepEqual(wall?.size, { x: 8, y: 4, z: 0.25 })
    assert.equal(next.masterTake, source.masterTake)
  })

  test('resolves prop whitebox entities through the public material color helper', async () => {
    const spatialViewportModule = await import('./SpatialPrevisViewport') as {
      whiteboxEntityMaterialColor?: (kind: WhiteboxEntity['kind']) => string
    }

    assert.equal(typeof spatialViewportModule.whiteboxEntityMaterialColor, 'function')
    assert.equal(spatialViewportModule.whiteboxEntityMaterialColor?.('prop'), '#9a6149')
  })

  test('does not expose test-only whitebox markup sentinels', () => {
    assert.doesNotMatch(viewportSource, /data-spatial-(whitebox-world|camera-rig|live-camera|whitebox-entity)/)
  })

  test('keeps spatial markup contracts off Three primitives', () => {
    assert.doesNotMatch(viewportSource, /<mesh\b[^>]*data-spatial/)
    assert.doesNotMatch(viewportSource, /<group\b[^>]*data-spatial/)
    assert.doesNotMatch(viewportSource, /<Line\b[^>]*data-spatial/)
  })

  test('uses pointer-first spatial blocking instead of persistent transform-control squares', () => {
    assert.doesNotMatch(viewportSource, /TransformControls/)
    assert.match(viewportSource, /function DirectGroundDrag/)
    assert.match(viewportSource, /function VerticalDragGuide/)
    assert.match(viewportSource, /function CameraTargetDragHandle/)
    assert.match(viewportSource, /function pointerHandlers/)
    assert.match(viewportSource, /function DirectDragCancellationGuard/)
    assert.match(viewportSource, /addEventListener\('pointercancel'/)
    assert.match(viewportSource, /addEventListener\('lostpointercapture'/)
    assert.match(viewportSource, /spatialDirectHandle: 'vertical'/)
    assert.match(viewportSource, /spatialDirectHandle: 'camera-target'/)
    assert.match(viewportSource, /event\.ray\.intersectPlane/)
    assert.match(viewportSource, /applyActorGroundDrag/)
    assert.match(viewportSource, /applyCameraDollyDrag/)
    assert.match(viewportSource, /applyCameraTargetDrag/)
    assert.match(viewportSource, /onDragStateChange/)
  })

  test('keeps the physical camera rig out of the live preview world', () => {
    assert.match(
      viewportSource,
      /<SpatialPrevisWorldGeometry\s+state=\{state\}\s+currentTimeSec=\{currentTimeSec\}\s+sampledCamera=\{sampledCamera\}\s+manipulationEnabled=\{false\}\s+showCameraRig=\{false\}\s*\/>/,
    )
  })

  test('renders the spatial viewport contract and familiar local camera actions', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.equal(markup.match(/data-spatial-previs-viewport="([^"]+)"/)?.[1], 'true')
    assert.equal(markup.match(/data-spatial-camera-preview="([^"]+)"/)?.[1], 'true')
    assert.match(markup, /aria-label="推"/)
    assert.match(markup, /aria-label="跟"/)
  })

  test('keeps unavailable coverage advisory-only while camera actions and nudges remain editable', () => {
    const unavailableState: SpatialPrevisState = {
      ...state,
      scene: {
        ...state.scene,
        coverage: { mode: 'unavailable', cameraFreedom: 'disabled' },
      },
    }
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state: unavailableState, currentTimeSec: 6, onChange: () => undefined }),
    )
    const action = applySpatialCameraAction(unavailableState, 6, '推')
    const nudge = applySpatialNudge(unavailableState, {
      currentTimeSec: 6,
      selection: 'camera',
      axis: 'x+',
    })
    const [risk] = assessAuthoringRisks(
      unavailableState.scene.coverage,
      unavailableState.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.position),
    )

    assert.notEqual(action, unavailableState)
    assert.notEqual(nudge, unavailableState)
    assert.equal(risk?.blocking, false)
    assert.doesNotMatch(markup, /aria-label="推" disabled=""/)
  })

  test('declares literal true data-attribute values rather than boolean JSX attributes', () => {
    assert.match(viewportSource, /data-spatial-previs-viewport="true"/)
    assert.match(viewportSource, /data-spatial-camera-preview="true"/)
  })

  test('declares named world anchors for the real spatial scene', () => {
    assert.match(viewportSource, /场景原点/)
    assert.match(viewportSource, /相机覆盖参考/)
    assert.match(viewportSource, /label: track\.anchorId/)
    assert.match(viewportSource, /WorldAnchorMarker/)
  })

  test('renders a compact selector for every actor track', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state: stateWithTwoActors(), currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.match(markup, /aria-label="选择演员轨道"/)
    assert.match(markup, /value="actor-track-lead"/)
    assert.match(markup, /value="actor-track-support"/)
  })

  test('offers a compact add-person control when the previs has no actor track', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state: stateWithoutActors(), currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.match(markup, /aria-label="添加人物"/)
    assert.match(markup, />添加人物</)
  })

  test('renders accessible selected-keyframe nudge buttons and disables them without an exact keyframe', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 6, onChange: () => undefined }),
    )
    const noKeyframeMarkup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 5, onChange: () => undefined }),
    )

    assert.match(markup, /aria-label="演员关键帧微调"/)
    assert.match(markup, /type="button" aria-label="演员向 X 轴正向微调"/)
    assert.match(markup, /aria-label="演员向 Z 轴负向微调"/)
    assert.match(noKeyframeMarkup, /aria-label="演员向 X 轴正向微调" disabled=""/)
  })

  test('renders the sampled shared camera frame in the live preview', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 3, onChange: () => undefined }),
    )

    assert.match(markup, /42\.5 mm/)
    assert.match(markup, /3 s/)
  })

  test('keeps physical camera and lens semantics separate for every local action', () => {
    const actionState: SpatialPrevisState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        actorTracks: state.masterTake.actorTracks.map((track) => ({
          ...track,
          keyframes: track.keyframes.map((keyframe) => keyframe.timeSec === 6
            ? { ...keyframe, position: { x: 1, y: 0, z: -2 } }
            : keyframe),
        })),
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === 6
            ? { ...keyframe, intent: 'static' }
            : keyframe),
        },
      },
    }
    const original = actionState.masterTake.cameraTrack.keyframes[1]!

    const push = applySpatialCameraAction(actionState, 6, '推')
    const pushFrame = push.masterTake.cameraTrack.keyframes[1]!
    assert.notDeepEqual(pushFrame.position, original.position)
    assert.deepEqual(pushFrame.target, original.target)
    assert.equal(pushFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(pushFrame.intent, 'push')
    assertOtherCameraFramesUnchanged(push, actionState)

    const pull = applySpatialCameraAction(actionState, 6, '拉')
    const pullFrame = pull.masterTake.cameraTrack.keyframes[1]!
    assert.notDeepEqual(pullFrame.position, original.position)
    assert.deepEqual(pullFrame.target, original.target)
    assert.equal(pullFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(pullFrame.intent, 'pull')
    assertOtherCameraFramesUnchanged(pull, actionState)

    const panTilt = applySpatialCameraAction(actionState, 6, '摇')
    const panTiltFrame = panTilt.masterTake.cameraTrack.keyframes[1]!
    assert.deepEqual(panTiltFrame.position, original.position)
    assert.notDeepEqual(panTiltFrame.target, original.target)
    assert.equal(panTiltFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(panTiltFrame.intent, 'pan-tilt')
    assertOtherCameraFramesUnchanged(panTilt, actionState)

    const dolly = applySpatialCameraAction(actionState, 6, '移')
    const dollyFrame = dolly.masterTake.cameraTrack.keyframes[1]!
    const cameraDelta = {
      x: dollyFrame.position.x - original.position.x,
      y: dollyFrame.position.y - original.position.y,
      z: dollyFrame.position.z - original.position.z,
    }
    const targetDelta = {
      x: dollyFrame.target.x - original.target.x,
      y: dollyFrame.target.y - original.target.y,
      z: dollyFrame.target.z - original.target.z,
    }
    assert.notDeepEqual(dollyFrame.position, original.position)
    assert.deepEqual(targetDelta, cameraDelta)
    assert.equal(dollyFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(dollyFrame.intent, 'dolly')
    assertOtherCameraFramesUnchanged(dolly, actionState)

    const follow = applySpatialCameraAction(actionState, 6, '跟')
    const followFrame = follow.masterTake.cameraTrack.keyframes[1]!
    assert.notDeepEqual(followFrame.position, original.position)
    assert.notDeepEqual(followFrame.target, original.target)
    assert.equal(followFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(followFrame.intent, 'follow')
    assertOtherCameraFramesUnchanged(follow, actionState)

    const rise = applySpatialCameraAction(actionState, 6, '升')
    const riseFrame = rise.masterTake.cameraTrack.keyframes[1]!
    assert.equal(riseFrame.position.x, original.position.x)
    assert.equal(riseFrame.position.z, original.position.z)
    assert.equal(riseFrame.target.x, original.target.x)
    assert.equal(riseFrame.target.z, original.target.z)
    assert.ok(Math.abs(
      (riseFrame.position.y - original.position.y) - (riseFrame.target.y - original.target.y),
    ) < 1e-9)
    assert.ok(riseFrame.position.y > original.position.y)
    assert.equal(riseFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(riseFrame.intent, 'crane')
    assertOtherCameraFramesUnchanged(rise, actionState)

    const descend = applySpatialCameraAction(actionState, 6, '降')
    const descendFrame = descend.masterTake.cameraTrack.keyframes[1]!
    assert.ok(descendFrame.position.y < original.position.y)
    assert.ok(descendFrame.target.y < original.target.y)
    assert.equal(descendFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(descendFrame.intent, 'crane')
    assertOtherCameraFramesUnchanged(descend, actionState)
  })

  test('moves laterally with a stable horizontal fallback for vertical camera views', () => {
    for (const targetY of [9, -6]) {
      const verticalState: SpatialPrevisState = {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === 6
              ? {
                ...keyframe,
                position: { x: 3, y: 1, z: -4 },
                target: { x: 3, y: targetY, z: -4 },
                intent: 'static',
              }
              : keyframe),
          },
        },
      }
      const original = verticalState.masterTake.cameraTrack.keyframes[1]!
      const next = applySpatialCameraAction(verticalState, 6, '移')
      const nudged = next.masterTake.cameraTrack.keyframes[1]!
      const cameraDelta = {
        x: nudged.position.x - original.position.x,
        y: nudged.position.y - original.position.y,
        z: nudged.position.z - original.position.z,
      }
      const targetDelta = {
        x: nudged.target.x - original.target.x,
        y: nudged.target.y - original.target.y,
        z: nudged.target.z - original.target.z,
      }

      assert.ok(Math.abs(cameraDelta.x - 0.35) < 1e-9)
      assert.equal(cameraDelta.y, 0)
      assert.equal(cameraDelta.z, 0)
      assert.deepEqual(targetDelta, cameraDelta)
      assert.equal(nudged.focalLengthMm, original.focalLengthMm)
      assertOtherCameraFramesUnchanged(next, verticalState)
    }
  })

  test('updates only the selected actor track at an existing exact keyframe', async () => {
    const spatialViewportModule = await import('./SpatialPrevisViewport') as {
      updateSpatialActorPosition?: (
        state: SpatialPrevisState,
        actorTrackId: string,
        currentTimeSec: number,
        position: Vec3,
      ) => SpatialPrevisState
    }
    assert.equal(typeof spatialViewportModule.updateSpatialActorPosition, 'function')

    const source = stateWithTwoActors()
    const next = spatialViewportModule.updateSpatialActorPosition!(source, 'actor-track-support', 6, { x: 4, y: 0, z: -1 })

    assert.notEqual(next, source)
    assert.deepEqual(next.masterTake.actorTracks[0], source.masterTake.actorTracks[0])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[0], source.masterTake.actorTracks[1]?.keyframes[0])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[2], source.masterTake.actorTracks[1]?.keyframes[2])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[1]?.position, { x: 4, y: 0, z: -1 })
    assert.equal(spatialViewportModule.updateSpatialActorPosition!(source, 'actor-track-support', 5, { x: 4, y: 0, z: -1 }), source)
  })

  test('nudges only the selected existing actor, camera, or target keyframe', async () => {
    const spatialViewportModule = await import('./SpatialPrevisViewport') as {
      applySpatialNudge?: (state: SpatialPrevisState, input: {
        currentTimeSec: number
        selection: 'actor' | 'camera' | 'target'
        actorTrackId?: string
        axis: 'x+' | 'y+' | 'z-'
      }) => SpatialPrevisState
    }
    assert.equal(typeof spatialViewportModule.applySpatialNudge, 'function')

    const source = stateWithTwoActors()
    const actorNudge = spatialViewportModule.applySpatialNudge!(source, {
      currentTimeSec: 6,
      selection: 'actor',
      actorTrackId: 'actor-track-support',
      axis: 'x+',
    })
    assert.deepEqual(actorNudge.masterTake.actorTracks[0], source.masterTake.actorTracks[0])
    assert.deepEqual(actorNudge.masterTake.actorTracks[1]?.keyframes[0], source.masterTake.actorTracks[1]?.keyframes[0])
    assert.deepEqual(actorNudge.masterTake.actorTracks[1]?.keyframes[2], source.masterTake.actorTracks[1]?.keyframes[2])
    assert.equal(actorNudge.masterTake.actorTracks[1]?.keyframes[1]?.position.x, 2.1)
    assert.deepEqual(actorNudge.masterTake.cameraTrack, source.masterTake.cameraTrack)

    const cameraNudge = spatialViewportModule.applySpatialNudge!(source, {
      currentTimeSec: 6,
      selection: 'camera',
      axis: 'y+',
    })
    assert.deepEqual(cameraNudge.masterTake.actorTracks, source.masterTake.actorTracks)
    assertOtherCameraFramesUnchanged(cameraNudge, source)
    assert.ok(Math.abs(cameraNudge.masterTake.cameraTrack.keyframes[1]!.position.y - 1.9) < 1e-9)
    assert.deepEqual(cameraNudge.masterTake.cameraTrack.keyframes[1]!.target, source.masterTake.cameraTrack.keyframes[1]!.target)

    const targetNudge = spatialViewportModule.applySpatialNudge!(source, {
      currentTimeSec: 6,
      selection: 'target',
      axis: 'z-',
    })
    assert.deepEqual(targetNudge.masterTake.actorTracks, source.masterTake.actorTracks)
    assertOtherCameraFramesUnchanged(targetNudge, source)
    assert.deepEqual(targetNudge.masterTake.cameraTrack.keyframes[1]!.position, source.masterTake.cameraTrack.keyframes[1]!.position)
    assert.ok(Math.abs(targetNudge.masterTake.cameraTrack.keyframes[1]!.target.z + 1.1) < 1e-9)

    assert.equal(spatialViewportModule.applySpatialNudge!(source, {
      currentTimeSec: 5,
      selection: 'actor',
      actorTrackId: 'actor-track-support',
      axis: 'x+',
    }), source)
  })

  test('dispatches an exact selected-keyframe nudge through the button handler', async () => {
    const spatialViewportModule = await import('./SpatialPrevisViewport') as {
      dispatchSpatialNudge?: (input: {
        state: SpatialPrevisState
        currentTimeSec: number
        selection: 'actor'
        actorTrackId: string
        axis: 'x+'
        onChange: (next: SpatialPrevisState) => void
      }) => void
    }
    assert.equal(typeof spatialViewportModule.dispatchSpatialNudge, 'function')

    let changed: SpatialPrevisState | null = null
    spatialViewportModule.dispatchSpatialNudge!({
      state,
      currentTimeSec: 6,
      selection: 'actor',
      actorTrackId: 'actor-track-lead',
      axis: 'x+',
      onChange: (next) => { changed = next },
    })
    assert.ok(changed)
    assert.notEqual(changed, state)

    changed = null
    spatialViewportModule.dispatchSpatialNudge!({
      state,
      currentTimeSec: 5,
      selection: 'actor',
      actorTrackId: 'actor-track-lead',
      axis: 'x+',
      onChange: (next) => { changed = next },
    })
    assert.equal(changed, null)
  })

  test('dispatches a local camera action through the strip handler only when a keyframe exists', async () => {
    const spatialControlModule = await import('./SpatialCameraControlStrip') as {
      dispatchSpatialCameraAction?: (input: {
        state: SpatialPrevisState
        currentTimeSec: number
        action: '推'
        onChange: (next: SpatialPrevisState) => void
      }) => void
    }
    assert.equal(typeof spatialControlModule.dispatchSpatialCameraAction, 'function')

    let changed: SpatialPrevisState | null = null
    spatialControlModule.dispatchSpatialCameraAction!({
      state,
      currentTimeSec: 6,
      action: '推',
      onChange: (next) => { changed = next },
    })
    assert.ok(changed)
    assert.notEqual(changed, state)

    changed = null
    spatialControlModule.dispatchSpatialCameraAction!({
      state,
      currentTimeSec: 5,
      action: '推',
      onChange: (next) => { changed = next },
    })
    assert.equal(changed, null)
  })
})
