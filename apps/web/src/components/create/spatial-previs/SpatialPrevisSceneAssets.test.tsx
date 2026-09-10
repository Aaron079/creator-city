/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisSceneAssets.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import test from 'node:test'
import path from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { SpatialSceneReference } from '@/lib/spatial-previs/types'
import * as sceneAssetsModule from './SpatialPrevisSceneAssets'
import {
  addSpatialSceneReference,
  removeSpatialSceneReference,
  spatialSceneReferenceFromProjectAsset,
  SpatialPrevisSceneAssets,
} from './SpatialPrevisSceneAssets'

Object.assign(globalThis, { React })

declare global {
  interface Window {
    __spatialPrevisSceneAssetsHarness: {
      mount: () => void
      rejectUpload: () => void
      resolveUpload: () => void
      snapshot: () => {
        pendingCalls: boolean[]
        referenceCalls: SpatialSceneReference[][]
        uploadCalls: number
      }
    }
  }
}

const props = {
  projectId: 'project-previs-01',
  references: [],
  disabled: false,
  onReferencesChange: () => undefined,
  onUpload: async () => ({
    id: 'scene-upload-01',
    assetId: 'asset-upload-01',
    title: 'Scene upload',
    mediaType: 'image' as const,
    url: '/api/assets/asset-upload-01/file',
    source: 'upload' as const,
  }),
}

const uploadedReference: SpatialSceneReference = {
  id: 'scene-upload-browser-01',
  assetId: 'asset-upload-browser-01',
  title: 'Browser upload',
  mediaType: 'image',
  url: '/api/assets/asset-upload-browser-01/file',
  source: 'upload',
}

let browser: Browser | null = null
let temporaryDirectory = ''
let bundlePath = ''

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
  const componentPath = path.resolve(process.cwd(), 'src/components/create/spatial-previs/SpatialPrevisSceneAssets.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { SpatialPrevisSceneAssets } from ${JSON.stringify(componentPath)}

    const uploadedReference = ${JSON.stringify(uploadedReference)}
    let root = null
    let references = []
    const state = {
      pendingCalls: [],
      referenceCalls: [],
      uploadCalls: 0,
      resolveUpload: null,
      rejectUpload: null,
    }

    window.fetch = async () => new Response(JSON.stringify({ success: true, assets: [{
      id: 'asset-library-street-01',
      projectId: 'project-previous-work',
      title: 'Library street reference',
      type: 'image',
      url: 'storage://creator-city-assets/library/street-reference.jpg',
    }] }), {
      headers: { 'content-type': 'application/json' },
    })

    function renderPanel() {
      root.render(React.createElement(SpatialPrevisSceneAssets, {
        projectId: 'project-previs-browser',
        references,
        disabled: false,
        onReferencesChange(next) {
          references = structuredClone(next)
          state.referenceCalls.push(structuredClone(next))
          renderPanel()
        },
        onUpload() {
          state.uploadCalls += 1
          return new Promise((resolve, reject) => {
            state.resolveUpload = () => resolve(uploadedReference)
            state.rejectUpload = () => reject(new Error('Browser upload failed'))
          })
        },
        onUploadPending(isPending) {
          state.pendingCalls.push(isPending)
        },
      }))
    }

    function mount() {
      root?.unmount()
      document.getElementById('root').replaceChildren()
      root = createRoot(document.getElementById('root'))
      references = []
      state.pendingCalls = []
      state.referenceCalls = []
      state.uploadCalls = 0
      state.resolveUpload = null
      state.rejectUpload = null
      renderPanel()
    }

    window.__spatialPrevisSceneAssetsHarness = {
      mount,
      resolveUpload: () => state.resolveUpload?.(),
      rejectUpload: () => state.rejectUpload?.(),
      snapshot: () => structuredClone({
        pendingCalls: state.pendingCalls,
        referenceCalls: state.referenceCalls,
        uploadCalls: state.uploadCalls,
      }),
    }
  `
}

async function mountSceneAssets(page: Page) {
  await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ path: bundlePath })
  await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.mount())
  await page.getByRole('button', { name: '添加场景资产' }).waitFor()
  await page.getByRole('button', { name: '添加场景资产' }).click()
  await page.locator('[data-scene-asset-dropzone="true"]').waitFor()
}

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'spatial-previs-scene-assets-'))
  const entryPath = path.join(temporaryDirectory, 'entry.tsx')
  bundlePath = path.join(temporaryDirectory, 'bundle.js')
  await writeFile(entryPath, renderedHarnessSource(), 'utf8')
  const build = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    `--outfile=${bundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  browser = await chromium.launch({ headless: true })
})

test.after(async () => {
  await browser?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test('renders one compact scene-assets entry instead of a persistent asset panel', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisSceneAssets, props))

  assert.equal((markup.match(/aria-label="添加场景资产"/g) ?? []).length, 1)
  assert.match(markup, /data-scene-asset-dropzone="true"/)
  assert.doesNotMatch(markup, /项目素材\s*<\/h2>/)
})

test('summarizes the first selected scene asset and asset count in its compact control', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisSceneAssets, {
    ...props,
    references: [
      {
        id: 'scene-project-01',
        assetId: 'asset-01',
        title: 'Rain-soaked alley',
        mediaType: 'image',
        url: '/api/assets/asset-01/file',
        source: 'project',
      },
      {
        id: 'scene-project-02',
        assetId: 'asset-02',
        title: 'Close-up reference',
        mediaType: 'video',
        url: '/api/assets/asset-02/file',
        source: 'project',
      },
    ],
  }))
  const compactControl = markup.match(/<button[^>]*aria-label="添加场景资产"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ''

  assert.match(compactControl, /Rain-soaked alley/)
  assert.match(compactControl, /2 assets/)
  assert.doesNotMatch(compactControl, /Scene assets|Close-up reference/)
})

test('maps safe project media assets and updates selected references without duplicates', () => {
  const reference = spatialSceneReferenceFromProjectAsset({
    id: 'asset-video-01',
    title: '  Establishing take  ',
    type: 'video',
    url: 'storage://creator-city-assets/project-previs-01/establishing.mp4',
  })

  assert.deepEqual(reference, {
    id: 'scene-project-asset-video-01',
    assetId: 'asset-video-01',
    title: 'Establishing take',
    mediaType: 'video',
    url: '/api/assets/asset-video-01/file',
    source: 'project',
  })
  assert.equal(spatialSceneReferenceFromProjectAsset({
    id: 'asset-audio-01',
    title: 'Room tone',
    type: 'audio',
    url: 'https://cdn.example.test/room-tone.mp3',
  }), null)

  assert.ok(reference)
  const selected = addSpatialSceneReference([], reference)
  assert.equal(addSpatialSceneReference(selected, reference), selected)
  assert.deepEqual(removeSpatialSceneReference(selected, reference.id), [])
})

test('merges a completed upload into references current after the upload starts', () => {
  type UploadMerge = (references: readonly SpatialSceneReference[], reference: SpatialSceneReference) => SpatialSceneReference[]
  const mergeUploadedSpatialSceneReference = (sceneAssetsModule as unknown as {
    mergeUploadedSpatialSceneReference?: UploadMerge
  }).mergeUploadedSpatialSceneReference
  const referencesAtUploadStart: SpatialSceneReference[] = [{
    id: 'scene-project-removed',
    assetId: 'asset-removed',
    title: 'Removed while uploading',
    mediaType: 'image',
    url: '/api/assets/asset-removed/file',
    source: 'project',
  }]
  const latestReferences: SpatialSceneReference[] = [{
    id: 'scene-project-added',
    assetId: 'asset-added',
    title: 'Added while uploading',
    mediaType: 'video',
    url: '/api/assets/asset-added/file',
    source: 'project',
  }]
  const uploadedReference: SpatialSceneReference = {
    id: 'scene-upload-finished',
    assetId: 'asset-upload-finished',
    title: 'Completed upload',
    mediaType: 'image',
    url: '/api/assets/asset-upload-finished/file',
    source: 'upload',
  }

  assert.notDeepEqual(latestReferences, referencesAtUploadStart)
  assert.equal(typeof mergeUploadedSpatialSceneReference, 'function')
  assert.deepEqual(mergeUploadedSpatialSceneReference?.(latestReferences, uploadedReference), [
    latestReferences[0],
    uploadedReference,
  ])
})

test('closes scene-asset interactions while an upload is in progress', () => {
  type InteractionGate = (disabled: boolean, isUploading: boolean) => boolean
  const isSceneAssetInteractionDisabled = (sceneAssetsModule as unknown as {
    isSceneAssetInteractionDisabled?: InteractionGate
  }).isSceneAssetInteractionDisabled

  assert.equal(typeof isSceneAssetInteractionDisabled, 'function')
  assert.equal(isSceneAssetInteractionDisabled?.(false, false), false)
  assert.equal(isSceneAssetInteractionDisabled?.(true, false), true)
  assert.equal(isSceneAssetInteractionDisabled?.(false, true), true)
})

test('reports the real upload lifecycle and updates references after a successful controlled upload', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)
    const input = page.locator('input[type="file"]')
    const dropzone = page.locator('[data-scene-asset-dropzone="true"]')

    await input.setInputFiles({
      name: 'scene-reference.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('scene-reference'),
    })
    await page.getByText('上传中…').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      pendingCalls: [true],
      referenceCalls: [],
      uploadCalls: 1,
    })
    assert.equal(await page.getByRole('button', { name: '添加场景资产' }).isDisabled(), true)
    assert.equal(await dropzone.getAttribute('aria-disabled'), 'true')
    assert.equal(await input.isDisabled(), true)

    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.resolveUpload())
    await page.getByText('拖放或选择图片 / 视频').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      pendingCalls: [true, false],
      referenceCalls: [[uploadedReference]],
      uploadCalls: 1,
    })
    assert.equal(await page.getByRole('button', { name: '添加场景资产' }).isEnabled(), true)
    assert.equal(await dropzone.getAttribute('aria-disabled'), 'false')
  } finally {
    await page.close()
  }
})

test('does not update references when a controlled upload rejects', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)
    const input = page.locator('input[type="file"]')

    await input.setInputFiles({
      name: 'scene-reference-failed.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('scene-reference-failed'),
    })
    await page.getByText('上传中…').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      pendingCalls: [true],
      referenceCalls: [],
      uploadCalls: 1,
    })
    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.rejectUpload())
    await page.getByRole('alert').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      pendingCalls: [true, false],
      referenceCalls: [],
      uploadCalls: 1,
    })
  } finally {
    await page.close()
  }
})

test('shows and selects an existing media asset from the account library', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)

    const libraryAsset = page.getByRole('button', { name: 'Library street reference' })
    await libraryAsset.waitFor()
    await libraryAsset.click()

    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      pendingCalls: [],
      referenceCalls: [[{
        id: 'scene-library-asset-library-street-01',
        assetId: 'asset-library-street-01',
        title: 'Library street reference',
        mediaType: 'image',
        url: '/api/assets/asset-library-street-01/file',
        source: 'library',
      }]],
      uploadCalls: 0,
    })
  } finally {
    await page.close()
  }
})
