export type ToolResultQualityStatus =
  | 'not-started'
  | 'processing'
  | 'needs-confirmation'
  | 'completed'
  | 'preview'
  | 'failed'
  | 'unavailable'

export type ToolResultQualitySummary = {
  status: ToolResultQualityStatus
  statusLabel: string
  sourceLabel: string
  resultLabel: string
  evidence: readonly string[]
  nextStepLabel?: string
}

type BaseInput = {
  sourceLabel: string
}

export type GridSplitQualityInput = BaseInput & {
  layoutLabel: string
  uploadedCount: number
  createdChildCount: number
  hasUploadError: boolean
  isProcessing: boolean
  uploadError?: string
}

export type ReferenceExtractionQualityInput = BaseInput & {
  selectedCount: number
  uploadedCount: number
  createdNodeCount: number
  errorCount: number
  isProcessing: boolean
  uploadError?: string
}

export type AnnotationQualityInput = BaseInput & {
  persistedCount: number
  unsavedDraftCount: number
  hasUnsavedChanges: boolean
  isSaving: boolean
  saveError: string
}

export type ColorGradeQualityInput = BaseInput & {
  activeWheelCount: number
  previewReady: boolean
  promptAppended: boolean
  derivedDraftCreated: boolean
  isApplying: boolean
  applyError: string
}

export type ContinuityQualityInput = {
  checkedNodeCount: number
  riskCount: number
  warnCount: number
  infoCount: number
}

export type VariantPlannerQualityInput = BaseInput & {
  hasAsset: boolean
  planCount: number
  isPlanning: boolean
}

export type ABCompareQualityInput = {
  firstLabel: string
  secondLabel: string
  hasValidPair: boolean
  winner: 'A' | 'B' | null
}

export type KeyframeQualityInput = BaseInput & {
  hasVideo: boolean
  hasLocalFrame: boolean
  extractionFailed: boolean
  extractionError: string
  isExtracting: boolean
  createdDraftKind: string | null
}

function count(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function hasLabel(value: string) {
  return value.trim().length > 0
}

function summary(
  status: ToolResultQualityStatus,
  statusLabel: string,
  sourceLabel: string,
  resultLabel: string,
  evidence: readonly string[],
  nextStepLabel?: string,
): ToolResultQualitySummary {
  return { status, statusLabel, sourceLabel, resultLabel, evidence, ...(nextStepLabel ? { nextStepLabel } : {}) }
}

export function gridSplitQuality(input: GridSplitQualityInput): ToolResultQualitySummary {
  const uploadedCount = count(input.uploadedCount)
  const createdChildCount = count(input.createdChildCount)
  const evidence = input.layoutLabel.trim() ? [`布局：${input.layoutLabel.trim()}`] : []

  if (!hasLabel(input.sourceLabel)) {
    return summary('unavailable', '缺少来源', '未选择来源图', '无法确认裁切结果', evidence)
  }
  if (input.hasUploadError) {
    return summary('failed', '上传未完成', input.sourceLabel, '裁切上传出现问题', [input.uploadError || '请查看现有上传错误信息', ...evidence])
  }
  if (input.isProcessing) {
    return summary('processing', '正在处理', input.sourceLabel, '正在准备裁切结果', evidence)
  }
  if (createdChildCount > 0) {
    return summary('completed', '子节点已创建', input.sourceLabel, `已创建 ${createdChildCount} 个子节点`, [`已上传 ${uploadedCount} 个裁切`, ...evidence])
  }
  if (uploadedCount > 0) {
    return summary('needs-confirmation', '等待确认', input.sourceLabel, `${uploadedCount} 个裁切已入库，等待创建子节点`, evidence, '确认后创建子节点')
  }
  if (input.layoutLabel.trim()) {
    return summary('needs-confirmation', '布局待确认', input.sourceLabel, '已检测到裁切布局，尚未上传裁切', evidence, '确认布局后上传裁切')
  }
  return summary('not-started', '尚未开始', input.sourceLabel, '尚未检测到裁切布局', evidence)
}

export function referenceExtractionQuality(input: ReferenceExtractionQualityInput): ToolResultQualitySummary {
  const selectedCount = count(input.selectedCount)
  const uploadedCount = count(input.uploadedCount)
  const createdNodeCount = count(input.createdNodeCount)
  const errorCount = count(input.errorCount)
  const evidence = [
    `已选择 ${selectedCount} 个参考区域`,
    ...(uploadedCount > 0 ? [`已入库 ${uploadedCount} 个参考图`] : []),
    ...(createdNodeCount > 0 ? [`已创建 ${createdNodeCount} 个参考节点`] : []),
  ]

  if (!hasLabel(input.sourceLabel)) {
    return summary('unavailable', '缺少来源', '未选择来源图', '无法提取参考图', evidence)
  }
  if (errorCount > 0) {
    return summary('failed', '提取未完成', input.sourceLabel, `${errorCount} 个参考区域处理失败`, [input.uploadError || '请检查失败区域后重试', ...evidence])
  }
  if (input.isProcessing) {
    return summary('processing', '正在提取', input.sourceLabel, '正在按顺序裁切并保存参考图', evidence)
  }
  if (uploadedCount > createdNodeCount) {
    const nodeEvidence = createdNodeCount > 0 ? [`其中 ${createdNodeCount} 个参考节点已创建`, ...evidence] : evidence
    const createdSuffix = createdNodeCount > 0 ? `，${createdNodeCount} 个参考节点已创建` : ''
    return summary('needs-confirmation', '节点待确认', input.sourceLabel, `${uploadedCount} 个参考图已入库${createdSuffix}，等待创建参考节点`, nodeEvidence, '确认参考节点放置结果')
  }
  if (createdNodeCount > 0) {
    return summary('completed', '参考节点已创建', input.sourceLabel, `已创建 ${createdNodeCount} 个参考节点`, evidence)
  }
  if (selectedCount > 0) {
    return summary('needs-confirmation', '等待提取', input.sourceLabel, `已选择 ${selectedCount} 个参考区域`, evidence, '确认提取')
  }
  return summary('not-started', '尚未选择区域', input.sourceLabel, '尚未选择参考区域', evidence, '拖拽添加参考区域')
}

export function annotationQuality(input: AnnotationQualityInput): ToolResultQualitySummary {
  const persistedCount = count(input.persistedCount)
  const unsavedDraftCount = count(input.unsavedDraftCount)
  const savedEvidence = persistedCount > 0 ? `已保存 ${persistedCount} 条标注` : '尚无已保存标注'

  if (!hasLabel(input.sourceLabel)) {
    return summary('unavailable', '缺少来源', '未选择图像节点', '无法核对标注状态', [])
  }
  if (input.saveError.trim()) {
    return summary('failed', '保存未完成', input.sourceLabel, '标注草稿尚未保存', [savedEvidence, input.saveError.trim()])
  }
  if (input.isSaving) {
    return summary('processing', '正在保存', input.sourceLabel, '正在保存标注草稿', [savedEvidence])
  }
  if (unsavedDraftCount > 0) {
    return summary('needs-confirmation', '存在待保存草稿', input.sourceLabel, `${unsavedDraftCount} 条标注草稿待保存`, [savedEvidence, `${unsavedDraftCount} 条待保存`], '使用现有保存操作保留草稿')
  }
  if (input.hasUnsavedChanges) {
    return summary('needs-confirmation', '存在未保存修改', input.sourceLabel, '存在未保存的标注修改', [savedEvidence, '包含编辑或删除的标注修改'], '使用现有保存操作保留修改')
  }
  if (persistedCount > 0) {
    return summary('completed', '标注已保存', input.sourceLabel, `已保存 ${persistedCount} 条标注`, [savedEvidence])
  }
  return summary('not-started', '尚未标注', input.sourceLabel, '尚未添加标注', [savedEvidence])
}

export function colorGradeQuality(input: ColorGradeQualityInput): ToolResultQualitySummary {
  const activeWheelCount = count(input.activeWheelCount)
  const evidence = activeWheelCount > 0 ? [`已启用 ${activeWheelCount} 个调色控制`] : []

  if (!hasLabel(input.sourceLabel)) {
    return summary('unavailable', '缺少来源', '未选择可调色节点', '无法显示调色状态', evidence)
  }
  if (input.applyError.trim()) {
    return summary('failed', '应用未完成', input.sourceLabel, '调色操作出现问题', [input.applyError.trim(), ...evidence])
  }
  if (input.isApplying) {
    return summary('processing', '正在应用', input.sourceLabel, '正在应用调色设置', evidence)
  }
  if (input.derivedDraftCreated) {
    return summary('completed', '草案节点已创建', input.sourceLabel, '已创建调色草案节点', ['草案节点仍可继续编辑', ...evidence])
  }
  if (input.promptAppended) {
    return summary('completed', '说明已附加', input.sourceLabel, '调色说明已附加到现有提示词', evidence)
  }
  if (input.previewReady) {
    return summary('preview', '预览可用', input.sourceLabel, '本地调色预览已就绪', ['CSS 仅用于本地预览', ...evidence])
  }
  if (activeWheelCount > 0) {
    return summary('not-started', '等待预览', input.sourceLabel, '调色设置尚未预览', evidence, '使用现有预览操作检查效果')
  }
  return summary('not-started', '尚未调色', input.sourceLabel, '尚未选择调色设置', evidence)
}

export function continuityQuality(input: ContinuityQualityInput): ToolResultQualitySummary {
  const checkedNodeCount = count(input.checkedNodeCount)
  const riskCount = count(input.riskCount)
  const warnCount = count(input.warnCount)
  const infoCount = count(input.infoCount)
  const sourceLabel = `已检查 ${checkedNodeCount} 个节点`

  if (checkedNodeCount < 2) {
    return summary('unavailable', '检查条件不足', sourceLabel, '需要至少 2 个带内容的节点', [])
  }
  if (riskCount > 0) {
    return summary('needs-confirmation', '优先处理', sourceLabel, '发现需要优先处理的问题', [`风险 ${riskCount} 项`, `警告 ${warnCount} 项`, `提示 ${infoCount} 项`], '先处理风险项')
  }
  if (warnCount > 0) {
    return summary('needs-confirmation', '需要确认', sourceLabel, '发现需要确认的连续性问题', [`警告 ${warnCount} 项`, `提示 ${infoCount} 项`], '检查警告项')
  }
  return summary('completed', '检查完成', sourceLabel, '未发现需要处理的问题', [`提示 ${infoCount} 项`])
}

export function variantPlannerQuality(input: VariantPlannerQualityInput): ToolResultQualitySummary {
  const planCount = count(input.planCount)

  if (!hasLabel(input.sourceLabel)) {
    return summary('unavailable', '缺少可用来源', '未选择来源', '需要一个可用来源才能规划变体', [])
  }
  if (input.isPlanning) {
    return summary('processing', '正在规划', input.sourceLabel, '正在整理变体方向', [])
  }
  if (planCount > 0) {
    const contextEvidence = input.hasAsset ? '基于现有资产上下文规划' : '基于提示词上下文规划'
    return summary('preview', '规划可用', input.sourceLabel, `已规划 ${planCount} 个变体方向`, [contextEvidence, '变体方向仅供后续选择与编辑'])
  }
  if (!input.hasAsset) {
    return summary('unavailable', '缺少可用资产', input.sourceLabel, '需要资产或已有变体计划才能继续', ['当前仅有提示词上下文'])
  }
  return summary('not-started', '尚未规划', input.sourceLabel, '尚未整理变体方向', [])
}

export function abCompareQuality(input: ABCompareQualityInput): ToolResultQualitySummary {
  const sourceLabel = `${input.firstLabel || '版本 A'} 与 ${input.secondLabel || '版本 B'}`

  if (!input.hasValidPair) {
    return summary('unavailable', '比较不可用', sourceLabel, '请选择一组有效的对比版本', [])
  }
  if (input.winner === 'A' || input.winner === 'B') {
    const winnerLabel = input.winner === 'A' ? input.firstLabel || '版本 A' : input.secondLabel || '版本 B'
    return summary('completed', '已选择结果', sourceLabel, `已选择 ${winnerLabel} 作为更优版本`, [`已明确选择版本 ${input.winner}`])
  }
  return summary('needs-confirmation', '等待选择', sourceLabel, '对比版本已就绪，尚未选择结果', ['有效对比版本已准备'], '选择更优版本')
}

export function keyframeQuality(input: KeyframeQualityInput): ToolResultQualitySummary {
  if (!hasLabel(input.sourceLabel) || !input.hasVideo) {
    return summary('unavailable', '缺少视频来源', input.sourceLabel || '未选择视频', '需要可用视频才能提取关键帧', [])
  }
  const failureEvidence = input.extractionFailed
    ? [input.extractionError.trim() || '请查看现有视频访问错误信息']
    : []
  if (input.createdDraftKind) {
    return summary('completed', '草案节点已创建', input.sourceLabel, '已创建关键帧草案节点', ['浏览器帧仅作为创建草案的来源', ...failureEvidence])
  }
  if (input.extractionFailed) {
    return summary('failed', '提取未完成', input.sourceLabel, '浏览器关键帧提取失败', failureEvidence)
  }
  if (input.isExtracting) {
    return summary('processing', '正在提取', input.sourceLabel, '正在提取浏览器关键帧', [])
  }
  if (input.hasLocalFrame) {
    return summary('preview', '本地帧预览可用', input.sourceLabel, '浏览器关键帧预览已就绪', ['该帧仅存在于当前浏览器预览中'])
  }
  return summary('not-started', '尚未提取', input.sourceLabel, '尚未提取浏览器关键帧', [])
}
