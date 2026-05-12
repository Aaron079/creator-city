'use client'

import { useMemo, useState } from 'react'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { getNodeImageUrlSources, getNodeVideoUrlSources, type MediaUrlSource } from '@/lib/canvas/media-urls'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import type { GenerationHealthResponse, GenerationHealthSection } from '@/lib/generation/health-types'

type AssetResolveResult = {
  success?: boolean
  assetId?: string
  status?: string
  resolvedUrl?: string | null
  stableUrl?: string | null
  thumbnailUrl?: string | null
  storageKey?: string | null
  storageProvider?: string | null
  bucket?: string | null
  provider?: string | null
  providerJobId?: string | null
  recoveryStatus?: string | null
  error?: string | null
  message?: string
  actionTaken?: string | null
  mediaPersistence?: unknown
  errorCode?: string
  originalUrl?: string | null
  currentUrl?: string | null
  signedUrlGenerated?: boolean
  signedUrlError?: string | null
  proxyFallbackUrl?: string | null
  proxyFallbackStatus?: number | null
  storageKeyFailureReason?: string | null
  whyUnrecoverable?: string | null
}

type ProviderStatusResponse = {
  success?: boolean
  providers?: Array<{
    providerId?: string
    available?: boolean
    configured?: boolean
    missingEnv?: string[]
    missingEnvKeys?: string[]
    reason?: string
    status?: string
    model?: string
  }>
  defaultProviderId?: string | null
  message?: string
  errorCode?: string
}

type GenerateResponseShape = {
  success?: boolean
  async?: boolean
  taskId?: string
  jobId?: string
  status?: string
  providerId?: string
  model?: string
  message?: string
  errorCode?: string
  upstreamStatus?: number
  upstreamMessage?: string
    rawCode?: string
    requestId?: string
    providerEndpoint?: string
    providerRequestMethod?: string
    providerHttpStatus?: number
    providerFetchError?: string
    providerFetchCause?: unknown
    missingEnv?: string[]
  missingEnvKeys?: string[]
  missingFields?: string[]
  submittedInput?: unknown
  providerResponse?: unknown
  resultImageUrl?: string
  resultVideoUrl?: string
  imageUrl?: string
  videoUrl?: string
  assetId?: string
  assetUrl?: string
  originalProviderImageUrl?: string
  originalProviderVideoUrl?: string
  mediaPersistence?: unknown
  asset?: { id?: string; url?: string; thumbnailUrl?: string | null }
  result?: {
    imageUrl?: string
    videoUrl?: string
    previewUrl?: string
    metadata?: Record<string, unknown>
    }
  }

type ExternalConnectivityResponse = {
  ok?: boolean
  errorCode?: string
  message?: string
  volcengine?: {
    ok?: boolean
    endpoint?: string
    authOk?: boolean
    networkOk?: boolean
    status?: number | null
    errorCode?: string | null
    errorMessage?: string | null
    requestId?: string | null
    providerEndpoint?: string
    providerRequestMethod?: string
    providerHttpStatus?: number
    providerFetchError?: string
    providerFetchCause?: unknown
    upstreamMessage?: string
  }
  seedream?: {
    ok?: boolean
    model?: string
    errorCode?: string | null
  }
  seedance?: {
    ok?: boolean
    model?: string
    errorCode?: string | null
  }
  oss?: {
    ok?: boolean
    bucket?: string
    signedUrlAvailable?: boolean
    uploadTestOk?: boolean
    readTestOk?: boolean
    deleteTestOk?: boolean
    errorCode?: string | null
    errorMessage?: string | null
  }
}

interface P0MediaDebugPanelProps {
  open: boolean
  projectId: string
  workflowId: string
  nodes: VisualCanvasNode[]
  generationHealth?: GenerationHealthResponse | null
  onClose: () => void
  onPatchNode: (nodeId: string, patch: Partial<VisualCanvasNode>) => void
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function nullableString(value: unknown) {
  const text = stringValue(value)
  return text || null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/s$/i, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : []
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

const ASSET_RECORD_MISSING_MESSAGE = '历史 Asset 记录不存在，需要用原 Prompt 重新生成并重建 Asset。'
const STORAGE_SIGNED_PROXY_MESSAGE = '对象存在但需要 signed URL/proxy 读取。'

function productionMissingEnvMessage(missingEnv: string[]) {
  return missingEnv.length ? `生产环境缺少：${missingEnv.join(', ')}，请先在 Vercel 配置后重新部署。` : ''
}

function isAssetRecordMissingCode(code?: string | null) {
  return code === 'ASSET_NOT_FOUND_BY_NODE'
    || code === 'ASSET_NOT_FOUND_FOR_NODE'
    || code === 'asset_not_found_by_node'
    || code === 'no_recovery_source'
}

function diagnosticNextAction(args: {
  missingEnv: string[]
  storageKeyReadProblem: boolean
  assetRecordMissing: boolean
  fallback: string
}) {
  const missingEnvMessage = productionMissingEnvMessage(args.missingEnv)
  if (missingEnvMessage) return missingEnvMessage
  if (args.storageKeyReadProblem) return STORAGE_SIGNED_PROXY_MESSAGE
  if (args.assetRecordMissing) return ASSET_RECORD_MISSING_MESSAGE
  return args.fallback
}

function summarizeUrlForDiagnostics(url?: string) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    return {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      pathnameTail: pathParts.slice(-2).join('/'),
      hasQuery: Boolean(parsed.search),
    }
  } catch {
    return { kind: url.startsWith('data:') ? 'data-url' : 'non-url', length: url.length }
  }
}

function nestedRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function mediaPersistenceRecord(metadata: Record<string, unknown>) {
  return nestedRecord(metadata.mediaPersistence)
}

function nodeParamValue(node: VisualCanvasNode, key: string) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = recordValue(node.metadataJson)
  const params = nestedRecord(metadata.params)
  const generationParams = nestedRecord(metadata.generationParams)
  const submittedInput = nestedRecord(metadata.submittedInput)
  return metadata[key]
    ?? params[key]
    ?? generationParams[key]
    ?? submittedInput[key]
    ?? nodeRecord[key]
}

function buildRegenerationParams(node: VisualCanvasNode) {
  const aspectRatio = stringValue(nodeParamValue(node, 'aspectRatio'))
    || stringValue(nodeParamValue(node, 'ratio'))
    || stringValue(node.ratio)
    || '16:9'
  const duration = numberValue(nodeParamValue(node, 'duration'))
  const resolution = stringValue(nodeParamValue(node, 'resolution'))
    || stringValue(nodeParamValue(node, 'quality'))
    || stringValue(nodeParamValue(node, 'size'))
  const negativePrompt = stringValue(nodeParamValue(node, 'negativePrompt'))
    || stringValue(nodeParamValue(node, 'negative_prompt'))
  return {
    ratio: aspectRatio,
    aspectRatio,
    ...(node.kind === 'video' ? { duration: duration ?? 5 } : duration ? { duration } : {}),
    ...(resolution ? { resolution, size: resolution } : {}),
    ...(negativePrompt ? { negativePrompt } : {}),
  } satisfies Record<string, string | number | boolean | undefined>
}

function buildRegenerationInputAssets(node: VisualCanvasNode): Array<{ id: string; type: string; url?: string }> | undefined {
  const imageUrl = stringValue(nodeParamValue(node, 'imageUrl'))
    || stringValue(nodeParamValue(node, 'sourceImageUrl'))
    || stringValue(nodeParamValue(node, 'firstFrameUrl'))
    || stringValue(nodeParamValue(node, 'referenceImageUrl'))
    || stringValue(nodeParamValue(node, 'referenceUrl'))
  if (!imageUrl) return undefined
  return [{ id: `${node.id}-reference-image`, type: 'image', url: imageUrl }]
}

function providerForRegenerationNode(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const submittedInput = nestedRecord(metadata.submittedInput)
  const lastGenerationError = nestedRecord(metadata.lastGenerationError)
  return stringValue(metadata.providerId)
    || stringValue(metadata.provider)
    || stringValue(metadata.sourceProvider)
    || stringValue(mediaPersistence.providerId)
    || stringValue(mediaPersistence.provider)
    || stringValue(submittedInput.providerId)
    || stringValue(lastGenerationError.providerId)
    || stringValue(node.providerId)
    || stringValue(node.model)
}

function modelForRegenerationNode(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const submittedInput = nestedRecord(metadata.submittedInput)
  const lastGenerationError = nestedRecord(metadata.lastGenerationError)
  return stringValue(metadata.model)
    || stringValue(nodeParamValue(node, 'model'))
    || stringValue(submittedInput.model)
    || stringValue(lastGenerationError.model)
    || stringValue(node.model)
}

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticValue)
  if (!value || typeof value !== 'object') return value
  const sanitized: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/secret|token|api[_-]?key|authorization|password|credential/i.test(key)) {
      sanitized[key] = '[redacted]'
      continue
    }
    sanitized[key] = sanitizeDiagnosticValue(nested)
  }
  return sanitized
}

function firstString(candidates: Array<[string, unknown]>) {
  for (const [source, value] of candidates) {
    const text = stringValue(value)
    if (text) return { source, value: text }
  }
  return { source: '', value: '' }
}

function getNodeAssetIdWithSource(node: VisualCanvasNode) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const topMediaPersistence = nestedRecord(nodeRecord.mediaPersistence)
  const assetRecord = nestedRecord(metadata.asset)
  const nodeData = nestedRecord(nodeRecord.data)
  const generationJob = nestedRecord(metadata.generationJob)
  const topGenerationJob = nestedRecord(nodeRecord.generationJob)
  const generationResult = nestedRecord(metadata.generationResult)
  const pluginResult = nestedRecord(metadata.pluginResult)
  return firstString([
    ['node.assetId', node.assetId],
    ['node.data.assetId', nodeData.assetId],
    ['node.metadataJson.assetId', metadata.assetId],
    ['node.metadataJson.asset.id', assetRecord.id],
    ['node.metadataJson.asset_id', metadata.asset_id],
    ['node.metadataJson.mediaAssetId', metadata.mediaAssetId],
    ['node.metadataJson.resultAssetId', metadata.resultAssetId],
    ['node.resultAssetId', nodeRecord.resultAssetId],
    ['node.mediaAssetId', nodeRecord.mediaAssetId],
    ['node.metadataJson.outputAssetId', metadata.outputAssetId],
    ['node.metadataJson.generationJob.outputAssetId', generationJob.outputAssetId],
    ['node.generationJob.outputAssetId', topGenerationJob.outputAssetId],
    ['node.metadataJson.generationResult.outputAssetId', generationResult.outputAssetId],
    ['node.metadataJson.pluginResult.outputAssetId', pluginResult.outputAssetId],
    ['node.metadataJson.mediaPersistence.assetId', mediaPersistence.assetId],
    ['node.metadataJson.mediaPersistence.outputAssetId', mediaPersistence.outputAssetId],
    ['node.mediaPersistence.assetId', topMediaPersistence.assetId],
    ['node.mediaPersistence.outputAssetId', topMediaPersistence.outputAssetId],
  ])
}

function getGenerationJobId(node: VisualCanvasNode) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const generationJob = nestedRecord(metadata.generationJob)
  return firstString([
    ['node.metadataJson.generationJobId', metadata.generationJobId],
    ['node.metadataJson.generationJob.id', generationJob.id],
    ['node.metadataJson.generationJob.jobId', generationJob.jobId],
    ['node.metadataJson.mediaPersistence.generationJobId', mediaPersistence.generationJobId],
    ['node.generationJobId', nodeRecord.generationJobId],
  ])
}

function getProviderJobId(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const generationJob = nestedRecord(metadata.generationJob)
  return firstString([
    ['node.metadataJson.providerJobId', metadata.providerJobId],
    ['node.metadataJson.taskId', metadata.taskId],
    ['node.metadataJson.generationJob.providerJobId', generationJob.providerJobId],
    ['node.metadataJson.mediaPersistence.providerJobId', mediaPersistence.providerJobId],
  ])
}

function mediaSourcesForNode(node: VisualCanvasNode): MediaUrlSource[] {
  if (node.kind === 'image') return getNodeImageUrlSources(node)
  if (node.kind === 'video') return getNodeVideoUrlSources(node)
  return []
}

function currentDisplaySource(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const resolvedUrl = stringValue(metadata.resolvedUrl) || stringValue(metadata.assetUrl)
  const sources = mediaSourcesForNode(node)
  const selected = resolvedUrl
    ? sources.find((source) => source.url === resolvedUrl) ?? { source: 'metadata.resolvedUrl', url: resolvedUrl }
    : sources[0] ?? { source: '', url: '' }
  return {
    ...selected,
    proxiedSrc: getProxiedMediaUrl(selected.url),
  }
}

function hasAnyRecoverableSource(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const providerJob = getProviderJobId(node).value
  const sources = mediaSourcesForNode(node)
  return Boolean(
    getNodeAssetIdWithSource(node).value ||
    stringValue(metadata.storageKey) ||
    stringValue(metadata.originalUrl) ||
    stringValue(metadata.originalProviderUrl) ||
    stringValue(metadata.originalProviderImageUrl) ||
    stringValue(metadata.originalProviderVideoUrl) ||
    stringValue(metadata.providerUrl) ||
    providerJob ||
    sources.some((source) => Boolean(source.url)),
  )
}

function isUnrecoverableStatus(status: string) {
  return status.startsWith('unrecoverable_') || status === 'UNRECOVERABLE' || status === 'no_recovery_source'
}

function storageKeyFailureReason(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const storageKey = stringValue(metadata.storageKey) || stringValue(mediaPersistenceRecord(metadata).storageKey)
  const resolvedUrl = stringValue(metadata.resolvedUrl) || stringValue(metadata.assetUrl)
  const status = stringValue(metadata.recoveryStatus) || stringValue(metadata.assetResolveStatus)
  if (!storageKey) return '没有 storageKey，因此不能按对象存储直接解析。'
  if (resolvedUrl) return '已有 resolvedUrl；CanvasNodeCard 应优先使用该 URL。'
  if (status === 'storage_permission_error') return 'storageKey 存在但对象存储返回权限错误；这需要 signedUrl 或 proxy fallback，不应判定不可恢复。'
  if (status === 'missing_env') return 'storageKey 存在但生产环境缺少对象存储签名配置。'
  if (status === 'signing_error') return 'storageKey 存在，对象可能存在，但签名 URL 生成失败。'
  if (status === 'proxy_error') return 'storageKey 存在，但 proxy fallback 也无法读取。'
  if (status === 'object_missing') return 'storageKey 存在，但对象存储检查没有找到对象。'
  if (isUnrecoverableStatus(status)) return `storageKey 存在但 recoveryStatus=${status}，需要重新 resolve 确认是否被误标不可恢复。`
  return status ? `storageKey 存在，当前状态为 ${status}。` : 'storageKey 存在，但当前节点没有 resolvedUrl。'
}

function buildDiagnostic(node: VisualCanvasNode, projectId: string, workflowId: string, generationHealth: GenerationHealthResponse | null) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const lastResolveResult = recordValue(metadata.p0LastResolveResult || metadata.p0LastRecoveryResult || metadata.assetResolveResult)
  const mediaRecoveryAudit = recordValue(metadata.mediaRecoveryAudit)
  const lastGenerationError = recordValue(metadata.lastGenerationError || metadata.lastError)
  const asset = getNodeAssetIdWithSource(node)
  const generationJob = getGenerationJobId(node)
  const current = currentDisplaySource(node)
  const params = nestedRecord(metadata.params)
  const generationParams = nestedRecord(metadata.generationParams)
  const resultImageUrl = stringValue(node.resultImageUrl) || stringValue(metadata.resultImageUrl)
  const resultVideoUrl = stringValue(node.resultVideoUrl) || stringValue(metadata.resultVideoUrl)
  const stableUrl = stringValue(metadata.stableUrl) || stringValue(mediaPersistence.stableUrl)
  const originalUrl = stringValue(metadata.originalUrl)
    || stringValue(metadata.originalProviderUrl)
    || stringValue(metadata.originalProviderImageUrl)
    || stringValue(metadata.originalProviderVideoUrl)
    || stringValue(mediaPersistence.originalUrl)
  const storageKey = stringValue(metadata.storageKey) || stringValue(mediaPersistence.storageKey)
  const bucket = stringValue(metadata.bucket) || stringValue(mediaPersistence.bucket) || stringValue(lastResolveResult.bucket)
  const storageProvider = stringValue(metadata.storageProvider) || stringValue(mediaPersistence.storageProvider) || stringValue(lastResolveResult.storageProvider)
  const model = stringValue(metadata.model) || stringValue(node.model)
  const aspectRatio = stringValue(metadata.aspectRatio)
    || stringValue(metadata.ratio)
    || stringValue(params.aspectRatio)
    || stringValue(params.ratio)
    || stringValue(generationParams.aspectRatio)
    || stringValue(generationParams.ratio)
    || stringValue(node.ratio)
  const duration = numberValue(metadata.duration) ?? numberValue(params.duration) ?? numberValue(generationParams.duration)
  const resolution = stringValue(metadata.resolution)
    || stringValue(params.resolution)
    || stringValue(params.size)
    || stringValue(params.quality)
    || stringValue(generationParams.resolution)
    || stringValue(generationParams.size)
    || stringValue(generationParams.quality)
  const provider = stringValue(metadata.provider)
    || stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(mediaPersistence.provider)
    || stringValue(lastResolveResult.provider)
    || node.providerId
    || node.model
  const resolvedUrl = stringValue(metadata.resolvedUrl) || stringValue(metadata.assetUrl) || stringValue(mediaPersistence.resolvedUrl)
  const assetUrl = stringValue(metadata.assetUrl) || resolvedUrl
  const recoveryStatus = stringValue(metadata.recoveryStatus) || stringValue(metadata.assetResolveStatus) || stringValue(mediaPersistence.status)
  const errorCode = stringValue(metadata.errorCode) || stringValue(lastGenerationError.errorCode) || stringValue(lastResolveResult.errorCode) || null
  const errorMessage = stringValue(metadata.errorMessage)
    || stringValue(lastGenerationError.message)
    || stringValue(lastResolveResult.errorMessage)
    || stringValue(lastResolveResult.message)
    || stringValue(node.errorMessage)
    || stringValue(mediaPersistence.message)
  const error = stringValue(metadata.error) || errorMessage || stringValue(mediaPersistence.errorCode)
  const resolveBatchStatus = stringValue(lastResolveResult.status) || stringValue(lastResolveResult.recoveryStatus) || recoveryStatus
  const proxyFallbackUrl = stringValue(lastResolveResult.proxyFallbackUrl) || getProxiedMediaUrl(current.url)
  const proxyUrl = stringValue(metadata.proxyUrl) || proxyFallbackUrl
  const proxyFallbackStatus = typeof lastResolveResult.proxyFallbackStatus === 'number'
    ? lastResolveResult.proxyFallbackStatus
    : typeof mediaRecoveryAudit.proxyStatus === 'number'
      ? mediaRecoveryAudit.proxyStatus
      : null
  const signedUrlGenerated = typeof lastResolveResult.signedUrlGenerated === 'boolean'
    ? lastResolveResult.signedUrlGenerated
    : Boolean(storageKey && resolvedUrl && current.source.includes('resolvedUrl'))
  const signedUrlAvailable = typeof lastResolveResult.signedUrlAvailable === 'boolean'
    ? lastResolveResult.signedUrlAvailable
    : typeof lastResolveResult.signedUrlGenerated === 'boolean'
      ? lastResolveResult.signedUrlGenerated
      : signedUrlGenerated
  const proxyAvailable = typeof lastResolveResult.proxyAvailable === 'boolean'
    ? lastResolveResult.proxyAvailable
    : Boolean(proxyUrl)
  const isPrivateBucket = typeof metadata.isPrivateBucket === 'boolean'
    ? metadata.isPrivateBucket
    : storageKey && /aliyun-oss|tencent-cos|supabase/i.test(storageProvider)
      ? true
      : null
  const reason = storageKeyFailureReason(node)
  const unrecoverable = isUnrecoverableStatus(recoveryStatus)
  const rawWhyUnrecoverable = resolvedUrl
    ? '已有 resolvedUrl，当前不应显示不可恢复。'
    : stringValue(lastResolveResult.whyUnrecoverable)
      || stringValue(lastResolveResult.storageKeyFailureReason)
      || (unrecoverable ? error || reason : reason)
  const attemptedUrls = [
    ...arrayValue(metadata.attemptedUrls),
    ...arrayValue(lastResolveResult.attemptedUrls),
  ]
  const failedUrls = [
    ...arrayValue(metadata.failedUrls),
    ...arrayValue(lastResolveResult.failedUrls),
    ...arrayValue(lastResolveResult.attemptedUrls),
  ]
  const missingEnv = uniqueStrings([
    ...(generationHealth?.missingEnv ?? []),
    ...stringArrayValue(lastGenerationError.missingEnv),
    ...stringArrayValue(lastGenerationError.missingEnvKeys),
    ...stringArrayValue(metadata.missingEnv),
    ...stringArrayValue(metadata.missingEnvKeys),
    ...stringArrayValue(lastResolveResult.missingEnv),
    ...stringArrayValue(lastResolveResult.missingEnvKeys),
  ])
  const storageKeyReadProblem = Boolean(
    storageKey
    && !resolvedUrl
    && (
      errorCode === 'storage_permission_error'
      || errorCode === 'needs_signed_url'
      || errorCode === 'signing_error'
      || errorCode === 'proxy_error'
      || recoveryStatus === 'storage_permission_error'
      || recoveryStatus === 'needs_signed_url'
      || recoveryStatus === 'signing_error'
      || recoveryStatus === 'proxy_error'
      || !current.url
    ),
  )
  const assetRecordMissing = Boolean(
    isAssetRecordMissingCode(errorCode)
    || isAssetRecordMissingCode(recoveryStatus)
    || isAssetRecordMissingCode(resolveBatchStatus)
    || (!asset.value && !resolvedUrl && !storageKey && mediaSourcesForNode(node).length === 0),
  )
  const nextAction = diagnosticNextAction({
    missingEnv,
    storageKeyReadProblem,
    assetRecordMissing,
    fallback: stringValue(metadata.nextAction) || (unrecoverable ? 'regenerate_from_prompt' : 'manual_debug'),
  })
  const whyUnrecoverable = productionMissingEnvMessage(missingEnv)
    || (storageKeyReadProblem ? STORAGE_SIGNED_PROXY_MESSAGE : '')
    || (assetRecordMissing ? ASSET_RECORD_MISSING_MESSAGE : '')
    || rawWhyUnrecoverable
  return {
    projectId,
    workflowId,
    nodeId: node.id,
    kind: node.kind,
    title: nullableString(node.title),
    position: { x: node.x, y: node.y, width: node.width, height: node.height },
    prompt: nullableString(node.prompt),
    providerId: node.providerId || node.model,
    provider,
    model: nullableString(model),
    aspectRatio: nullableString(aspectRatio),
    duration,
    resolution: nullableString(resolution),
    assetId: asset.value || null,
    assetIdSource: asset.source || null,
    generationJobId: generationJob.value || null,
    generationJobIdSource: generationJob.source || null,
    providerJobId: getProviderJobId(node).value || null,
    resultImageUrlExists: Boolean(resultImageUrl),
    resultVideoUrlExists: Boolean(resultVideoUrl),
    stableUrlExists: Boolean(stableUrl),
    originalUrlExists: Boolean(originalUrl),
    currentUrlExists: Boolean(current.url),
    storageKeyExists: Boolean(storageKey),
    resolvedUrlExists: Boolean(resolvedUrl),
    resultImageUrl,
    resultVideoUrl,
    stableUrl,
    originalUrl,
    currentUrl: current.url,
    assetUrl: nullableString(assetUrl),
    proxyUrl: nullableString(proxyUrl),
    selectedRenderUrl: nullableString(current.url),
    currentUrlSource: current.source,
    storageKey,
    bucket,
    storageProvider,
    isPrivateBucket,
    resolvedUrl,
    canvasNodeCardSrc: current.proxiedSrc || current.url,
    selectedUrl: current.url,
    selectedUrlSource: current.source,
    recoveryStatus: recoveryStatus || null,
    error: error || null,
    unrecoverable,
    resolveBatchStatus: resolveBatchStatus || null,
    resolveBatchResult: Object.keys(lastResolveResult).length ? lastResolveResult : null,
    storageKeyFailureReason: reason,
    attemptedUrls,
    failedUrls,
    signedUrlAvailable,
    signedUrlGenerated,
    signedUrlError: stringValue(lastResolveResult.signedUrlError) || null,
    proxyAvailable,
    proxyFallbackUrl,
    proxyFallbackStatus,
    proxyFallbackOk: typeof proxyFallbackStatus === 'number' ? proxyFallbackStatus >= 200 && proxyFallbackStatus < 300 : null,
    whyUnrecoverable,
    whyNotRecoverable: whyUnrecoverable,
    canRecover: hasAnyRecoverableSource(node),
    nextAction,
    isRecovering: metadata.isRecovering === true || metadata.recovering === true,
    isRegenerating: metadata.isRegenerating === true || metadata.regenerating === true,
    errorCode,
    errorMessage: nullableString(errorMessage),
    upstreamStatus: typeof lastGenerationError.upstreamStatus === 'number'
      ? lastGenerationError.upstreamStatus
      : typeof lastResolveResult.upstreamStatus === 'number'
        ? lastResolveResult.upstreamStatus
        : null,
      upstreamMessage: nullableString(stringValue(lastGenerationError.upstreamMessage) || stringValue(lastResolveResult.upstreamMessage)),
      requestId: nullableString(stringValue(lastGenerationError.requestId) || stringValue(lastResolveResult.requestId)),
      providerEndpoint: nullableString(stringValue(lastGenerationError.providerEndpoint) || stringValue(metadata.providerEndpoint)),
      providerRequestMethod: nullableString(stringValue(lastGenerationError.providerRequestMethod) || stringValue(metadata.providerRequestMethod)),
      providerHttpStatus: typeof lastGenerationError.providerHttpStatus === 'number'
        ? lastGenerationError.providerHttpStatus
        : typeof metadata.providerHttpStatus === 'number'
          ? metadata.providerHttpStatus
          : null,
      providerFetchError: nullableString(stringValue(lastGenerationError.providerFetchError) || stringValue(metadata.providerFetchError)),
      providerFetchCause: sanitizeDiagnosticValue(lastGenerationError.providerFetchCause ?? metadata.providerFetchCause ?? null),
      regenerateInputPreview: sanitizeDiagnosticValue(metadata.regenerationInputPreview ?? null),
    submittedInput: sanitizeDiagnosticValue(lastGenerationError.submittedInput ?? metadata.submittedInput ?? lastResolveResult.submittedInput ?? null),
    generationHealth,
    missingEnv,
    hasRecoverableSource: hasAnyRecoverableSource(node),
    urlCandidates: mediaSourcesForNode(node).map((candidate) => ({ ...candidate, proxiedUrl: getProxiedMediaUrl(candidate.url) })),
    lastGenerationError: Object.keys(lastGenerationError).length ? lastGenerationError : null,
    metadataJson: node.metadataJson,
  }
}

function shouldPromotePromptRegeneration(item: ReturnType<typeof buildDiagnostic>) {
  const terminal = new Set([
    'ASSET_NOT_FOUND_BY_NODE',
    'asset_not_found_by_node',
    'no_recovery_source',
    'old_url_expired',
    'provider_media_download_failed',
  ])
  const status = item.recoveryStatus || item.errorCode || item.resolveBatchStatus || ''
  return Boolean(
    item.prompt
    && (
      item.unrecoverable
      || terminal.has(status)
      || (!item.assetId && item.urlCandidates.length === 0)
      || item.nextAction === 'regenerate_from_prompt'
    ),
  )
}

function patchFromResolved(node: VisualCanvasNode, result: AssetResolveResult): Partial<VisualCanvasNode> {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const resolvedUrl = stringValue(result.resolvedUrl) || stringValue(result.stableUrl)
  const recoveryStatus = stringValue(result.recoveryStatus) || stringValue(result.status) || (resolvedUrl ? 'ready' : 'missing')
  const nextMetadata = {
    ...metadata,
    ...(result.assetId ? { assetId: result.assetId } : {}),
    ...(resolvedUrl ? { assetUrl: resolvedUrl, resolvedUrl, stableUrl: resolvedUrl } : {}),
    assetResolveStatus: stringValue(result.status) || recoveryStatus,
    recoveryStatus,
    ...(result.storageKey ? { storageKey: result.storageKey } : {}),
    ...(result.storageProvider ? { storageProvider: result.storageProvider } : {}),
    ...(result.bucket ? { bucket: result.bucket } : {}),
    ...(result.providerJobId ? { providerJobId: result.providerJobId } : {}),
    ...(result.error || result.message ? { error: result.error || result.message } : {}),
    p0LastResolveResult: result,
    p0LastResolveAt: new Date().toISOString(),
    mediaPersistence: {
      ...mediaPersistence,
      status: resolvedUrl ? 'persisted' : stringValue(result.status) || recoveryStatus,
      ...(result.assetId ? { assetId: result.assetId } : {}),
      ...(resolvedUrl ? { resolvedUrl, stableUrl: resolvedUrl } : {}),
      ...(result.storageKey ? { storageKey: result.storageKey } : {}),
      ...(result.storageProvider ? { storageProvider: result.storageProvider } : {}),
      ...(result.bucket ? { bucket: result.bucket } : {}),
      ...(result.mediaPersistence && typeof result.mediaPersistence === 'object' ? recordValue(result.mediaPersistence) : {}),
      p0DebugPatchedAt: new Date().toISOString(),
      actionTaken: result.actionTaken,
    },
  }
  return {
    ...(result.assetId ? { assetId: result.assetId } : {}),
    ...(resolvedUrl && node.kind === 'image' ? { resultImageUrl: resolvedUrl } : {}),
    ...(resolvedUrl && node.kind === 'video' ? {
      resultVideoUrl: resolvedUrl,
      preview: { ...(node.preview ?? { type: 'remote-video' as const }), type: 'remote-video' as const, url: resolvedUrl, poster: result.thumbnailUrl ?? node.preview?.poster },
    } : {}),
    errorMessage: resolvedUrl ? undefined : result.error || result.message || node.errorMessage,
    metadataJson: nextMetadata,
  }
}

function oldUrlCandidate(node: VisualCanvasNode) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const sources = mediaSourcesForNode(node)
  const source = firstString([
    ['metadata.originalUrl', metadata.originalUrl],
    ['metadata.originalProviderUrl', metadata.originalProviderUrl],
    ['metadata.originalProviderImageUrl', metadata.originalProviderImageUrl],
    ['metadata.originalProviderVideoUrl', metadata.originalProviderVideoUrl],
    ['metadata.providerUrl', metadata.providerUrl],
    ['metadata.currentUrl', metadata.currentUrl],
    ['metadata.mediaPersistence.originalUrl', mediaPersistence.originalUrl],
    ['metadata.mediaPersistence.url', mediaPersistence.url],
    ['node.resultImageUrl', node.resultImageUrl],
    ['node.resultVideoUrl', node.resultVideoUrl],
    [sources[0]?.source ?? 'canvas-current-source', sources[0]?.url],
  ])
  return source.value ? source : { source: '', value: '' }
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

async function readJson(response: Response) {
  return await response.json().catch(() => ({})) as Record<string, unknown>
}

function externalConnectivityTone(ok?: boolean | null) {
  if (ok === true) return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
  if (ok === false) return 'border-red-300/25 bg-red-300/10 text-red-50'
  return 'border-white/10 bg-white/[0.04] text-white/60'
}

function errorCauseDetails(error: unknown) {
  if (!(error instanceof Error)) return { name: 'UnknownError', message: String(error || 'Unknown error') }
  const cause = (error as Error & { cause?: unknown }).cause
  return {
    name: error.name,
    message: error.message,
    causeName: cause instanceof Error ? cause.name : undefined,
    causeMessage: cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined,
  }
}

function visibleGenerationFailureCode(result: Partial<GenerateResponseShape> & { message?: string; errorCode?: string }) {
  const rawCode = result.errorCode || ''
  const message = `${result.message || ''} ${result.upstreamMessage || ''} ${result.providerFetchError || ''}`.toLowerCase()
  if (rawCode === 'provider_timeout' || /timeout|abort/.test(`${rawCode} ${message}`)) return 'provider_timeout'
  if (rawCode === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(`${rawCode} ${message}`)) return 'provider_network_failed'
  if (rawCode === 'provider_response_parse_failed') return 'provider_response_parse_failed'
  if (rawCode === 'provider_auth_failed' || rawCode === 'provider_auth_error' || result.upstreamStatus === 401 || result.upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(message)) return 'provider_auth_failed'
  if (rawCode === 'provider_model_invalid' || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|does not exist)|模型|接入点/.test(`${rawCode} ${message}`)) return 'provider_model_invalid'
  if (rawCode === 'provider_invalid_parameter' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(message)) return 'provider_invalid_parameter'
  if (rawCode === 'provider_no_download_url') return 'provider_no_download_url'
  if (rawCode === 'provider_media_download_failed' || rawCode === 'MEDIA_FETCH_FAILED' || rawCode === 'ASSET_DOWNLOAD_FAILED' || rawCode === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(message)) return 'provider_media_download_failed'
  return rawCode || 'generation_failed'
}

function healthTone(section?: GenerationHealthSection) {
  if (!section) return 'border-white/10 bg-white/[0.04] text-white/60'
  return section.ok
    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
    : 'border-amber-300/25 bg-amber-300/10 text-amber-50'
}

function HealthStatusItem({
  label,
  section,
}: {
  label: string
  section?: GenerationHealthSection
}) {
  return (
    <div className={`rounded-lg border p-3 ${healthTone(section)}`}>
      <div className="text-white/48">{label}</div>
      <div className="mt-1 font-mono text-xs">{section ? (section.ok ? 'ok' : 'missing_env') : 'not_loaded'}</div>
      {section?.provider ? <div className="mt-1 break-all text-[11px] text-white/54">{section.provider}</div> : null}
      {section && section.missingEnv.length > 0 ? (
        <div className="mt-2 break-words text-[11px] leading-snug">
          缺少：{section.missingEnv.join(', ')}
        </div>
      ) : null}
    </div>
  )
}

function ConnectivityStatusItem({
  label,
  ok,
  detail,
}: {
  label: string
  ok?: boolean | null
  detail?: string | null
}) {
  return (
    <div className={`rounded-lg border p-3 ${externalConnectivityTone(ok)}`}>
      <div className="text-white/48">{label}</div>
      <div className="mt-1 font-mono text-xs">{ok === true ? 'ok' : ok === false ? 'failed' : 'not_run'}</div>
      {detail ? <div className="mt-1 break-all text-[11px] leading-snug text-white/62">{detail}</div> : null}
    </div>
  )
}

export function P0MediaDebugPanel({
  open,
  projectId,
  workflowId,
  nodes,
  generationHealth = null,
  onClose,
  onPatchNode,
}: P0MediaDebugPanelProps) {
  const [busyNodeId, setBusyNodeId] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [copyState, setCopyState] = useState('')
  const [projectStateCopy, setProjectStateCopy] = useState('')
  const [connectivity, setConnectivity] = useState<ExternalConnectivityResponse | null>(null)
  const [connectivityBusy, setConnectivityBusy] = useState(false)
  const [connectivityCopy, setConnectivityCopy] = useState('')

  const mediaNodes = useMemo(() => nodes.filter((node) => node.kind === 'image' || node.kind === 'video'), [nodes])
  const diagnostics = useMemo(
    () => mediaNodes.map((node) => buildDiagnostic(node, projectId, workflowId, generationHealth)),
    [mediaNodes, projectId, workflowId, generationHealth],
  )

  if (!open) return null

  function setNodeMessage(nodeId: string, message: string) {
    setMessages((current) => ({ ...current, [nodeId]: message }))
  }

  async function runNodeAction(node: VisualCanvasNode, label: string, action: () => Promise<void>) {
    setBusyNodeId(node.id)
    setNodeMessage(node.id, `${label}...`)
    try {
      await action()
    } catch (error) {
      setNodeMessage(node.id, error instanceof Error ? error.message : `${label}失败。`)
    } finally {
      setBusyNodeId('')
    }
  }

  async function resolveByAssetId(node: VisualCanvasNode, assetId: string) {
    const response = await fetch('/api/assets/resolve-batch', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ assetIds: [assetId], projectId }),
    })
    const data = await readJson(response) as { assets?: AssetResolveResult[]; message?: string; errorCode?: string }
    const result = Array.isArray(data.assets) ? data.assets[0] : undefined
    if (!response.ok || !result) throw new Error(data.message || data.errorCode || 'resolve-batch 没有返回该 asset。')
    onPatchNode(node.id, patchFromResolved(node, result))
    setNodeMessage(node.id, result.resolvedUrl ? `resolve 成功：${result.status}` : `resolve 返回：${result.status || result.recoveryStatus || 'missing'}`)
  }

  async function lookupByNodeId(node: VisualCanvasNode) {
    const response = await fetch('/api/assets/resolve-by-node', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        nodeId: node.id,
        projectId,
        workflowId,
        legacyUrls: mediaSourcesForNode(node).map((candidate) => ({ url: candidate.url, source: candidate.source })),
      }),
    })
    const data = await readJson(response) as AssetResolveResult & { message?: string; errorCode?: string }
    if (!response.ok || !data.assetId) {
      throw new Error(data.message || data.errorCode || '没有从 nodeId 找到已有 Asset。')
    }
    onPatchNode(node.id, patchFromResolved(node, data))
    setNodeMessage(node.id, data.resolvedUrl ? `已通过 nodeId 找到并解析 Asset：${data.assetId}` : `找到 Asset：${data.assetId}，但状态为 ${data.status}`)
  }

  async function recoverAsset(node: VisualCanvasNode) {
    const assetId = getNodeAssetIdWithSource(node).value
    if (!assetId) {
      await lookupByNodeId(node).catch(async () => {
        await resyncOldUrl(node)
      })
      return
    }
    const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/recover`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const data = await readJson(response) as AssetResolveResult & { message?: string; errorCode?: string }
    if (!response.ok) throw new Error(data.message || data.errorCode || '恢复 Asset 失败。')
    onPatchNode(node.id, patchFromResolved(node, data))
    setNodeMessage(node.id, data.resolvedUrl ? `恢复成功：${data.recoveryStatus || data.status}` : `恢复返回：${data.recoveryStatus || data.status || data.error}`)
  }

  async function resyncOldUrl(node: VisualCanvasNode) {
    const old = oldUrlCandidate(node)
    if (!old.value) throw new Error('该节点没有可重新导入的旧 URL。')
    const metadata = recordValue(node.metadataJson)
    const response = await fetch('/api/media/resync', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        url: old.value,
        type: node.kind,
        projectId,
        workflowId,
        nodeId: node.id,
        filenameHint: `${node.title || node.id}-${node.kind === 'image' ? 'image.png' : 'video.mp4'}`,
        metadata: {
          ...metadata,
          p0ResyncSource: old.source,
        },
      }),
    })
    const data = await readJson(response) as AssetResolveResult & { success?: boolean; stableUrl?: string; message?: string; errorCode?: string }
    if (!response.ok || data.success === false || !data.assetId) {
      throw new Error(data.message || data.errorCode || '旧 URL 重新导入失败。')
    }
    onPatchNode(node.id, patchFromResolved(node, {
      ...data,
      resolvedUrl: data.resolvedUrl ?? data.stableUrl ?? null,
      status: 'ready',
      recoveryStatus: 'recovered_from_old_url',
      actionTaken: 'reuploaded_from_original_url',
    }))
    setNodeMessage(node.id, `已从 ${old.source} 重新导入 OSS 并写回 assetId。`)
  }

  async function regenerateFromPrompt(node: VisualCanvasNode) {
    if (node.kind !== 'image' && node.kind !== 'video') return
    const prompt = node.prompt?.trim()
      const failGeneration = (result: Partial<GenerateResponseShape> & { message?: string; errorCode?: string }) => {
        const code = visibleGenerationFailureCode(result)
        const rawCode = result.errorCode || code
        const message = result.message || code
        const missingEnv = result.missingEnvKeys?.length ? result.missingEnvKeys : result.missingEnv
        const metadata = recordValue(node.metadataJson)
        onPatchNode(node.id, {
        status: 'error',
        errorMessage: [
          code,
          message,
          missingEnv?.length ? `missingEnv=${missingEnv.join(', ')}` : '',
            result.upstreamStatus ? `upstreamStatus=${result.upstreamStatus}` : '',
            result.upstreamMessage ? `upstreamMessage=${result.upstreamMessage}` : '',
            result.requestId ? `requestId=${result.requestId}` : '',
            result.providerEndpoint ? `providerEndpoint=${result.providerEndpoint}` : '',
            result.providerRequestMethod ? `providerRequestMethod=${result.providerRequestMethod}` : '',
            result.providerHttpStatus ? `providerHttpStatus=${result.providerHttpStatus}` : '',
            result.providerFetchError ? `providerFetchError=${result.providerFetchError}` : '',
          ].filter(Boolean).join(' · '),
          metadataJson: {
            ...metadata,
          recoveryStatus: code,
          mediaRecoveryStatus: 'generation_failed',
          nextAction: code === 'provider_env_missing' || code === 'missing_generation_input' ? 'manual_debug' : 'regenerate_from_prompt',
          isRecovering: false,
          recovering: false,
          isRegenerating: false,
          regenerating: false,
          loading: false,
          errorCode: code,
          errorMessage: message,
            upstreamStatus: result.upstreamStatus,
            upstreamMessage: result.upstreamMessage,
            requestId: result.requestId,
            providerEndpoint: result.providerEndpoint,
            providerRequestMethod: result.providerRequestMethod,
            providerHttpStatus: result.providerHttpStatus,
            providerFetchError: result.providerFetchError,
            providerFetchCause: sanitizeDiagnosticValue(result.providerFetchCause ?? null),
            submittedInput: sanitizeDiagnosticValue(result.submittedInput ?? null),
            lastGenerationError: {
              errorCode: code,
              rawErrorCode: result.rawCode || rawCode,
              message,
              upstreamStatus: result.upstreamStatus,
              upstreamMessage: result.upstreamMessage,
              requestId: result.requestId,
              providerEndpoint: result.providerEndpoint,
              providerRequestMethod: result.providerRequestMethod,
              providerHttpStatus: result.providerHttpStatus,
              providerFetchError: result.providerFetchError,
              providerFetchCause: sanitizeDiagnosticValue(result.providerFetchCause ?? null),
              missingEnv,
              missingFields: result.missingFields,
              submittedInput: sanitizeDiagnosticValue(result.submittedInput ?? null),
            providerResponse: sanitizeDiagnosticValue(result.providerResponse ?? null),
            at: new Date().toISOString(),
          },
        },
      })
    }
    if (!prompt) {
      const result = {
        errorCode: 'missing_generation_input',
        message: 'missing_generation_input：缺少 prompt。',
        missingFields: ['prompt'],
        submittedInput: { projectId, workflowId, nodeId: node.id, kind: node.kind, hasPrompt: false },
      }
      failGeneration(result)
      throw new Error(result.message)
    }
    if (!projectId) {
      const result = {
        errorCode: 'missing_generation_input',
        message: 'missing_generation_input：缺少 projectId。',
        missingFields: ['projectId'],
        submittedInput: { projectId, workflowId, nodeId: node.id, kind: node.kind, hasPrompt: true },
      }
      failGeneration(result)
      throw new Error(result.message)
    }
    const statusResponse = await fetch(`/api/generate/${node.kind}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const statusData = await statusResponse.json().catch(() => ({})) as ProviderStatusResponse
    const defaultProviderId = statusData.defaultProviderId
      || statusData.providers?.find((item) => item.available)?.providerId
      || ''
    const providerId = providerForRegenerationNode(node) || defaultProviderId
    const provider = statusData.providers?.find((item) => item.providerId === providerId)
      ?? statusData.providers?.find((item) => item.providerId === defaultProviderId)
    const selectedProviderId = provider?.providerId || providerId
    const model = provider && 'model' in provider && typeof provider.model === 'string' && provider.model.trim()
      ? provider.model.trim()
      : modelForRegenerationNode(node)
    const selectedModel = model || selectedProviderId
    const params = buildRegenerationParams(node)
    const inputAssets = buildRegenerationInputAssets(node)
    const submittedInputBase = {
      projectId,
      workflowId,
      nodeId: node.id,
      kind: node.kind,
      promptChars: prompt.length,
      providerId: selectedProviderId || null,
      model: model || selectedModel || null,
      aspectRatio: params.aspectRatio ?? null,
      duration: params.duration ?? null,
      resolution: params.resolution ?? null,
      inputAssets: inputAssets?.map((asset) => ({ id: asset.id, type: asset.type, hasUrl: Boolean(asset.url), url: summarizeUrlForDiagnostics(asset.url) })) ?? null,
    }
    if (!statusResponse.ok || statusData.success === false) {
      const result = {
        errorCode: statusData.errorCode || 'provider_env_missing',
        message: statusData.message || 'Provider health check 失败。',
        submittedInput: submittedInputBase,
      }
      failGeneration(result)
      throw new Error(result.message)
    }
    if (!selectedProviderId || !provider?.available) {
      const missing = provider?.missingEnvKeys?.length ? provider.missingEnvKeys : provider?.missingEnv
      const result = {
        errorCode: 'provider_env_missing',
        message: `Provider 不可用：${provider?.reason || provider?.status || 'not configured'}${missing?.length ? `；缺少 ${missing.join(', ')}` : ''}`,
        missingEnv: missing,
        missingEnvKeys: missing,
        submittedInput: submittedInputBase,
      }
      failGeneration(result)
      throw new Error(result.message)
    }
      let response: Response
      try {
        response = await fetch(`/api/generate/${node.kind}`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            prompt,
            compiledPrompt: prompt,
            providerId: provider.providerId,
            provider: provider.providerId,
            model,
            projectId,
            workflowId,
            nodeId: node.id,
            kind: node.kind,
            inputAssets,
            aspectRatio: typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined,
            duration: typeof params.duration === 'number' ? params.duration : undefined,
            resolution: typeof params.resolution === 'string' ? params.resolution : undefined,
            params,
          }),
        })
      } catch (error) {
        const cause = errorCauseDetails(error)
        const result = {
          errorCode: 'client_fetch_failed',
          message: `POST /api/generate/${node.kind} fetch failed: ${cause.name}: ${cause.message}`,
          providerFetchError: `${cause.name}: ${cause.message}`,
          providerFetchCause: cause,
          submittedInput: submittedInputBase,
        }
        failGeneration(result)
        throw new Error(result.message)
      }
    const data = await response.json().catch(() => ({})) as GenerateResponseShape
    if (!response.ok || data.success === false) {
      failGeneration({
        ...data,
        submittedInput: data.submittedInput ?? submittedInputBase,
      })
      const message = [
        data.message || data.errorCode || `HTTP ${response.status}`,
        data.upstreamStatus ? `upstream=${data.upstreamStatus}` : '',
        data.upstreamMessage ? `upstreamMessage=${data.upstreamMessage}` : '',
        data.requestId ? `requestId=${data.requestId}` : '',
      ].filter(Boolean).join(' · ')
      throw new Error(message)
    }
    if (data.async && data.taskId) {
      onPatchNode(node.id, {
        status: 'running',
        resultPreview: '视频任务已提交，正在生成中',
        outputLabel: '视频生成中',
        errorMessage: undefined,
        metadataJson: {
          ...recordValue(node.metadataJson),
          providerId: data.providerId,
          model: data.model,
          taskId: data.taskId,
          providerJobId: data.taskId,
          generationJobId: data.jobId,
          p0RegeneratedAt: new Date().toISOString(),
        },
      })
      setNodeMessage(node.id, `已提交异步生成任务：${data.taskId}`)
      return
    }
    const resolvedUrl = stringValue(data.result?.imageUrl)
      || stringValue(data.resultImageUrl)
      || stringValue(data.imageUrl)
      || stringValue(data.result?.videoUrl)
      || stringValue(data.resultVideoUrl)
      || stringValue(data.videoUrl)
      || stringValue(data.assetUrl)
    onPatchNode(node.id, patchFromResolved(node, {
      assetId: data.asset?.id || data.assetId,
      status: 'ready',
      resolvedUrl,
      stableUrl: resolvedUrl,
      thumbnailUrl: data.asset?.thumbnailUrl ?? data.result?.previewUrl,
      recoveryStatus: 'regenerated_from_prompt',
      mediaPersistence: data.mediaPersistence,
      actionTaken: 'recovered_from_provider',
    }))
    setNodeMessage(node.id, data.assetId || data.asset?.id ? '已用原 Prompt 重新生成并写回 assetId。' : '已重新生成；未返回 assetId，请查看 mediaPersistence。')
  }

  async function copyDiagnostic(nodeId?: string) {
    const payload = nodeId
      ? diagnostics.find((item) => item.nodeId === nodeId)
      : {
          projectId,
          workflowId,
          nodeCount: nodes.length,
          mediaNodeCount: diagnostics.length,
          diagnostics,
        }
    try {
      await navigator.clipboard.writeText(formatJson(payload))
      setCopyState(nodeId ? `copied:${nodeId}` : 'copied:all')
      window.setTimeout(() => setCopyState(''), 1400)
    } catch {
      setCopyState('failed')
    }
  }

  async function copyCurrentProjectState() {
    try {
      const suffix = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
      const response = await fetch(`/api/debug/current-project-state${suffix}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const payload = await readJson(response)
      await navigator.clipboard.writeText(formatJson(payload))
      setProjectStateCopy(response.ok ? 'copied' : 'failed')
      window.setTimeout(() => setProjectStateCopy(''), 1400)
    } catch {
      setProjectStateCopy('failed')
    }
  }

  async function runConnectivityTest() {
    setConnectivityBusy(true)
    setConnectivityCopy('')
    try {
      const response = await fetch('/api/generation/connectivity', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const payload = await readJson(response) as ExternalConnectivityResponse
      setConnectivity(payload)
    } catch (error) {
      const cause = errorCauseDetails(error)
      setConnectivity({
        ok: false,
        errorCode: 'client_fetch_failed',
        message: `${cause.name}: ${cause.message}`,
      })
    } finally {
      setConnectivityBusy(false)
    }
  }

  async function copyConnectivityJson() {
    if (!connectivity) return
    try {
      await navigator.clipboard.writeText(formatJson(connectivity))
      setConnectivityCopy('copied')
      window.setTimeout(() => setConnectivityCopy(''), 1400)
    } catch {
      setConnectivityCopy('failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-end bg-black/42 p-4 text-white"
      role="presentation"
      data-no-node-drag="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
    >
      <aside
        className="flex max-h-[calc(100vh-32px)] w-[min(980px,100%)] flex-col overflow-hidden rounded-xl border border-white/12 bg-[#0b0f14]/96 shadow-2xl shadow-black/50 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="P0 媒体自检"
        data-no-node-drag="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/52">P0 Media Debug</p>
            <h2 className="mt-1 text-lg font-semibold text-white">P0 媒体自检</h2>
            <p className="mt-1 text-xs text-white/52">
              项目 {projectId || '未加载'} · 节点 {nodes.length} · 图片/视频 {mediaNodes.length}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/16"
              onClick={() => { void copyCurrentProjectState() }}
            >
              {projectStateCopy === 'copied' ? '已复制项目诊断 JSON' : '复制当前用户项目诊断 JSON'}
            </button>
            <button
              type="button"
              className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/16"
              onClick={() => { void copyDiagnostic() }}
            >
              {copyState === 'copied:all' ? '已复制全部 JSON' : '复制全部诊断 JSON'}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-lg leading-none text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="关闭 P0 媒体自检"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>

        <div className="border-b border-white/10 px-5 py-4 text-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-white/82">生产生成环境</div>
              <div className="mt-1 text-white/46">只显示变量名，不显示值。缺失项需要到 Vercel Production Environment Variables 配置。</div>
            </div>
            <div className={`rounded border px-2 py-1 font-mono ${generationHealth?.ok ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50' : 'border-amber-300/25 bg-amber-300/10 text-amber-50'}`}>
              {generationHealth ? (generationHealth.ok ? 'ok' : 'missing_env') : 'not_loaded'}
            </div>
          </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <HealthStatusItem label="数据库" section={generationHealth?.database} />
              <HealthStatusItem label="OSS" section={generationHealth?.storage} />
              <HealthStatusItem label="图片生成 Provider" section={generationHealth?.imageGeneration} />
              <HealthStatusItem label="视频生成 Provider" section={generationHealth?.videoGeneration} />
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white/82">外接 API 连通性测试</div>
                  <div className="mt-1 font-mono text-[11px] text-white/46">GET /api/generation/connectivity</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-emerald-200/25 bg-emerald-200/10 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-200/16 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={connectivityBusy}
                    onClick={() => { void runConnectivityTest() }}
                  >
                    {connectivityBusy ? '测试中...' : '外接 API 连通性测试'}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/16 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!connectivity}
                    onClick={() => { void copyConnectivityJson() }}
                  >
                    {connectivityCopy === 'copied' ? '已复制连通性 JSON' : connectivityCopy === 'failed' ? '复制失败' : '复制外接 API 连通性 JSON'}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <ConnectivityStatusItem label="火山引擎网络" ok={connectivity?.volcengine?.networkOk ?? null} detail={connectivity?.volcengine?.endpoint ?? null} />
                <ConnectivityStatusItem label="火山引擎鉴权" ok={connectivity?.volcengine?.authOk ?? null} detail={connectivity?.volcengine?.requestId ? `requestId=${connectivity.volcengine.requestId}` : connectivity?.volcengine?.status ? `HTTP ${connectivity.volcengine.status}` : null} />
                <ConnectivityStatusItem label="Seedream 模型" ok={connectivity?.seedream?.ok ?? null} detail={connectivity?.seedream?.model || connectivity?.seedream?.errorCode || null} />
                <ConnectivityStatusItem label="Seedance 模型" ok={connectivity?.seedance?.ok ?? null} detail={connectivity?.seedance?.model || connectivity?.seedance?.errorCode || null} />
                <ConnectivityStatusItem label="OSS signed URL" ok={connectivity?.oss?.signedUrlAvailable ?? null} detail={connectivity?.oss?.bucket ?? null} />
                <ConnectivityStatusItem label="OSS 上传测试" ok={connectivity?.oss?.uploadTestOk ?? null} detail={connectivity?.oss?.errorCode === 'oss_upload_failed' ? connectivity.oss.errorMessage : null} />
                <ConnectivityStatusItem label="OSS 读取测试" ok={connectivity?.oss?.readTestOk ?? null} detail={connectivity?.oss?.errorCode === 'oss_read_failed' ? connectivity.oss.errorMessage : null} />
                <ConnectivityStatusItem label="OSS 删除测试" ok={connectivity?.oss?.deleteTestOk ?? null} detail={connectivity?.oss?.errorCode === 'oss_delete_failed' ? connectivity.oss.errorMessage : null} />
              </div>
              {connectivity?.volcengine?.errorCode || connectivity?.oss?.errorCode || connectivity?.seedream?.errorCode || connectivity?.seedance?.errorCode || connectivity?.errorCode ? (
                <div className="mt-3 rounded-md border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs leading-5 text-red-50">
                  {[
                    connectivity.errorCode ? `client=${connectivity.errorCode}${connectivity.message ? `: ${connectivity.message}` : ''}` : '',
                    connectivity.volcengine?.errorCode ? `volcengine=${connectivity.volcengine.errorCode}${connectivity.volcengine.errorMessage ? `: ${connectivity.volcengine.errorMessage}` : ''}` : '',
                    connectivity.seedream?.errorCode ? `seedream=${connectivity.seedream.errorCode}` : '',
                    connectivity.seedance?.errorCode ? `seedance=${connectivity.seedance.errorCode}` : '',
                    connectivity.oss?.errorCode ? `oss=${connectivity.oss.errorCode}${connectivity.oss.errorMessage ? `: ${connectivity.oss.errorMessage}` : ''}` : '',
                  ].filter(Boolean).join(' · ')}
                </div>
              ) : null}
              {connectivity ? (
                <details className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
                  <summary className="cursor-pointer font-semibold text-white/70">外接 API 连通性 JSON</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-black/35 p-3 text-[11px] leading-5 text-white/62">{formatJson(connectivity)}</pre>
                </details>
              ) : null}
            </div>
          </div>

        <div className="grid gap-3 border-b border-white/10 px-5 py-4 text-xs sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-white/42">当前项目 id</div>
            <div className="mt-1 break-all font-mono text-white/78">{projectId || '(none)'}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-white/42">当前 workflow id</div>
            <div className="mt-1 break-all font-mono text-white/78">{workflowId || '(none)'}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-white/42">当前节点数量</div>
            <div className="mt-1 font-mono text-white/78">{nodes.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="text-white/42">image/video 节点数量</div>
            <div className="mt-1 font-mono text-white/78">{mediaNodes.length}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {diagnostics.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-white/62">
              当前画布还没有 image/video 节点。
            </div>
          ) : (
            <div className="space-y-4">
              {diagnostics.map((item) => {
                const node = mediaNodes.find((candidate) => candidate.id === item.nodeId)
                if (!node) return null
                const busy = busyNodeId === node.id
                const regeneratePrimary = shouldPromotePromptRegeneration(item)
                return (
                  <section key={node.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded border border-white/12 bg-white/[0.05] px-2 py-1 text-xs font-semibold uppercase text-white/70">{item.kind}</span>
                          <h3 className="text-sm font-semibold text-white">{node.title || node.id}</h3>
                          <span className={`rounded border px-2 py-1 text-xs ${item.unrecoverable ? 'border-red-300/25 bg-red-300/10 text-red-100' : item.resolvedUrlExists ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/25 bg-amber-300/10 text-amber-100'}`}>
                            {item.unrecoverable ? 'unrecoverable' : item.resolvedUrlExists ? 'resolved' : item.recoveryStatus || 'needs_check'}
                          </span>
                        </div>
                        <div className="mt-2 break-all font-mono text-xs text-white/48">{node.id}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {regeneratePrimary ? (
                          <button type="button" className="rounded-md border border-amber-200/25 bg-amber-200/10 px-2.5 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-200/16" disabled={busy} onClick={() => { void runNodeAction(node, 'Provider health check / 原 Prompt 重新生成', () => regenerateFromPrompt(node)) }}>
                            用原 Prompt 重新生成并重建 Asset
                          </button>
                        ) : null}
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '重新 resolve', async () => {
                          const assetId = getNodeAssetIdWithSource(node).value
                          if (assetId) await resolveByAssetId(node, assetId)
                          else await lookupByNodeId(node)
                        }) }}>
                          重新 resolve 该节点
                        </button>
                        <button type="button" className={regeneratePrimary ? 'rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/62 hover:bg-white/10' : 'rounded-md border border-emerald-200/25 bg-emerald-200/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-200/16'} disabled={busy} onClick={() => { void runNodeAction(node, '立即恢复资产', () => recoverAsset(node)) }}>
                          立即恢复资产
                        </button>
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '从 nodeId 查找 Asset', () => lookupByNodeId(node)) }}>
                          从 nodeId 查找已有 Asset
                        </button>
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '从旧 URL 重新导入 OSS', () => resyncOldUrl(node)) }}>
                          从旧 URL 重新导入到 OSS
                        </button>
                        {!regeneratePrimary ? (
                          <button type="button" className="rounded-md border border-amber-200/25 bg-amber-200/10 px-2.5 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-200/16" disabled={busy} onClick={() => { void runNodeAction(node, 'Provider health check / 原 Prompt 重新生成', () => regenerateFromPrompt(node)) }}>
                            用原 Prompt 重新生成并重建 Asset
                          </button>
                        ) : null}
                        <button type="button" className="rounded-md border border-cyan-200/25 bg-cyan-200/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-50 hover:bg-cyan-200/16" onClick={() => { void copyDiagnostic(node.id) }}>
                          {copyState === `copied:${node.id}` ? '已复制 JSON' : '复制该节点诊断 JSON'}
                        </button>
                      </div>
                    </div>

                    {messages[node.id] ? (
                      <div className="mt-3 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">
                        {busy ? '处理中：' : ''}{messages[node.id]}
                      </div>
                    ) : null}

                    {regeneratePrimary ? (
                      <div className="mt-3 rounded-md border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs leading-5 text-amber-50">
                        历史 Asset 记录不存在，需要用原 Prompt 重建。
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 text-xs md:grid-cols-3">
                      {[
                        ['position', `${item.position.x}, ${item.position.y}`],
                        ['prompt', item.prompt || '(empty)'],
                        ['assetId', item.assetId || '(none)'],
                        ['assetId 来源字段', item.assetIdSource || '(none)'],
                        ['provider', item.provider || '(none)'],
                        ['generationJobId', item.generationJobId || '(none)'],
                        ['providerJobId', item.providerJobId || '(none)'],
                        ['resultImageUrl 是否存在', item.resultImageUrlExists ? 'yes' : 'no'],
                        ['resultVideoUrl 是否存在', item.resultVideoUrlExists ? 'yes' : 'no'],
                        ['stableUrl 是否存在', item.stableUrlExists ? 'yes' : 'no'],
                        ['originalUrl 是否存在', item.originalUrlExists ? 'yes' : 'no'],
                        ['currentUrl 是否存在', item.currentUrlExists ? 'yes' : 'no'],
                        ['storageKey 是否存在', item.storageKeyExists ? 'yes' : 'no'],
                        ['bucket', item.bucket || '(none)'],
                        ['storageProvider', item.storageProvider || '(none)'],
                        ['resolvedUrl 是否存在', item.resolvedUrlExists ? 'yes' : 'no'],
                        ['CanvasNodeCard 实际使用 src', item.canvasNodeCardSrc || '(none)'],
                        ['selectedUrl', item.selectedUrl || '(none)'],
                        ['resolve-batch 返回状态', item.resolveBatchStatus || '(none)'],
                        ['signedUrl 是否生成成功', item.signedUrlGenerated ? 'yes' : 'no'],
                        ['signedUrl 错误', item.signedUrlError || '(none)'],
                        ['proxy fallback URL', item.proxyFallbackUrl || '(none)'],
                        ['proxy fallback status', item.proxyFallbackStatus ?? '(none)'],
                          ['recoveryStatus', item.recoveryStatus || '(none)'],
                          ['error', item.error || '(none)'],
                          ['providerEndpoint', item.providerEndpoint || '(none)'],
                          ['providerRequestMethod', item.providerRequestMethod || '(none)'],
                          ['providerHttpStatus', item.providerHttpStatus ?? '(none)'],
                          ['providerFetchError', item.providerFetchError || '(none)'],
                          ['providerFetchCause', item.providerFetchCause ? formatJson(item.providerFetchCause) : '(none)'],
                          ['是否 unrecoverable', item.unrecoverable ? 'yes' : 'no'],
                        ['是否有可恢复来源', item.hasRecoverableSource ? 'yes' : 'no'],
                        ['为什么显示 storageKey，无法恢复', item.storageKeyFailureReason],
                        ['为什么最终显示不可恢复', item.whyUnrecoverable],
                        ['最近一次生成错误', item.lastGenerationError ? formatJson(item.lastGenerationError) : '(none)'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-white/10 bg-black/18 p-3">
                          <div className="text-white/38">{label}</div>
                          <div className="mt-1 max-h-24 overflow-auto break-all font-mono leading-5 text-white/76">{value}</div>
                        </div>
                      ))}
                    </div>

                    <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                      <summary className="cursor-pointer font-semibold text-white/70">URL 候选与完整 JSON</summary>
                      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black/35 p-3 text-[11px] leading-5 text-white/62">{formatJson(item)}</pre>
                    </details>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
