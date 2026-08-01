import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, type Browser } from '@playwright/test'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotationPanel } from '@/components/create/AnnotationPanel'
import { StoryboardGridSplitPanel } from '@/components/create/StoryboardGridSplitPanel'
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

globalThis.React = React

let browser: Browser | null = null
let clientBundlePath = ''
let clientTempDirectory = ''

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

function annotationClientHarnessSource() {
  const panelPath = path.resolve(process.cwd(), 'src/components/create/AnnotationPanel.tsx')
  return `
    import * as React from 'react'
    import { createRoot } from 'react-dom/client'
    import { AnnotationPanel } from ${JSON.stringify(panelPath)}

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

    createRoot(document.getElementById('root')).render(React.createElement(AnnotationPanel, {
      sourceNode,
      onSave() {},
      onClose() {},
    }))
  `
}

before(async () => {
  clientTempDirectory = await mkdtemp(path.join(process.cwd(), '.annotation-quality-'))
  assert.equal(path.dirname(clientTempDirectory), process.cwd())
  const entryPath = path.join(clientTempDirectory, 'entry.tsx')
  clientBundlePath = path.join(clientTempDirectory, 'bundle.js')
  await writeFile(entryPath, annotationClientHarnessSource(), 'utf8')
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
  browser = await chromium.launch({ headless: true })
})

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

test('recognizes a created keyframe draft after an extraction error', () => {
  const summary = keyframeQuality({
    sourceLabel: '镜头 07',
    hasVideo: true,
    hasLocalFrame: false,
    extractionFailed: true,
    extractionError: 'CORS 访问受限',
    isExtracting: false,
    createdDraftKind: 'image',
  })

  assert.equal(summary.status, 'completed')
  assert.match(summary.evidence.join(' '), /CORS 访问受限/)
})
