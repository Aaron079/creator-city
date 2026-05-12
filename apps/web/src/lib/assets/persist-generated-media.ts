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
      assetId?: string
      stableUrl: string
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
      errorCode: string
      rawErrorCode?: string
      errorMessage: string
      message: string
      provider?: string
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

function storageDetails(error: unknown) {
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

function classifyOssUploadError(error: unknown) {
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
}): PersistGeneratedMediaResult {
  const diagnostics = metadataDiagnostics(args.input)
  const providerFetchCause = args.providerFetchCause && Object.keys(args.providerFetchCause).length
    ? args.providerFetchCause
    : Object.keys(diagnostics.providerFetchCause).length
      ? diagnostics.providerFetchCause
      : undefined
  return {
    ok: false,
    stage: args.stage,
    generationStage: args.stage,
    errorCode: args.errorCode,
    ...(args.rawErrorCode ? { rawErrorCode: args.rawErrorCode } : {}),
    errorMessage: args.message,
    message: args.message,
    ...(diagnostics.provider ? { provider: diagnostics.provider } : {}),
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
      assetId,
      url: stableUrl,
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
            assetId,
            outputAssetId: assetId,
            ...(typeof input.metadata?.generationJobId === 'string' ? { generationJobId: input.metadata.generationJobId } : {}),
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

export async function persistGeneratedMedia(input: PersistGeneratedMediaInput): Promise<PersistGeneratedMediaResult> {
  try {
    const url = input.url?.trim()
    if (!url) {
      return persistError({
        stage: 'provider_output_parse',
        errorCode: 'provider_no_download_url',
        message: 'Provider did not return a downloadable media URL.',
        input,
      })
    }
    if (!input.userId) {
      return persistError({
        stage: 'asset_create',
        errorCode: 'asset_persistence_error',
        rawErrorCode: 'MEDIA_UPLOAD_FAILED',
        message: '缺少媒体归属用户，无法保存 Asset。',
        input,
        sourceUrl: url,
      })
    }
    const downloaded = url.startsWith('data:')
      ? dataUrlToDownloadedAsset(url) ?? { ok: false as const, status: 0, errorCode: 'MEDIA_FETCH_FAILED', message: 'Data URL 无法解析为媒体文件。' }
      : await downloadExternalAsset(url)
    if (!downloaded.ok) {
      return persistError({
        stage: 'media_download',
        errorCode: 'provider_media_download_failed',
        rawErrorCode: downloaded.errorCode || 'MEDIA_FETCH_FAILED',
        message: downloaded.message,
        input,
        upstreamStatus: downloaded.status || undefined,
        upstreamMessage: 'bodySnippet' in downloaded ? downloaded.bodySnippet : undefined,
        providerFetchError: 'fetchError' in downloaded ? downloaded.fetchError : undefined,
        providerFetchCause: 'fetchCause' in downloaded ? downloaded.fetchCause : undefined,
        sourceUrl: url,
        mediaDownloadUrl: 'requestUrl' in downloaded ? downloaded.requestUrl : url,
      })
    }
    const contentType = downloaded.mimeType
    const body = downloaded.buffer
    const assetId = randomUUID()
    const now = new Date()
    const fileName = safeFileName(input.filenameHint || `${input.type}-${assetId}`)

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
      return persistError({
        stage: 'oss_upload',
        errorCode: classified.errorCode,
        rawErrorCode: details.rawCode || 'MEDIA_UPLOAD_FAILED',
        message: classified.errorMessage,
        input,
        upstreamStatus: details.status,
        upstreamMessage: details.message,
        storageProvider: (details.provider as CanonicalStorageProvider | string) || null,
        bucket: details.bucket || null,
        storageKey: details.key || null,
        attemptedUploadKey: details.key || null,
        sourceUrl: url,
        mediaDownloadUrl: url,
        ossRequestId: details.requestId || null,
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
        assetId: asset.id,
        stableUrl,
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
      sourceUrl: input.url,
      mediaDownloadUrl: input.url,
    })
  }
}
