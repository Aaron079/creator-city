import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { generateSeedanceVideo } from '@/lib/providers/china/volcengine'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'
import { missingGenerationInput, prepareGenerationContext, stringInput } from '@/lib/generation/generation-context'

export const dynamic = 'force-dynamic'

type VideoGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
  model?: string
  imageUrl?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  system?: string
  compiledPrompt?: string
}

const VIDEO_PROVIDER_ORDER = ['volcengine-seedance-video', 'custom-video-gateway', 'creator-video-gateway'] as const

async function getVideoProviderRows() {
  const status = await buildProviderManagementStatus()
  const rowById = new Map(status.providers.map((provider) => [provider.providerId, provider]))
  return VIDEO_PROVIDER_ORDER.map((providerId) => rowById.get(providerId)).filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function defaultVideoProviderId(rows: Awaited<ReturnType<typeof getVideoProviderRows>>) {
  return rows.find((row) => row.providerId === 'volcengine-seedance-video' && row.available)?.providerId
    ?? rows.find((row) => row.providerId === 'custom-video-gateway' && row.available)?.providerId
    ?? rows.find((row) => row.available)?.providerId
    ?? null
}

function providerNotConfiguredResponse(providerId: string, missingEnv: string[] = []) {
  return NextResponse.json({
    success: false,
    errorCode: 'provider_env_missing',
    message: '视频 Provider 未配置，请先在 /admin/providers 配置环境变量。',
    providerId,
    missingEnv,
    missingEnvKeys: missingEnv,
    mode: 'unavailable',
    status: 'not-configured',
  }, { status: 200 })
}

function firstImageInput(body: VideoGenerateBody) {
  return stringParam(body.imageUrl)
    ?? stringParam(body.inputAssets?.find((asset) => asset.type === 'image' && asset.url)?.url)
}

function failedMediaPersistence(result: Extract<PersistGeneratedMediaResult, { ok: false }>) {
  const pending = result.persistenceStatus === 'pending_persistence'
  return {
    status: pending ? 'pending_persistence' : 'failed',
    ...result,
    errorMessage: result.errorMessage || result.message,
    retryPersistenceAvailable: result.retryPersistenceAvailable ?? Boolean(result.assetId),
  }
}

function visiblePersistenceErrorCode(errorCode: string) {
  if (errorCode === 'provider_media_download_failed' || errorCode === 'MEDIA_FETCH_FAILED' || errorCode === 'ASSET_DOWNLOAD_FAILED' || errorCode === 'ASSET_DOWNLOAD_ERROR' || errorCode === 'ASSET_DOWNLOAD_TIMEOUT' || errorCode === 'PROVIDER_MEDIA_DOWNLOAD_FAILED') return 'provider_media_download_failed'
  if (errorCode === 'oss_upload_timeout' || errorCode === 'oss_upload_error' || errorCode === 'oss_auth_error' || errorCode === 'oss_permission_error' || errorCode === 'oss_config_error') return errorCode
  if (errorCode === 'MEDIA_UPLOAD_FAILED') return 'oss_upload_error'
  if (errorCode === 'canvas_save_error') return 'canvas_save_error'
  if (errorCode === 'MEDIA_ASSET_CREATE_FAILED' || errorCode === 'MEDIA_PERSISTENCE_FAILED' || errorCode === 'MEDIA_PERSIST_FAILED' || errorCode === 'MEDIA_PERSIST_TIMEOUT') return 'asset_persistence_error'
  return errorCode
}

function visibleProviderErrorCode(errorCode: string | undefined, upstreamStatus?: number, message = '') {
  const code = errorCode ?? ''
  const haystack = `${code} ${message}`.toLowerCase()
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'provider_env_missing' || code.includes('MODEL_REQUIRED') || haystack.includes('not configured')) return 'provider_env_missing'
  if (code === 'PROMPT_REQUIRED' || code === 'MISSING_GENERATION_INPUT' || code === 'missing_generation_input' || code === 'missing_or_invalid_video_input') return 'missing_generation_input'
  if (code === 'provider_timeout' || code.includes('TIMEOUT') || /timeout|abort/.test(haystack)) return 'provider_timeout'
  if (code === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(haystack)) return 'provider_network_failed'
  if (code === 'provider_response_parse_failed') return 'provider_response_parse_failed'
  if (code === 'provider_request_failed') return 'provider_request_failed'
  if (code === 'PROVIDER_AUTH_ERROR' || code === 'provider_auth_failed' || code === 'provider_auth_error' || upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_failed'
  if (code === 'provider_model_invalid' || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|does not exist)|模型|接入点/.test(haystack)) return 'provider_model_invalid'
  if (code === 'PROVIDER_QUOTA_OR_BILLING_ERROR' || code === 'provider_quota_or_billing_error' || code === 'INSUFFICIENT_CREDITS' || code === 'BILLING_ERROR' || upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (code === 'PROVIDER_INVALID_PARAMETER' || code === 'provider_invalid_parameter' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'provider_media_download_failed' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(haystack)) return 'provider_media_download_failed'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'provider_no_download_url' || code === 'VIDEO_URL_EMPTY' || code.includes('URL_EMPTY') || code.includes('URL_MISSING')) return 'provider_no_download_url'
  return code || 'generation_failed'
}

function isMissingGenerationJobNodeIdColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /GenerationJob.*nodeId|nodeId.*GenerationJob|column.*nodeId|Unknown arg `nodeId`/i.test(message)
}

function numberParam(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/s$/i, ''))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function stringParam(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function summarizeInputUrl(url?: string) {
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

function normalizeSeedanceRouteAspectRatio(value?: string) {
  const ratio = String(value || '').trim().toLowerCase()
  if (ratio === '16:9' || ratio === '9:16' || ratio === '1:1') return ratio
  if (ratio === '3:4' || ratio === '4:5') return '9:16'
  if (ratio === '4:3' || ratio === '21:9' || ratio === 'adaptive') return '16:9'
  return '16:9'
}

function isSeedanceRouteAspectRatioValid(value?: string) {
  if (!value) return true
  return ['16:9', '9:16', '1:1', '3:4', '4:5', '4:3', '21:9', 'adaptive'].includes(value.trim().toLowerCase())
}

function normalizeSeedanceRouteDuration(value?: number) {
  if (!Number.isFinite(value)) return 5
  return Math.round(Number(value)) <= 5 ? 5 : 10
}

function normalizeSeedanceRouteResolution(value?: string) {
  const resolution = String(value || '').trim().toLowerCase()
  if (!resolution) return undefined
  if (resolution === '480p' || resolution === '720p' || resolution === '1080p') return resolution
  if (resolution.includes('1080')) return '1080p'
  if (resolution.includes('720')) return '720p'
  if (resolution.includes('480')) return '480p'
  return undefined
}

function validateVideoInput(args: {
  prompt: string
  model?: string | null
  requestedAspectRatio?: string
  requestedDuration?: number
  requestedResolution?: string
}) {
  const missingFields: string[] = []
  const invalidFields: string[] = []
  if (!args.prompt.trim()) missingFields.push('prompt')
  if (!args.model?.trim()) missingFields.push('model')
  if (args.requestedAspectRatio && !isSeedanceRouteAspectRatioValid(args.requestedAspectRatio)) invalidFields.push('aspectRatio')
  if (args.requestedDuration !== undefined && (!Number.isFinite(args.requestedDuration) || args.requestedDuration < 1 || args.requestedDuration > 60)) invalidFields.push('duration')
  if (args.requestedResolution && !normalizeSeedanceRouteResolution(args.requestedResolution)) invalidFields.push('resolution')
  if (!missingFields.length && !invalidFields.length) return { ok: true as const }
  const errorCode = invalidFields.length ? 'provider_invalid_parameter' : 'missing_generation_input'
  return {
    ok: false as const,
    errorCode,
    message: `Seedance 输入缺失或参数无效：${[...missingFields, ...invalidFields].join(', ')}`,
    missingFields,
    invalidFields,
  }
}

async function assertProviderReadableImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return { ok: true as const }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return {
      ok: false as const,
      errorCode: 'PROVIDER_INVALID_PARAMETER',
      message: 'Seedance 首帧 imageUrl 必须是可公网访问的 http/https URL。',
      upstreamMessage: `imageUrl is not http(s): ${imageUrl.slice(0, 160)}`,
    }
  }
  const diagnostic = await diagnoseMediaUrl(imageUrl)
  if (diagnostic.reachable) return { ok: true as const, diagnostic }
  return {
    ok: false as const,
    errorCode: 'PROVIDER_MEDIA_DOWNLOAD_FAILED',
    message: 'Seedance 首帧 imageUrl 当前不可下载，Provider 会返回 media download failed。',
    upstreamStatus: diagnostic.upstreamStatus || diagnostic.status,
    upstreamMessage: diagnostic.message,
    diagnostic,
  }
}

async function createVideoGenerationJob(args: {
  userId: string
  providerId: string
  prompt: string
  body: VideoGenerateBody
  imageUrl?: string
}) {
  const data = {
    userId: args.userId,
    projectId: args.body.projectId ?? null,
    nodeId: args.body.nodeId ?? null,
    providerId: args.providerId,
    provider: args.providerId,
    nodeType: 'video',
    kind: 'video',
    status: 'PROCESSING' as const,
    prompt: args.prompt.slice(0, 2000),
    input: {
      prompt: args.prompt,
      projectId: args.body.projectId ?? null,
      imageUrl: args.imageUrl,
      params: args.body.params ?? {},
      workflowId: args.body.workflowId,
      nodeId: args.body.nodeId,
    },
  }
  try {
    return await db.generationJob.create({ data })
  } catch (error) {
    if (!isMissingGenerationJobNodeIdColumn(error)) throw error
    const fallbackData = { ...data }
    delete (fallbackData as { nodeId?: string | null }).nodeId
    return db.generationJob.create({ data: fallbackData })
  }
}

async function markVideoGenerationJobFailed(jobId: string | undefined, message: string) {
  if (!jobId) return
  await db.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      error: message,
      errorMessage: message.slice(0, 1000),
      completedAt: new Date(),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/video] failed to mark GenerationJob failed', error)
  })
}

async function attachPersistedVideo(args: {
  videoUrl: string
  providerId: string
  model?: string
  prompt: string
  body: VideoGenerateBody
  userId: string
  generationJobId?: string
  providerJobId?: string
  requestId?: string
  providerEndpoint?: string
  providerRequestMethod?: string
  providerHttpStatus?: number
  providerFetchError?: string
  providerFetchCause?: Record<string, unknown>
  submittedInput?: unknown
}) {
  const assetIntelligence = analyzeAssetIntelligence({
    mediaType: 'video',
    prompt: args.body.prompt,
    compiledPrompt: args.body.compiledPrompt || args.prompt,
    providerId: args.providerId,
    metadata: { model: args.model, providerJobId: args.providerJobId },
  })
  if (process.env.MEDIA_PERSISTENCE_ENABLED === 'false') {
    return {
      videoUrl: args.videoUrl,
      stableUrl: args.videoUrl,
      mediaPersistence: { status: 'disabled' },
      assetIntelligence,
      warning: undefined,
      assetId: undefined,
      asset: undefined,
      storageProvider: undefined,
      bucket: undefined,
      storageKey: undefined,
      persistenceError: undefined,
    }
  }

  const persistence = await persistGeneratedMedia({
    url: args.videoUrl,
    type: 'video',
    projectId: args.body.projectId,
    workflowId: args.body.workflowId,
    nodeId: args.body.nodeId,
    filenameHint: 'generated-video.mp4',
    sourceProvider: args.providerId,
    userId: args.userId,
    metadata: {
      model: args.model,
      prompt: args.prompt,
      generationJobId: args.generationJobId,
      providerJobId: args.providerJobId,
      requestId: args.requestId,
      providerEndpoint: args.providerEndpoint,
      providerRequestMethod: args.providerRequestMethod,
      providerHttpStatus: args.providerHttpStatus,
      providerFetchError: args.providerFetchError,
      providerFetchCause: args.providerFetchCause,
      submittedInput: args.submittedInput,
      assetIntelligence,
    },
  }).catch((error: unknown): PersistGeneratedMediaResult => ({
    ok: false,
    stage: 'asset_create',
    generationStage: 'asset_create',
    errorCode: 'asset_persistence_error',
    rawErrorCode: 'MEDIA_PERSIST_FAILED',
    errorMessage: error instanceof Error ? error.message : '生成视频转存失败。',
    message: error instanceof Error ? error.message : '生成视频转存失败。',
  }))

  if (!persistence.ok) {
    const displayUrl = persistence.providerOriginalUrl || persistence.temporaryUrl || args.videoUrl
    const pending = persistence.persistenceStatus === 'pending_persistence'
    return {
      displayUrl: displayUrl,
      videoUrl: displayUrl,
      stableUrl: displayUrl,
      mediaPersistence: failedMediaPersistence(persistence),
      assetIntelligence,
      warning: pending ? '媒体已生成，资产库上传待重试。' : '视频生成成功，但媒体转存失败，该链接可能会过期。',
      assetId: persistence.assetId,
      asset: persistence.assetId ? {
        id: persistence.assetId,
        type: 'VIDEO',
        url: displayUrl,
        dataUrl: null,
        thumbnailUrl: null,
        providerId: 'generated-media-persistence',
        generationJobId: args.generationJobId,
        projectId: args.body.projectId,
        workflowId: args.body.workflowId,
        nodeId: args.body.nodeId,
        status: pending ? 'pending_persistence' : 'failed',
      } : undefined,
      originalProviderVideoUrl: args.videoUrl,
      providerOriginalUrl: args.videoUrl,
      temporaryUrl: args.videoUrl,
      generationStatus: 'generation_success',
      persistenceStatus: pending ? 'pending_persistence' : 'persistence_failed',
      assetStatus: pending ? 'pending_persistence' : 'failed',
      persistenceError: persistence,
      generationStage: pending ? 'oss_upload' : persistence.generationStage,
      nextAction: pending ? 'retry_persistence' : undefined,
      resolvedUrl: undefined,
      proxyUrl: undefined,
      storageProvider: persistence.storageProvider,
      bucket: persistence.bucket,
      storageKey: persistence.storageKey,
      signedUrlAvailable: false,
      proxyAvailable: false,
      retryPersistenceAvailable: persistence.retryPersistenceAvailable ?? Boolean(persistence.assetId),
      attemptedUploadKey: persistence.attemptedUploadKey,
      ossRequestId: persistence.ossRequestId,
    }
  }

  return {
    videoUrl: persistence.stableUrl,
    stableUrl: persistence.stableUrl,
    mediaPersistence: { status: 'persisted', ...persistence },
    assetIntelligence,
    warning: undefined,
    assetId: persistence.assetId,
    asset: persistence.assetId ? {
      id: persistence.assetId,
      type: 'VIDEO',
      url: persistence.stableUrl,
      dataUrl: null,
      thumbnailUrl: null,
      providerId: 'generated-media-persistence',
      generationJobId: args.generationJobId,
      projectId: args.body.projectId,
      workflowId: args.body.workflowId,
      nodeId: args.body.nodeId,
    } : undefined,
    originalProviderVideoUrl: args.videoUrl,
    providerOriginalUrl: args.videoUrl,
    temporaryUrl: args.videoUrl,
    generationStatus: 'generation_success',
    persistenceStatus: 'persistence_success',
    assetStatus: 'ready',
    resolvedUrl: persistence.resolvedUrl,
    proxyUrl: persistence.proxyUrl,
    storageProvider: persistence.storageProvider,
    bucket: persistence.bucket,
    storageKey: persistence.storageKey,
    signedUrlAvailable: persistence.signedUrlAvailable,
    proxyAvailable: persistence.proxyAvailable,
    retryPersistenceAvailable: false,
    persistenceError: undefined,
  }
}

export async function GET() {
  try {
    const providers = await getVideoProviderRows()
    return NextResponse.json({
      success: true,
      providers: providers.map((provider) => ({
        providerId: provider.providerId,
        label: provider.displayName,
        configured: provider.configured,
        available: provider.available,
        status: provider.available ? 'available' : provider.availabilityStatus,
        missingEnv: provider.missingEnv,
        missingEnvKeys: provider.missingEnvKeys,
        reason: provider.reason,
        model: provider.model,
      })),
      defaultProviderId: defaultVideoProviderId(providers),
    })
  } catch (error) {
    console.error('[api/generate/video][status]', error)
    return NextResponse.json({
      success: false,
      errorCode: 'VIDEO_PROVIDER_STATUS_FAILED',
      message: error instanceof Error ? error.message : '加载视频 Provider 状态失败。',
      providers: [],
      defaultProviderId: null,
    }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: VideoGenerateBody
    try {
      body = await request.json() as VideoGenerateBody
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: '请先登录后再生成视频。',
        mode: 'unavailable',
        status: 'failed',
      }, { status: 401 })
    }

  const prompt = body.compiledPrompt?.trim() || body.prompt?.trim() || ''
  const projectId = stringInput(body.projectId)
  const nodeId = stringInput(body.nodeId)
  const workflowId = stringInput(body.workflowId)
  const missing = missingGenerationInput({ projectId, nodeId, prompt })
  if (missing.length) {
    return NextResponse.json({
      success: false,
      errorCode: 'missing_generation_input',
      message: `缺少生成必要字段：${missing.join(', ')}。`,
      missing,
      missingFields: missing,
      mode: 'unavailable',
      status: 'failed',
    }, { status: 400 })
  }

  const providers = await getVideoProviderRows()
  const defaultProviderId = defaultVideoProviderId(providers)
  const providerId = body.providerId || defaultProviderId || 'volcengine-seedance-video'
  const imageUrl = firstImageInput(body)

  const providerRow = providers.find((provider) => provider.providerId === providerId)
  if (!providerRow?.available) {
    return providerNotConfiguredResponse(providerId, providerRow?.missingEnv ?? [])
  }

  const requestModel = typeof body.model === 'string' && body.model.trim()
    ? body.model.trim()
    : providerRow?.model ?? providerId
  const generationContext = await prepareGenerationContext({
    userId: currentUser.id,
    projectId,
    workflowId: workflowId || undefined,
    nodeId,
    kind: 'video',
    prompt,
    providerId,
    model: requestModel,
  })
  if (!generationContext.ok) {
    return NextResponse.json({
      success: false,
      errorCode: generationContext.errorCode,
      message: generationContext.message,
      mode: 'unavailable',
      status: 'failed',
    }, { status: generationContext.status })
  }
  body.projectId = generationContext.projectId
  body.workflowId = generationContext.workflowId
  body.nodeId = generationContext.nodeId

  if (providerId === 'volcengine-seedance-video') {
    const generationJob = await createVideoGenerationJob({
      userId: currentUser.id,
      providerId,
      prompt,
      body,
      imageUrl,
    })
    const params = body.params ?? {}
    const requestedDuration = body.duration
      ?? numberParam(params.duration)
      ?? 5
    const requestedAspectRatio = body.aspectRatio
      ?? (typeof params.ratio === 'string' ? params.ratio : undefined)
      ?? (typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined)
      ?? '16:9'
    const requestedResolution = stringParam(params.resolution)
      ?? body.resolution
      ?? stringParam(params.quality)
      ?? stringParam(params.size)
    const duration = normalizeSeedanceRouteDuration(requestedDuration)
    const aspectRatio = normalizeSeedanceRouteAspectRatio(requestedAspectRatio)
    const resolution = normalizeSeedanceRouteResolution(requestedResolution)
    const videoInputValidation = validateVideoInput({
      prompt,
      model: providerRow.model,
      requestedAspectRatio,
      requestedDuration,
      requestedResolution,
    })
    if (!videoInputValidation.ok) {
      await markVideoGenerationJobFailed(generationJob.id, videoInputValidation.message)
      return NextResponse.json({
        success: false,
        providerId,
        mode: 'real',
        status: 'failed',
        message: videoInputValidation.message,
        errorCode: videoInputValidation.errorCode,
        model: providerRow.model,
        missingFields: videoInputValidation.missingFields,
        invalidFields: videoInputValidation.invalidFields,
        submittedInput: {
          providerId,
          model: providerRow.model,
          promptChars: prompt.length,
          hasImageUrl: Boolean(imageUrl),
          imageUrl: summarizeInputUrl(imageUrl),
          requestedDuration,
          duration,
          requestedAspectRatio,
          aspectRatio,
          requestedResolution,
          resolution: resolution ?? null,
        },
      }, { status: 200 })
    }
    const imageReadable = await assertProviderReadableImageUrl(imageUrl)
    if (!imageReadable.ok) {
      await markVideoGenerationJobFailed(generationJob.id, imageReadable.message)
      return NextResponse.json({
        success: false,
        providerId,
        mode: 'real',
        status: 'failed',
        message: imageReadable.message,
        errorCode: visibleProviderErrorCode(imageReadable.errorCode, imageReadable.upstreamStatus, imageReadable.message),
        model: providerRow.model,
        upstreamStatus: imageReadable.upstreamStatus,
        upstreamMessage: imageReadable.upstreamMessage,
        submittedInput: {
          providerId,
          model: providerRow.model,
          promptChars: prompt.length,
          hasImageUrl: Boolean(imageUrl),
          imageUrl: summarizeInputUrl(imageUrl),
          requestedDuration,
          duration,
          requestedAspectRatio,
          aspectRatio,
          requestedResolution,
          resolution,
        },
        providerResponse: imageReadable.diagnostic,
      }, { status: 200 })
    }
    const raw = await generateSeedanceVideo({
      prompt,
      imageUrl,
      providerId,
      duration,
      aspectRatio,
      resolution,
      projectId: body.projectId,
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    })

    if (!raw.success) {
      await markVideoGenerationJobFailed(generationJob.id, raw.message)
      return NextResponse.json({
        success: false,
        providerId,
        mode: raw.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'unavailable' : 'real',
        status: raw.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'not-configured' : 'failed',
        message: raw.message,
        errorCode: visibleProviderErrorCode(raw.errorCode, raw.upstreamStatus, raw.message),
        model: raw.model,
        upstreamStatus: raw.upstreamStatus,
          upstreamMessage: raw.upstreamMessage,
          rawCode: raw.rawCode,
          requestId: raw.requestId,
          providerEndpoint: raw.providerEndpoint,
          providerRequestMethod: raw.providerRequestMethod,
          providerHttpStatus: raw.providerHttpStatus,
          providerFetchError: raw.providerFetchError,
          providerFetchCause: raw.providerFetchCause,
          submittedInput: raw.submittedInput,
          providerResponse: raw.providerResponse,
        }, { status: 200 })
    }

    if (raw.async) {
      const submittedAt = new Date().toISOString()
      await db.generationJob.update({
        where: { id: generationJob.id },
        data: {
          providerJobId: raw.taskId,
          status: 'PROCESSING',
          output: {
            taskId: raw.taskId,
            status: 'running',
            submittedAt,
          },
        },
      }).catch((error: unknown) => {
        console.warn('[api/generate/video] failed to store provider task id', error)
      })
      return NextResponse.json({
        success: true,
        async: true,
        taskId: raw.taskId,
        jobId: generationJob.id,
        generationJobId: generationJob.id,
        providerId,
        model: raw.model,
        mode: 'real',
        status: 'running',
        message: '视频任务已提交，正在生成中',
        submittedAt,
        requestId: raw.requestId,
        providerEndpoint: raw.providerEndpoint,
        providerRequestMethod: raw.providerRequestMethod,
        providerHttpStatus: raw.providerHttpStatus,
        upstreamMessage: raw.upstreamMessage,
        result: {
          metadata: {
            providerId,
            model: raw.model,
            taskId: raw.taskId,
            providerJobId: raw.taskId,
            generationJobId: generationJob.id,
            submittedAt,
            requestId: raw.requestId,
            providerEndpoint: raw.providerEndpoint,
            providerRequestMethod: raw.providerRequestMethod,
            providerHttpStatus: raw.providerHttpStatus,
            submittedInput: raw.submittedInput,
            providerResponse: raw.providerResponse,
          },
        },
      }, { status: 200 })
    }

    const completedAt = new Date().toISOString()
    const persisted = await attachPersistedVideo({
      videoUrl: raw.videoUrl,
      providerId,
      model: raw.model,
      prompt,
      body,
      userId: currentUser.id,
      generationJobId: generationJob.id,
      requestId: raw.requestId,
      providerEndpoint: raw.providerEndpoint,
      providerRequestMethod: raw.providerRequestMethod,
      providerHttpStatus: raw.providerHttpStatus,
      submittedInput: raw.submittedInput,
    })
    const persistencePending = persisted.persistenceStatus === 'pending_persistence'
    const persistenceErrorCode = persisted.persistenceError ? visiblePersistenceErrorCode(persisted.persistenceError.errorCode) : undefined
    return NextResponse.json({
      success: true,
      async: false,
      displayUrl: persisted.videoUrl,
      videoUrl: persisted.videoUrl,
      resultVideoUrl: persisted.videoUrl,
      assetUrl: persisted.assetId && !persistencePending ? persisted.videoUrl : undefined,
      resolvedUrl: persistencePending ? undefined : persisted.resolvedUrl ?? persisted.videoUrl,
      stableUrl: persisted.stableUrl,
      proxyUrl: persisted.proxyUrl ?? undefined,
      storageProvider: persisted.storageProvider ?? undefined,
      bucket: persisted.bucket ?? undefined,
      storageKey: persisted.storageKey ?? undefined,
      signedUrlAvailable: persisted.signedUrlAvailable,
      proxyAvailable: persisted.proxyAvailable,
      assetId: persisted.assetId,
      outputAssetId: persisted.assetId,
      generationJobId: generationJob.id,
      asset: persisted.asset,
      originalProviderVideoUrl: raw.videoUrl,
      providerOriginalUrl: raw.videoUrl,
      temporaryUrl: raw.videoUrl,
      generationStatus: 'generation_success',
      persistenceStatus: persisted.persistenceStatus,
      assetStatus: persisted.assetStatus,
      persistenceError: persistenceErrorCode,
      retryPersistenceAvailable: persisted.retryPersistenceAvailable,
      generationStage: persistencePending ? 'oss_upload' : undefined,
      nextAction: persistencePending ? 'retry_persistence' : 'show_media',
      attemptedUploadKey: persisted.attemptedUploadKey,
      ossRequestId: persisted.ossRequestId,
      mediaPersistence: persisted.mediaPersistence,
      assetIntelligence: persisted.assetIntelligence,
      warning: persisted.warning,
      providerId,
      model: raw.model,
      mode: 'real',
      status: persistencePending ? 'succeeded_with_persistence_pending' : 'succeeded',
      message: persisted.warning ?? `视频生成成功（${raw.model}）`,
      completedAt,
      result: {
        videoUrl: persisted.videoUrl,
        previewUrl: persisted.videoUrl,
        metadata: {
          providerId,
          model: raw.model,
          completedAt,
          generationJobId: generationJob.id,
          generationStatus: 'generation_success',
          persistenceStatus: persisted.persistenceStatus,
          assetStatus: persisted.assetStatus,
          providerOriginalUrl: raw.videoUrl,
          temporaryUrl: raw.videoUrl,
          ...(persisted.assetId ? { assetId: persisted.assetId, outputAssetId: persisted.assetId } : {}),
          ...(persisted.assetId && !persistencePending ? { assetUrl: persisted.videoUrl } : {}),
          ...(persistencePending ? {} : { resolvedUrl: persisted.resolvedUrl ?? persisted.videoUrl }),
          stableUrl: persisted.stableUrl,
          ...(persisted.proxyUrl ? { proxyUrl: persisted.proxyUrl } : {}),
          storageProvider: persisted.storageProvider,
          bucket: persisted.bucket,
          storageKey: persisted.storageKey,
          signedUrlAvailable: persisted.signedUrlAvailable,
          proxyAvailable: persisted.proxyAvailable,
          originalProviderVideoUrl: raw.videoUrl,
          lastGenerationError: null,
          ...(persistenceErrorCode ? {
            persistenceError: persistenceErrorCode,
            attemptedUploadKey: persisted.attemptedUploadKey,
            ossRequestId: persisted.ossRequestId,
            retryPersistenceAvailable: persisted.retryPersistenceAvailable,
            nextAction: 'retry_persistence',
          } : {}),
          mediaPersistence: persisted.mediaPersistence,
          assetIntelligence: persisted.assetIntelligence,
          submittedInput: 'submittedInput' in raw ? raw.submittedInput : undefined,
          providerResponse: 'providerResponse' in raw ? raw.providerResponse : undefined,
        },
      },
    }, { status: 200 })
  }

  const billing = await setupBilling(request, providerId, 'video', prompt, { projectId, nodeId })
  if (!billing.ok) {
    return NextResponse.json(billing.errorResponse, { status: billing.status })
  }

  const raw = await runGenerate({
    providerId,
    nodeType: 'video',
    prompt,
    inputAssets: body.inputAssets,
    params: body.params,
    projectId: body.projectId,
    nodeId: body.nodeId,
  })

  const result = await finalizeBilling(raw, billing.ctx.billingJobId)
  const resultWithMedia = result as typeof result & { resultVideoUrl?: string; videoUrl?: string; model?: string }
  const providerVideoUrl = result.result?.videoUrl ?? resultWithMedia.resultVideoUrl ?? resultWithMedia.videoUrl
  if (result.success && !providerVideoUrl) {
    return NextResponse.json({
      success: false,
      providerId,
      mode: 'real',
      status: 'failed',
      message: '视频生成成功，但 Provider 未返回可下载视频 URL。',
      errorCode: 'provider_no_download_url',
      model: resultWithMedia.model,
      result,
    }, { status: 200 })
  }
  if (result.success && providerVideoUrl) {
    const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object' ? result.result.metadata : {}
    const resultModel = resultWithMedia.model ?? (typeof resultMetadata.model === 'string' ? resultMetadata.model : undefined)
    const persisted = await attachPersistedVideo({
      videoUrl: providerVideoUrl,
      providerId,
      model: resultModel,
      prompt,
      body,
      userId: currentUser.id,
      generationJobId: result.billingJobId ?? result.jobId,
      providerJobId: result.jobId,
    })
    const persistencePending = persisted.persistenceStatus === 'pending_persistence'
    const persistenceErrorCode = persisted.persistenceError ? visiblePersistenceErrorCode(persisted.persistenceError.errorCode) : undefined
    return NextResponse.json({
      ...result,
      success: true,
      status: persistencePending ? 'succeeded_with_persistence_pending' : result.status,
      message: persisted.warning ?? result.message,
      displayUrl: persisted.videoUrl,
      videoUrl: persisted.videoUrl,
      resultVideoUrl: persisted.videoUrl,
      assetUrl: persisted.assetId && !persistencePending ? persisted.videoUrl : undefined,
      resolvedUrl: persistencePending ? undefined : persisted.resolvedUrl ?? persisted.videoUrl,
      stableUrl: persisted.stableUrl,
      proxyUrl: persisted.proxyUrl ?? undefined,
      storageProvider: persisted.storageProvider ?? undefined,
      bucket: persisted.bucket ?? undefined,
      storageKey: persisted.storageKey ?? undefined,
      signedUrlAvailable: persisted.signedUrlAvailable,
      proxyAvailable: persisted.proxyAvailable,
      assetId: persisted.assetId,
      outputAssetId: persisted.assetId,
      generationJobId: result.billingJobId ?? result.jobId,
      asset: persisted.asset,
      originalProviderVideoUrl: providerVideoUrl,
      providerOriginalUrl: providerVideoUrl,
      temporaryUrl: providerVideoUrl,
      generationStatus: 'generation_success',
      persistenceStatus: persisted.persistenceStatus,
      assetStatus: persisted.assetStatus,
      persistenceError: persistenceErrorCode,
      retryPersistenceAvailable: persisted.retryPersistenceAvailable,
      generationStage: persistencePending ? 'oss_upload' : undefined,
      nextAction: persistencePending ? 'retry_persistence' : 'show_media',
      attemptedUploadKey: persisted.attemptedUploadKey,
      ossRequestId: persisted.ossRequestId,
      mediaPersistence: persisted.mediaPersistence,
      assetIntelligence: persisted.assetIntelligence,
      warning: persisted.warning,
      result: {
        ...result.result,
        videoUrl: persisted.videoUrl,
        previewUrl: persisted.videoUrl,
        metadata: {
          ...(result.result?.metadata ?? {}),
          generationStatus: 'generation_success',
          persistenceStatus: persisted.persistenceStatus,
          assetStatus: persisted.assetStatus,
          providerOriginalUrl: providerVideoUrl,
          temporaryUrl: providerVideoUrl,
          ...(persisted.assetId ? { assetId: persisted.assetId, outputAssetId: persisted.assetId } : {}),
          ...(persisted.assetId && !persistencePending ? { assetUrl: persisted.videoUrl } : {}),
          ...(persistencePending ? {} : { resolvedUrl: persisted.resolvedUrl ?? persisted.videoUrl }),
          stableUrl: persisted.stableUrl,
          ...(persisted.proxyUrl ? { proxyUrl: persisted.proxyUrl } : {}),
          storageProvider: persisted.storageProvider,
          bucket: persisted.bucket,
          storageKey: persisted.storageKey,
          signedUrlAvailable: persisted.signedUrlAvailable,
          proxyAvailable: persisted.proxyAvailable,
          originalProviderVideoUrl: providerVideoUrl,
          lastGenerationError: null,
          ...(persistenceErrorCode ? {
            persistenceError: persistenceErrorCode,
            attemptedUploadKey: persisted.attemptedUploadKey,
            ossRequestId: persisted.ossRequestId,
            retryPersistenceAvailable: persisted.retryPersistenceAvailable,
            nextAction: 'retry_persistence',
          } : {}),
          mediaPersistence: persisted.mediaPersistence,
          assetIntelligence: persisted.assetIntelligence,
        },
      },
    })
  }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/video]', err)
    return NextResponse.json({
      success: false,
      message,
      errorCode: 'generation_failed',
      mode: 'unavailable',
      status: 'failed',
    }, { status: 500 })
  }
}
