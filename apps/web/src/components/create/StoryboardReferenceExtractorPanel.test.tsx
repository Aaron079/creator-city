import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser } from '@playwright/test'
import {
  getReferenceSelectionAction,
  processStoryboardReferenceSelection,
  StoryboardReferenceExtractorPanel,
  appendReferenceSelection,
  type ReferenceSelection,
} from './StoryboardReferenceExtractorPanel'

let browser: Browser | null = null
let bundlePath = ''
let temporaryDirectory = ''

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
  const panelPath = path.resolve(process.cwd(), 'src/components/create/StoryboardReferenceExtractorPanel.tsx')
  const source = JSON.stringify({
    ...sourceNode,
    mediaUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22%3E%3Crect width=%22320%22 height=%22180%22 fill=%22black%22/%3E%3C/svg%3E',
  })
  const selection = JSON.stringify({
    id: 'selection-uploaded-1',
    label: '参考图 1',
    order: 0,
    crop: { x: 10, y: 20, width: 120, height: 80 },
    status: 'uploaded',
    assetId: 'asset-reference-1',
    assetUrl: 'https://assets.example.test/reference-1.jpg',
  })
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { StoryboardReferenceExtractorPanel } from ${JSON.stringify(panelPath)}

    const sourceNode = ${source}
    const initialSelection = ${selection}
    let root = null
    const counts = { crop: 0, uploadFetch: 0, nodeCreate: 0 }

    function mount() {
      root?.unmount()
      document.getElementById('root').replaceChildren()
      root = createRoot(document.getElementById('root'))
      root.render(React.createElement(StoryboardReferenceExtractorPanel, {
        projectId: 'project-1',
        sourceNode,
        testInitialSelections: [initialSelection],
        testProcessingDependencies: {
          cropToBlob: async () => {
            counts.crop += 1
            return new Blob(['crop'], { type: 'image/png' })
          },
          fetchImpl: async () => {
            counts.uploadFetch += 1
            return new Response(null, { status: 500 })
          },
        },
        onCreateReferenceNode(reference, placementIndex, total) {
          counts.nodeCreate += 1
          if (reference.assetId !== 'asset-reference-1' || placementIndex !== 0 || total !== 1) {
            throw new Error('Unexpected retry reference arguments')
          }
          return 'node-reference-1'
        },
        onUpdateSourceSession() {},
        onClose() {},
      }))
    }

    window.__referenceExtractorHarness = {
      mount,
      counts: () => ({ ...counts }),
    }
  `
}

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'storyboard-reference-extractor-'))
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
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.equal(build.status, 0, build.stderr || build.stdout)
  browser = await chromium.launch({ headless: true })
})

test.after(async () => {
  await browser?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

const sourceNode = {
  id: 'image-node-1',
  title: '角色构图参考',
  prompt: '雨夜街头',
  mediaUrl: 'https://assets.example.test/reference.jpg',
  assetId: 'asset-source-1',
}

test('does not expose a confirmation action before an explicit freeform selection exists', () => {
  const markup = renderToStaticMarkup(createElement(StoryboardReferenceExtractorPanel, {
    projectId: 'project-1',
    sourceNode,
    onCreateReferenceNode: () => null,
    onUpdateSourceSession: () => {},
    onClose: () => {},
  }))

  assert.match(markup, /请选择或拖拽参考区域/)
  assert.match(markup, /<button[^>]*disabled=""[^>]*>确认提取<\/button>/)
})

test('keeps user-confirmed selections in a stable ordered label sequence', () => {
  const first = appendReferenceSelection([], {
    id: 'selection-1',
    label: '参考图 1',
    crop: { x: 10, y: 20, width: 120, height: 80 },
  })
  const second = appendReferenceSelection(first, {
    id: 'selection-2',
    label: '参考图 2',
    crop: { x: 160, y: 30, width: 90, height: 110 },
  })

  assert.deepEqual(second.map((item: ReferenceSelection) => item.label), ['参考图 1', '参考图 2'])
  assert.deepEqual(second.map((item: ReferenceSelection) => item.order), [0, 1])
})

test('retries only node creation for an uploaded reference without duplicating the upload', () => {
  const ready: ReferenceSelection = {
    id: 'selection-1',
    label: '参考图 1',
    order: 0,
    crop: { x: 10, y: 20, width: 120, height: 80 },
    status: 'ready',
  }
  const uploadedWithoutNode: ReferenceSelection = {
    ...ready,
    id: 'selection-1',
    status: 'uploaded',
    assetId: 'asset-reference-1',
    assetUrl: 'https://assets.example.test/reference-1.jpg',
  }
  const created: ReferenceSelection = { ...uploadedWithoutNode, createdNodeId: 'node-reference-1' }
  let uploadCount = 0
  let nodeCreateCount = 0

  for (const selection of [ready, uploadedWithoutNode, created]) {
    const action = getReferenceSelectionAction(selection)
    if (action === 'upload-and-create') uploadCount += 1
    if (action === 'create-node-retry') nodeCreateCount += 1
  }

  assert.equal(uploadCount, 1)
  assert.equal(nodeCreateCount, 1)
})

test('confirmation retry reuses the uploaded reference without cropping or uploading again', async () => {
  const uploadedWithoutNode: ReferenceSelection = {
    id: 'selection-1',
    label: '参考图 1',
    order: 0,
    crop: { x: 10, y: 20, width: 120, height: 80 },
    status: 'uploaded',
    assetId: 'asset-reference-1',
    assetUrl: 'https://assets.example.test/reference-1.jpg',
  }
  let cropCount = 0
  let uploadFetchCount = 0
  let nodeCreateCount = 0

  const result = await processStoryboardReferenceSelection({
    selection: uploadedWithoutNode,
    sourceAssetId: 'asset-source-1',
    sourceNodeId: 'image-node-1',
    extractionSessionId: 'session-1',
    image: {} as HTMLImageElement,
    imageSize: { width: 320, height: 180 },
    projectId: 'project-1',
    total: 1,
    onCreateReferenceNode: (reference, placementIndex, total) => {
      nodeCreateCount += 1
      assert.equal(reference.assetId, 'asset-reference-1')
      assert.equal(placementIndex, 0)
      assert.equal(total, 1)
      return 'node-reference-1'
    },
    cropToBlob: async () => {
      cropCount += 1
      return new Blob()
    },
    fetchImpl: async () => {
      uploadFetchCount += 1
      return new Response(null, { status: 500 })
    },
  })

  assert.equal(cropCount, 0)
  assert.equal(uploadFetchCount, 0)
  assert.equal(nodeCreateCount, 1)
  assert.equal(result.createdNodeId, 'node-reference-1')
  assert.equal(result.status, 'uploaded')
})

test('clicking 确认提取 retries an uploaded selection without a second crop or upload', async () => {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  try {
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ path: bundlePath })
    await page.evaluate(() => (
      window as unknown as { __referenceExtractorHarness: { mount: () => void } }
    ).__referenceExtractorHarness.mount())

    const confirm = page.getByRole('button', { name: '确认提取' })
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find((element) => element.textContent === '确认提取') as HTMLButtonElement | undefined
      return Boolean(button && !button.disabled)
    })
    await confirm.click()
    await page.waitForFunction(() => (
      window as unknown as {
        __referenceExtractorHarness: { counts: () => { nodeCreate: number } }
      }
    ).__referenceExtractorHarness.counts().nodeCreate === 1)

    const counts = await page.evaluate(() => (
      window as unknown as {
        __referenceExtractorHarness: {
          counts: () => { crop: number; uploadFetch: number; nodeCreate: number }
        }
      }
    ).__referenceExtractorHarness.counts())
    assert.deepEqual(counts, { crop: 0, uploadFetch: 0, nodeCreate: 1 })
    assert.deepEqual(pageErrors, [])
  } finally {
    await page.close()
  }
})
