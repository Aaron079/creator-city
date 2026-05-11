'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { CHAR_REF_DRAG_MIME, type CharacterReferenceDragPayload } from './CharacterReferenceCard'
import { getNodeImageUrlSources, getNodeVideoUrlSources, type MediaUrlSource } from '@/lib/canvas/media-urls'
import { getAssetIntelligenceTagCount } from '@/lib/asset-intelligence'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import { auditNodeMedia, type MediaRecoveryAudit } from '@/lib/media/recovery-audit'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'asset' | 'template' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'queued' | 'running' | 'generating' | 'done' | 'error'
export type CanvasNodePreviewType = 'text' | 'image' | 'video'
export type VisualCanvasNodePreview = {
  type: 'none' | 'placeholder-video' | 'remote-video'
  url?: string
  poster?: string
  licenseType?: string
  attribution?: string
  gradientFrom?: string
  gradientTo?: string
}

export interface VisualCanvasNode {
  id: string
  type: VisualCanvasNodeKind
  kind: VisualCanvasNodeKind
  title: string
  subtitle: string
  prompt: string
  model: string
  providerId: string
  stage: string
  ratio?: string
  status: VisualCanvasNodeStatus
  resultPreview?: string
  outputLabel?: string
  errorMessage?: string
  preview?: VisualCanvasNodePreview
  resultImageUrl?: string
  resultText?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  assetId?: string
  metadataJson?: unknown
  x: number
  y: number
  width: number
  height: number
  createdAt: number
}

interface CanvasNodeCardProps {
  node: VisualCanvasNode
  active: boolean
  projectId?: string
  workflowId?: string
  onSelect: () => void
  onAddPrev: (event: React.PointerEvent<HTMLButtonElement>) => void
  onAddNext: (event: React.PointerEvent<HTMLButtonElement>) => void
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onOpenContextMenu: (event: React.MouseEvent<HTMLElement>) => void
  onOpenPreview: (type: CanvasNodePreviewType) => void
  onOpenPromptInspector?: () => void
  onOpenMediaDiagnostics?: (type: 'image' | 'video') => void
  onCreateStableCopy?: () => void
  onRecoverMedia?: (nodeId: string, patch: Partial<VisualCanvasNode>) => void
  onRegenerateFromPrompt?: () => void
  enabledSkillCount?: number
  onOpenSkillPanel?: () => void
  creativeAssetLabel?: string
  onOpenCreativeAssets?: () => void
  onOpenAssetIntelligence?: () => void
  onAddToStoryboard?: () => void
  dragging?: boolean
}

const NODE_META: Record<VisualCanvasNodeKind, { icon: string; label: string; empty: string }> = {
  text: {
    icon: '✦',
    label: 'Text',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  image: {
    icon: '◫',
    label: 'Image',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  video: {
    icon: '▻',
    label: 'Video',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  audio: {
    icon: '♫',
    label: 'Audio',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  asset: {
    icon: '↑',
    label: 'Asset',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  template: {
    icon: '◧',
    label: 'Template',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  delivery: {
    icon: '✓',
    label: 'Delivery',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  world: {
    icon: '◎',
    label: 'World',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  upload: {
    icon: '↑',
    label: 'Upload',
    empty: '点击编辑，生成内容会显示在这里。',
  },
}

function getResultPreviewClass(kind: VisualCanvasNodeKind) {
  if (kind === 'image') return 'is-image-result'
  if (kind === 'video') return 'is-video-result'
  if (kind === 'audio') return 'is-audio-result'
  return ''
}

function getStatusLabel(status: VisualCanvasNodeStatus) {
  if (status === 'queued') return '排队中'
  if (status === 'running' || status === 'generating') return '运行中'
  if (status === 'done') return '完成'
  if (status === 'error') return '失败'
  return '待运行'
}

function summarizeTextError(errorMessage?: string) {
  const message = errorMessage?.trim()
  if (!message) return '生成失败，请重试。'
  const lower = message.toLowerCase()
  if ((message.includes('KIMI_TEXT_FAILED') || message.includes('KIMI_REQUEST_TIMEOUT')) && lower.includes('abort')) {
    return 'Kimi 请求超时或被中断，请重试。'
  }
  if (message.includes('KIMI_REQUEST_TIMEOUT')) return 'Kimi 请求超时或被中断，请重试。'
  return message.length > 200 ? `${message.slice(0, 200)}...` : message
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function nestedRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function mediaPersistenceRecord(metadata: Record<string, unknown>) {
  return nestedRecord(metadata.mediaPersistence)
}

function getNodeAssetIdWithSource(node: VisualCanvasNode) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = metadataRecord(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const topMediaPersistence = nestedRecord(nodeRecord.mediaPersistence)
  const assetRecord = nestedRecord(metadata.asset)
  const nodeData = nestedRecord(nodeRecord.data)
  const generationJob = nestedRecord(metadata.generationJob)
  const topGenerationJob = nestedRecord(nodeRecord.generationJob)
  const generationResult = nestedRecord(metadata.generationResult)
  const pluginResult = nestedRecord(metadata.pluginResult)
  const candidates: Array<[string, unknown]> = [
    ['node.assetId', node.assetId],
    ['node.data.assetId', nodeData.assetId],
    ['node.resultAssetId', nodeRecord.resultAssetId],
    ['node.mediaAssetId', nodeRecord.mediaAssetId],
    ['metadata.assetId', metadata.assetId],
    ['metadata.asset.id', assetRecord.id],
    ['metadata.asset_id', metadata.asset_id],
    ['metadata.mediaAssetId', metadata.mediaAssetId],
    ['metadata.resultAssetId', metadata.resultAssetId],
    ['metadata.result_asset_id', metadata.result_asset_id],
    ['metadata.media_asset_id', metadata.media_asset_id],
    ['metadata.outputAssetId', metadata.outputAssetId],
    ['metadata.generationJob.outputAssetId', generationJob.outputAssetId],
    ['node.generationJob.outputAssetId', topGenerationJob.outputAssetId],
    ['metadata.generationResult.outputAssetId', generationResult.outputAssetId],
    ['metadata.pluginResult.outputAssetId', pluginResult.outputAssetId],
    ['metadata.mediaPersistence.assetId', mediaPersistence.assetId],
    ['metadata.mediaPersistence.outputAssetId', mediaPersistence.outputAssetId],
    ['node.mediaPersistence.assetId', topMediaPersistence.assetId],
    ['node.mediaPersistence.outputAssetId', topMediaPersistence.outputAssetId],
  ]
  for (const [source, value] of candidates) {
    const id = stringValue(value)
    if (id) return { value: id, source }
  }
  return { value: '', source: '' }
}

type MediaState = {
  url: string
  source: string
  hasUrl: boolean
  loadFailed: boolean
  isExpiredLikely: boolean
}

type MediaRecoveryStatus = 'idle' | 'checking' | 'recovered' | 'unrecoverable'
type AssetRecoverResponse = {
  success?: boolean
  assetId?: string
  status?: string
  resolvedUrl?: string | null
  stableUrl?: string | null
  storageKey?: string | null
  storageProvider?: string | null
  bucket?: string | null
  providerJobId?: string | null
  recoveryStatus?: string | null
  error?: string | null
  message?: string
  errorCode?: string
  actionTaken?: string
  mediaPersistence?: unknown
  attemptedUrls?: unknown
  failedUrl?: string | null
  upstreamStatus?: number
  upstreamMessage?: string | null
  requestId?: string | null
}

type CandidateProbe = MediaUrlSource & {
  proxiedUrl: string
  proxyStatus: number
  upstreamStatus?: number
  reachable: boolean
}

type RenderFailure = {
  url: string
  source: string
  proxiedUrl: string
  reason: string
  at: string
}

type MediaFailureDiagnosis = {
  code: string
  title: string
  detail: string
  nextAction: string
  canRecover: boolean
}

type MediaDiagnosticPayload = {
  nodeId: string
  kind: VisualCanvasNodeKind
  title: string | null
  prompt: string | null
  provider: string | null
  model: string | null
  projectId: string | null
  workflowId: string | null
  position: { x: number; y: number; width: number; height: number }
  assetId: string | null
  assetIdSource: string | null
  generationJobId: string | null
  providerJobId: string | null
  storageKey: string | null
  bucket: string | null
  originalUrl: string | null
  currentUrl: string | null
  stableUrl: string | null
  resultImageUrl: string | null
  resultVideoUrl: string | null
  resolvedUrl: string | null
  assetUrl: string | null
  selectedRenderUrl: string | null
  canvasNodeCardSrc: string | null
  failedRenderUrl: string | null
  failedRenderReason: string | null
  attemptedUrls: RenderFailure[]
  urlCandidates: Array<MediaUrlSource & { proxiedUrl: string }>
  resolveBatchStatus: string | null
  recoveryStatus: string | null
  storageKeyFailureReason: string | null
  mediaVaultStatus: string | null
  mediaFailureMessage: string | null
  lastGenerationError: Record<string, unknown> | null
  upstreamStatus: number | null
  upstreamMessage: string | null
  errorCode: string | null
  requestId: string | null
  canRecover: boolean
  whyNotRecoverable: string | null
  nextAction: string
  regenerateInputPreview: Record<string, unknown> | null
  submittedInput?: unknown
  providerResponse?: unknown
  missingFields: string[]
  metadataJson: unknown
  copiedAt?: string
}

const REQUIRED_MEDIA_DIAGNOSTIC_FIELDS = [
  'nodeId',
  'kind',
  'title',
  'prompt',
  'provider',
  'model',
  'projectId',
  'workflowId',
  'position',
  'assetId',
  'assetIdSource',
  'generationJobId',
  'providerJobId',
  'storageKey',
  'bucket',
  'originalUrl',
  'currentUrl',
  'stableUrl',
  'resultImageUrl',
  'resultVideoUrl',
  'resolvedUrl',
  'assetUrl',
  'selectedRenderUrl',
  'failedRenderUrl',
  'failedRenderReason',
  'attemptedUrls',
  'urlCandidates',
  'resolveBatchStatus',
  'recoveryStatus',
  'storageKeyFailureReason',
  'mediaVaultStatus',
  'mediaFailureMessage',
  'lastGenerationError',
  'upstreamStatus',
  'upstreamMessage',
  'errorCode',
  'requestId',
  'canRecover',
  'whyNotRecoverable',
  'nextAction',
  'regenerateInputPreview',
] as const

const TERMINAL_RECOVERY_REASONS = new Set([
  'old_url_expired',
  'provider_media_download_failed',
  'no_recovery_source',
  'provider_retrieve_not_available',
  'unrecoverable_provider_retrieve_not_implemented',
  'unrecoverable_provider_expired',
])

const EMPTY_MEDIA_URL_SOURCES: MediaUrlSource[] = []
const EMPTY_RENDER_FAILURES: RenderFailure[] = []

function isTemporarySignedUrl(url: string) {
  const lower = url.toLowerCase()
  return [
    'x-tos-expires',
    'x-tos-signature',
    'x-amz-expires',
    'x-amz-signature',
    'x-oss-expires',
    'x-oss-signature',
    'expires=',
    'signature=',
    'security-token=',
  ].some((pattern) => lower.includes(pattern))
}

function mediaState(source: { url: string; source: string }, loadFailed: boolean): MediaState {
  return {
    ...source,
    hasUrl: Boolean(source.url),
    loadFailed,
    isExpiredLikely: Boolean(source.url && (loadFailed || isTemporarySignedUrl(source.url))),
  }
}

function candidateKey(candidates: MediaUrlSource[]) {
  return candidates.map((candidate) => `${candidate.source}=${candidate.url}`).join('|')
}

async function probeMediaCandidate(candidate: MediaUrlSource): Promise<CandidateProbe> {
  const proxiedUrl = getProxiedMediaUrl(candidate.url)
  if (candidate.url.startsWith('data:')) {
    return { ...candidate, proxiedUrl, proxyStatus: 200, upstreamStatus: 200, reachable: true }
  }
  try {
    const response = await fetch(proxiedUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-1' },
    })
    const upstreamStatusHeader = response.headers.get('x-media-proxy-upstream-status')
    const upstreamStatus = upstreamStatusHeader ? Number(upstreamStatusHeader) : response.status
    return {
      ...candidate,
      proxiedUrl,
      proxyStatus: response.status,
      upstreamStatus: Number.isFinite(upstreamStatus) ? upstreamStatus : response.status,
      reachable: response.ok || response.status === 206,
    }
  } catch {
    return { ...candidate, proxiedUrl, proxyStatus: 0, upstreamStatus: 0, reachable: false }
  }
}

function mediaPersistenceStatus(value: unknown) {
  const record = metadataRecord(value)
  if (record.status === 'persisted' || record.ok === true) return 'persisted'
  if (record.status === 'needs_recovery') return 'needs_recovery'
  if (record.status === 'failed' || record.ok === false || record.errorCode) return 'failed'
  if (record.status === 'disabled') return 'disabled'
  if (record.status === 'skipped') return 'skipped'
  return 'missing'
}

function mediaRecoveryReason(metadata: Record<string, unknown>) {
  return stringValue(metadata.recoveryStatus)
    || stringValue(metadata.assetResolveStatus)
    || stringValue(metadata.mediaRecoveryStatus)
}

function nullableString(value: unknown) {
  const text = stringValue(value)
  return text || null
}

function statusFromRecord(value: unknown) {
  const record = metadataRecord(value)
  return stringValue(record.status) || stringValue(record.recoveryStatus) || stringValue(record.errorCode)
}

function generationJobIdFor(node: VisualCanvasNode) {
  const nodeRecord = node as unknown as Record<string, unknown>
  const metadata = metadataRecord(node.metadataJson)
  return stringValue(metadata.generationJobId)
    || stringValue(metadata.taskId)
    || stringValue(nestedRecord(metadata.generationJob).id)
    || stringValue(nestedRecord(metadata.generationJob).jobId)
    || stringValue(nestedRecord(nodeRecord.generationJob).id)
    || stringValue(nestedRecord(nodeRecord.generationJob).jobId)
}

function providerJobIdFor(metadata: Record<string, unknown>) {
  return stringValue(metadata.providerJobId)
    || stringValue(metadata.taskId)
    || stringValue(nestedRecord(metadata.mediaPersistence).providerJobId)
    || stringValue(nestedRecord(metadata.p0LastResolveResult).providerJobId)
}

function providerForNode(node: VisualCanvasNode, metadata: Record<string, unknown>) {
  return stringValue(metadata.provider)
    || stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(nestedRecord(metadata.mediaPersistence).provider)
    || stringValue(nestedRecord(metadata.p0LastResolveResult).provider)
    || stringValue(node.providerId)
    || stringValue(node.model)
}

function modelForNode(node: VisualCanvasNode, metadata: Record<string, unknown>) {
  return stringValue(metadata.model)
    || stringValue(nestedRecord(metadata.generationParams).model)
    || stringValue(nestedRecord(metadata.params).model)
    || stringValue(node.model)
    || stringValue(node.providerId)
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/s$/i, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function paramValue(metadata: Record<string, unknown>, node: VisualCanvasNode, key: string) {
  const params = nestedRecord(metadata.params)
  const generationParams = nestedRecord(metadata.generationParams)
  const nodeParams = nestedRecord((node as unknown as Record<string, unknown>).params)
  const nodeRecord = node as unknown as Record<string, unknown>
  return metadata[key]
    ?? params[key]
    ?? generationParams[key]
    ?? nodeParams[key]
    ?? nodeRecord[key]
}

function regenerateInputPreviewFor(node: VisualCanvasNode, metadata: Record<string, unknown>, mediaKind: 'image' | 'video') {
  const provider = providerForNode(node, metadata)
  const model = modelForNode(node, metadata)
  const aspectRatio = stringValue(paramValue(metadata, node, 'aspectRatio'))
    || stringValue(paramValue(metadata, node, 'ratio'))
    || stringValue(node.ratio)
    || null
  const duration = numberValue(paramValue(metadata, node, 'duration')) ?? null
  const resolution = stringValue(paramValue(metadata, node, 'resolution'))
    || stringValue(paramValue(metadata, node, 'size'))
    || stringValue(paramValue(metadata, node, 'quality'))
    || null
  const referenceImageUrl = mediaKind === 'video'
    ? stringValue(paramValue(metadata, node, 'imageUrl')) || stringValue(paramValue(metadata, node, 'sourceImageUrl')) || null
    : null
  return {
    prompt: nullableString(node.prompt),
    provider: nullableString(provider),
    model: nullableString(model),
    aspectRatio,
    duration,
    resolution,
    referenceImageUrl,
    nodeId: node.id,
  }
}

function isTerminalRecoveryReason(reason: string) {
  return TERMINAL_RECOVERY_REASONS.has(reason)
}

function responseHasResolvedUrl(result: AssetRecoverResponse) {
  return Boolean(stringValue(result.resolvedUrl) || stringValue(result.stableUrl))
}

function isSuccessfulRecovery(result: AssetRecoverResponse) {
  return result.success !== false && (responseHasResolvedUrl(result) || result.status === 'ready')
}

function normalizedRecoveryCode(result: AssetRecoverResponse, fallback = 'old_url_expired') {
  const code = stringValue(result.errorCode) || stringValue(result.recoveryStatus) || stringValue(result.status)
  if (code === 'MEDIA_SOURCE_EXPIRED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || code === 'MEDIA_FETCH_FAILED') return 'old_url_expired'
  if (code === 'PROVIDER_RETRIEVE_NOT_AVAILABLE' || code === 'provider_retrieve_not_implemented' || code === 'unrecoverable_provider_retrieve_not_implemented') return 'provider_retrieve_not_available'
  return code || fallback
}

function candidateLooksProviderOwned(candidate: MediaUrlSource) {
  return /provider|seedance|seedream|jimeng|volc|runway|luma|pika|kling/i.test(`${candidate.source} ${candidate.url}`)
}

function terminalRecoveryCodeFromAttempts(candidates: MediaUrlSource[], result?: AssetRecoverResponse) {
  const code = result ? normalizedRecoveryCode(result, '') : ''
  if (code === 'provider_retrieve_not_available' || code === 'no_recovery_source') return code
  const message = `${result?.message ?? ''} ${result?.error ?? ''} ${result?.upstreamMessage ?? ''}`.toLowerCase()
  if (message.includes('media download failed') || message.includes('invalid parameter')) return 'provider_media_download_failed'
  if (candidates.some(candidateLooksProviderOwned)) return 'provider_media_download_failed'
  return candidates.length ? 'old_url_expired' : 'no_recovery_source'
}

function normalizeGenerationFailureCode(error: Record<string, unknown>) {
  const code = stringValue(error.errorCode)
  const message = stringValue(error.message)
  const upstreamStatus = typeof error.upstreamStatus === 'number' ? error.upstreamStatus : undefined
  const haystack = `${code} ${message} ${stringValue(error.upstreamMessage)}`.toLowerCase()
  if (Array.isArray(error.missingEnv) && error.missingEnv.length) return 'provider_env_missing'
  if (code === 'PROVIDER_NOT_CONFIGURED' || code.includes('MODEL_REQUIRED') || haystack.includes('not configured')) return 'provider_env_missing'
  if (upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_error'
  if (upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (/invalid parameter|invalid_param|invalid request|bad request|parameter/i.test(haystack)) return 'provider_invalid_parameter'
  if (/prompt.*reject|rejected|sensitive|违规|不合规|blocked/.test(haystack)) return 'prompt_rejected_or_invalid'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'VIDEO_URL_EMPTY' || code === 'IMAGE_URL_EMPTY' || code.includes('URL_MISSING') || code.includes('URL_EMPTY')) return 'provider_no_download_url'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed|external asset/i.test(haystack)) return 'provider_media_download_failed'
  if (code === 'MEDIA_UPLOAD_FAILED') return 'oss_upload_error'
  if (code === 'MEDIA_ASSET_CREATE_FAILED' || code === 'MEDIA_PERSISTENCE_FAILED' || code === 'MEDIA_PERSIST_FAILED') return 'asset_persistence_error'
  if (/canvas|save/.test(haystack)) return 'canvas_save_error'
  return code ? 'generation_failed' : ''
}

function generationFailureMessage(error: Record<string, unknown>) {
  const normalized = normalizeGenerationFailureCode(error)
  const missingEnv = Array.isArray(error.missingEnv) ? error.missingEnv.filter((item): item is string => typeof item === 'string') : []
  const code = stringValue(error.errorCode)
  const upstreamStatus = typeof error.upstreamStatus === 'number' ? error.upstreamStatus : undefined
  const upstreamMessage = stringValue(error.upstreamMessage)
  const message = stringValue(error.message)
  if (normalized === 'provider_env_missing') return `provider_env_missing：缺少 Provider 环境变量${missingEnv.length ? `：${missingEnv.join(', ')}` : '。'}`
  if (normalized === 'provider_auth_error') return `provider_auth_error：Provider 鉴权或权限失败${upstreamStatus ? `（HTTP ${upstreamStatus}）` : ''}${upstreamMessage ? `：${upstreamMessage}` : ''}`
  if (normalized === 'provider_quota_or_billing_error') return `provider_quota_or_billing_error：Provider 额度、余额或限流失败${upstreamStatus ? `（HTTP ${upstreamStatus}）` : ''}${upstreamMessage ? `：${upstreamMessage}` : ''}`
  if (normalized === 'provider_invalid_parameter') return `provider_invalid_parameter：Provider 参数无效${upstreamStatus ? `（HTTP ${upstreamStatus}）` : ''}${upstreamMessage ? `：${upstreamMessage}` : message ? `：${message}` : ''}`
  if (normalized === 'prompt_rejected_or_invalid') return `prompt_rejected_or_invalid：Provider 拒绝了该 prompt 或输入不合法。${upstreamMessage || message || code}`
  if (normalized === 'provider_no_download_url') return `provider_no_download_url：Provider 未返回可下载媒体 URL。${upstreamMessage || message || code}`
  if (normalized === 'provider_media_download_failed') return `provider_media_download_failed：Provider 返回的媒体 URL 无法下载或首帧 URL 不可被 Provider 读取。${upstreamMessage || message || code}`
  if (normalized === 'oss_upload_error') return `oss_upload_error：生成成功后上传到 OSS 失败。${message || code}`
  if (normalized === 'asset_persistence_error') return `asset_persistence_error：媒体持久化或 Asset 写入失败。${message || code}`
  if (normalized === 'canvas_save_error') return `canvas_save_error：Canvas 保存失败。${message || code}`
  if (normalized === 'generation_failed') return `generation_failed：${[code, message, upstreamStatus ? `upstreamStatus=${upstreamStatus}` : '', upstreamMessage].filter(Boolean).join(' · ')}`
  return ''
}

function mediaFailureMessage(metadata: Record<string, unknown>, hasAssetId: boolean) {
  const reason = mediaRecoveryReason(metadata)
  if (reason === 'unrecoverable_blob_url') return '该资产当时只保存为浏览器临时 blob，刷新后无法恢复。'
  if (reason === 'unrecoverable_data_url_without_file') return '该资产只保存了不可解析的 data URL，无法恢复成文件。'
  if (reason === 'unrecoverable_expired_signed_url_without_storage_key') return '该资产只保存了过期临时链接，没有保存永久 storageKey，无法恢复。'
  if (reason === 'unrecoverable_provider_expired') return '原始生成平台链接已过期，且没有可用 providerJobId。'
  if (reason === 'unrecoverable_provider_retrieve_not_implemented') return '该资产有 providerJobId，但当前 provider 尚未接入历史结果取回接口。'
  if (reason === 'unrecoverable_no_record') return '当前画布节点没有 assetId，也没有可恢复的原始 URL。'
  if (reason === 'needs_signed_url') return '对象存储是私有桶，需要签名 URL 才能读取。'
  if (reason === 'proxy_required') return '浏览器不能直接读取该媒体，正在使用代理读取。'
  if (reason === 'missing_env') return '对象存储环境变量缺失，无法生成签名 URL。'
  if (reason === 'storage_permission_error') return '对象存储返回权限错误，需要签名 URL 或代理读取。'
  if (reason === 'object_missing') return '对象存储中没有找到该文件。'
  if (reason === 'signing_error') return '对象存在，但签名 URL 生成失败。'
  if (reason === 'proxy_error') return '代理 fallback 读取失败，请查看恢复详情。'
  if (reason === 'provider_error') return 'Provider 历史结果取回失败。'
  if (reason === 'MEDIA_SOURCE_EXPIRED' || reason === 'ASSET_DOWNLOAD_FAILED') return '旧媒体源当前不可读取，可能已过期或需要权限。'
  if (reason === 'old_url_expired') return '旧媒体 URL 候选已全部尝试，当前不可下载。'
  if (reason === 'provider_media_download_failed') return 'Provider 返回的媒体链接不可下载，或传给 Provider 的首帧/参考图 URL 不可读取。'
  if (reason === 'provider_retrieve_not_available') return 'Provider 历史结果取回不可用，需要用原 Prompt 重新生成。'
  if (reason === 'MEDIA_UPLOAD_FAILED') return '媒体下载成功后转存到对象存储失败。'
  if (reason === 'MEDIA_ASSET_CREATE_FAILED') return '媒体已上传，但 Asset 记录创建失败。'
  if (reason === 'recovery_request_failed') return '资产恢复请求失败，请复制诊断 JSON。'
  if (reason === 'no_recovery_source') return '没有 assetId、storageKey、originalUrl、providerJobId 或旧 URL 可用于恢复。'
  if (reason === 'storage_key_unreadable') return '数据库有 storageKey，但对象存储暂时无法读取。'
  if (reason === 'storage_key_unreadable_without_recovery_source') return '数据库有 storageKey，但签名 URL、代理和历史来源都未能读取。'
  if (reason === 'provider_retrieve_not_implemented') return '该资产有 providerJobId，但当前 provider 尚未接入历史结果取回接口。'
  if (reason === 'needs_recovery') return '正在尝试恢复历史资产。'
  if (!hasAssetId) return '当前画布节点缺少 assetId；可尝试用历史 URL 创建可持久化 Asset。'
  const generationMessage = generationFailureMessage(metadataRecord(metadata.lastError))
  if (generationMessage) return generationMessage
  return stringValue(metadata.error) || 'asset_not_found_by_node：按 nodeId 或 assetId 未解析到可显示媒体。'
}

function getOriginalProviderUrl(metadata: Record<string, unknown>, kind: 'image' | 'video') {
  return kind === 'image'
    ? stringValue(metadata.originalProviderImageUrl) || stringValue(metadata.originalProviderUrl)
    : stringValue(metadata.originalProviderVideoUrl) || stringValue(metadata.originalProviderUrl)
}

function failureDiagnosis(args: {
  node: VisualCanvasNode
  mediaKind: 'image' | 'video'
  metadata: Record<string, unknown>
  assetId: string
  candidates: MediaUrlSource[]
  loadFailed: boolean
  failedRenderUrl: string
}): MediaFailureDiagnosis {
  const { node, metadata, assetId, candidates, loadFailed, failedRenderUrl } = args
  const lastError = metadataRecord(metadata.lastError)
  const generationMessage = generationFailureMessage(lastError)
  if (generationMessage) {
    const code = normalizeGenerationFailureCode(lastError)
    return {
      code,
      title: code,
      detail: generationMessage,
      nextAction: code === 'provider_env_missing' ? '配置缺失的环境变量后再用原 Prompt 重新生成。' : '用原 Prompt 重新生成，或复制诊断 JSON 排查 provider 返回。',
      canRecover: false,
    }
  }

  const reason = mediaRecoveryReason(metadata)
  const hasStorageKey = Boolean(stringValue(metadata.storageKey) || stringValue(nestedRecord(metadata.mediaPersistence).storageKey))
  const providerJobId = providerJobIdFor(metadata)
  const detail = mediaFailureMessage(metadata, Boolean(assetId))
  const withAction = (code: string, title: string, nextAction: string, canRecover = true): MediaFailureDiagnosis => ({
    code,
    title,
    detail,
    nextAction,
    canRecover,
  })

  if (isTerminalRecoveryReason(reason)) {
    const code = reason === 'unrecoverable_provider_retrieve_not_implemented' ? 'provider_retrieve_not_available' : reason
    return {
      code,
      title: code,
      detail,
      nextAction: '用原 Prompt 重新生成并重建 Asset。',
      canRecover: false,
    }
  }
  if (!assetId && !candidates.length) return withAction('no_asset_id', 'no_asset_id', '当前节点没有 assetId，也没有可用 URL；需要用原 Prompt 重新生成。', false)
  if (!assetId && node.id) return withAction('asset_not_found_by_node', 'asset_not_found_by_node', '点击“立即恢复资产”会先按 nodeId 查找 Asset，找不到再尝试旧 URL resync。')
  if (reason === 'object_missing') return withAction('object_missing', 'object_missing', 'OSS 对象不存在；如有旧 URL 会尝试重新导入，否则需要重新生成。', Boolean(candidates.length))
  if (reason === 'storage_permission_error' || reason === 'needs_signed_url') return withAction('storage_permission_error', 'storage_permission_error', '点击“重新 resolve”重新生成 signed URL 或使用 proxy fallback。')
  if (reason === 'signing_error') return withAction('signing_error', 'signing_error', 'signed URL 生成失败；需要检查对象存储签名配置。', false)
  if (reason === 'proxy_error') return withAction('proxy_error', 'proxy_error', 'proxy fallback 失败；复制诊断 JSON 查看 upstream 状态。', Boolean(candidates.length))
  if (!candidates.length) return withAction('no_url_candidates', 'no_url_candidates', '没有 result/stable/current/original/provider URL；需要重新生成。', false)
  if (reason === 'MEDIA_SOURCE_EXPIRED' || reason === 'ASSET_DOWNLOAD_FAILED' || reason === 'unrecoverable_expired_signed_url_without_storage_key' || loadFailed) {
    return withAction('old_url_expired', 'old_url_expired', failedRenderUrl ? '当前渲染 URL 已失败；点击“立即恢复资产”会尝试下一个候选或重新导入旧 URL。' : '旧 URL 可能过期；尝试 resync 或重新生成。', Boolean(candidates.length))
  }
  if (providerJobId && (reason === 'unrecoverable_provider_retrieve_not_implemented' || reason === 'provider_retrieve_not_implemented')) {
    return withAction('provider_retrieve_not_available', 'provider_retrieve_not_available', '有 providerJobId 但未接入 retrieve；需要用原 Prompt 重新生成。', false)
  }
  if (reason === 'missing_env') return withAction('provider_env_missing', 'provider_env_missing', '缺少对象存储或 provider 环境变量；配置后重新 resolve。', false)
  if (hasStorageKey && !candidates.some((candidate) => candidate.source.includes('resolvedUrl') || candidate.source.includes('assetUrl'))) {
    return withAction('storage_permission_error', 'storage_permission_error', 'storageKey 存在但没有可读 URL；点击“重新 resolve”生成可读 URL。')
  }
  return withAction(assetId ? 'asset_not_found_by_node' : 'no_asset_id', assetId ? 'asset_not_found_by_node' : 'no_asset_id', assetId ? '点击“重新 resolve”刷新 Asset 可读 URL。' : '点击“立即恢复资产”先按 nodeId 找 Asset。', Boolean(node.id || candidates.length))
}

function persistedRecoveryMetadata(value: unknown, recoveredAt: string) {
  const record = metadataRecord(value)
  if (record.status === 'persisted' || record.ok === true) return value
  return {
    ...record,
    status: 'persisted',
    source: stringValue(record.source) || 'media-recovery-audit',
    recoveredAt,
  }
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest([
    'button',
    'input',
    'textarea',
    'select',
    'a',
    'video[controls]',
    'audio',
    '[contenteditable="true"]',
    '[data-provider-menu="true"]',
    '[data-no-node-drag="true"]',
    '[data-connection-handle="true"]',
    '[data-node-action="true"]',
    '[data-node-preview-overlay="true"]',
    '.canvas-node-dialog',
    '.canvas-prompt-box',
    '.canvas-context-menu',
    '.canvas-node-add-menu',
    '.canvas-node-create-menu',
    '.canvas-side-panel',
  ].join(',')))
}

function movedBeyondClickThreshold(start: { x: number; y: number } | null, event: { clientX: number; clientY: number }) {
  if (!start) return false
  return Math.abs(event.clientX - start.x) > 6 || Math.abs(event.clientY - start.y) > 6
}

function aspectRatioFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (Math.abs(value - 1.777) < 0.04) return 16 / 9
    if (Math.abs(value - 1) < 0.04) return 1
    if (Math.abs(value - 0.5625) < 0.04) return 9 / 16
    return value
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === '16:9') return 16 / 9
  if (normalized === '9:16') return 9 / 16
  if (normalized === '1:1') return 1
  if (normalized === '4:3') return 4 / 3
  if (normalized === '3:4') return 3 / 4
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric > 0 ? aspectRatioFromValue(numeric) : null
}

function aspectRatioCss(value: number) {
  if (Math.abs(value - 16 / 9) < 0.04) return '16 / 9'
  if (Math.abs(value - 9 / 16) < 0.04) return '9 / 16'
  if (Math.abs(value - 1) < 0.04) return '1 / 1'
  if (Math.abs(value - 4 / 3) < 0.04) return '4 / 3'
  if (Math.abs(value - 3 / 4) < 0.04) return '3 / 4'
  return `${Math.max(0.1, value).toFixed(4)} / 1`
}

function resolveImageAspectRatio(node: VisualCanvasNode, naturalRatio: number | null) {
  const metadata = metadataRecord(node.metadataJson)
  const params = metadata.params && typeof metadata.params === 'object' && !Array.isArray(metadata.params)
    ? metadata.params as Record<string, unknown>
    : {}
  const generationParams = metadata.generationParams && typeof metadata.generationParams === 'object' && !Array.isArray(metadata.generationParams)
    ? metadata.generationParams as Record<string, unknown>
    : {}
  const nodeParams = (node as VisualCanvasNode & { params?: unknown }).params
  const nodeParamsRecord = nodeParams && typeof nodeParams === 'object' && !Array.isArray(nodeParams)
    ? nodeParams as Record<string, unknown>
    : {}
  return aspectRatioFromValue(metadata.aspectRatio)
    ?? aspectRatioFromValue((node as VisualCanvasNode & { aspectRatio?: unknown }).aspectRatio)
    ?? aspectRatioFromValue(params.aspectRatio)
    ?? aspectRatioFromValue(params.ratio)
    ?? aspectRatioFromValue(generationParams.aspectRatio)
    ?? aspectRatioFromValue(generationParams.ratio)
    ?? aspectRatioFromValue(nodeParamsRecord.aspectRatio)
    ?? aspectRatioFromValue(nodeParamsRecord.ratio)
    ?? aspectRatioFromValue(node.ratio)
    ?? naturalRatio
    ?? 16 / 9
}

function resolveVideoAspectRatio(node: VisualCanvasNode) {
  const metadata = metadataRecord(node.metadataJson)
  const params = metadata.params && typeof metadata.params === 'object' && !Array.isArray(metadata.params)
    ? metadata.params as Record<string, unknown>
    : {}
  const generationParams = metadata.generationParams && typeof metadata.generationParams === 'object' && !Array.isArray(metadata.generationParams)
    ? metadata.generationParams as Record<string, unknown>
    : {}
  const nodeParams = (node as VisualCanvasNode & { params?: unknown }).params
  const nodeParamsRecord = nodeParams && typeof nodeParams === 'object' && !Array.isArray(nodeParams)
    ? nodeParams as Record<string, unknown>
    : {}
  return aspectRatioFromValue(metadata.aspectRatio)
    ?? aspectRatioFromValue((node as VisualCanvasNode & { aspectRatio?: unknown }).aspectRatio)
    ?? aspectRatioFromValue(params.aspectRatio)
    ?? aspectRatioFromValue(params.ratio)
    ?? aspectRatioFromValue(generationParams.aspectRatio)
    ?? aspectRatioFromValue(generationParams.ratio)
    ?? aspectRatioFromValue(nodeParamsRecord.aspectRatio)
    ?? aspectRatioFromValue(nodeParamsRecord.ratio)
    ?? aspectRatioFromValue(node.ratio)
    ?? 16 / 9
}

export function CanvasNodeCard({
  node,
  active,
  projectId,
  workflowId,
  onSelect,
  onAddPrev,
  onAddNext,
  onDragStart,
  onOpenContextMenu,
  onOpenPreview,
  onOpenPromptInspector,
  onOpenMediaDiagnostics,
  onRecoverMedia,
  onRegenerateFromPrompt,
  enabledSkillCount = 0,
  onOpenSkillPanel,
  creativeAssetLabel = '创作资产',
  onOpenCreativeAssets,
  onOpenAssetIntelligence,
  onAddToStoryboard,
  dragging = false,
}: CanvasNodeCardProps) {
  const meta = NODE_META[node.kind]
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownInteractiveRef = useRef(false)
  const suppressInteractiveClickRef = useRef(false)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [imageNaturalRatio, setImageNaturalRatio] = useState<number | null>(null)
  const [videoLoadFailed, setVideoLoadFailed] = useState(false)
  const [charRefDragOver, setCharRefDragOver] = useState(false)
  const [copiedDiagnostic, setCopiedDiagnostic] = useState<'node' | 'urls' | null>(null)
  const [imageRenderFailures, setImageRenderFailures] = useState<RenderFailure[]>([])
  const [videoRenderFailures, setVideoRenderFailures] = useState<RenderFailure[]>([])
  const [mediaRecoveryStatus, setMediaRecoveryStatus] = useState<MediaRecoveryStatus>('idle')
  const [selectedImageSource, setSelectedImageSource] = useState<MediaUrlSource | null>(null)
  const [selectedVideoSource, setSelectedVideoSource] = useState<MediaUrlSource | null>(null)
  const recoveryAttemptKeyRef = useRef('')

  function handleVideoPreviewEnter() {
    const video = videoPreviewRef.current
    if (!video) return
    video.muted = true
    video.playsInline = true
    void video.play().catch(() => undefined)
  }

  function handleVideoPreviewLeave() {
    const video = videoPreviewRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }
  const imageCandidateUrls = useMemo(() => (node.kind === 'image' ? getNodeImageUrlSources(node) : []), [node])
  const videoCandidateUrls = useMemo(() => (node.kind === 'video' ? getNodeVideoUrlSources(node) : []), [node])
  const imageCandidateUrlsKey = useMemo(() => candidateKey(imageCandidateUrls), [imageCandidateUrls])
  const videoCandidateUrlsKey = useMemo(() => candidateKey(videoCandidateUrls), [videoCandidateUrls])
  const imageSource = selectedImageSource && imageCandidateUrls.some((candidate) => candidate.url === selectedImageSource.url)
    ? selectedImageSource
    : imageCandidateUrls[0] ?? { url: '', source: '' }
  const videoSource = selectedVideoSource && videoCandidateUrls.some((candidate) => candidate.url === selectedVideoSource.url)
    ? selectedVideoSource
    : videoCandidateUrls[0] ?? { url: '', source: '' }
  const imageMedia = mediaState(node.kind === 'image' ? imageSource : { url: '', source: '' }, imageLoadFailed)
  const videoMedia = mediaState(node.kind === 'video' ? videoSource : { url: '', source: '' }, videoLoadFailed)
  const nodeMetadata = metadataRecord(node.metadataJson)
  const nodeAsset = getNodeAssetIdWithSource(node)
  const nodeAssetId = nodeAsset.value
  const assetIntelligenceTagCount = getAssetIntelligenceTagCount(nodeMetadata.assetIntelligence)
  const persistenceStatus = mediaPersistenceStatus(nodeMetadata.mediaPersistence)
  const assetUrl = stringValue(nodeMetadata.assetUrl)
  const resolvedUrl = stringValue(nodeMetadata.resolvedUrl)
  const stableUrl = stringValue(nodeMetadata.stableUrl)
  const recoveryReason = mediaRecoveryReason(nodeMetadata)
  const activeMedia = node.kind === 'image' ? imageMedia : node.kind === 'video' ? videoMedia : null
  const activeCandidates = node.kind === 'image' ? imageCandidateUrls : node.kind === 'video' ? videoCandidateUrls : EMPTY_MEDIA_URL_SOURCES
  const activeRenderFailures = node.kind === 'image' ? imageRenderFailures : node.kind === 'video' ? videoRenderFailures : EMPTY_RENDER_FAILURES
  const failedRenderUrl = activeRenderFailures[activeRenderFailures.length - 1]?.url ?? ''
  const failedRenderReason = activeRenderFailures[activeRenderFailures.length - 1]?.reason ?? ''
  const mediaVaultStatus = activeMedia?.hasUrl
    ? persistenceStatus === 'persisted' || (resolvedUrl && activeMedia.url === resolvedUrl) || (assetUrl && activeMedia.url === assetUrl) || (stableUrl && activeMedia.url === stableUrl)
      ? { label: '已保存', tone: 'persisted' }
      : persistenceStatus === 'failed'
        ? { label: '转存失败', tone: 'temporary' }
        : (recoveryReason.startsWith('unrecoverable_') || recoveryReason === 'no_recovery_source') && !resolvedUrl && !assetUrl && !stableUrl
          ? { label: '无恢复来源', tone: 'expired' }
          : !assetUrl && activeMedia.isExpiredLikely
            ? { label: '旧链接失败', tone: 'expired' }
          : null
    : null
  const imagePreviewUrl = imageMedia.url
  const videoPreviewUrl = videoMedia.url
  const mediaFailureText = mediaFailureMessage(nodeMetadata, Boolean(nodeAssetId))
  const imageProxiedSrc = getProxiedMediaUrl(imagePreviewUrl)
  const videoProxiedSrc = getProxiedMediaUrl(videoPreviewUrl)
  const selectedRenderUrl = node.kind === 'image' ? imagePreviewUrl : node.kind === 'video' ? videoPreviewUrl : ''
  const selectedRenderSrc = node.kind === 'image' ? imageProxiedSrc : node.kind === 'video' ? videoProxiedSrc : ''
  const hasMediaResult = (node.kind === 'image' && imageMedia.hasUrl) || (node.kind === 'video' && videoMedia.hasUrl)
  const mediaFailureDiagnosis = node.kind === 'image' || node.kind === 'video'
    ? failureDiagnosis({
        node,
        mediaKind: node.kind,
        metadata: nodeMetadata,
        assetId: nodeAssetId,
        candidates: activeCandidates,
        loadFailed: Boolean(activeMedia?.loadFailed),
        failedRenderUrl,
      })
    : null
  const mediaNeedsAttention = Boolean(
    (node.kind === 'image' || node.kind === 'video') &&
    (
      node.status === 'error' ||
      activeMedia?.loadFailed ||
      recoveryReason ||
      statusFromRecord(nodeMetadata.lastError) ||
      (nodeAssetId && !hasMediaResult)
    ),
  )
  const textResult = node.resultText?.trim() ? node.resultText : ''
  const textErrorSummary = node.status === 'error' ? summarizeTextError(node.errorMessage) : ''
  const textDisplay = node.status === 'queued'
    ? '排队中...'
    : node.status === 'running' || node.status === 'generating'
      ? '正在生成文本...'
      : textResult || textErrorSummary || '生成结果会显示在这里。'
  const textIsPlaceholder = !textResult && !textErrorSummary && node.status !== 'queued' && node.status !== 'running' && node.status !== 'generating'
  const className = [
    'canvas-node-card',
    `node-${node.kind}`,
    active ? 'is-active' : '',
    dragging ? 'is-dragging' : '',
    node.status === 'generating' || node.status === 'running' ? 'is-generating' : '',
  ].filter(Boolean).join(' ')
  const imageAspectRatioValue = node.kind === 'image' ? resolveImageAspectRatio(node, imageNaturalRatio) : 16 / 9
  const imageAspectRatioCssValue = aspectRatioCss(imageAspectRatioValue)
  const imageFrameStyle = node.kind === 'image'
    ? {
        '--image-aspect-ratio': imageAspectRatioCssValue,
        aspectRatio: imageAspectRatioCssValue,
        height: imageAspectRatioValue < 1 ? '100%' : 'auto',
        maxHeight: '100%',
        maxWidth: '100%',
        width: imageAspectRatioValue < 1 ? 'auto' : '100%',
      } as CSSProperties
    : undefined
  const videoAspectRatioValue = node.kind === 'video' ? resolveVideoAspectRatio(node) : 16 / 9
  const videoAspectRatioCssValue = aspectRatioCss(videoAspectRatioValue)
  const videoFrameStyle = node.kind === 'video'
    ? {
        '--video-aspect-ratio': videoAspectRatioCssValue,
        aspectRatio: videoAspectRatioCssValue,
        height: videoAspectRatioValue < 1 ? '100%' : 'auto',
        maxHeight: '100%',
        maxWidth: '100%',
        width: videoAspectRatioValue < 1 ? 'auto' : '100%',
      } as CSSProperties
    : undefined
  const canOpenCreativeAssets = Boolean(onOpenCreativeAssets && (node.kind === 'text' || node.kind === 'image' || node.kind === 'video'))
  const canOpenAssetIntelligence = Boolean(onOpenAssetIntelligence && assetIntelligenceTagCount > 0 && (node.kind === 'image' || node.kind === 'video'))
  const mediaPersistence = mediaPersistenceRecord(nodeMetadata)
  const lastResolveResult = metadataRecord(nodeMetadata.p0LastResolveResult || nodeMetadata.p0LastRecoveryResult || nodeMetadata.assetResolveResult)
  const lastGenerationError = metadataRecord(nodeMetadata.lastError)
  const mediaDiagnosticPayload = useMemo<MediaDiagnosticPayload | null>(() => {
    if (node.kind !== 'image' && node.kind !== 'video') return null
    const originalUrl = stringValue(nodeMetadata.originalUrl)
      || getOriginalProviderUrl(nodeMetadata, node.kind)
      || stringValue(mediaPersistence.originalUrl)
    const currentUrl = stringValue(nodeMetadata.currentUrl) || selectedRenderUrl
    const provider = providerForNode(node, nodeMetadata)
    const model = modelForNode(node, nodeMetadata)
    const storageKey = stringValue(nodeMetadata.storageKey) || stringValue(mediaPersistence.storageKey) || stringValue(lastResolveResult.storageKey)
    const bucket = stringValue(nodeMetadata.bucket) || stringValue(mediaPersistence.bucket) || stringValue(lastResolveResult.bucket)
    const resolveBatchStatus = stringValue(lastResolveResult.status) || stringValue(lastResolveResult.recoveryStatus) || recoveryReason
    const recoveryStatus = recoveryReason || stringValue(mediaPersistence.status) || null
    const attemptedUrls = [
      ...activeRenderFailures,
      ...(Array.isArray(nodeMetadata.attemptedUrls) ? nodeMetadata.attemptedUrls : []),
      ...(Array.isArray(lastResolveResult.attemptedUrls) ? lastResolveResult.attemptedUrls : []),
    ]
    const upstreamStatus = typeof lastGenerationError.upstreamStatus === 'number'
      ? lastGenerationError.upstreamStatus
      : typeof lastResolveResult.upstreamStatus === 'number'
        ? lastResolveResult.upstreamStatus
        : null
    const upstreamMessage = stringValue(lastGenerationError.upstreamMessage)
      || stringValue(lastResolveResult.upstreamMessage)
      || null
    const errorCode = stringValue(lastGenerationError.errorCode)
      || stringValue(lastResolveResult.errorCode)
      || mediaFailureDiagnosis?.code
      || null
    const requestId = stringValue(lastGenerationError.requestId)
      || stringValue(lastResolveResult.requestId)
      || null
    const regenerateInputPreview = regenerateInputPreviewFor(node, nodeMetadata, node.kind)
    const diagnostic: MediaDiagnosticPayload = {
      nodeId: node.id,
      kind: node.kind,
      title: nullableString(node.title),
      prompt: nullableString(node.prompt),
      provider: nullableString(provider),
      model: nullableString(model),
      projectId: nullableString(projectId || nodeMetadata.projectId),
      workflowId: nullableString(workflowId || nodeMetadata.workflowId),
      position: { x: node.x, y: node.y, width: node.width, height: node.height },
      assetId: nullableString(nodeAssetId),
      assetIdSource: nullableString(nodeAsset.source),
      generationJobId: nullableString(generationJobIdFor(node)),
      providerJobId: nullableString(providerJobIdFor(nodeMetadata)),
      storageKey: nullableString(storageKey),
      bucket: nullableString(bucket),
      originalUrl: nullableString(originalUrl),
      currentUrl: nullableString(currentUrl),
      stableUrl: nullableString(stableUrl || mediaPersistence.stableUrl),
      resultImageUrl: nullableString(node.resultImageUrl || nodeMetadata.resultImageUrl),
      resultVideoUrl: nullableString(node.resultVideoUrl || nodeMetadata.resultVideoUrl),
      resolvedUrl: nullableString(resolvedUrl),
      assetUrl: nullableString(assetUrl),
      selectedRenderUrl: nullableString(selectedRenderUrl),
      canvasNodeCardSrc: nullableString(selectedRenderSrc),
      failedRenderUrl: nullableString(failedRenderUrl),
      failedRenderReason: nullableString(failedRenderReason),
      attemptedUrls: attemptedUrls as RenderFailure[],
      urlCandidates: activeCandidates.map((candidate) => ({ ...candidate, proxiedUrl: getProxiedMediaUrl(candidate.url) })),
      resolveBatchStatus: nullableString(resolveBatchStatus),
      recoveryStatus: nullableString(recoveryStatus),
      storageKeyFailureReason: nullableString(
        stringValue(lastResolveResult.storageKeyFailureReason)
        || (storageKey && !selectedRenderUrl ? 'storageKey exists but no selected render URL was available.' : ''),
      ),
      mediaVaultStatus: mediaVaultStatus?.label ?? null,
      mediaFailureMessage: mediaFailureDiagnosis?.detail ?? mediaFailureText,
      lastGenerationError: Object.keys(lastGenerationError).length ? lastGenerationError : null,
      upstreamStatus,
      upstreamMessage,
      errorCode,
      requestId,
      canRecover: Boolean(mediaFailureDiagnosis?.canRecover),
      whyNotRecoverable: mediaFailureDiagnosis?.canRecover ? null : mediaFailureDiagnosis?.detail ?? '没有可恢复来源。',
      nextAction: mediaFailureDiagnosis?.nextAction ?? '复制诊断 JSON 后排查。',
      regenerateInputPreview,
      submittedInput: lastGenerationError.submittedInput ?? lastResolveResult.submittedInput ?? null,
      providerResponse: lastGenerationError.providerResponse ?? lastResolveResult.providerResponse ?? null,
      missingFields: [],
      metadataJson: node.metadataJson,
    }
    diagnostic.missingFields = REQUIRED_MEDIA_DIAGNOSTIC_FIELDS.filter((field) => diagnostic[field] === null)
    return diagnostic
  }, [
    activeCandidates,
    activeRenderFailures,
    assetUrl,
    failedRenderReason,
    failedRenderUrl,
    lastGenerationError,
    lastResolveResult,
    mediaFailureDiagnosis,
    mediaFailureText,
    mediaPersistence,
    mediaVaultStatus?.label,
    node,
    nodeAsset.source,
    nodeAssetId,
    nodeMetadata,
    projectId,
    recoveryReason,
    resolvedUrl,
    selectedRenderSrc,
    selectedRenderUrl,
    stableUrl,
    workflowId,
  ])

  const copyNodeDiagnostic = async () => {
    if (!mediaDiagnosticPayload) return
    try {
      await navigator.clipboard?.writeText(JSON.stringify({ ...mediaDiagnosticPayload, copiedAt: new Date().toISOString() }, null, 2))
      setCopiedDiagnostic('node')
      window.setTimeout(() => setCopiedDiagnostic(null), 1400)
    } catch {
      setCopiedDiagnostic(null)
    }
  }

  const copyUrlCandidates = async () => {
    if (!mediaDiagnosticPayload) return
    try {
      await navigator.clipboard?.writeText(JSON.stringify({
        nodeId: node.id,
        kind: node.kind,
        selectedRenderUrl: mediaDiagnosticPayload.selectedRenderUrl,
        canvasNodeCardSrc: mediaDiagnosticPayload.canvasNodeCardSrc,
        failedRenderUrl: mediaDiagnosticPayload.failedRenderUrl,
        attemptedUrls: mediaDiagnosticPayload.attemptedUrls,
        urlCandidates: mediaDiagnosticPayload.urlCandidates,
        copiedAt: new Date().toISOString(),
      }, null, 2))
      setCopiedDiagnostic('urls')
      window.setTimeout(() => setCopiedDiagnostic(null), 1400)
    } catch {
      setCopiedDiagnostic(null)
    }
  }

  const patchRecoveredAsset = (mediaKind: 'image' | 'video', result: AssetRecoverResponse) => {
    if (!onRecoverMedia) return
    const resolvedUrl = typeof result.resolvedUrl === 'string' && result.resolvedUrl.trim()
      ? result.resolvedUrl.trim()
      : typeof result.stableUrl === 'string' && result.stableUrl.trim()
        ? result.stableUrl.trim()
        : ''
    const recoveryStatus = result.recoveryStatus || result.status || result.errorCode || 'no_recovery_source'
    const nextMetadata = {
      ...metadataRecord(node.metadataJson),
      ...(result.assetId ? { assetId: result.assetId } : {}),
      ...(resolvedUrl ? { assetUrl: resolvedUrl, resolvedUrl, stableUrl: resolvedUrl } : {}),
      assetResolveStatus: result.status || recoveryStatus,
      recoveryStatus,
      ...(result.storageKey ? { storageKey: result.storageKey } : {}),
      ...(result.storageProvider ? { storageProvider: result.storageProvider } : {}),
      ...(result.bucket ? { bucket: result.bucket } : {}),
      ...(result.providerJobId ? { providerJobId: result.providerJobId } : {}),
      ...(result.error || result.message || result.errorCode ? { error: result.error || result.message || result.errorCode } : {}),
      p0LastRecoveryResult: result,
      mediaPersistence: {
        ...metadataRecord(metadataRecord(node.metadataJson).mediaPersistence),
        status: resolvedUrl || result.status === 'ready' ? 'persisted' : result.status || recoveryStatus,
        ...(result.assetId ? { assetId: result.assetId } : {}),
        ...(resolvedUrl ? { resolvedUrl, stableUrl: resolvedUrl } : {}),
        ...(result.storageKey ? { storageKey: result.storageKey } : {}),
        ...(result.storageProvider ? { storageProvider: result.storageProvider } : {}),
        ...(result.bucket ? { bucket: result.bucket } : {}),
        ...(result.mediaPersistence && typeof result.mediaPersistence === 'object' ? metadataRecord(result.mediaPersistence) : {}),
        recoveredAt: new Date().toISOString(),
        actionTaken: result.actionTaken,
      },
    }
    onRecoverMedia(node.id, {
      ...(result.assetId ? { assetId: result.assetId } : {}),
      ...(resolvedUrl && mediaKind === 'image' ? { resultImageUrl: resolvedUrl } : {}),
      ...(resolvedUrl && mediaKind === 'video' ? {
        resultVideoUrl: resolvedUrl,
        preview: { ...(node.preview ?? { type: 'remote-video' as const }), type: 'remote-video' as const, url: resolvedUrl },
      } : {}),
      errorMessage: resolvedUrl || result.status === 'ready' ? undefined : result.error || result.message || result.errorCode || node.errorMessage,
      metadataJson: nextMetadata,
    })
  }

  const setRecoveryStatusFromResult = (result: AssetRecoverResponse) => {
    const resolvedUrl = stringValue(result.resolvedUrl) || stringValue(result.stableUrl)
    const status = result.recoveryStatus || result.status || result.errorCode || ''
    setMediaRecoveryStatus(resolvedUrl ? 'recovered' : status.startsWith('unrecoverable_') || status === 'UNRECOVERABLE' || isTerminalRecoveryReason(status) ? 'unrecoverable' : 'idle')
  }

  const appendRenderFailure = (mediaKind: 'image' | 'video', source: MediaUrlSource, reason: string) => {
    if (!source.url) return
    const failure: RenderFailure = {
      url: source.url,
      source: source.source || 'unknown',
      proxiedUrl: getProxiedMediaUrl(source.url),
      reason,
      at: new Date().toISOString(),
    }
    const append = (current: RenderFailure[]) => (
      current.some((item) => item.url === failure.url && item.reason === failure.reason)
        ? current
        : [...current, failure].slice(-12)
    )
    if (mediaKind === 'image') setImageRenderFailures(append)
    else setVideoRenderFailures(append)
    if (onRecoverMedia) {
      const existing = Array.isArray(nodeMetadata.attemptedUrls) ? nodeMetadata.attemptedUrls : []
      onRecoverMedia(node.id, {
        metadataJson: {
          ...metadataRecord(node.metadataJson),
          failedRenderUrl: failure.url,
          failedRenderReason: failure.reason,
          attemptedUrls: [...existing, failure].slice(-12),
          lastRenderFailureAt: failure.at,
        },
      })
    }
  }

  async function resolveAssetBatch(assetId: string) {
    const response = await fetch('/api/assets/resolve-batch', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ assetIds: [assetId] }),
    })
    const data = await response.json().catch(() => ({})) as { assets?: AssetRecoverResponse[]; message?: string; errorCode?: string }
    const result = Array.isArray(data.assets) ? data.assets[0] : undefined
    if (!response.ok || !result) {
      return {
        success: false,
        status: data.errorCode || 'asset_not_found_by_node',
        recoveryStatus: data.errorCode || 'asset_not_found_by_node',
        errorCode: data.errorCode || 'asset_not_found_by_node',
        message: data.message || 'resolve-batch 没有返回该 asset。',
      } satisfies AssetRecoverResponse
    }
    return result
  }

  const resolveCurrentAsset = async (mediaKind: 'image' | 'video') => {
    if (!onRecoverMedia) return
    const recoveryProjectId = projectId || stringValue(nodeMetadata.projectId)
    const recoveryWorkflowId = workflowId || stringValue(nodeMetadata.workflowId)
    setMediaRecoveryStatus('checking')
    try {
      if (nodeAssetId) {
        const result = await resolveAssetBatch(nodeAssetId)
        patchRecoveredAsset(mediaKind, result)
        setRecoveryStatusFromResult(result)
        return
      }
      const lookupResponse = await fetch('/api/assets/resolve-by-node', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          projectId: recoveryProjectId,
          workflowId: recoveryWorkflowId,
        }),
      })
      const lookupData = await lookupResponse.json().catch(() => ({})) as AssetRecoverResponse
      if (!lookupResponse.ok || !lookupData.assetId) {
        const failed = {
          success: false,
          status: lookupData.errorCode || 'asset_not_found_by_node',
          recoveryStatus: lookupData.errorCode || 'asset_not_found_by_node',
          errorCode: lookupData.errorCode || 'asset_not_found_by_node',
          message: lookupData.message || '按 nodeId 没查到已存在 Asset。',
        } satisfies AssetRecoverResponse
        patchRecoveredAsset(mediaKind, failed)
        setRecoveryStatusFromResult(failed)
        return
      }
      const resolved = await resolveAssetBatch(lookupData.assetId)
      patchRecoveredAsset(mediaKind, {
        ...lookupData,
        ...resolved,
        assetId: resolved.assetId || lookupData.assetId,
      })
      setRecoveryStatusFromResult(resolved)
    } catch (error) {
      const failed = {
        success: false,
        status: 'recovery_request_failed',
        recoveryStatus: 'recovery_request_failed',
        errorCode: 'recovery_request_failed',
        message: error instanceof Error ? error.message : '重新 resolve 失败。',
      } satisfies AssetRecoverResponse
      patchRecoveredAsset(mediaKind, failed)
      setRecoveryStatusFromResult(failed)
    }
  }

  const recoverCurrentAsset = async (mediaKind: 'image' | 'video') => {
    if (!onRecoverMedia) return
    const recoveryProjectId = projectId || stringValue(nodeMetadata.projectId)
    const recoveryWorkflowId = workflowId || stringValue(nodeMetadata.workflowId)
    const recoveryCandidates = (mediaKind === 'image' ? imageCandidateUrls : videoCandidateUrls)
      .filter((candidate) => candidate.url && (/^https?:\/\//i.test(candidate.url) || candidate.url.startsWith('data:')))
    const recoveryAttempts: Array<Record<string, unknown>> = []
    setMediaRecoveryStatus('checking')
    try {
      if (nodeAssetId) {
        const response = await fetch(`/api/assets/${encodeURIComponent(nodeAssetId)}/recover`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({})) as AssetRecoverResponse
        recoveryAttempts.push({ step: 'assetId', assetId: nodeAssetId, ok: response.ok, result: data })
        if (response.ok && isSuccessfulRecovery(data)) {
          patchRecoveredAsset(mediaKind, data)
          setRecoveryStatusFromResult(data)
          return
        }
      }

      try {
        const lookupResponse = await fetch('/api/assets/resolve-by-node', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            nodeId: node.id,
            projectId: recoveryProjectId,
            workflowId: recoveryWorkflowId,
          }),
        })
        const lookupData = await lookupResponse.json().catch(() => ({})) as AssetRecoverResponse
        recoveryAttempts.push({ step: 'resolve-by-node', nodeId: node.id, ok: lookupResponse.ok, result: lookupData })
        if (lookupResponse.ok && lookupData.assetId) {
          const resolved = await resolveAssetBatch(lookupData.assetId)
          recoveryAttempts.push({ step: 'resolve-batch', assetId: lookupData.assetId, result: resolved })
          patchRecoveredAsset(mediaKind, {
            ...lookupData,
            ...resolved,
            assetId: resolved.assetId || lookupData.assetId,
          })
          if (isSuccessfulRecovery(resolved)) {
            setRecoveryStatusFromResult(resolved)
            return
          }
        }
      } catch {
        recoveryAttempts.push({ step: 'resolve-by-node', ok: false, error: 'request_failed' })
      }

      if (recoveryCandidates.length) {
        const response = await fetch('/api/media/resync', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            url: recoveryCandidates[0]?.url,
            urls: recoveryCandidates.map((candidate) => ({ url: candidate.url, source: candidate.source })),
            type: mediaKind,
            projectId: recoveryProjectId,
            workflowId: recoveryWorkflowId,
            nodeId: node.id,
            filenameHint: `${node.title || node.id || 'recovered'}-${mediaKind}.${mediaKind === 'image' ? 'png' : 'mp4'}`,
            metadata: {
              ...nodeMetadata,
              urlCandidates: recoveryCandidates,
            },
          }),
        })
        const data = await response.json().catch(() => ({})) as AssetRecoverResponse
        recoveryAttempts.push({ step: 'media-resync', ok: response.ok, result: data })
        if (response.ok && data.success && data.stableUrl && data.assetId) {
          patchRecoveredAsset(mediaKind, {
            success: true,
            assetId: data.assetId,
            status: 'ready',
            resolvedUrl: data.stableUrl,
            recoveryStatus: 'recovered_from_old_url',
            actionTaken: 'reuploaded_from_original_url',
            mediaPersistence: data.mediaPersistence,
          })
          setMediaRecoveryStatus('recovered')
          return
        }
        const terminalCode = terminalRecoveryCodeFromAttempts(recoveryCandidates, data)
        patchRecoveredAsset(mediaKind, {
          success: false,
          status: terminalCode,
          recoveryStatus: terminalCode,
          errorCode: terminalCode,
          error: data.message || data.errorCode || '旧媒体 URL 候选已全部不可下载。',
          actionTaken: 'marked_unrecoverable',
          attemptedUrls: data.attemptedUrls || recoveryAttempts,
          upstreamStatus: data.upstreamStatus,
          upstreamMessage: data.upstreamMessage,
          requestId: data.requestId,
        })
      } else {
        patchRecoveredAsset(mediaKind, {
          success: false,
          status: 'no_recovery_source',
          recoveryStatus: 'no_recovery_source',
          errorCode: 'no_recovery_source',
          error: '当前节点没有 assetId、nodeId 可解析 Asset，也没有可重新导入的旧 URL。',
          actionTaken: 'marked_unrecoverable',
          attemptedUrls: recoveryAttempts,
        })
      }
      setMediaRecoveryStatus('unrecoverable')
    } catch (error) {
      patchRecoveredAsset(mediaKind, {
        success: false,
        status: 'recovery_request_failed',
        recoveryStatus: 'recovery_request_failed',
        error: error instanceof Error ? error.message : '资产恢复请求失败。',
        actionTaken: 'marked_unrecoverable',
      })
      setMediaRecoveryStatus('unrecoverable')
    }
  }

  const selectNextImageCandidate = () => {
    appendRenderFailure('image', imageSource, 'img onError')
    const currentIndex = imageCandidateUrls.findIndex((candidate) => candidate.url === imagePreviewUrl)
    const next = imageCandidateUrls[currentIndex + 1]
    if (next) {
      setSelectedImageSource(next)
      setImageLoadFailed(false)
      return
    }
    setImageLoadFailed(true)
  }

  const selectNextVideoCandidate = () => {
    appendRenderFailure('video', videoSource, 'video onError')
    const currentIndex = videoCandidateUrls.findIndex((candidate) => candidate.url === videoPreviewUrl)
    const next = videoCandidateUrls[currentIndex + 1]
    if (next) {
      setSelectedVideoSource(next)
      setVideoLoadFailed(false)
      return
    }
    setVideoLoadFailed(true)
  }

  useEffect(() => {
    if (node.kind !== 'image') {
      setSelectedImageSource(null)
      setImageRenderFailures([])
      return
    }
    if (!imageCandidateUrls.length) {
      setSelectedImageSource(null)
      setImageLoadFailed(false)
      setImageRenderFailures([])
      return
    }

    let cancelled = false
    setImageLoadFailed(false)
    setImageRenderFailures([])

    void (async () => {
      const probes: CandidateProbe[] = []
      for (const candidate of imageCandidateUrls) {
        const probe = await probeMediaCandidate(candidate)
        probes.push(probe)
        if (cancelled) return
        if (probe.reachable) {
          setSelectedImageSource(candidate)
          setImageLoadFailed(false)
          console.log('[legacy-media-recovery]', {
            nodeId: node.id,
            kind: node.kind,
            metadataJson: node.metadataJson,
            candidateUrls: imageCandidateUrls,
            selectedDisplayUrl: candidate.url,
            proxiedUrl: probe.proxiedUrl,
            proxyStatus: probe.proxyStatus,
            upstreamStatus: probe.upstreamStatus,
          })
          return
        }
      }
      if (!cancelled) {
        setSelectedImageSource(imageCandidateUrls[0] ?? null)
        setImageLoadFailed(true)
        setImageRenderFailures(probes.map((probe) => ({
          url: probe.url,
          source: probe.source,
          proxiedUrl: probe.proxiedUrl,
          reason: `probe failed: proxy=${probe.proxyStatus} upstream=${probe.upstreamStatus ?? 0}`,
          at: new Date().toISOString(),
        })).slice(-12))
        console.log('[legacy-media-recovery]', {
          nodeId: node.id,
          kind: node.kind,
          metadataJson: node.metadataJson,
          candidateUrls: imageCandidateUrls,
          selectedDisplayUrl: '',
          proxiedUrl: probes[0]?.proxiedUrl ?? '',
          proxyStatus: probes[0]?.proxyStatus ?? 0,
          upstreamStatus: probes[0]?.upstreamStatus ?? 0,
          probes,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCandidateUrlsKey, node.id, node.kind])

  useEffect(() => {
    if (node.kind !== 'video') {
      setSelectedVideoSource(null)
      setVideoRenderFailures([])
      return
    }
    if (!videoCandidateUrls.length) {
      setSelectedVideoSource(null)
      setVideoLoadFailed(false)
      setVideoRenderFailures([])
      return
    }

    let cancelled = false
    setVideoLoadFailed(false)
    setVideoRenderFailures([])

    void (async () => {
      const probes: CandidateProbe[] = []
      for (const candidate of videoCandidateUrls) {
        const probe = await probeMediaCandidate(candidate)
        probes.push(probe)
        if (cancelled) return
        if (probe.reachable) {
          setSelectedVideoSource(candidate)
          setVideoLoadFailed(false)
          console.log('[legacy-media-recovery]', {
            nodeId: node.id,
            kind: node.kind,
            metadataJson: node.metadataJson,
            candidateUrls: videoCandidateUrls,
            selectedDisplayUrl: candidate.url,
            proxiedUrl: probe.proxiedUrl,
            proxyStatus: probe.proxyStatus,
            upstreamStatus: probe.upstreamStatus,
          })
          return
        }
      }
      if (!cancelled) {
        setSelectedVideoSource(videoCandidateUrls[0] ?? null)
        setVideoLoadFailed(true)
        setVideoRenderFailures(probes.map((probe) => ({
          url: probe.url,
          source: probe.source,
          proxiedUrl: probe.proxiedUrl,
          reason: `probe failed: proxy=${probe.proxyStatus} upstream=${probe.upstreamStatus ?? 0}`,
          at: new Date().toISOString(),
        })).slice(-12))
        console.log('[legacy-media-recovery]', {
          nodeId: node.id,
          kind: node.kind,
          metadataJson: node.metadataJson,
          candidateUrls: videoCandidateUrls,
          selectedDisplayUrl: '',
          proxiedUrl: probes[0]?.proxiedUrl ?? '',
          proxyStatus: probes[0]?.proxyStatus ?? 0,
          upstreamStatus: probes[0]?.upstreamStatus ?? 0,
          probes,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoCandidateUrlsKey, node.id, node.kind])

  useEffect(() => {
    if (!onRecoverMedia || (node.kind !== 'image' && node.kind !== 'video')) return

    const mediaKind = node.kind
    const resultUrl = mediaKind === 'image' ? stringValue(node.resultImageUrl) : stringValue(node.resultVideoUrl)
    const currentUrl = mediaKind === 'image' ? imagePreviewUrl : videoPreviewUrl
    const loadFailed = mediaKind === 'image' ? imageLoadFailed : videoLoadFailed
    const originalProviderUrl = getOriginalProviderUrl(nodeMetadata, mediaKind) || (!assetUrl ? resultUrl : '')
    const shouldAudit = Boolean(currentUrl || assetUrl || originalProviderUrl)
      && (
        loadFailed
        || (assetUrl && resultUrl !== assetUrl)
        || (!assetUrl && originalProviderUrl && persistenceStatus !== 'persisted')
      )
    if (!shouldAudit) return

    const attemptKey = [
      node.id,
      mediaKind,
      resultUrl,
      currentUrl,
      assetUrl,
      originalProviderUrl,
      persistenceStatus,
      loadFailed ? 'failed' : 'ready',
    ].join('|')
    if (recoveryAttemptKeyRef.current === attemptKey) return
    recoveryAttemptKeyRef.current = attemptKey

    let cancelled = false
    setMediaRecoveryStatus('checking')

    const patchRecoveredNode = (workingUrl: string, audit: MediaRecoveryAudit, extraMetadata?: Record<string, unknown>) => {
      const recoveredAt = new Date().toISOString()
      const recoveredFrom = audit.selectedWorkingSource ?? audit.providerUrl ?? audit.stableAssetUrl ?? audit.currentUrl ?? 'unknown'
      const nextMetadata = {
        ...metadataRecord(node.metadataJson),
        recoveredAt,
        recoveredFrom,
        recoveryStatus: 'recovered',
        mediaPersistence: persistedRecoveryMetadata(nodeMetadata.mediaPersistence, recoveredAt),
        mediaRecoveryAudit: audit,
        mediaRecoveredAt: recoveredAt,
        ...(mediaKind === 'image' && audit.providerUrl ? { originalProviderImageUrl: audit.providerUrl } : {}),
        ...(mediaKind === 'video' && audit.providerUrl ? { originalProviderVideoUrl: audit.providerUrl } : {}),
        ...(extraMetadata ?? {}),
      }
      onRecoverMedia(node.id, {
        ...(mediaKind === 'image' ? { resultImageUrl: workingUrl } : { resultVideoUrl: workingUrl }),
        metadataJson: nextMetadata,
      })
      setMediaRecoveryStatus('recovered')
    }

    void auditNodeMedia(node, mediaKind).then(async (audit) => {
      if (cancelled) return
      if (audit.assetReachable && audit.stableAssetUrl) {
        patchRecoveredNode(audit.stableAssetUrl, audit, { assetUrl: audit.stableAssetUrl })
        return
      }

      const resyncUrl = !audit.hasStableAsset
        ? audit.selectedWorkingUrl ?? (audit.providerReachable ? audit.providerUrl : undefined)
        : undefined

      if (resyncUrl) {
        try {
          const response = await fetch('/api/media/resync', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              url: resyncUrl,
              type: mediaKind,
              nodeId: node.id,
              filenameHint: `${node.title || node.id || 'recovered'}-${mediaKind}.${mediaKind === 'image' ? 'png' : 'mp4'}`,
              metadata: nodeMetadata,
            }),
          })
          const data = await response.json().catch(() => ({})) as {
            success?: boolean
            stableUrl?: string
            assetId?: string
            mediaPersistence?: unknown
            diagnostic?: unknown
          }
          if (!cancelled && response.ok && data.success && data.stableUrl) {
            patchRecoveredNode(data.stableUrl, audit, {
              assetUrl: data.stableUrl,
              assetId: data.assetId,
              mediaPersistence: data.mediaPersistence
                ? { ...metadataRecord(data.mediaPersistence), status: 'persisted' }
                : persistedRecoveryMetadata(nodeMetadata.mediaPersistence, new Date().toISOString()),
              mediaResync: data,
            })
            return
          }
        } catch {
          // Fall through to the unrecoverable state when the visible media has already failed.
        }
      }

      if (audit.selectedWorkingUrl) {
        patchRecoveredNode(audit.selectedWorkingUrl, audit, {
          mediaPersistence: {
            ...metadataRecord(nodeMetadata.mediaPersistence),
            status: mediaPersistenceStatus(nodeMetadata.mediaPersistence),
          },
        })
        return
      }

      setMediaRecoveryStatus(loadFailed && !audit.likelyRecoverable ? 'unrecoverable' : 'idle')
    }).catch(() => {
      if (!cancelled) setMediaRecoveryStatus(loadFailed ? 'unrecoverable' : 'idle')
    })

    return () => {
      cancelled = true
    }
  }, [
    assetUrl,
    imageLoadFailed,
    imagePreviewUrl,
    node,
    nodeMetadata,
    onRecoverMedia,
    persistenceStatus,
    videoLoadFailed,
    videoPreviewUrl,
  ])

  useEffect(() => {
    setImageNaturalRatio(null)
    setMediaRecoveryStatus('idle')
  }, [imagePreviewUrl])

  useEffect(() => {
    setMediaRecoveryStatus('idle')
  }, [videoPreviewUrl])

  const renderMediaRecoveryActions = (mediaKind: 'image' | 'video') => (
    <div className="mt-2 flex w-full flex-wrap gap-1.5" data-no-node-drag="true">
      <button
        type="button"
        data-no-node-drag="true"
        className="rounded border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 text-xs font-semibold text-cyan-50"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void copyNodeDiagnostic()
        }}
      >
        {copiedDiagnostic === 'node' ? '已复制诊断 JSON' : '复制该节点诊断 JSON'}
      </button>
      <button
        type="button"
        data-no-node-drag="true"
        className="rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/78"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void copyUrlCandidates()
        }}
      >
        {copiedDiagnostic === 'urls' ? '已复制 URL 候选' : '复制全部 URL 候选'}
      </button>
      {onRecoverMedia ? (
        <>
          <button
            type="button"
            data-no-node-drag="true"
            className="rounded border border-emerald-200/25 bg-emerald-200/10 px-2 py-1 text-xs font-semibold text-emerald-50"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void recoverCurrentAsset(mediaKind)
            }}
          >
            立即恢复资产
          </button>
          <button
            type="button"
            data-no-node-drag="true"
            className="rounded border border-sky-200/25 bg-sky-200/10 px-2 py-1 text-xs font-semibold text-sky-50"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void resolveCurrentAsset(mediaKind)
            }}
          >
            重新 resolve
          </button>
        </>
      ) : null}
      {onRegenerateFromPrompt ? (
        <button
          type="button"
          data-no-node-drag="true"
          className="rounded border border-amber-200/25 bg-amber-200/10 px-2 py-1 text-xs font-semibold text-amber-50"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRegenerateFromPrompt()
          }}
        >
          用原 Prompt 重新生成并重建 Asset
        </button>
      ) : null}
      {onOpenMediaDiagnostics ? (
        <button
          type="button"
          data-no-node-drag="true"
          className="rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/72"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenMediaDiagnostics(mediaKind)
          }}
        >
          查看恢复详情
        </button>
      ) : null}
    </div>
  )

  const renderMediaFailurePanel = (mediaKind: 'image' | 'video') => (
    <span className={mediaKind === 'image' ? 'canvas-node-image-error' : 'canvas-node-video-error'}>
      <span className="block text-left text-[11px] font-bold uppercase tracking-normal text-red-100">
        {mediaRecoveryStatus === 'checking' ? '正在尝试恢复历史资产...' : mediaFailureDiagnosis?.title ?? 'generation_failed'}
      </span>
      <span className="mt-1 block text-left text-xs leading-snug text-white/82">
        {mediaRecoveryStatus === 'checking'
          ? '正在按 assetId、nodeId、旧 URL 顺序恢复并写回当前节点。'
          : mediaFailureDiagnosis?.detail ?? mediaFailureText}
      </span>
      {mediaFailureDiagnosis?.nextAction ? (
        <span className="mt-1 block text-left text-[11px] leading-snug text-cyan-100/86">
          下一步：{mediaFailureDiagnosis.nextAction}
        </span>
      ) : null}
      {failedRenderUrl ? (
        <span className="mt-1 block max-w-full truncate text-left text-[10px] text-white/45">
          failedRenderUrl: {failedRenderUrl}
        </span>
      ) : null}
      {renderMediaRecoveryActions(mediaKind)}
    </span>
  )

  return (
    <motion.div
      role="button"
      tabIndex={0}
      data-node-drag-root="true"
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      onPointerDownCapture={(event) => {
        if (event.button !== 0) return
        pointerDownPos.current = { x: event.clientX, y: event.clientY }
        pointerDownInteractiveRef.current = isInteractiveTarget(event.target)
        suppressInteractiveClickRef.current = false
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        pointerDownPos.current ??= { x: event.clientX, y: event.clientY }
        if (isInteractiveTarget(event.target)) return
        event.preventDefault()
        event.stopPropagation()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is best-effort; window-level listeners still carry the drag.
        }
        onDragStart(event)
      }}
      onPointerMoveCapture={(event) => {
        if (pointerDownInteractiveRef.current && movedBeyondClickThreshold(pointerDownPos.current, event)) {
          suppressInteractiveClickRef.current = true
        }
      }}
      onClickCapture={(event) => {
        if (!suppressInteractiveClickRef.current || !isInteractiveTarget(event.target)) return
        event.preventDefault()
        event.stopPropagation()
        suppressInteractiveClickRef.current = false
      }}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return
        const down = pointerDownPos.current
        if (movedBeyondClickThreshold(down, event)) return
        onSelect()
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (isInteractiveTarget(event.target)) return
        onSelect()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`${className} group text-left`}
      style={{ width: node.width, height: node.height }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenContextMenu(event)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(CHAR_REF_DRAG_MIME)) return
        if (node.kind !== 'image' && node.kind !== 'video') return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setCharRefDragOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setCharRefDragOver(false)
      }}
      onDrop={(event) => {
        setCharRefDragOver(false)
        if (!event.dataTransfer.types.includes(CHAR_REF_DRAG_MIME)) return
        event.preventDefault()
        event.stopPropagation()
        try {
          const raw = event.dataTransfer.getData(CHAR_REF_DRAG_MIME)
          const payload = JSON.parse(raw) as CharacterReferenceDragPayload
          window.dispatchEvent(new CustomEvent('creator-city:char-ref-drop', {
            detail: {
              nodeId: node.id,
              referenceId: payload.referenceId,
              characterId: payload.characterId,
              imageUrl: payload.imageUrl,
              kind: payload.kind,
              label: payload.label,
            },
          }))
        } catch {
          // Malformed payload — ignore
        }
      }}
    >
      <div className="canvas-node-topline" />
      {charRefDragOver && (node.kind === 'image' || node.kind === 'video') ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-cyan-300/70 bg-cyan-300/10">
          <div className="rounded-xl border border-cyan-200/40 bg-black/70 px-3 py-2 text-xs font-semibold text-cyan-100 backdrop-blur-sm">
            放开绑定角色参考
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddPrev(event)
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        className="canvas-node-connector is-left"
        aria-label="Add previous node"
        data-canvas-connector="true"
        data-connection-handle="true"
        data-node-id={node.id}
        data-handle="left"
      >
        +
      </button>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddNext(event)
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        className="canvas-node-connector is-right"
        aria-label="Add next node"
        data-canvas-connector="true"
        data-connection-handle="true"
        data-node-id={node.id}
        data-handle="right"
      >
        +
      </button>

      <div
        className="relative z-[1] flex h-full flex-col"
      >
        <div className="canvas-node-header">
          <div className="min-w-0 flex items-center gap-2">
            <span className="canvas-node-icon">{meta.icon}</span>
            <div className="min-w-0">
              <div className="canvas-node-kind">{meta.label}</div>
              <div className="canvas-node-title">{node.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`canvas-node-status-text status-${node.status}`}>{getStatusLabel(node.status)}</span>
            <span className={`canvas-node-status-dot status-${node.status}`} aria-hidden="true" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenContextMenu(event)
              }}
              className="canvas-node-more"
              aria-label="Node options"
            >
              ···
            </button>
          </div>
        </div>

        <div className="canvas-node-body">
          {node.kind === 'text' ? (
            <button
              type="button"
              data-no-node-drag="true"
              className={`canvas-node-text-result ${textIsPlaceholder ? 'is-placeholder' : ''} ${node.status === 'error' ? 'is-error' : ''}`}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
              }}
              onWheel={(event) => {
                event.stopPropagation()
              }}
              onWheelCapture={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSelect()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenPreview('text')
              }}
              aria-label="查看或编辑文本结果"
            >
              {node.status === 'error' && textResult ? (
                <span className="canvas-node-text-error">{textErrorSummary}</span>
              ) : null}
              <span className="canvas-node-text-copy">{textDisplay}</span>
            </button>
          ) : hasMediaResult ? (
            <div
              className={`canvas-node-preview preview-${node.kind} ${getResultPreviewClass(node.kind)} ${node.preview?.type === 'placeholder-video' ? 'has-placeholder-preview' : ''}`}
              style={node.preview?.gradientFrom && node.preview?.gradientTo
                ? {
                  '--node-preview-from': node.preview.gradientFrom,
                  '--node-preview-to': node.preview.gradientTo,
                  ...(node.kind === 'image' ? imageFrameStyle : {}),
                  ...(node.kind === 'video' ? videoFrameStyle : {}),
                } as CSSProperties
                : node.kind === 'image' ? imageFrameStyle : node.kind === 'video' ? videoFrameStyle : undefined}
            >
              {mediaVaultStatus ? (
                <span
                  className={`absolute right-2.5 top-2.5 z-[5] inline-flex min-h-[22px] items-center rounded-full border px-2 text-[10px] font-bold leading-none backdrop-blur ${
                    mediaVaultStatus.tone === 'persisted'
                      ? 'border-emerald-300/35 bg-emerald-950/65 text-emerald-100'
                      : mediaVaultStatus.tone === 'temporary'
                        ? 'border-amber-300/35 bg-amber-950/65 text-amber-100'
                        : 'border-red-300/35 bg-red-950/65 text-red-100'
                  }`}
                >
                  {mediaVaultStatus.label}
                </span>
              ) : null}
              {node.kind === 'video' && videoPreviewUrl ? (
                <div
                  className="canvas-node-video-button"
                  onMouseEnter={handleVideoPreviewEnter}
                  onMouseLeave={handleVideoPreviewLeave}
                  aria-label="视频预览拖动区域"
                >
                  {videoMedia.loadFailed ? (
                    renderMediaFailurePanel('video')
                  ) : (
                    <>
                      <video
                        ref={videoPreviewRef}
                        className="canvas-node-preview-video"
                        src={videoProxiedSrc}
                        poster={node.preview?.poster}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ pointerEvents: 'none' }}
                        onError={selectNextVideoCandidate}
                        onLoadedMetadata={() => setVideoLoadFailed(false)}
                        onCanPlay={() => setVideoLoadFailed(false)}
                      />
                      <span className="canvas-node-video-play" aria-hidden="true">▶</span>
                    </>
                  )}
                </div>
              ) : null}
              {node.kind === 'image' && imagePreviewUrl ? (
                <div
                  className="canvas-node-image-button"
                  aria-label="图片预览拖动区域"
                >
                  {imageMedia.loadFailed ? (
                    renderMediaFailurePanel('image')
                  ) : (
                    <img
                      src={imageProxiedSrc}
                      alt={node.title}
                      className="canvas-node-preview-image"
                      loading="lazy"
                      draggable={false}
                      style={{ pointerEvents: 'none' }}
                      onLoad={(event) => {
                        setImageLoadFailed(false)
                        const { naturalWidth, naturalHeight } = event.currentTarget
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          setImageNaturalRatio(naturalWidth / naturalHeight)
                        }
                      }}
                      onError={selectNextImageCandidate}
                    />
                  )}
                </div>
              ) : null}
              <div className="canvas-node-preview-copy">
                {node.resultText || node.resultPreview || node.outputLabel || '结果已生成。'}
                {node.preview?.type === 'placeholder-video' ? (
                  <span className="canvas-node-preview-license">合法占位预览 · 无第三方素材</span>
                ) : null}
                {node.preview?.type === 'remote-video' ? (
                  <span className="canvas-node-preview-license">
                    {node.preview.licenseType === 'original' ? '生成结果' : '参考预览'} · {node.preview.attribution ?? node.preview.licenseType ?? 'licensed source'}
                  </span>
                ) : null}
              </div>
            </div>
          ) : node.status === 'generating' || node.status === 'running' || node.status === 'queued' ? (
            <div className="canvas-node-preview is-generating-preview">
              <div className="canvas-node-loading-bar" />
              <div className="canvas-node-preview-copy">
                {node.kind === 'video'
                  ? (node.resultPreview || node.outputLabel || (node.status === 'queued' ? '排队中...' : '视频生成中，请稍后查询结果'))
                  : node.resultPreview || node.outputLabel || (node.status === 'queued' ? '排队中...' : '运行中...')}
              </div>
            </div>
          ) : mediaNeedsAttention && (node.kind === 'image' || node.kind === 'video') ? (
            <div className={`canvas-node-preview preview-${node.kind} is-error-preview`}>
              {renderMediaFailurePanel(node.kind)}
            </div>
          ) : node.status === 'error' ? (
            <div className="canvas-node-preview is-error-preview">
              <div className="canvas-node-preview-copy">{node.errorMessage || '生成失败，点击重试。'}</div>
            </div>
          ) : (
            <div className={`canvas-node-empty empty-${node.kind}`}>
              <span>{meta.empty}</span>
            </div>
          )}
        </div>
      </div>
      {enabledSkillCount > 0 ? (
        <button
          type="button"
          className="canvas-node-skill-badge"
          data-no-node-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenSkillPanel?.()
          }}
          title="打开风格圣经"
        >
          Skills: {enabledSkillCount}
        </button>
      ) : null}
      {canOpenAssetIntelligence ? (
        <button
          type="button"
          className="absolute right-2 top-9 z-[6] inline-flex min-h-6 items-center rounded-full border border-violet-200/25 bg-violet-200/12 px-2 text-[10px] font-bold text-violet-50 shadow-sm transition hover:border-cyan-200/35 hover:bg-cyan-200/12"
          data-no-node-drag="true"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenAssetIntelligence?.()
          }}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          title="打开智能资产"
        >
          AI Tags: {assetIntelligenceTagCount}
        </button>
      ) : null}
      {(onOpenPromptInspector || canOpenCreativeAssets || onAddToStoryboard) && (node.kind === 'text' || node.kind === 'image' || node.kind === 'video') ? (
        <div className="absolute bottom-2 left-2 z-[6] flex max-w-[calc(100%-16px)] items-center gap-1.5" data-no-node-drag="true">
          {onOpenPromptInspector ? (
            <button
              type="button"
              className="inline-flex min-h-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenPromptInspector()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="查看生成依据"
              title="查看生成依据"
            >
              生成依据
            </button>
          ) : null}
          {canOpenCreativeAssets ? (
            <button
              type="button"
              className="inline-flex min-h-6 min-w-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenCreativeAssets?.()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="打开创作资产"
              title="打开创作资产"
            >
              <span className="truncate">{creativeAssetLabel}</span>
            </button>
          ) : null}
          {onAddToStoryboard ? (
            <button
              type="button"
              className="inline-flex min-h-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-amber-200/30 hover:bg-amber-200/10 hover:text-amber-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onAddToStoryboard()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="加入分镜"
              title="加入当前分镜"
            >
              加入分镜
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}
