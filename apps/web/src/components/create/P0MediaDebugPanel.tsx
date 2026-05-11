'use client'

import { useMemo, useState } from 'react'
import type { VisualCanvasNode } from '@/components/create/CanvasNodeCard'
import { getNodeImageUrlSources, getNodeVideoUrlSources, type MediaUrlSource } from '@/lib/canvas/media-urls'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

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

interface P0MediaDebugPanelProps {
  open: boolean
  projectId: string
  workflowId: string
  nodes: VisualCanvasNode[]
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

function nestedRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function mediaPersistenceRecord(metadata: Record<string, unknown>) {
  return nestedRecord(metadata.mediaPersistence)
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

function buildDiagnostic(node: VisualCanvasNode, projectId: string, workflowId: string) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = mediaPersistenceRecord(metadata)
  const lastResolveResult = recordValue(metadata.p0LastResolveResult || metadata.p0LastRecoveryResult || metadata.assetResolveResult)
  const mediaRecoveryAudit = recordValue(metadata.mediaRecoveryAudit)
  const lastGenerationError = recordValue(metadata.lastError)
  const asset = getNodeAssetIdWithSource(node)
  const generationJob = getGenerationJobId(node)
  const current = currentDisplaySource(node)
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
  const provider = stringValue(metadata.provider)
    || stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(mediaPersistence.provider)
    || stringValue(lastResolveResult.provider)
    || node.providerId
    || node.model
  const resolvedUrl = stringValue(metadata.resolvedUrl) || stringValue(metadata.assetUrl) || stringValue(mediaPersistence.resolvedUrl)
  const recoveryStatus = stringValue(metadata.recoveryStatus) || stringValue(metadata.assetResolveStatus) || stringValue(mediaPersistence.status)
  const error = stringValue(metadata.error) || stringValue(node.errorMessage) || stringValue(mediaPersistence.message) || stringValue(mediaPersistence.errorCode)
  const resolveBatchStatus = stringValue(lastResolveResult.status) || stringValue(lastResolveResult.recoveryStatus) || recoveryStatus
  const proxyFallbackUrl = stringValue(lastResolveResult.proxyFallbackUrl) || getProxiedMediaUrl(current.url)
  const proxyFallbackStatus = typeof lastResolveResult.proxyFallbackStatus === 'number'
    ? lastResolveResult.proxyFallbackStatus
    : typeof mediaRecoveryAudit.proxyStatus === 'number'
      ? mediaRecoveryAudit.proxyStatus
      : null
  const signedUrlGenerated = typeof lastResolveResult.signedUrlGenerated === 'boolean'
    ? lastResolveResult.signedUrlGenerated
    : Boolean(storageKey && resolvedUrl && current.source.includes('resolvedUrl'))
  const reason = storageKeyFailureReason(node)
  const unrecoverable = isUnrecoverableStatus(recoveryStatus)
  const whyUnrecoverable = resolvedUrl
    ? '已有 resolvedUrl，当前不应显示不可恢复。'
    : stringValue(lastResolveResult.whyUnrecoverable)
      || stringValue(lastResolveResult.storageKeyFailureReason)
      || (unrecoverable ? error || reason : reason)
  return {
    projectId,
    workflowId,
    nodeId: node.id,
    kind: node.kind,
    position: { x: node.x, y: node.y, width: node.width, height: node.height },
    prompt: node.prompt,
    providerId: node.providerId || node.model,
    provider,
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
    currentUrlSource: current.source,
    storageKey,
    bucket,
    storageProvider,
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
    signedUrlGenerated,
    signedUrlError: stringValue(lastResolveResult.signedUrlError) || null,
    proxyFallbackUrl,
    proxyFallbackStatus,
    proxyFallbackOk: typeof proxyFallbackStatus === 'number' ? proxyFallbackStatus >= 200 && proxyFallbackStatus < 300 : null,
    whyUnrecoverable,
    hasRecoverableSource: hasAnyRecoverableSource(node),
    urlCandidates: mediaSourcesForNode(node),
    lastGenerationError: Object.keys(lastGenerationError).length ? lastGenerationError : null,
    metadataJson: node.metadataJson,
  }
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

export function P0MediaDebugPanel({
  open,
  projectId,
  workflowId,
  nodes,
  onClose,
  onPatchNode,
}: P0MediaDebugPanelProps) {
  const [busyNodeId, setBusyNodeId] = useState('')
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [copyState, setCopyState] = useState('')

  const mediaNodes = useMemo(() => nodes.filter((node) => node.kind === 'image' || node.kind === 'video'), [nodes])
  const diagnostics = useMemo(
    () => mediaNodes.map((node) => buildDiagnostic(node, projectId, workflowId)),
    [mediaNodes, projectId, workflowId],
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
      body: JSON.stringify({ assetIds: [assetId] }),
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
      body: JSON.stringify({ nodeId: node.id, projectId, workflowId }),
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
    if (!prompt) throw new Error('该节点没有原 Prompt，不能重新生成。')
    const statusResponse = await fetch(`/api/generate/${node.kind}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    const statusData = await statusResponse.json().catch(() => ({})) as ProviderStatusResponse
    const providerId = node.providerId || node.model || statusData.defaultProviderId || ''
    const provider = statusData.providers?.find((item) => item.providerId === providerId)
      ?? statusData.providers?.find((item) => item.providerId === statusData.defaultProviderId)
    if (!statusResponse.ok || statusData.success === false) {
      throw new Error(statusData.message || statusData.errorCode || 'Provider health check 失败。')
    }
    if (!provider?.available) {
      const missing = provider?.missingEnvKeys?.length ? provider.missingEnvKeys : provider?.missingEnv
      throw new Error(`Provider 不可用：${provider?.reason || provider?.status || 'not configured'}${missing?.length ? `；缺少 ${missing.join(', ')}` : ''}`)
    }
    const confirmed = window.confirm(`Provider health check 已通过。继续会真实调用 ${node.kind} 生成接口并可能消耗额度，是否继续？`)
    if (!confirmed) {
      setNodeMessage(node.id, '已完成 health check；用户取消真实生成，未产生费用。')
      return
    }
    const response = await fetch(`/api/generate/${node.kind}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        prompt,
        providerId: provider.providerId,
        projectId,
        workflowId,
        nodeId: node.id,
        aspectRatio: node.ratio,
        params: { ratio: node.ratio },
      }),
    })
    const data = await response.json().catch(() => ({})) as GenerateResponseShape
    if (!response.ok || data.success === false) {
      throw new Error([
        data.message || data.errorCode || `HTTP ${response.status}`,
        data.upstreamStatus ? `upstream=${data.upstreamStatus}` : '',
        data.upstreamMessage ? `upstreamMessage=${data.upstreamMessage}` : '',
        data.requestId ? `requestId=${data.requestId}` : '',
      ].filter(Boolean).join(' · '))
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
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '重新 resolve', async () => {
                          const assetId = getNodeAssetIdWithSource(node).value
                          if (assetId) await resolveByAssetId(node, assetId)
                          else await lookupByNodeId(node)
                        }) }}>
                          重新 resolve 该节点
                        </button>
                        <button type="button" className="rounded-md border border-emerald-200/25 bg-emerald-200/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-200/16" disabled={busy} onClick={() => { void runNodeAction(node, '立即恢复资产', () => recoverAsset(node)) }}>
                          立即恢复资产
                        </button>
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '从 nodeId 查找 Asset', () => lookupByNodeId(node)) }}>
                          从 nodeId 查找已有 Asset
                        </button>
                        <button type="button" className="rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/72 hover:bg-white/10" disabled={busy} onClick={() => { void runNodeAction(node, '从旧 URL 重新导入 OSS', () => resyncOldUrl(node)) }}>
                          从旧 URL 重新导入到 OSS
                        </button>
                        <button type="button" className="rounded-md border border-amber-200/25 bg-amber-200/10 px-2.5 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-200/16" disabled={busy} onClick={() => { void runNodeAction(node, 'Provider health check / 原 Prompt 重新生成', () => regenerateFromPrompt(node)) }}>
                          用原 Prompt 重新生成
                        </button>
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
