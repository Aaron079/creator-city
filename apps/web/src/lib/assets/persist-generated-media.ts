import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { toAssetType } from '@/lib/projects/canvas-mappers'
import { downloadExternalAsset, resolveAssetUrl, uploadAsset, type CanonicalStorageProvider } from '@/lib/assets/storage-adapter'
import { isChinaStorageError } from '@/lib/storage/china/errors'

export type PersistGeneratedMediaStage =
  | 'provider_output_parse'
  | 'media_download'
  | 'oss_upload'
  | 'asset_create'
  | 'generation_job_update'
  | 'canvas_node_update'

export type PersistGeneratedMediaInput = {
  url?: string
  type: 'image' | 'video'
  projectId?: string
  workflowId?: string
  nodeId?: string
  filenameHint?: string
  sourceProvider?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export type PersistGeneratedMediaResult =
  | {
      ok: true
      generationStatus: 'generation_success'
      persistenceStatus: 'persistence_success'
      assetStatus: 'ready'
      assetId?: string
      stableUrl: string
      providerOriginalUrl?: string | null
      temporaryUrl?: string | null
      mediaType?: 'image' | 'video'
      provider?: string
      providerJobId?: string | null
      prompt?: string | null
      model?: string | null
      storageProvider: CanonicalStorageProvider
      bucket?: string | null
      storageKey?: string | null
      proxyUrl?: string | null
      resolvedUrl?: string | null
      signedUrlAvailable?: boolean
      proxyAvailable?: boolean
      mimeType?: string
      size?: number
      persistedAt: string
    }
  | {
      ok: false
      stage: PersistGeneratedMediaStage
      generationStage: PersistGeneratedMediaStage
      generationStatus?: 'generation_success' | 'generation_failed'
      persistenceStatus?: 'pending_persistence' | 'persistence_failed'
      assetStatus?: 'pending_persistence' | 'failed' | null
      assetId?: string
      stableUrl?: string
      providerOriginalUrl?: string | null
      temporaryUrl?: string | null
      mediaType?: 'image' | 'video'
      errorCode: string
      rawErrorCode?: string
      errorMessage: string
      message: string
      provider?: string
      providerJobId?: string | null
      prompt?: string | null
      model?: string | null
      requestId?: string
      upstreamStatus?: number
      upstreamMessage?: string
      providerEndpoint?: string
      providerRequestMethod?: string
      providerHttpStatus?: number
      providerFetchError?: string
      providerFetchCause?: Record<string, unknown>
      storageProvider?: CanonicalStorageProvider | string | null
      bucket?: string | null
      storageKey?: string | null
      attemptedUploadKey?: string | null
      sourceUrl?: string | null
      mediaDownloadUrl?: string | null
      ossRequestId?: string | null
      retryPersistenceAvailable?: boolean
      }

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function sanitizeSourceUrl(url?: string | null) {
  const value = url?.trim()
  if (!value) return null
  if (value.startsWith('data:')) {
    const match = value.match(/^data:([^;,]+)?/)
    return `data:${match?.[1] || 'application/octet-stream'};<redacted>`
  }
  try {
    const parsed = new URL(value)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return value.slice(0, 240)
  }
}

function metadataDiagnostics(input?: PersistGeneratedMediaInput) {
  const metadata = recordValue(input?.metadata)
  return {
    provider: input?.sourceProvider,
    requestId: stringValue(metadata.requestId) || undefined,
    providerEndpoint: stringValue(metadata.providerEndpoint) || undefined,
    providerRequestMethod: stringValue(metadata.providerRequestMethod) || undefined,
    providerHttpStatus: numberValue(metadata.providerHttpStatus),
    providerFetchError: stringValue(metadata.providerFetchError) || undefined,
    providerFetchCause: recordValue(metadata.providerFetchCause),
  }
}

export function generatedMediaProviderJobId(input: PersistGeneratedMediaInput) {
  return typeof input.metadata?.providerJobId === 'string'
    ? input.metadata.providerJobId
    : typeof input.metadata?.taskId === 'string'
      ? input.metadata.taskId
      : typeof input.metadata?.generationJobId === 'string'
        ? input.metadata.generationJobId
        : null
}

function generatedMediaPrompt(input: PersistGeneratedMediaInput) {
  return typeof input.metadata?.prompt === 'string' ? input.metadata.prompt : null
}

function generatedMediaModel(input: PersistGeneratedMediaInput) {
  return typeof input.metadata?.model === 'string' ? input.metadata.model : null
}

export function storageDetails(error: unknown) {
  const details = isChinaStorageError(error) ? recordValue(error.details) : recordValue(error)
  const message = error instanceof Error ? error.message : stringValue(details.message) || 'Object storage upload failed.'
  const code = isChinaStorageError(error) ? error.code : stringValue(details.code)
  return {
    status: isChinaStorageError(error) ? error.status : numberValue(details.status),
    code,
    rawCode: stringValue(details.code) || code,
    name: stringValue(details.name) || (error instanceof Error ? error.name : ''),
    message,
    provider: stringValue(details.provider),
    bucket: stringValue(details.bucket),
    key: stringValue(details.key),
    requestId: stringValue(details.ossRequestId) || stringValue(details.requestId),
  }
}

export function classifyOssUploadError(error: unknown) {
  const details = storageDetails(error)
  const haystack = `${details.code} ${details.rawCode} ${details.name} ${details.message}`.toLowerCase()
  if (/storage_not_configured|storage_config_error|not configured|nosuchbucket|invalidbucket|invalid endpoint|unknown endpoint|enotfound|getaddrinfo/.test(haystack)) {
    return { errorCode: 'oss_config_error', errorMessage: details.message || 'Aliyun OSS is not configured correctly.' }
  }
  if (/storage_upload_timeout|responsetimeouterror|timeout|timedout|etimedout|socket timeout/.test(haystack)) {
    return { errorCode: 'oss_upload_timeout', errorMessage: 'Aliyun OSS upload timed out' }
  }
  if (/storage_auth_failed|invalidaccesskeyid|signaturedoesnotmatch|invalidsecuritytoken|accesskey|credentials?|credential/.test(haystack)) {
    return { errorCode: 'oss_auth_error', errorMessage: details.message || 'Aliyun OSS authentication failed.' }
  }
  if (details.status === 401 || details.status === 403 || /storage_permission_denied|accessdenied|forbidden|permission|not authorized/.test(haystack)) {
    return { errorCode: 'oss_permission_error', errorMessage: details.message || 'Aliyun OSS permission denied.' }
  }
  return { errorCode: 'oss_upload_error', errorMessage: details.message || 'Aliyun OSS upload failed.' }
}

function persistError(args: {
  stage: PersistGeneratedMediaStage
  errorCode: string
  message: string
  input?: PersistGeneratedMediaInput
  generationStatus?: 'generation_success' | 'generation_failed'
  persistenceStatus?: 'pending_persistence' | 'persistence_failed'
  assetStatus?: 'pending_persistence' | 'failed' | null
  assetId?: string
  stableUrl?: string
  providerOriginalUrl?: string | null
  temporaryUrl?: string | null
  rawErrorCode?: string
  upstreamStatus?: number
  upstreamMessage?: string
  providerFetchError?: string
  providerFetchCause?: Record<string, unknown>
  storageProvider?: CanonicalStorageProvider | string | null
  bucket?: string | null
  storageKey?: string | null
  attemptedUploadKey?: string | null
  sourceUrl?: string | null
  mediaDownloadUrl?: string | null
  ossRequestId?: string | null
  retryPersistenceAvailable?: boolean
}): PersistGeneratedMediaResult {
  const diagnostics = metadataDiagnostics(args.input)
  const providerOriginalUrl = args.providerOriginalUrl ?? args.sourceUrl ?? null
  const temporaryUrl = args.temporaryUrl ?? providerOriginalUrl
  const providerFetchCause = args.providerFetchCause && Object.keys(args.providerFetchCause).length
    ? args.providerFetchCause
    : Object.keys(diagnostics.providerFetchCause).length
      ? diagnostics.providerFetchCause
      : undefined
  return {
    ok: false,
    stage: args.stage,
    generationStage: args.stage,
    ...(args.generationStatus ? { generationStatus: args.generationStatus } : {}),
    ...(args.persistenceStatus ? { persistenceStatus: args.persistenceStatus } : {}),
    ...(args.assetStatus !== undefined ? { assetStatus: args.assetStatus } : {}),
    ...(args.assetId ? { assetId: args.assetId } : {}),
    ...(args.stableUrl ? { stableUrl: args.stableUrl } : {}),
    ...(providerOriginalUrl ? { providerOriginalUrl } : {}),
    ...(temporaryUrl ? { temporaryUrl } : {}),
    ...(args.input?.type ? { mediaType: args.input.type } : {}),
    errorCode: args.errorCode,
    ...(args.rawErrorCode ? { rawErrorCode: args.rawErrorCode } : {}),
    errorMessage: args.message,
    message: args.message,
    ...(diagnostics.provider ? { provider: diagnostics.provider } : {}),
    ...(args.input ? { providerJobId: generatedMediaProviderJobId(args.input), prompt: generatedMediaPrompt(args.input), model: generatedMediaModel(args.input) } : {}),
    ...(diagnostics.requestId ? { requestId: diagnostics.requestId } : {}),
    ...(args.upstreamStatus !== undefined ? { upstreamStatus: args.upstreamStatus } : {}),
    ...(args.upstreamMessage ? { upstreamMessage: args.upstreamMessage } : {}),
    ...(diagnostics.providerEndpoint ? { providerEndpoint: diagnostics.providerEndpoint } : {}),
    ...(diagnostics.providerRequestMethod ? { providerRequestMethod: diagnostics.providerRequestMethod } : {}),
    ...(diagnostics.providerHttpStatus !== undefined ? { providerHttpStatus: diagnostics.providerHttpStatus } : {}),
    ...(args.providerFetchError || diagnostics.providerFetchError ? { providerFetchError: args.providerFetchError || diagnostics.providerFetchError } : {}),
    ...(providerFetchCause ? { providerFetchCause } : {}),
    ...(args.storageProvider ? { storageProvider: args.storageProvider } : {}),
    ...(args.bucket ? { bucket: args.bucket } : {}),
    ...(args.storageKey ? { storageKey: args.storageKey } : {}),
    ...(args.attemptedUploadKey ? { attemptedUploadKey: args.attemptedUploadKey } : {}),
    ...(args.sourceUrl ? { sourceUrl: sanitizeSourceUrl(args.sourceUrl), mediaDownloadUrl: sanitizeSourceUrl(args.mediaDownloadUrl || args.sourceUrl) } : {}),
    ...(args.mediaDownloadUrl && !args.sourceUrl ? { mediaDownloadUrl: sanitizeSourceUrl(args.mediaDownloadUrl) } : {}),
    ...(args.ossRequestId ? { ossRequestId: args.ossRequestId } : {}),
    ...(args.retryPersistenceAvailable !== undefined ? { retryPersistenceAvailable: args.retryPersistenceAvailable } : {}),
  }
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 120) || 'generated-media'
}

function dataUrlToDownloadedAsset(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const body = match[3] || ''
  const buffer = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body))
  if (!buffer.byteLength) return null
  return {
    ok: true as const,
    buffer,
    mimeType,
    size: buffer.byteLength,
    status: 200,
  }
}

function jsonMetadata(input: PersistGeneratedMediaInput, uploaded: {
  provider: string
  bucket?: string | null
  key?: string | null
  sizeBytes?: number
  mimeType?: string
}, originalUrl: string) {
  return {
    source: 'generated-media-persistence',
    generationStatus: 'generation_success',
    persistenceStatus: 'persistence_success',
    assetStatus: 'ready',
    providerOriginalUrl: originalUrl,
    temporaryUrl: originalUrl,
    originalProviderUrl: originalUrl,
    originalUrl,
    sourceProvider: input.sourceProvider,
    provider: input.sourceProvider,
    providerJobId: typeof input.metadata?.providerJobId === 'string'
      ? input.metadata.providerJobId
      : typeof input.metadata?.taskId === 'string'
        ? input.metadata.taskId
        : typeof input.metadata?.generationJobId === 'string'
          ? input.metadata.generationJobId
          : undefined,
    nodeId: input.nodeId,
    canvasNodeId: input.nodeId,
    projectId: input.projectId,
    userId: input.userId,
    mediaType: input.type,
    storageProvider: uploaded.provider,
    bucket: uploaded.bucket,
    storageKey: uploaded.key,
    mediaPersistence: {
      status: 'persisted',
      generationStatus: 'generation_success',
      persistenceStatus: 'persistence_success',
      storageProvider: uploaded.provider,
      bucket: uploaded.bucket,
      key: uploaded.key,
      storageKey: uploaded.key,
      sizeBytes: uploaded.sizeBytes,
      mimeType: uploaded.mimeType,
      persistedAt: new Date().toISOString(),
    },
    ...(input.metadata ?? {}),
  } satisfies Prisma.InputJsonObject
}

function pendingPersistenceMetadata(input: PersistGeneratedMediaInput, args: {
  assetId: string
  originalUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  errorCode: string
  errorMessage: string
  rawErrorCode?: string | null
  storageProvider?: string | null
  bucket?: string | null
  attemptedUploadKey?: string | null
  ossRequestId?: string | null
}) {
  const providerJobId = generatedMediaProviderJobId(input)
  const prompt = generatedMediaPrompt(input)
  const model = generatedMediaModel(input)
  const now = new Date().toISOString()
  return {
    ...(input.metadata ?? {}),
    source: 'generated-media-persistence',
    generationStatus: 'generation_success',
    persistenceStatus: 'pending_persistence',
    assetStatus: 'pending_persistence',
    providerOriginalUrl: args.originalUrl,
    temporaryUrl: args.originalUrl,
    originalProviderUrl: args.originalUrl,
    ...(input.type === 'image' ? { originalProviderImageUrl: args.originalUrl, resultImageUrl: args.originalUrl } : {}),
    ...(input.type === 'video' ? { originalProviderVideoUrl: args.originalUrl, resultVideoUrl: args.originalUrl } : {}),
    originalUrl: args.originalUrl,
    sourceProvider: input.sourceProvider,
    provider: input.sourceProvider,
    providerJobId: providerJobId ?? undefined,
    model: model ?? undefined,
    prompt: prompt ?? undefined,
    nodeId: input.nodeId,
    canvasNodeId: input.nodeId,
    projectId: input.projectId,
    userId: input.userId,
    mediaType: input.type,
    assetId: args.assetId,
    outputAssetId: args.assetId,
    storageProvider: args.storageProvider ?? undefined,
    bucket: args.bucket ?? undefined,
    storageKey: null,
    attemptedUploadKey: args.attemptedUploadKey ?? undefined,
    persistenceError: args.errorCode,
    errorCode: null,
    errorMessage: null,
    lastGenerationError: null,
    retryPersistenceAvailable: true,
    nextAction: 'retry_persistence',
    mediaPersistence: {
      status: 'pending_persistence',
      generationStatus: 'generation_success',
      persistenceStatus: 'pending_persistence',
      assetId: args.assetId,
      outputAssetId: args.assetId,
      generationJobId: typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : undefined,
      providerOriginalUrl: args.originalUrl,
      temporaryUrl: args.originalUrl,
      originalUrl: args.originalUrl,
      sourceUrl: args.originalUrl,
      mediaDownloadUrl: args.originalUrl,
      mediaType: input.type,
      provider: input.sourceProvider,
      providerJobId: providerJobId ?? undefined,
      model: model ?? undefined,
      prompt: prompt ?? undefined,
      storageProvider: args.storageProvider ?? undefined,
      bucket: args.bucket ?? undefined,
      storageKey: null,
      attemptedUploadKey: args.attemptedUploadKey ?? undefined,
      errorCode: args.errorCode,
      rawErrorCode: args.rawErrorCode ?? undefined,
      errorMessage: args.errorMessage,
      persistenceError: args.errorCode,
      ossRequestId: args.ossRequestId ?? undefined,
      retryPersistenceAvailable: true,
      createdAt: now,
      updatedAt: now,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
    },
  } satisfies Prisma.InputJsonObject
}

async function linkGenerationJob(input: PersistGeneratedMediaInput, assetId: string, stableUrl: string) {
  const generationJobId = typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : ''
  if (!generationJobId) return

  const providerJobId = typeof input.metadata?.providerJobId === 'string'
    ? input.metadata.providerJobId
    : typeof input.metadata?.taskId === 'string'
      ? input.metadata.taskId
      : undefined

  const data = {
    projectId: input.projectId ?? undefined,
    nodeId: input.nodeId ?? undefined,
    providerJobId,
    provider: input.sourceProvider ?? undefined,
    kind: input.type,
    status: 'SUCCEEDED' as const,
    outputAssetId: assetId,
    output: {
      status: 'succeeded',
      generationStatus: 'generation_success',
      persistenceStatus: 'persistence_success',
      assetStatus: 'ready',
      assetId,
      url: stableUrl,
      providerOriginalUrl: input.url,
      temporaryUrl: input.url,
      type: input.type,
      providerJobId,
      completedAt: new Date().toISOString(),
    },
    completedAt: new Date(),
  }
  await db.generationJob.update({
    where: { id: generationJobId },
    data,
  }).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (/GenerationJob.*nodeId|nodeId.*GenerationJob|column.*nodeId|Unknown arg `nodeId`/i.test(message)) {
      const fallbackData = { ...data }
      delete (fallbackData as { nodeId?: string }).nodeId
      await db.generationJob.update({
        where: { id: generationJobId },
        data: fallbackData,
      })
      return
    }
    throw error
  })
}

async function linkCanvasNode(input: PersistGeneratedMediaInput, assetId: string, stableUrl: string, uploaded: {
  storageProvider: CanonicalStorageProvider
  bucket?: string | null
  storageKey?: string | null
  resolvedUrl?: string | null
  proxyUrl?: string | null
  signedUrlAvailable?: boolean
  proxyAvailable?: boolean
}) {
  if (!input.nodeId) return
  const where: Prisma.CanvasNodeWhereInput = input.workflowId
    ? { nodeId: input.nodeId, workflowId: input.workflowId }
    : input.projectId
      ? { nodeId: input.nodeId, workflow: { projectId: input.projectId } }
      : { nodeId: input.nodeId }
  const nodes = await db.canvasNode.findMany({
    where,
    select: { id: true, metadataJson: true },
    take: 10,
  })
  await Promise.all(nodes.map((node) => {
    const metadata = node.metadataJson && typeof node.metadataJson === 'object' && !Array.isArray(node.metadataJson)
      ? node.metadataJson as Record<string, unknown>
      : {}
    const mediaPersistence = metadata.mediaPersistence && typeof metadata.mediaPersistence === 'object' && !Array.isArray(metadata.mediaPersistence)
      ? metadata.mediaPersistence as Record<string, unknown>
      : {}
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
        ...(input.type === 'image' ? { resultImageUrl: stableUrl } : {}),
        ...(input.type === 'video' ? { resultVideoUrl: stableUrl } : {}),
        status: 'done',
        errorMessage: null,
        metadataJson: {
          ...metadata,
          assetId,
          outputAssetId: assetId,
          ...(typeof input.metadata?.generationJobId === 'string' ? { generationJobId: input.metadata.generationJobId } : {}),
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_success',
          assetStatus: 'ready',
          providerOriginalUrl: input.url ?? stableUrl,
          temporaryUrl: input.url ?? stableUrl,
          originalProviderUrl: input.url ?? stableUrl,
          ...(input.type === 'image' ? { originalProviderImageUrl: input.url ?? stableUrl } : {}),
          ...(input.type === 'video' ? { originalProviderVideoUrl: input.url ?? stableUrl } : {}),
          assetUrl: uploaded.resolvedUrl ?? stableUrl,
          resolvedUrl: uploaded.resolvedUrl ?? stableUrl,
          stableUrl,
          ...(uploaded.proxyUrl ? { proxyUrl: uploaded.proxyUrl } : {}),
          signedUrlAvailable: uploaded.signedUrlAvailable ?? null,
          proxyAvailable: uploaded.proxyAvailable ?? Boolean(uploaded.proxyUrl),
          assetResolveStatus: 'ready',
          recoveryStatus: 'ready',
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          mediaPersistence: {
            ...mediaPersistence,
            status: 'persisted',
            generationStatus: 'generation_success',
            persistenceStatus: 'persistence_success',
            assetId,
            outputAssetId: assetId,
            ...(typeof input.metadata?.generationJobId === 'string' ? { generationJobId: input.metadata.generationJobId } : {}),
            providerOriginalUrl: input.url ?? stableUrl,
            temporaryUrl: input.url ?? stableUrl,
            stableUrl,
            assetUrl: uploaded.resolvedUrl ?? stableUrl,
            resolvedUrl: uploaded.resolvedUrl ?? stableUrl,
            ...(uploaded.proxyUrl ? { proxyUrl: uploaded.proxyUrl } : {}),
            storageProvider: uploaded.storageProvider,
            bucket: uploaded.bucket,
            storageKey: uploaded.storageKey,
            persistedAt: new Date().toISOString(),
          },
        },
      },
    })
  }))
}

async function linkPendingGenerationJob(input: PersistGeneratedMediaInput, assetId: string, providerUrl: string, args: {
  errorCode: string
  errorMessage: string
  rawErrorCode?: string | null
  storageProvider?: string | null
  bucket?: string | null
  attemptedUploadKey?: string | null
  ossRequestId?: string | null
}) {
  const generationJobId = typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : ''
  if (!generationJobId) return

  const providerJobId = generatedMediaProviderJobId(input) ?? undefined
  const data = {
    projectId: input.projectId ?? undefined,
    nodeId: input.nodeId ?? undefined,
    providerJobId,
    provider: input.sourceProvider ?? undefined,
    kind: input.type,
    status: 'SUCCEEDED' as const,
    outputAssetId: assetId,
    output: {
      status: 'succeeded_with_persistence_pending',
      generationStatus: 'generation_success',
      persistenceStatus: 'pending_persistence',
      assetStatus: 'pending_persistence',
      assetId,
      outputAssetId: assetId,
      url: providerUrl,
      providerOriginalUrl: providerUrl,
      temporaryUrl: providerUrl,
      type: input.type,
      mediaType: input.type,
      provider: input.sourceProvider,
      providerJobId,
      prompt: generatedMediaPrompt(input),
      model: generatedMediaModel(input),
      persistenceError: args.errorCode,
      errorCode: args.errorCode,
      rawErrorCode: args.rawErrorCode,
      errorMessage: args.errorMessage,
      storageProvider: args.storageProvider,
      bucket: args.bucket,
      storageKey: null,
      attemptedUploadKey: args.attemptedUploadKey,
      ossRequestId: args.ossRequestId,
      retryPersistenceAvailable: true,
      completedAt: new Date().toISOString(),
    },
    error: null,
    errorMessage: null,
    completedAt: new Date(),
  }
  await db.generationJob.update({
    where: { id: generationJobId },
    data,
  }).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (/GenerationJob.*nodeId|nodeId.*GenerationJob|column.*nodeId|Unknown arg `nodeId`/i.test(message)) {
      const fallbackData = { ...data }
      delete (fallbackData as { nodeId?: string }).nodeId
      await db.generationJob.update({
        where: { id: generationJobId },
        data: fallbackData,
      })
      return
    }
    throw error
  })
}

async function linkPendingCanvasNode(input: PersistGeneratedMediaInput, assetId: string, providerUrl: string, args: {
  errorCode: string
  errorMessage: string
  rawErrorCode?: string | null
  storageProvider?: string | null
  bucket?: string | null
  attemptedUploadKey?: string | null
  ossRequestId?: string | null
}) {
  if (!input.nodeId) return
  const where: Prisma.CanvasNodeWhereInput = input.workflowId
    ? { nodeId: input.nodeId, workflowId: input.workflowId }
    : input.projectId
      ? { nodeId: input.nodeId, workflow: { projectId: input.projectId } }
      : { nodeId: input.nodeId }
  const nodes = await db.canvasNode.findMany({
    where,
    select: { id: true, metadataJson: true },
    take: 10,
  })
  await Promise.all(nodes.map((node) => {
    const metadata = node.metadataJson && typeof node.metadataJson === 'object' && !Array.isArray(node.metadataJson)
      ? node.metadataJson as Record<string, unknown>
      : {}
    const mediaPersistence = metadata.mediaPersistence && typeof metadata.mediaPersistence === 'object' && !Array.isArray(metadata.mediaPersistence)
      ? metadata.mediaPersistence as Record<string, unknown>
      : {}
    const now = new Date().toISOString()
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
        ...(input.type === 'image' ? { resultImageUrl: providerUrl } : {}),
        ...(input.type === 'video' ? { resultVideoUrl: providerUrl } : {}),
        resultPreview: '已生成，资产持久化待重试',
        status: 'done',
        errorMessage: null,
        metadataJson: {
          ...metadata,
          assetId,
          outputAssetId: assetId,
          ...(typeof input.metadata?.generationJobId === 'string' ? { generationJobId: input.metadata.generationJobId } : {}),
          generationStatus: 'generation_success',
          persistenceStatus: 'pending_persistence',
          assetStatus: 'pending_persistence',
          providerOriginalUrl: providerUrl,
          temporaryUrl: providerUrl,
          originalProviderUrl: providerUrl,
          ...(input.type === 'image' ? { originalProviderImageUrl: providerUrl, resultImageUrl: providerUrl } : {}),
          ...(input.type === 'video' ? { originalProviderVideoUrl: providerUrl, resultVideoUrl: providerUrl } : {}),
          recoveryStatus: 'pending_persistence',
          assetResolveStatus: 'pending_persistence',
          mediaRecoveryStatus: 'generated_but_persistence_pending',
          lastError: null,
          lastGenerationError: null,
          error: null,
          errorCode: null,
          errorMessage: null,
          persistenceError: args.errorCode,
          storageProvider: args.storageProvider ?? null,
          bucket: args.bucket ?? null,
          storageKey: null,
          attemptedUploadKey: args.attemptedUploadKey ?? null,
          ossRequestId: args.ossRequestId ?? null,
          retryPersistenceAvailable: true,
          nextAction: 'retry_persistence',
          mediaPersistence: {
            ...mediaPersistence,
            status: 'pending_persistence',
            generationStatus: 'generation_success',
            persistenceStatus: 'pending_persistence',
            assetId,
            outputAssetId: assetId,
            ...(typeof input.metadata?.generationJobId === 'string' ? { generationJobId: input.metadata.generationJobId } : {}),
            providerOriginalUrl: providerUrl,
            temporaryUrl: providerUrl,
            originalUrl: providerUrl,
            sourceUrl: providerUrl,
            mediaDownloadUrl: providerUrl,
            provider: input.sourceProvider,
            providerJobId: generatedMediaProviderJobId(input),
            prompt: generatedMediaPrompt(input),
            model: generatedMediaModel(input),
            mediaType: input.type,
            storageProvider: args.storageProvider ?? null,
            bucket: args.bucket ?? null,
            storageKey: null,
            attemptedUploadKey: args.attemptedUploadKey ?? null,
            errorCode: args.errorCode,
            rawErrorCode: args.rawErrorCode ?? null,
            errorMessage: args.errorMessage,
            persistenceError: args.errorCode,
            ossRequestId: args.ossRequestId ?? null,
            retryPersistenceAvailable: true,
            updatedAt: now,
          },
        },
      },
    })
  }))
}

async function createPendingPersistenceRecord(input: PersistGeneratedMediaInput, args: {
  assetId: string
  originalUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  errorCode: string
  errorMessage: string
  rawErrorCode?: string | null
  storageProvider?: string | null
  bucket?: string | null
  attemptedUploadKey?: string | null
  ossRequestId?: string | null
}) {
  if (!input.userId) return null
  const metadataJson = pendingPersistenceMetadata(input, args)
  const now = new Date()
  const workflow = input.workflowId
    ? await db.canvasWorkflow.findFirst({
        where: {
          id: input.workflowId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
        select: { id: true },
      })
    : input.projectId
      ? await db.canvasWorkflow.findFirst({
          where: { projectId: input.projectId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
      : null
  const asset = await db.asset.create({
    data: {
      id: args.assetId,
      name: input.filenameHint || `${input.type} generation ${now.toISOString()}`,
      title: input.filenameHint || null,
      type: toAssetType(input.type),
      status: 'PENDING',
      ownerId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: workflow?.id ?? null,
      nodeId: input.nodeId ?? null,
      source: 'generated',
      provider: input.sourceProvider ?? null,
      providerJobId: generatedMediaProviderJobId(input),
      storageProvider: args.storageProvider ?? null,
      bucket: args.bucket ?? null,
      storageKey: null,
      url: args.originalUrl,
      dataUrl: null,
      thumbnailUrl: input.type === 'image' ? args.originalUrl : null,
      originalUrl: args.originalUrl,
      filename: args.fileName,
      mimeType: args.mimeType,
      size: BigInt(args.sizeBytes),
      sizeBytes: BigInt(args.sizeBytes),
      prompt: generatedMediaPrompt(input),
      metadata: metadataJson,
      metadataJson,
      providerId: input.sourceProvider ?? null,
      generationJobId: typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : null,
      recoveryStatus: 'pending_persistence',
      error: args.errorMessage,
      tags: ['generated', input.type, 'pending_persistence'],
    },
  })
  await linkPendingGenerationJob(input, asset.id, args.originalUrl, args).catch((error: unknown) => {
    console.warn('[persistGeneratedMedia] failed to mark GenerationJob pending_persistence', error)
  })
  await linkPendingCanvasNode(input, asset.id, args.originalUrl, args).catch((error: unknown) => {
    console.warn('[persistGeneratedMedia] failed to write pending_persistence CanvasNode', error)
  })
  return asset
}

export async function persistGeneratedMedia(input: PersistGeneratedMediaInput): Promise<PersistGeneratedMediaResult> {
  try {
    const url = input.url?.trim()
    if (!url) {
      return persistError({
        stage: 'provider_output_parse',
        errorCode: 'provider_no_download_url',
        message: 'Provider did not return a downloadable media URL.',
        input,
        generationStatus: 'generation_failed',
        persistenceStatus: 'persistence_failed',
        assetStatus: 'failed',
      })
    }
    if (!input.userId) {
      return persistError({
        stage: 'asset_create',
        errorCode: 'asset_persistence_error',
        rawErrorCode: 'MEDIA_UPLOAD_FAILED',
        message: '缺少媒体归属用户，无法保存 Asset。',
        input,
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_failed',
        assetStatus: 'failed',
        stableUrl: url,
        providerOriginalUrl: url,
        temporaryUrl: url,
        sourceUrl: url,
      })
    }
    const assetId = randomUUID()
    const now = new Date()
    const fileName = safeFileName(input.filenameHint || `${input.type}-${assetId}`)
    const downloaded = url.startsWith('data:')
      ? dataUrlToDownloadedAsset(url) ?? { ok: false as const, status: 0, errorCode: 'MEDIA_FETCH_FAILED', message: 'Data URL 无法解析为媒体文件。' }
      : await downloadExternalAsset(url)
    if (!downloaded.ok) {
      let pendingAssetId: string | undefined
      try {
        const pendingAsset = await createPendingPersistenceRecord(input, {
          assetId,
          originalUrl: url,
          fileName,
          mimeType: 'application/octet-stream',
          sizeBytes: 0,
          errorCode: 'provider_media_download_failed',
          errorMessage: downloaded.message,
          rawErrorCode: downloaded.errorCode || 'MEDIA_FETCH_FAILED',
        })
        pendingAssetId = pendingAsset?.id
      } catch (error) {
        console.warn('[persistGeneratedMedia] failed to create pending persistence asset after download failure', error)
      }
      return persistError({
        stage: 'media_download',
        errorCode: 'provider_media_download_failed',
        rawErrorCode: downloaded.errorCode || 'MEDIA_FETCH_FAILED',
        message: downloaded.message,
        input,
        generationStatus: 'generation_success',
        persistenceStatus: 'pending_persistence',
        assetStatus: pendingAssetId ? 'pending_persistence' : 'failed',
        assetId: pendingAssetId,
        stableUrl: url,
        providerOriginalUrl: url,
        temporaryUrl: url,
        upstreamStatus: downloaded.status || undefined,
        upstreamMessage: 'bodySnippet' in downloaded ? downloaded.bodySnippet : undefined,
        providerFetchError: 'fetchError' in downloaded ? downloaded.fetchError : undefined,
        providerFetchCause: 'fetchCause' in downloaded ? downloaded.fetchCause : undefined,
        sourceUrl: url,
        mediaDownloadUrl: 'requestUrl' in downloaded ? downloaded.requestUrl : url,
        retryPersistenceAvailable: Boolean(pendingAssetId),
      })
    }
    const contentType = downloaded.mimeType
    const body = downloaded.buffer

    let uploaded: Awaited<ReturnType<typeof uploadAsset>>
    try {
      uploaded = await uploadAsset(body, {
        filename: fileName,
        mimeType: contentType,
        projectId: input.projectId,
        userId: input.userId,
        type: input.type,
      })
    } catch (error) {
      const details = storageDetails(error)
      const classified = classifyOssUploadError(error)
      let pendingAssetId: string | undefined
      try {
        const pendingAsset = await createPendingPersistenceRecord(input, {
          assetId,
          originalUrl: url,
          fileName,
          mimeType: contentType,
          sizeBytes: body.byteLength,
          errorCode: classified.errorCode,
          errorMessage: classified.errorMessage,
          rawErrorCode: details.rawCode || 'MEDIA_UPLOAD_FAILED',
          storageProvider: (details.provider as CanonicalStorageProvider | string) || null,
          bucket: details.bucket || null,
          attemptedUploadKey: details.key || null,
          ossRequestId: details.requestId || null,
        })
        pendingAssetId = pendingAsset?.id
      } catch (pendingError) {
        console.warn('[persistGeneratedMedia] failed to create pending persistence asset after upload failure', pendingError)
      }
      return persistError({
        stage: 'oss_upload',
        errorCode: classified.errorCode,
        rawErrorCode: details.rawCode || 'MEDIA_UPLOAD_FAILED',
        message: classified.errorMessage,
        input,
        generationStatus: 'generation_success',
        persistenceStatus: 'pending_persistence',
        assetStatus: pendingAssetId ? 'pending_persistence' : 'failed',
        assetId: pendingAssetId,
        stableUrl: url,
        providerOriginalUrl: url,
        temporaryUrl: url,
        upstreamStatus: details.status,
        upstreamMessage: details.message,
        storageProvider: (details.provider as CanonicalStorageProvider | string) || null,
        bucket: details.bucket || null,
        storageKey: details.key || null,
        attemptedUploadKey: details.key || null,
        sourceUrl: url,
        mediaDownloadUrl: url,
        ossRequestId: details.requestId || null,
        retryPersistenceAvailable: Boolean(pendingAssetId),
      })
    }

    try {
      const metadataJson = jsonMetadata(input, {
        provider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        key: uploaded.storageKey,
        sizeBytes: uploaded.size,
        mimeType: uploaded.mimeType,
      }, url)
      const proxyUrl = uploaded.storageKey ? `/api/assets/${encodeURIComponent(assetId)}/file` : null
      const resolved = await resolveAssetUrl({
        id: assetId,
        url: uploaded.url,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
        metadataJson,
      }).catch(() => ({ url: '', source: 'missing' as const, signedUrlAvailable: false }))
      const stableUrl = resolved.url || proxyUrl || uploaded.url
      if (!stableUrl) {
        return persistError({
          stage: 'oss_upload',
          errorCode: 'oss_upload_error',
          rawErrorCode: 'MEDIA_UPLOAD_FAILED',
          message: '媒体已上传，但没有返回稳定 URL 或 proxy URL。',
          input,
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_failed',
          assetStatus: 'failed',
          stableUrl: url,
          providerOriginalUrl: url,
          temporaryUrl: url,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          attemptedUploadKey: uploaded.storageKey,
          sourceUrl: url,
          mediaDownloadUrl: url,
        })
      }
      let asset: Awaited<ReturnType<typeof db.asset.create>>
      try {
        const workflow = input.workflowId
          ? await db.canvasWorkflow.findFirst({
              where: {
                id: input.workflowId,
                ...(input.projectId ? { projectId: input.projectId } : {}),
              },
              select: { id: true },
            })
          : input.projectId
            ? await db.canvasWorkflow.findFirst({
                where: { projectId: input.projectId },
                orderBy: { createdAt: 'asc' },
                select: { id: true },
              })
            : null
        asset = await db.asset.create({
        data: {
          id: assetId,
          name: input.filenameHint || `${input.type} generation ${now.toISOString()}`,
          title: input.filenameHint || null,
          type: toAssetType(input.type),
          status: 'READY',
          ownerId: input.userId,
          projectId: input.projectId ?? null,
          workflowId: workflow?.id ?? null,
          nodeId: input.nodeId ?? null,
          source: 'generated',
          provider: input.sourceProvider ?? null,
          providerJobId: typeof input.metadata?.providerJobId === 'string'
            ? input.metadata.providerJobId
            : typeof input.metadata?.taskId === 'string'
              ? input.metadata.taskId
              : typeof input.metadata?.generationJobId === 'string'
                ? input.metadata.generationJobId
                : null,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket ?? null,
          storageKey: uploaded.storageKey ?? null,
          url: stableUrl,
          dataUrl: null,
          thumbnailUrl: input.type === 'image' ? stableUrl : null,
          originalUrl: url,
          filename: fileName,
          mimeType: contentType,
          size: BigInt(uploaded.size),
          sizeBytes: BigInt(uploaded.size),
          prompt: typeof input.metadata?.prompt === 'string' ? input.metadata.prompt : null,
          metadata: {
            ...metadataJson,
            assetUrl: resolved.url || stableUrl,
            resolvedUrl: resolved.url || stableUrl,
            stableUrl,
            ...(proxyUrl ? { proxyUrl } : {}),
            signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
            proxyAvailable: Boolean(proxyUrl),
          },
          metadataJson: {
            ...metadataJson,
            assetUrl: resolved.url || stableUrl,
            resolvedUrl: resolved.url || stableUrl,
            stableUrl,
            ...(proxyUrl ? { proxyUrl } : {}),
            signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
            proxyAvailable: Boolean(proxyUrl),
          },
          providerId: input.sourceProvider ?? uploaded.storageProvider,
          generationJobId: typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : null,
          tags: ['generated', input.type, 'persisted'],
        },
        })
      } catch (error) {
        return persistError({
          stage: 'asset_create',
          errorCode: 'asset_persistence_error',
          rawErrorCode: 'MEDIA_ASSET_CREATE_FAILED',
          message: error instanceof Error ? error.message : '媒体已上传，但 Asset 记录创建失败。',
          input,
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_failed',
          assetStatus: 'failed',
          stableUrl,
          providerOriginalUrl: url,
          temporaryUrl: url,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          attemptedUploadKey: uploaded.storageKey,
          sourceUrl: url,
          mediaDownloadUrl: url,
        })
      }
      try {
        await linkGenerationJob(input, asset.id, stableUrl)
      } catch (error) {
        return persistError({
          stage: 'generation_job_update',
          errorCode: 'asset_persistence_error',
          message: error instanceof Error ? error.message : 'Asset 已创建，但 GenerationJob 写回失败。',
          input,
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_failed',
          assetStatus: 'failed',
          assetId: asset.id,
          stableUrl,
          providerOriginalUrl: url,
          temporaryUrl: url,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          attemptedUploadKey: uploaded.storageKey,
          sourceUrl: url,
          mediaDownloadUrl: url,
        })
      }
      try {
        await linkCanvasNode(input, asset.id, stableUrl, {
          ...uploaded,
          resolvedUrl: resolved.url || null,
          proxyUrl,
          signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
          proxyAvailable: Boolean(proxyUrl),
        })
      } catch (error) {
        return persistError({
          stage: 'canvas_node_update',
          errorCode: 'canvas_save_error',
          message: error instanceof Error ? error.message : 'Asset 已创建，但 Canvas 节点写回失败。',
          input,
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_failed',
          assetStatus: 'failed',
          assetId: asset.id,
          stableUrl,
          providerOriginalUrl: url,
          temporaryUrl: url,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          attemptedUploadKey: uploaded.storageKey,
          sourceUrl: url,
          mediaDownloadUrl: url,
        })
      }

      return {
        ok: true,
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetStatus: 'ready',
        assetId: asset.id,
        stableUrl,
        providerOriginalUrl: url,
        temporaryUrl: url,
        mediaType: input.type,
        provider: input.sourceProvider,
        providerJobId: generatedMediaProviderJobId(input),
        prompt: generatedMediaPrompt(input),
        model: generatedMediaModel(input),
        resolvedUrl: resolved.url || null,
        proxyUrl,
        signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
        proxyAvailable: Boolean(proxyUrl),
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        persistedAt: now.toISOString(),
      }
    } catch (error) {
      return persistError({
        stage: 'asset_create',
        errorCode: 'asset_persistence_error',
        rawErrorCode: 'MEDIA_PERSISTENCE_FAILED',
        message: error instanceof Error ? error.message : '生成媒体转存失败。',
        input,
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_failed',
        assetStatus: 'failed',
        providerOriginalUrl: url,
        temporaryUrl: url,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
        attemptedUploadKey: uploaded.storageKey,
        sourceUrl: url,
        mediaDownloadUrl: url,
      })
    }
  } catch (error) {
    return persistError({
      stage: 'provider_output_parse',
      errorCode: 'asset_persistence_error',
      rawErrorCode: 'MEDIA_PERSISTENCE_FAILED',
      message: error instanceof Error ? error.message : '生成媒体转存失败。',
      input,
      generationStatus: input.url ? 'generation_success' : 'generation_failed',
      persistenceStatus: 'persistence_failed',
      assetStatus: 'failed',
      stableUrl: input.url,
      providerOriginalUrl: input.url,
      temporaryUrl: input.url,
      sourceUrl: input.url,
      mediaDownloadUrl: input.url,
    })
  }
}
