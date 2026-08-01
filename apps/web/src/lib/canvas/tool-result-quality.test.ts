import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser } from '@playwright/test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ABComparePanel } from '@/components/create/ABComparePanel'
import { AnnotationPanel } from '@/components/create/AnnotationPanel'
import { AssetVariantPlannerPanel } from '@/components/create/AssetVariantPlannerPanel'
import { ColorGradePalettePanel } from '@/components/create/ColorGradePalettePanel'
import { ContinuityCheckerPanel } from '@/components/create/ContinuityCheckerPanel'
import { KeyframeExtractorPanel } from '@/components/create/KeyframeExtractorPanel'
import { StoryboardGridSplitPanel } from '@/components/create/StoryboardGridSplitPanel'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { analyzeContinuity, buildContinuityReportText } from './continuity-check'
import {
  abCompareQuality,
  annotationQuality,
  colorGradeQuality,
  continuityQuality,
  gridSplitQuality,
  keyframeQuality,
  variantPlannerQuality,
} from './tool-result-quality'

function countQualityStrips(markup: string) {
  return (markup.match(/data-testid="tool-result-quality-strip"/g) ?? []).length
}

function qualityStripMarkup(markup: string) {
  return markup.match(/<section[^>]*data-testid="tool-result-quality-strip"[\s\S]*?<\/section>/)?.[0] ?? ''
}

function makeCanvasNode(
  overrides: Pick<VisualCanvasNode, 'id' | 'kind' | 'type'> & Partial<VisualCanvasNode>,
): VisualCanvasNode {
  return {
    title: '',
    subtitle: '',
    prompt: '',
    model: '',
    providerId: '',
    stage: '',
    status: 'idle',
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    createdAt: 0,
    ...overrides,
  }
}

globalThis.React = React

let browser: Browser | null = null
let clientBundlePath = ''
let clientTempDirectory = ''
let colorGradeClientBundlePath = ''

type ColorGradeHarnessState = {
  sourceNode: { prompt: string }
  applyRequests: Array<Array<{ nodeId: string; prompt: string }>>
  createRequests: Array<{ sourceNodeId: string; kind: string; prompt: string; cssFilter: string }>
}

declare global {
  interface Window {
    __colorGradeTestState?: ColorGradeHarnessState
    __renderColorGradeHarness?: (acknowledged: boolean) => void
  }
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

function clientHarnessSource() {
  const annotationPanelPath = path.resolve(process.cwd(), 'src/components/create/AnnotationPanel.tsx')
  const abComparePanelPath = path.resolve(process.cwd(), 'src/components/create/ABComparePanel.tsx')
  const keyframePanelPath = path.resolve(process.cwd(), 'src/components/create/KeyframeExtractorPanel.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { AnnotationPanel } from ${JSON.stringify(annotationPanelPath)}
    import { ABComparePanel } from ${JSON.stringify(abComparePanelPath)}
    import { KeyframeExtractorPanel } from ${JSON.stringify(keyframePanelPath)}

    const sourceNode = {
      id: 'image-1',
      title: '角色参考',
      mediaUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3C/svg%3E',
      metadataJson: {
        annotations: {
          version: 1,
          items: [{
            id: 'annotation-1',
            type: 'rect',
            color: '#ffcc00',
            strokeWidth: 3,
            points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
            createdAt: '2026-01-01T00:00:00.000Z',
          }],
        },
      },
    }

    const comparableNodes = [
      {
        id: 'image-a', type: 'image', kind: 'image', title: '版本 A', subtitle: '',
        prompt: '晴天中的城市街头', model: '', providerId: '', stage: '', status: 'idle',
        x: 0, y: 0, width: 320, height: 220, createdAt: 0,
      },
      {
        id: 'image-b', type: 'image', kind: 'image', title: '版本 B', subtitle: '',
        prompt: '雨夜中的城市街头', model: '', providerId: '', stage: '', status: 'idle',
        x: 0, y: 0, width: 320, height: 220, createdAt: 0,
      },
    ]

    const requestOnlyVideoNode = {
      id: 'video-request', type: 'video', kind: 'video', title: '镜头 08', subtitle: '',
      prompt: '下一镜头草案', model: '', providerId: '', stage: '', status: 'idle',
      x: 0, y: 0, width: 320, height: 220, createdAt: 0,
    }

    const extractableVideoNode = {
      ...requestOnlyVideoNode,
      id: 'video-extract',
      title: '镜头 09',
      resultVideoUrl: 'data:video/mp4;base64,',
    }
    const secondExtractableVideoNode = {
      ...extractableVideoNode,
      id: 'video-extract-next',
      title: '镜头 10',
    }
    const mode = (globalThis as typeof globalThis & { __toolQualityPanelMode?: string }).__toolQualityPanelMode
    const panel = mode === 'ab'
      ? React.createElement(ABComparePanel, {
          nodes: comparableNodes,
          onFocusNode() {},
          onClose() {},
        })
      : mode === 'keyframe' || mode === 'keyframe-extract'
        ? React.createElement(KeyframeExtractorPanel, {
            nodes: mode === 'keyframe-extract'
              ? [extractableVideoNode, secondExtractableVideoNode]
              : [requestOnlyVideoNode],
            onCreateNode() {},
            onFocusNode() {},
            onClose() {},
          })
        : React.createElement(AnnotationPanel, {
            sourceNode,
            onSave() {},
            onClose() {},
          })

    createRoot(document.getElementById('root')).render(panel)
  `
}

function colorGradeClientHarnessSource() {
  const panelPath = path.resolve(process.cwd(), 'src/components/create/ColorGradePalettePanel.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { ColorGradePalettePanel } from ${JSON.stringify(panelPath)}

    type TestState = {
      sourceNode: { prompt: string }
      applyRequests: Array<Array<{ nodeId: string; prompt: string }>>
      createRequests: Array<{ sourceNodeId: string; kind: string; prompt: string; cssFilter: string }>
    }

    declare global {
      interface Window {
        __colorGradeTestState?: TestState
        __renderColorGradeHarness?: (acknowledged: boolean) => void
      }
    }

    const sourceNode = {
      id: 'image-1',
      kind: 'image',
      title: '主视觉',
      prompt: 'cinematic product still',
      resultImageUrl: 'https://example.com/reference.png',
    }
    const testState: TestState = { sourceNode, applyRequests: [], createRequests: [] }
    const root = createRoot(document.getElementById('root'))

    function render(acknowledged: boolean) {
      root.render(React.createElement(ColorGradePalettePanel, {
        key: acknowledged ? 'acknowledged' : 'pending',
        nodes: [sourceNode],
        onApplyGrade(updates) {
          testState.applyRequests.push(updates)
          return { acknowledged }
        },
        onCreateGradeNode(request) {
          testState.createRequests.push(request)
          return { acknowledged }
        },
        onClose() {},
        defaultSelectedNodeId: 'image-1',
      }))
    }

    window.__colorGradeTestState = testState
    window.__renderColorGradeHarness = render
    render(false)
  `
}

before(async () => {
  clientTempDirectory = await mkdtemp(path.join(process.cwd(), '.annotation-quality-'))
  assert.equal(path.dirname(clientTempDirectory), process.cwd())
  const entryPath = path.join(clientTempDirectory, 'entry.tsx')
  clientBundlePath = path.join(clientTempDirectory, 'bundle.js')
  await writeFile(entryPath, clientHarnessSource(), 'utf8')
  const build = spawnSync(await findEsbuildBinary(), [
    entryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    `--outfile=${clientBundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(build.status, 0, build.stderr || build.stdout)

  const colorGradeEntryPath = path.join(clientTempDirectory, 'color-grade-entry.tsx')
  colorGradeClientBundlePath = path.join(clientTempDirectory, 'color-grade-bundle.js')
  await writeFile(colorGradeEntryPath, colorGradeClientHarnessSource(), 'utf8')
  const colorGradeBuild = spawnSync(await findEsbuildBinary(), [
    colorGradeEntryPath,
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--jsx=automatic',
    `--outfile=${colorGradeClientBundlePath}`,
    `--tsconfig=${path.resolve(process.cwd(), 'tsconfig.json')}`,
    '--define:process.env.NODE_ENV="test"',
  ], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(colorGradeBuild.status, 0, colorGradeBuild.stderr || colorGradeBuild.stdout)
  browser = await chromium.launch({ headless: true })
})

type ClientPanelMode = 'ab' | 'keyframe' | 'keyframe-extract'

async function renderClientPanel(mode: ClientPanelMode) {
  assert.ok(browser)
  const page = await browser.newPage()
  await page.setContent('<div id="root"></div>')
  await page.evaluate((panelMode) => {
    ;(globalThis as typeof globalThis & { __toolQualityPanelMode?: string }).__toolQualityPanelMode = panelMode
    if (panelMode === 'keyframe-extract') {
      document.addEventListener('error', (event) => {
        if (event.target instanceof HTMLVideoElement) event.stopImmediatePropagation()
      }, true)
    }
  }, mode)
  await page.addScriptTag({ path: clientBundlePath })
  if (mode === 'keyframe-extract') {
    const video = page.locator('video')
    await video.waitFor({ state: 'attached', timeout: 2_000 })
    await video.evaluate((element) => {
      Object.defineProperties(element, {
        duration: { configurable: true, value: 8 },
        videoWidth: { configurable: true, value: 640 },
        videoHeight: { configurable: true, value: 360 },
      })
      element.dispatchEvent(new Event('loadedmetadata', { bubbles: true }))
    })
    await page.getByRole('button', { name: '预览当前帧' }).waitFor({ state: 'visible', timeout: 2_000 })
  }
  return page
}

after(async () => {
  await browser?.close()
  if (clientTempDirectory) await rm(clientTempDirectory, { recursive: true, force: true })
})

test('keeps saved annotations completed after client image dimensions load', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: clientBundlePath })
  const image = page.locator('img')
  await image.waitFor()
  await image.evaluate((element) => {
    Object.defineProperties(element, {
      naturalWidth: { configurable: true, value: 640 },
      naturalHeight: { configurable: true, value: 360 },
    })
    element.dispatchEvent(new Event('load', { bubbles: true }))
  })
  await page.waitForTimeout(50)

  const summaryText = await page.locator('[data-testid="tool-result-quality-strip"]').textContent()
  assert.match(summaryText ?? '', /标注已保存/)
  assert.doesNotMatch(summaryText ?? '', /存在未保存修改/)
  await page.close()
})

test('reports an A/B winner only after the user selects one', async () => {
  const page = await renderClientPanel('ab')
  const strip = page.locator('[data-testid="tool-result-quality-strip"]')

  await strip.waitFor()
  assert.doesNotMatch(await strip.textContent() ?? '', /已选择结果/)
  await page.locator('button[title="标记为推荐版本"]').first().click()
  assert.match(await strip.textContent() ?? '', /已选择 版本 A 作为更优版本/)
  await page.close()
})

test('reports a keyframe draft request without asserting node persistence', async () => {
  const page = await renderClientPanel('keyframe')
  const strip = page.locator('[data-testid="tool-result-quality-strip"]')

  await strip.waitFor()
  await page.getByRole('button', { name: '创建图片节点草案' }).click()
  const summaryText = await strip.textContent()
  assert.match(summaryText ?? '', /草案请求已发出/)
  assert.match(summaryText ?? '', /已请求创建图片草案节点/)
  assert.doesNotMatch(summaryText ?? '', /草案节点已创建/)
  await page.close()
})

test('shows keyframe extraction progress before browser canvas work runs', async () => {
  const page = await renderClientPanel('keyframe-extract')
  const strip = page.locator('[data-testid="tool-result-quality-strip"]')

  await page.evaluate(() => {
    const callbacks: FrameRequestCallback[] = []
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback)
      return callbacks.length
    }
    ;(globalThis as typeof globalThis & { __releaseFrame?: () => void }).__releaseFrame = () => {
      callbacks.shift()?.(performance.now())
    }
  })
  const extractButton = page.getByRole('button', { name: '预览当前帧' })
  await extractButton.click({ timeout: 2_000 })
  await strip.getByText('正在提取', { exact: true }).waitFor({ timeout: 2_000 })
  await page.evaluate(() => {
    ;(globalThis as typeof globalThis & { __releaseFrame?: () => void }).__releaseFrame?.()
  })
  await page.close()
})

test('ignores a pending keyframe extraction after the selected video changes', async () => {
  const page = await renderClientPanel('keyframe-extract')
  const strip = page.locator('[data-testid="tool-result-quality-strip"]')

  await page.evaluate(() => {
    const callbacks: FrameRequestCallback[] = []
    window.requestAnimationFrame = (callback) => {
      callbacks.push(callback)
      return callbacks.length
    }
    ;(globalThis as typeof globalThis & { __releaseFrame?: () => void }).__releaseFrame = () => {
      callbacks.shift()?.(performance.now())
    }
  })
  const extractButton = page.getByRole('button', { name: '预览当前帧' })
  await extractButton.click({ timeout: 2_000 })
  await page.locator('select').selectOption('video-extract-next')
  await strip.getByText('尚未提取', { exact: true }).waitFor({ timeout: 2_000 })
  await page.evaluate(() => {
    ;(globalThis as typeof globalThis & { __releaseFrame?: () => void }).__releaseFrame?.()
  })

  const summaryText = await strip.textContent()
  assert.match(summaryText ?? '', /镜头 10/)
  assert.match(summaryText ?? '', /尚未提取浏览器关键帧/)
  assert.doesNotMatch(summaryText ?? '', /本地帧预览可用|正在提取/)
  await page.close()
})
test('renders one quality strip in each image tool panel', () => {
  const annotationMarkup = renderToStaticMarkup(createElement(AnnotationPanel, {
    sourceNode: {
      id: 'image-1',
      title: '角色参考',
      mediaUrl: 'https://example.com/reference.png',
      metadataJson: {
        annotations: {
          version: 1,
          items: [{
            id: 'annotation-1',
            type: 'rect',
            color: '#ffcc00',
            strokeWidth: 3,
            points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
            createdAt: '2026-01-01T00:00:00.000Z',
          }],
        },
      },
    },
    onSave: () => {},
    onClose: () => {},
  }))
  const gridMarkup = renderToStaticMarkup(createElement(StoryboardGridSplitPanel, {
    projectId: 'project-1',
    sourceNode: {
      id: 'image-1',
      title: '分镜源图',
      mediaUrl: 'https://example.com/storyboard.png',
      assetId: 'asset-1',
    },
    onClose: () => {},
    onCreateCellNode: () => null,
    onUpdateSourceSession: () => {},
  }))

  assert.equal(countQualityStrips(annotationMarkup), 1)
  assert.match(annotationMarkup, /标注已保存/)
  assert.equal(countQualityStrips(gridMarkup), 1)
})

test('renders one informational color-grade quality strip before previewing', () => {
  const markup = renderToStaticMarkup(createElement(ColorGradePalettePanel, {
    nodes: [{ id: 'image-1', kind: 'image', title: '主视觉' }],
    onApplyGrade: () => ({ acknowledged: false }),
    onCreateGradeNode: () => ({ acknowledged: false }),
    onClose: () => {},
    defaultSelectedNodeId: 'image-1',
  }))
  const stripMarkup = qualityStripMarkup(markup)

  assert.equal(countQualityStrips(markup), 1)
  assert.match(stripMarkup, /尚未调色/)
  assert.doesNotMatch(stripMarkup, /<button/)
})

test('reports color-grade completion only after a parent acknowledgement', async () => {
  assert.ok(browser)
  const page = await browser.newPage()
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: colorGradeClientBundlePath })

  const strip = page.locator('[data-testid="tool-result-quality-strip"]')
  await strip.waitFor({ timeout: 2_000 })
  await page.getByRole('button', { name: '预览 Prompt' }).click()
  await strip.getByText('预览可用', { exact: true }).waitFor({ timeout: 2_000 })
  assert.match(await strip.textContent() ?? '', /本地调色预览已就绪/)
  assert.match(await strip.textContent() ?? '', /CSS 仅用于本地预览/)

  await page.getByRole('button', { name: '追加到当前 Prompt' }).click()
  await strip.getByText('证据已发出提示词更新请求，等待外部确认', { exact: true }).waitFor({ timeout: 2_000 })
  const afterApply = await page.evaluate(() => window.__colorGradeTestState)
  assert.ok(afterApply)
  assert.equal(afterApply.applyRequests.length, 1)
  const [applyRequest] = afterApply.applyRequests
  assert.ok(applyRequest)
  const [applyUpdate] = applyRequest
  assert.ok(applyUpdate)
  assert.equal(applyUpdate.nodeId, 'image-1')
  assert.match(applyUpdate.prompt, /^cinematic product still\n\n\[Color Grade Palette\]/)
  assert.equal(afterApply.sourceNode.prompt, 'cinematic product still')
  assert.match(await strip.textContent() ?? '', /预览可用/)
  assert.doesNotMatch(await strip.textContent() ?? '', /已附加到现有提示词/)

  await page.evaluate(() => window.__renderColorGradeHarness?.(true))
  await page.getByRole('button', { name: '预览 Prompt' }).click()
  await strip.getByText('预览可用', { exact: true }).waitFor({ timeout: 2_000 })
  await page.getByRole('button', { name: '追加到当前 Prompt' }).click()
  await strip.getByText('说明已附加', { exact: true }).waitFor({ timeout: 2_000 })
  const afterApplyAcknowledgement = await page.evaluate(() => window.__colorGradeTestState)
  assert.ok(afterApplyAcknowledgement)
  assert.equal(afterApplyAcknowledgement.applyRequests.length, 2)
  assert.equal(afterApplyAcknowledgement.sourceNode.prompt, 'cinematic product still')

  await page.getByRole('button', { name: '应用调色到画布' }).click()
  await strip.getByText('草案节点已创建', { exact: true }).waitFor({ timeout: 2_000 })
  const afterCreate = await page.evaluate(() => window.__colorGradeTestState)
  assert.ok(afterCreate)
  assert.equal(afterCreate.createRequests.length, 1)
  const [createRequest] = afterCreate.createRequests
  assert.ok(createRequest)
  assert.deepEqual(Object.keys(createRequest).sort(), ['cssFilter', 'kind', 'prompt', 'sourceNodeId'])
  assert.equal(createRequest.sourceNodeId, 'image-1')
  assert.equal(createRequest.kind, 'image')
  assert.match(createRequest.prompt, /^cinematic product still\n\n\[Color Grade Palette\]/)
  assert.equal(afterCreate.sourceNode.prompt, 'cinematic product still')
  assert.match(await strip.textContent() ?? '', /已创建调色草案节点/)
  assert.equal(await strip.locator('button').count(), 0)
  await page.close()
})

test('marks color grading unavailable when no source node is selected', () => {
  const markup = renderToStaticMarkup(createElement(ColorGradePalettePanel, {
    nodes: [],
    onApplyGrade: () => ({ acknowledged: false }),
    onClose: () => {},
  }))

  assert.equal(countQualityStrips(markup), 1)
  assert.match(markup, /未选择可调色节点/)
})

test('renders one truthful quality strip in each director tool panel', () => {
  const promptOnlyNode = makeCanvasNode({
    id: 'prompt-only',
    kind: 'text',
    type: 'text',
    title: '',
    prompt: '城市夜景中的角色独白',
  })
  const firstComparableNode = makeCanvasNode({
    id: 'image-a',
    kind: 'image',
    type: 'image',
    title: '版本 A',
    prompt: '晴天中的城市街头',
  })
  const secondComparableNode = makeCanvasNode({
    id: 'image-b',
    kind: 'image',
    type: 'image',
    title: '版本 B',
    prompt: '雨夜中的城市街头',
  })
  const videoNode = makeCanvasNode({
    id: 'video-1',
    kind: 'video',
    type: 'video',
    title: '镜头 07',
    resultVideoUrl: 'https://example.com/shot-07.mp4',
  })

  const variantMarkup = renderToStaticMarkup(createElement(AssetVariantPlannerPanel, {
    node: promptOnlyNode,
    canvasPrompt: '',
    canInsert: true,
    onInsert: () => {},
    onCreateNode: () => {},
    onClose: () => {},
  }))
  const compareMarkup = renderToStaticMarkup(createElement(ABComparePanel, {
    nodes: [firstComparableNode, secondComparableNode],
    onFocusNode: () => {},
    onClose: () => {},
  }))
  const keyframeMarkup = renderToStaticMarkup(createElement(KeyframeExtractorPanel, {
    nodes: [videoNode],
    onCreateNode: () => {},
    onFocusNode: () => {},
    onClose: () => {},
  }))
  const unavailableKeyframeMarkup = renderToStaticMarkup(createElement(KeyframeExtractorPanel, {
    nodes: [makeCanvasNode({
      id: 'video-prompt-only',
      kind: 'video',
      type: 'video',
      title: '仅提示词视频',
      prompt: '尚未生成的视频设想',
    })],
    onCreateNode: () => {},
    onFocusNode: () => {},
    onClose: () => {},
  }))

  assert.equal(countQualityStrips(variantMarkup), 1)
  assert.match(variantMarkup, /规划可用/)
  assert.match(qualityStripMarkup(variantMarkup), /未命名节点/)
  assert.match(variantMarkup, /提示词上下文/)
  assert.doesNotMatch(variantMarkup, /缺少可用资产/)
  assert.equal(countQualityStrips(compareMarkup), 1)
  assert.match(compareMarkup, /对比版本已就绪，尚未选择结果/)
  assert.equal(countQualityStrips(keyframeMarkup), 1)
  assert.match(keyframeMarkup, /尚未提取浏览器关键帧/)
  assert.equal(countQualityStrips(unavailableKeyframeMarkup), 1)
  assert.match(unavailableKeyframeMarkup, /需要可用视频才能提取关键帧/)
})

test('renders distinct A/B comparison states for insufficient and same selections', () => {
  const onlyComparableNode = makeCanvasNode({
    id: 'image-a',
    kind: 'image',
    type: 'image',
    title: '版本 A',
    prompt: '晴天中的城市街头',
  })
  const secondComparableNode = makeCanvasNode({
    id: 'image-b',
    kind: 'image',
    type: 'image',
    title: '版本 B',
    prompt: '雨夜中的城市街头',
  })

  const insufficientMarkup = renderToStaticMarkup(createElement(ABComparePanel, {
    nodes: [onlyComparableNode],
    onFocusNode: () => {},
    onClose: () => {},
  }))
  const samePairMarkup = renderToStaticMarkup(createElement(ABComparePanel, {
    nodes: [onlyComparableNode, secondComparableNode],
    initialNodeAId: onlyComparableNode.id,
    initialNodeBId: onlyComparableNode.id,
    onFocusNode: () => {},
    onClose: () => {},
  }))

  assert.equal(countQualityStrips(insufficientMarkup), 1)
  assert.match(insufficientMarkup, /至少需要两个可比较节点/)
  assert.equal(countQualityStrips(samePairMarkup), 1)
  assert.match(samePairMarkup, /A 和 B 选择了同一个节点/)
})

test('keeps a detected grid layout pending before any crop upload', () => {
  const summary = gridSplitQuality({
    sourceLabel: '分镜源图',
    layoutLabel: '3 x 3',
    uploadedCount: 0,
    createdChildCount: 0,
    hasUploadError: false,
    isProcessing: false,
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.resultLabel, /尚未上传裁切/)
  assert.doesNotMatch(summary.resultLabel, /子节点已创建/)
})

test('keeps uploaded grid crops pending until a child node exists', () => {
  const summary = gridSplitQuality({
    sourceLabel: '分镜源图',
    layoutLabel: '2 x 2',
    uploadedCount: 4,
    createdChildCount: 0,
    hasUploadError: false,
    isProcessing: false,
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.resultLabel, /4 个裁切已入库/)
  assert.doesNotMatch(summary.resultLabel, /子节点已创建/)
})

test('recognizes grid child creation only from created child evidence', () => {
  const summary = gridSplitQuality({
    sourceLabel: '分镜源图',
    layoutLabel: '2 x 2',
    uploadedCount: 4,
    createdChildCount: 2,
    hasUploadError: false,
    isProcessing: false,
  })

  assert.equal(summary.status, 'completed')
  assert.match(summary.resultLabel, /已创建 2 个子节点/)
})

test('reports grid upload errors and processing from crop state', () => {
  const failed = gridSplitQuality({
    sourceLabel: '分镜源图',
    layoutLabel: '2 x 2',
    uploadedCount: 1,
    createdChildCount: 0,
    hasUploadError: true,
    isProcessing: false,
    uploadError: '上传失败',
  })
  const processing = gridSplitQuality({
    sourceLabel: '分镜源图',
    layoutLabel: '2 x 2',
    uploadedCount: 0,
    createdChildCount: 0,
    hasUploadError: false,
    isProcessing: true,
  })

  assert.equal(failed.status, 'failed')
  assert.match(failed.evidence.join(' '), /上传失败/)
  assert.equal(processing.status, 'processing')
})

test('separates dirty annotation drafts from persisted annotations', () => {
  const summary = annotationQuality({
    sourceLabel: '角色参考',
    persistedCount: 1,
    unsavedDraftCount: 2,
    hasUnsavedChanges: true,
    isSaving: false,
    saveError: '',
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.evidence.join(' '), /已保存 1 条/)
  assert.match(summary.evidence.join(' '), /2 条待保存/)
})

test('keeps saved-only annotations completed', () => {
  const summary = annotationQuality({
    sourceLabel: '角色参考',
    persistedCount: 2,
    unsavedDraftCount: 0,
    hasUnsavedChanges: false,
    isSaving: false,
    saveError: '',
  })

  assert.equal(summary.status, 'completed')
  assert.doesNotMatch(summary.resultLabel, /待保存/)
})

test('describes unsaved annotation edits without inventing a zero draft count', () => {
  const summary = annotationQuality({
    sourceLabel: '角色参考',
    persistedCount: 2,
    unsavedDraftCount: 0,
    hasUnsavedChanges: true,
    isSaving: false,
    saveError: '',
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.resultLabel, /未保存的标注修改/)
  assert.match(summary.evidence.join(' '), /编辑或删除/)
  assert.doesNotMatch(summary.resultLabel, /0 条标注草稿待保存/)
})

test('keeps color grading explicitly preview-only', () => {
  const summary = colorGradeQuality({
    sourceLabel: '主视觉',
    activeWheelCount: 2,
    previewReady: true,
    promptAppended: false,
    derivedDraftCreated: false,
    isApplying: false,
    applyError: '',
  })

  assert.equal(summary.status, 'preview')
  assert.match(summary.resultLabel, /预览/)
  assert.doesNotMatch(summary.resultLabel, /已生成|已改写源资产|已保存资产/)
})

test('prefers an appended color-grade prompt over a retained preview', () => {
  const summary = colorGradeQuality({
    sourceLabel: '主视觉',
    activeWheelCount: 2,
    previewReady: true,
    promptAppended: true,
    derivedDraftCreated: false,
    isApplying: false,
    applyError: '',
  })

  assert.equal(summary.status, 'completed')
  assert.match(summary.resultLabel, /提示词/)
})

test('categorizes continuity risks without exposing a numeric score', () => {
  const summary = continuityQuality({
    checkedNodeCount: 6,
    riskCount: 1,
    warnCount: 4,
    infoCount: 2,
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.statusLabel, /优先处理/)
  assert.doesNotMatch(JSON.stringify(summary), /score|评分|\/100/i)
})

test('reports insufficient continuity context as unavailable', () => {
  const summary = continuityQuality({
    checkedNodeCount: 1,
    riskCount: 0,
    warnCount: 0,
    infoCount: 0,
  })

  assert.equal(summary.status, 'unavailable')
})

test('requires confirmation when continuity warnings need review', () => {
  const summary = continuityQuality({
    checkedNodeCount: 4,
    riskCount: 0,
    warnCount: 2,
    infoCount: 1,
  })

  assert.equal(summary.status, 'needs-confirmation')
  assert.match(summary.statusLabel, /需要确认/)
  assert.match(summary.nextStepLabel ?? '', /警告/)
})

test('completes continuity checks with no issues', () => {
  const summary = continuityQuality({
    checkedNodeCount: 4,
    riskCount: 0,
    warnCount: 0,
    infoCount: 0,
  })

  assert.equal(summary.status, 'completed')
  assert.match(summary.resultLabel, /未发现需要处理的问题/)
})

test('renders and copies continuity evidence without the legacy numeric score', () => {
  const nodes = [
    { id: 'failed-node', kind: 'text', title: '失败节点', prompt: 'A girl in a forest', status: 'failed' },
    { id: 'next-node', kind: 'text', title: '后续节点', prompt: 'A girl walks through the forest', status: 'done' },
  ]
  const report = analyzeContinuity(nodes, [])
  const markup = renderToStaticMarkup(
    createElement(ContinuityCheckerPanel, {
      nodes,
      edges: [],
      onFocusNode() {},
      onClose() {},
    }),
  )
  const copiedText = buildContinuityReportText(report)
  const renderedText = markup.replace(/<[^>]+>/g, '')

  assert.equal('overallScore' in report, false)
  assert.match(markup, /data-testid="tool-result-quality-strip"/)
  assert.match(renderedText, /优先处理/)
  assert.match(renderedText, /风险 1 项/)
  assert.match(renderedText, /定位节点/)
  assert.doesNotMatch(renderedText, /评分|\/100/)
  assert.match(copiedText, /RISK/)
  assert.doesNotMatch(copiedText, /评分|\/100/)
})

test('keeps variant plans as planning previews rather than assets', () => {
  const summary = variantPlannerQuality({
    sourceLabel: '参考图',
    hasAsset: true,
    planCount: 4,
    isPlanning: false,
  })

  assert.equal(summary.status, 'preview')
  assert.match(summary.resultLabel, /4 个变体方向/)
  assert.doesNotMatch(JSON.stringify(summary), /新资产|已生成/)
})

test('keeps prompt-context variant plans available without an asset', () => {
  const summary = variantPlannerQuality({
    sourceLabel: '文案节点',
    hasAsset: false,
    planCount: 3,
    isPlanning: false,
  })

  assert.equal(summary.status, 'preview')
  assert.match(summary.evidence.join(' '), /提示词上下文/)
})

test('distinguishes an invalid A/B pair from a deliberate winner', () => {
  const unavailable = abCompareQuality({
    firstLabel: '版本 A',
    secondLabel: '版本 B',
    hasValidPair: false,
    winner: null,
  })
  const ready = abCompareQuality({
    firstLabel: '版本 A',
    secondLabel: '版本 B',
    hasValidPair: true,
    winner: null,
  })
  const completed = abCompareQuality({
    firstLabel: '版本 A',
    secondLabel: '版本 B',
    hasValidPair: true,
    winner: 'B',
  })

  assert.equal(unavailable.status, 'unavailable')
  assert.equal(ready.status, 'needs-confirmation')
  assert.equal(completed.status, 'completed')
  assert.match(completed.resultLabel, /版本 B/)
})

test('keeps a browser keyframe frame as a local preview', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07',
    hasVideo: true,
    hasLocalFrame: true,
    extractionFailed: false,
    extractionError: '',
    isExtracting: false,
    createdDraftKind: null,
  })

  assert.equal(summary.status, 'preview')
  assert.doesNotMatch(JSON.stringify(summary), /已保存资产|已生成/)
})

test('reports a CORS keyframe extraction failure without a draft request', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07',
    hasVideo: true,
    hasLocalFrame: false,
    extractionFailed: true,
    extractionError: 'CORS 访问受限',
    isExtracting: false,
    createdDraftKind: null,
  })

  assert.equal(summary.status, 'failed')
  assert.match(summary.evidence.join(' '), /CORS 访问受限/)
  assert.doesNotMatch(JSON.stringify(summary), /草案节点已创建/)
})
