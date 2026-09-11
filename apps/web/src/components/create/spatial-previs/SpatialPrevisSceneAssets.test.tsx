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
import type { SpatialAssetRole, SpatialSceneReference } from '@/lib/spatial-previs/types'
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
      failSecondUpload: () => void
      useImmediateUploads: () => void
      snapshot: () => {
        assetSetCalls: Array<{ references: SpatialSceneReference[]; role: SpatialAssetRole }>
        pendingCalls: boolean[]
        referenceCalls: SpatialSceneReference[][]
        uploadNames: string[]
      uploadCalls: number
      }
    }
  }
}

const props = {
  projectId: 'project-previs-01',
  references: [],
  assetSets: [],
  disabled: false,
  onReferencesChange: () => undefined,
  onAddAssetSet: () => undefined,
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
    let assetSets = []
    const state = {
      assetSetCalls: [],
      pendingCalls: [],
      referenceCalls: [],
      uploadNames: [],
      uploadCalls: 0,
      failOnSecondUpload: false,
      immediateUploads: false,
      resolveUpload: null,
      rejectUpload: null,
    }

    window.fetch = async () => new Response(JSON.stringify({ success: true, assets: [{
      id: 'asset-project-interior-01',
      projectId: 'project-previs-browser',
      title: 'Project interior reference',
      type: 'image',
      url: 'storage://creator-city-assets/project-previs-browser/interior-reference.jpg',
    }, {
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
        assetSets,
        disabled: false,
        onReferencesChange(next) {
          references = structuredClone(next)
          state.referenceCalls.push(structuredClone(next))
          renderPanel()
        },
        onAddAssetSet(selectedReferences, role) {
          const selected = structuredClone(selectedReferences)
          state.assetSetCalls.push({ references: selected, role })
          for (const reference of selected) {
            if (!references.some((item) => item.id === reference.id)) references.push(reference)
          }
          assetSets.push({
            id: 'asset-set-' + role + '-' + (assetSets.length + 1),
            role,
            referenceIds: selected.map((reference) => reference.id),
          })
          renderPanel()
        },
        onUpload(file) {
          state.uploadCalls += 1
          state.uploadNames.push(file.name)
          if (state.failOnSecondUpload && state.uploadCalls === 2) {
            state.failOnSecondUpload = false
            state.immediateUploads = true
            return Promise.reject(new Error('Second upload failed'))
          }
          if (state.failOnSecondUpload) {
            return Promise.resolve({
              id: 'scene-upload-' + file.name,
              assetId: 'asset-upload-' + file.name,
              title: file.name,
              mediaType: 'image',
              url: '/api/assets/asset-upload-' + file.name + '/file',
              source: 'upload',
            })
          }
          if (state.immediateUploads) {
            return Promise.resolve({
              id: 'scene-upload-' + file.name,
              assetId: 'asset-upload-' + file.name,
              title: file.name,
              mediaType: 'image',
              url: '/api/assets/asset-upload-' + file.name + '/file',
              source: 'upload',
            })
          }
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
      assetSets = []
      state.assetSetCalls = []
      state.pendingCalls = []
      state.referenceCalls = []
      state.uploadNames = []
      state.uploadCalls = 0
      state.failOnSecondUpload = false
      state.immediateUploads = false
      state.resolveUpload = null
      state.rejectUpload = null
      renderPanel()
    }

    window.__spatialPrevisSceneAssetsHarness = {
      mount,
      resolveUpload: () => state.resolveUpload?.(),
      rejectUpload: () => state.rejectUpload?.(),
      failSecondUpload: () => { state.failOnSecondUpload = true },
      useImmediateUploads: () => { state.immediateUploads = true },
      snapshot: () => structuredClone({
        assetSetCalls: state.assetSetCalls,
        pendingCalls: state.pendingCalls,
        referenceCalls: state.referenceCalls,
        uploadNames: state.uploadNames,
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
    assetSets: [{
      id: 'asset-set-scene-1',
      role: 'scene',
      referenceIds: ['scene-project-01', 'scene-project-02'],
    }],
  }))
  const compactControl = markup.match(/<button[^>]*aria-label="添加场景资产"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ''

  assert.match(compactControl, /Rain-soaked alley/)
  assert.match(compactControl, /2 assets/)
  assert.match(compactControl, /场景/)
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

test('uploads every selected file sequentially and preserves selection order', async () => {
  type UploadFiles = (
    files: readonly File[],
    upload: (file: File) => Promise<SpatialSceneReference>,
  ) => Promise<SpatialSceneReference[]>
  const uploadSceneAssetFiles = (sceneAssetsModule as unknown as {
    uploadSceneAssetFiles?: UploadFiles
  }).uploadSceneAssetFiles
  const files = [
    new File(['front'], 'front.jpg', { type: 'image/jpeg' }),
    new File(['left'], 'left.jpg', { type: 'image/jpeg' }),
    new File(['right'], 'right.jpg', { type: 'image/jpeg' }),
  ]
  const calls: string[] = []
  let activeUploads = 0
  let maxActiveUploads = 0

  assert.equal(typeof uploadSceneAssetFiles, 'function')
  const uploaded = await uploadSceneAssetFiles?.(files, async (file) => {
    calls.push(file.name)
    activeUploads += 1
    maxActiveUploads = Math.max(maxActiveUploads, activeUploads)
    await new Promise((resolve) => setTimeout(resolve, 1))
    activeUploads -= 1
    return {
      id: `scene-upload-${file.name}`,
      assetId: `asset-${file.name}`,
      title: file.name,
      mediaType: 'image',
      url: `/api/assets/asset-${file.name}/file`,
      source: 'upload',
    }
  })

  assert.deepEqual(calls, ['front.jpg', 'left.jpg', 'right.jpg'])
  assert.equal(maxActiveUploads, 1)
  assert.deepEqual(uploaded?.map((reference) => reference.title), calls)
})

test('preserves uploaded prefixes and remaining files in a typed batch failure', async () => {
  type UploadFiles = (
    files: readonly File[],
    upload: (file: File) => Promise<SpatialSceneReference>,
  ) => Promise<SpatialSceneReference[]>
  const uploadSceneAssetFiles = (sceneAssetsModule as unknown as {
    uploadSceneAssetFiles?: UploadFiles
  }).uploadSceneAssetFiles
  const files = [
    new File(['first'], 'first.jpg', { type: 'image/jpeg' }),
    new File(['second'], 'second.jpg', { type: 'image/jpeg' }),
  ]
  const uploadedReference = {
    id: 'scene-upload-first',
    assetId: 'asset-first',
    title: 'first.jpg',
    mediaType: 'image' as const,
    url: '/api/assets/asset-first/file',
    source: 'upload' as const,
  }

  assert.equal(typeof uploadSceneAssetFiles, 'function')
  await assert.rejects(
    () => uploadSceneAssetFiles!(files, async (file) => {
      if (file.name === 'second.jpg') throw new Error('Second upload failed')
      return uploadedReference
    }),
    (error: unknown) => {
      const failure = error as {
        name?: string
        uploadedReferences?: SpatialSceneReference[]
        remainingFiles?: File[]
      }
      assert.equal(failure.name, 'SpatialSceneAssetUploadFailure')
      assert.deepEqual(failure.uploadedReferences, [uploadedReference])
      assert.deepEqual(failure.remainingFiles?.map((file) => file.name), ['second.jpg'])
      return true
    },
  )
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
      assetSetCalls: [],
      pendingCalls: [true],
      referenceCalls: [],
      uploadNames: ['scene-reference.jpg'],
      uploadCalls: 1,
    })
    assert.equal(await page.getByRole('button', { name: '添加场景资产' }).isDisabled(), true)
    assert.equal(await dropzone.getAttribute('aria-disabled'), 'true')
    assert.equal(await input.isDisabled(), true)

    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.resolveUpload())
    await page.getByText('拖放或选择图片 / 视频').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      assetSetCalls: [{ references: [uploadedReference], role: 'scene' }],
      pendingCalls: [true, false],
      referenceCalls: [],
      uploadNames: ['scene-reference.jpg'],
      uploadCalls: 1,
    })
    assert.equal(await page.getByRole('button', { name: '添加场景资产' }).isEnabled(), true)
    assert.equal(await dropzone.getAttribute('aria-disabled'), 'false')
  } finally {
    await page.close()
  }
})

test('adds one default scene set for an ordered multi-angle upload batch', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)
    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.useImmediateUploads())
    await page.locator('input[type="file"]').setInputFiles([
      { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('front') },
      { name: 'left.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('left') },
      { name: 'right.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('right') },
    ])

    await page.getByText('拖放或选择图片 / 视频').waitFor()
    const snapshot = await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot())
    assert.deepEqual(snapshot.pendingCalls, [true, false])
    assert.deepEqual(snapshot.uploadNames, ['front.jpg', 'left.jpg', 'right.jpg'])
    assert.equal(snapshot.assetSetCalls.length, 1)
    assert.equal(snapshot.assetSetCalls[0]?.role, 'scene')
    assert.deepEqual(
      snapshot.assetSetCalls[0]?.references.map((reference) => reference.title),
      ['front.jpg', 'left.jpg', 'right.jpg'],
    )
  } finally {
    await page.close()
  }
})

test('groups a successful upload prefix and retries only the failed remainder', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)
    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.failSecondUpload())
    await page.locator('input[type="file"]').setInputFiles([
      { name: 'first.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('first') },
      { name: 'second.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('second') },
    ])

    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').textContent() ?? '', /Second upload failed/)
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      assetSetCalls: [{
        references: [{
          id: 'scene-upload-first.jpg',
          assetId: 'asset-upload-first.jpg',
          title: 'first.jpg',
          mediaType: 'image',
          url: '/api/assets/asset-upload-first.jpg/file',
          source: 'upload',
        }],
        role: 'scene',
      }],
      pendingCalls: [true, false],
      referenceCalls: [],
      uploadNames: ['first.jpg', 'second.jpg'],
      uploadCalls: 2,
    })

    await page.getByRole('button', { name: '重试剩余文件' }).click()
    await page.getByText('拖放或选择图片 / 视频').waitFor()
    const snapshot = await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot())
    assert.deepEqual(snapshot.pendingCalls, [true, false, true, false])
    assert.deepEqual(snapshot.uploadNames, ['first.jpg', 'second.jpg', 'second.jpg'])
    assert.equal(snapshot.assetSetCalls.length, 2)
    assert.deepEqual(snapshot.assetSetCalls[1]?.references.map((reference) => reference.title), ['second.jpg'])
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
      assetSetCalls: [],
      pendingCalls: [true],
      referenceCalls: [],
      uploadNames: ['scene-reference-failed.jpg'],
      uploadCalls: 1,
    })
    await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.rejectUpload())
    await page.getByRole('alert').waitFor()
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      assetSetCalls: [],
      pendingCalls: [true, false],
      referenceCalls: [],
      uploadNames: ['scene-reference-failed.jpg'],
      uploadCalls: 1,
    })
  } finally {
    await page.close()
  }
})

test('shows library assets first and adds selected media as one chosen-role set', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  try {
    await mountSceneAssets(page)
    const libraryAsset = page.getByRole('button', { name: 'Library street reference' })
    await libraryAsset.waitFor()

    assert.deepEqual(
      await page.locator('[aria-label="场景图片和视频素材"] > p').allTextContents(),
      ['资产库', '本项目'],
    )
    assert.equal(await page.getByRole('group', { name: '素材角色' }).count(), 0)

    await libraryAsset.click()
    const roleGroup = page.getByRole('group', { name: '素材角色' })
    await roleGroup.waitFor()
    assert.equal(await roleGroup.getByRole('button', { name: '场景' }).getAttribute('aria-pressed'), 'true')
    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      assetSetCalls: [],
      pendingCalls: [],
      referenceCalls: [],
      uploadNames: [],
      uploadCalls: 0,
    })

    await roleGroup.getByRole('button', { name: '道具' }).click()
    await libraryAsset.click()
    assert.equal(await page.getByRole('group', { name: '素材角色' }).count(), 0)
    await libraryAsset.click()
    assert.equal(await roleGroup.getByRole('button', { name: '场景' }).getAttribute('aria-pressed'), 'true')
    await roleGroup.getByRole('button', { name: '道具' }).click()
    await page.getByRole('button', { name: '添加素材组' }).click()

    assert.deepEqual(await page.evaluate(() => window.__spatialPrevisSceneAssetsHarness.snapshot()), {
      assetSetCalls: [{
        references: [{
          id: 'scene-library-asset-library-street-01',
          assetId: 'asset-library-street-01',
          title: 'Library street reference',
          mediaType: 'image',
          url: '/api/assets/asset-library-street-01/file',
          source: 'library',
        }],
        role: 'prop',
      }],
      pendingCalls: [],
      referenceCalls: [],
      uploadNames: [],
      uploadCalls: 0,
    })
  } finally {
    await page.close()
  }
})
