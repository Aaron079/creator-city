/**
 * Rendered node-scoping tests for the Canvas inspector.
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/canvas/inspector/CanvasRightInspector.test.tsx
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { chromium, type Browser, type Page } from '@playwright/test'

let browser: Browser | null = null
let bundlePath = ''
let tempDirectory = ''

async function findEsbuildBinary() {
  const pnpmDirectory = path.resolve(process.cwd(), '../..', 'node_modules/.pnpm')
  const entries = (await readdir(pnpmDirectory)).filter((entry) => entry.startsWith('tsx@')).sort()
  for (const entry of entries) {
    const candidate = path.join(pnpmDirectory, entry, 'node_modules/esbuild/bin/esbuild')
    try {
      await access(candidate)
      return candidate
    } catch {
      // Keep looking for the existing tsx installation that owns esbuild.
    }
  }
  throw new Error('Unable to locate the existing tsx esbuild binary')
}

function harnessSource() {
  const inspectorPath = path.resolve(process.cwd(), 'src/components/canvas/inspector/CanvasRightInspector.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { CanvasRightInspector } from ${JSON.stringify(inspectorPath)}

    const root = createRoot(document.getElementById('root'))
    const calls = []
    const sourceNode = {
      id: 'source-node', type: 'image', kind: 'image', title: 'Source Node', subtitle: '', prompt: '', model: '', providerId: '', stage: '', status: 'done', x: 0, y: 0, width: 240, height: 220, createdAt: 1,
    }
    const nodeA = {
      id: 'node-a', type: 'image', kind: 'image', title: 'Node A', subtitle: '', prompt: 'Prompt A', model: '', providerId: '', stage: '', status: 'done', x: 0, y: 0, width: 240, height: 220, createdAt: 1,
      metadataJson: { derivedFromToolLabel: 'Reference Extractor', generationDraft: { sourceNodeId: 'source-node', status: 'draft' } },
    }
    const nodeB = {
      id: 'node-b', type: 'video', kind: 'video', title: 'Node B', subtitle: '', prompt: 'Prompt B', model: '', providerId: '', stage: '', status: 'done', x: 0, y: 0, width: 240, height: 220, createdAt: 2,
      resultVideoUrl: 'data:video/mp4;base64,AAAA',
    }
    let activeNode = nodeA

    function render() {
      const isNodeA = activeNode.id === 'node-a'
      root.render(React.createElement(CanvasRightInspector, {
        node: activeNode,
        sourceNode: isNodeA ? sourceNode : undefined,
        incomingEdges: isNodeA ? [] : [{ id: 'edge-a-b', fromNodeId: 'node-a', toNodeId: 'node-b', label: 'input' }],
        outgoingEdges: isNodeA ? [{ id: 'edge-a-b', fromNodeId: 'node-a', toNodeId: 'node-b', label: 'output' }] : [],
        nodeTitleById: new Map([['source-node', 'Source Node'], ['node-a', 'Node A'], ['node-b', 'Node B']]),
        onClose() { calls.push('close:' + activeNode.id) },
        onOpenGenerationDialog() { calls.push('generate:' + activeNode.id) },
        onOpenPromptInspector(nodeId) { calls.push('prompt:' + nodeId) },
        onOpenCameraControl(nodeId) { calls.push('camera:' + nodeId) },
        onOpenSceneLighting(nodeId) { calls.push('lighting:' + nodeId) },
        onSelectNode(nodeId) { calls.push('select:' + nodeId) },
      }))
    }

    window.__canvasRightInspectorHarness = {
      renderNodeA() { activeNode = nodeA; render() },
      renderNodeB() { activeNode = nodeB; render() },
      calls() { return calls.slice() },
      clearCalls() { calls.length = 0 },
      unmount() { root.unmount() },
    }
    render()
  `
}

before(async () => {
  tempDirectory = await mkdtemp(path.join(tmpdir(), 'canvas-right-inspector-'))
  const entryPath = path.join(tempDirectory, 'entry.tsx')
  bundlePath = path.join(tempDirectory, 'bundle.js')
  await writeFile(entryPath, harnessSource(), 'utf8')
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

after(async () => {
  await browser?.close()
  if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true })
})

type CanvasRightInspectorHarness = {
  renderNodeA: () => void
  renderNodeB: () => void
  calls: () => string[]
  clearCalls: () => void
  unmount: () => void
}

async function renderPage() {
  assert.ok(browser)
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(5_000)
  await page.route('http://creator-city.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body><div id="root"></div></body></html>',
  }))
  await page.goto('http://creator-city.test/canvas')
  await page.addScriptTag({ path: bundlePath })
  await page.waitForSelector('text=Node A')
  return page
}

async function calls(page: Page) {
  return page.evaluate(() => (
    window as unknown as { __canvasRightInspectorHarness: CanvasRightInspectorHarness }
  ).__canvasRightInspectorHarness.calls())
}

async function invoke(page: Page, method: 'renderNodeA' | 'renderNodeB' | 'clearCalls') {
  await page.evaluate((nextMethod) => (
    window as unknown as { __canvasRightInspectorHarness: CanvasRightInspectorHarness }
  ).__canvasRightInspectorHarness[nextMethod](), method)
}

describe('CanvasRightInspector node-scoped controls', () => {
  test('keeps all controls scoped to the displayed node across rerenders', async () => {
    const page = await renderPage()

    assert.deepEqual(await calls(page), [], 'rendering must not open generation or invoke controls')
    await page.getByRole('button', { name: '摄影机' }).click()
    await page.getByRole('button', { name: '灯光' }).click()
    await page.getByRole('button', { name: '查看 Prompt' }).click()
    await page.getByRole('button', { name: '打开生成任务' }).click()
    await page.getByRole('button', { name: /定位来源：Source Node/ }).click()
    await page.getByRole('button', { name: /output · Node B/ }).click()
    assert.deepEqual(await calls(page), [
      'camera:node-a',
      'lighting:node-a',
      'prompt:node-a',
      'generate:node-a',
      'select:source-node',
      'select:node-b',
    ])

    await invoke(page, 'clearCalls')
    await invoke(page, 'renderNodeB')
    await page.waitForSelector('text=Node B')
    await page.getByRole('button', { name: '摄影机' }).click()
    await page.getByRole('button', { name: '灯光' }).click()
    await page.getByRole('button', { name: '查看 Prompt' }).click()
    await page.getByRole('button', { name: '打开生成任务' }).click()
    await page.getByRole('button', { name: /input · Node A/ }).click()
    assert.deepEqual(await calls(page), [
      'camera:node-b',
      'lighting:node-b',
      'prompt:node-b',
      'generate:node-b',
      'select:node-a',
    ])
    await page.close()
  })

  test('keeps video click-to-load and never mounts a player until the labelled action', async () => {
    const page = await renderPage()
    await invoke(page, 'renderNodeB')
    await page.waitForSelector('text=Node B')

    assert.equal(await page.locator('video').count(), 0)
    await page.getByRole('button', { name: '播放视频预览' }).click()
    assert.equal(await page.locator('video').count(), 1)
    assert.equal(await page.locator('video').evaluate((element) => (element as HTMLVideoElement).autoplay), false)
    await page.close()
  })
})
