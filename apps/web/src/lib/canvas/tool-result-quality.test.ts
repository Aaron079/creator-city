import assert from 'node:assert/strict'
import test from 'node:test'
import {
  abCompareQuality,
  annotationQuality,
  colorGradeQuality,
  continuityQuality,
  gridSplitQuality,
  keyframeQuality,
  variantPlannerQuality,
} from './tool-result-quality'

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
