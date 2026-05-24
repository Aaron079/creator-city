import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import { missingGenerationInput, prepareGenerationContext, stringInput } from '@/lib/generation/generation-context'
import { isRenderableMediaUrl } from '@/lib/media/renderable-url'
import { getExecutorForProvider } from '@/lib/executors/executor-gateway'

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
    ?? null
}

function providerNotConfiguredResponse(providerId: string, missingEnv: string[] = [], requestId?: string, submittedInput?: unknown) {
  return videoErrorResponse({
    errorCode: 'provider_env_missing',
    errorMessage: '视频 Provider 未配置，请先在 /admin/providers 配置环境变量。',
    requestId,
    providerId,
    mode: 'unavailable',
    status: 'not-configured',
    submittedInput,
    details: {
      missingEnv,
      missingEnvKeys: missingEnv,
    },
  })
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

function createVideoRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `video_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function safeVideoSubmittedInput(body?: VideoGenerateBody, overrides: Record<string, unknown> = {}) {
  const imageUrl = body ? firstImageInput(body) : undefined
  return {
    providerId: stringParam(overrides.providerId) ?? stringParam(body?.providerId) ?? null,
    model: stringParam(overrides.model) ?? stringParam(body?.model) ?? null,
    projectId: stringInput(body?.projectId) || null,
    workflowId: stringInput(body?.workflowId) || null,
    nodeId: stringInput(body?.nodeId) || null,
    promptChars: body?.prompt?.trim().length ?? 0,
    compiledPromptChars: body?.compiledPrompt?.trim().length ?? 0,
    hasImageUrl: Boolean(imageUrl),
    imageUrl: summarizeInputUrl(imageUrl),
    ...overrides,
  }
}

function videoErrorResponse(args: {
  errorCode: string
  errorMessage: string
  requestId?: string | null
  upstreamStatus?: number | null
  upstreamMessage?: string | null
  submittedInput?: unknown
  statusCode?: number
  providerId?: string | null
  mode?: string
  status?: string
  details?: Record<string, unknown>
}) {
  return NextResponse.json({
    success: false,
    providerId: args.providerId ?? undefined,
    mode: args.mode ?? 'real',
    status: args.status ?? 'failed',
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
    message: args.errorMessage,
    requestId: args.requestId || createVideoRequestId(),
    upstreamStatus: args.upstreamStatus ?? null,
    upstreamMessage: args.upstreamMessage ?? null,
    submittedInput: args.submittedInput ?? null,
    ...(args.details ?? {}),
  }, { status: args.statusCode ?? 200 })
}

function classifyVideoException(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '生成请求失败')
  const haystack = message.toLowerCase()
  if (/invalid[_ -]?param|invalid parameter|bad request|parameter|参数/.test(haystack)) return { errorCode: 'provider_invalid_parameter', message }
  if (/no .*download|download .*url|url .*missing|video.*url.*empty|provider_no_download_url/.test(haystack)) return { errorCode: 'provider_no_download_url', message }
  if (/(oss|upload|aliyun|bucket|storage).*(timeout|timed out)|timeout.*(oss|upload|aliyun|bucket|storage)/.test(haystack)) return { errorCode: 'oss_upload_timeout', message }
  if (/oss|upload|aliyun|bucket|storage|putobject/.test(haystack)) return { errorCode: 'oss_upload_error', message }
  if (/fetch failed|failed to fetch|network|econn|enotfound|dns|socket|connection/.test(haystack)) return { errorCode: 'provider_network_failed', message }
  return { errorCode: 'generation_failed', message }
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

function assertProviderReadableImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) return { ok: true as const }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return {
      ok: false as const,
      errorCode: 'PROVIDER_INVALID_PARAMETER',
      message: 'Seedance 首帧 imageUrl 必须是可公网访问的 http/https URL。',
      upstreamMessage: `imageUrl is not http(s): ${imageUrl.slice(0, 160)}`,
    }
  }
  const mediaCandidate = isRenderableMediaUrl(imageUrl, { source: 'imageUrl' })
  if (!mediaCandidate.ok) {
    return {
      ok: false as const,
      errorCode: 'PROVIDER_INVALID_PARAMETER',
      message: 'Seedance 首帧 imageUrl 必须是真实图片 URL，不能是 Provider API endpoint。',
      upstreamMessage: `${mediaCandidate.reason}: ${imageUrl.slice(0, 160)}`,
    }
  }
  return { ok: true as const }
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
  if (process.env.GENERATION_DISABLED === 'true') {
    return NextResponse.json({
      success: false,
      errorCode: 'GENERATION_DISABLED',
      message: 'Generation is temporarily disabled to prevent token drain.',
      mode: 'unavailable',
      status: 'failed',
    }, { status: 200 })
  }

  const routeRequestId = createVideoRequestId()
  let body: VideoGenerateBody | undefined
  try {
    try {
      body = await request.json() as VideoGenerateBody
    } catch {
      return videoErrorResponse({
        errorCode: 'provider_invalid_parameter',
        errorMessage: 'Invalid JSON',
        requestId: routeRequestId,
        statusCode: 400,
        submittedInput: safeVideoSubmittedInput(undefined),
      })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return videoErrorResponse({
        errorCode: 'UNAUTHORIZED',
        errorMessage: '请先登录后再生成视频。',
        requestId: routeRequestId,
        mode: 'unavailable',
        status: 'failed',
        statusCode: 401,
        submittedInput: safeVideoSubmittedInput(body),
      })
    }

  if (!body) {
    return videoErrorResponse({
      errorCode: 'provider_invalid_parameter',
      errorMessage: 'Invalid JSON',
      requestId: routeRequestId,
      statusCode: 400,
      submittedInput: safeVideoSubmittedInput(undefined),
    })
  }

  const prompt = body.prompt?.trim() || ''
  const projectId = stringInput(body.projectId)
  const nodeId = stringInput(body.nodeId)
  const workflowId = stringInput(body.workflowId)
  const missing = missingGenerationInput({ projectId, nodeId, prompt })
  if (missing.length) {
    return videoErrorResponse({
      errorCode: 'missing_generation_input',
      errorMessage: `缺少生成必要字段：${missing.join(', ')}。`,
      requestId: routeRequestId,
      mode: 'unavailable',
      status: 'failed',
      statusCode: 400,
      submittedInput: safeVideoSubmittedInput(body),
      details: {
        missing,
        missingFields: missing,
      },
    })
  }

  const providers = await getVideoProviderRows()
  const defaultProviderId = defaultVideoProviderId(providers)
  const providerId = body.providerId || defaultProviderId || 'volcengine-seedance-video'
  // cn video providers will route to cn-executor in v2; currently runs direct for Seedance
  const { providerRegion, executionRegion, storageRegion, executor: resolvedExecutor, executorKind } = getExecutorForProvider(providerId)
  const imageUrl = firstImageInput(body)

  const providerRow = providers.find((provider) => provider.providerId === providerId)
  if (!providerRow?.available) {
    return providerNotConfiguredResponse(providerId, providerRow?.missingEnv ?? [], routeRequestId, safeVideoSubmittedInput(body, {
      providerId,
    }))
  }

  const requestModel = providerRow?.model ?? providerId
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
    return videoErrorResponse({
      errorCode: generationContext.errorCode,
      errorMessage: generationContext.message,
      requestId: routeRequestId,
      providerId,
      mode: 'unavailable',
      status: 'failed',
      statusCode: generationContext.status,
      submittedInput: safeVideoSubmittedInput(body, {
        providerId,
        model: requestModel,
      }),
    })
  }
  body.projectId = generationContext.projectId
  body.workflowId = generationContext.workflowId
  body.nodeId = generationContext.nodeId

  if (providerId === 'volcengine-seedance-video') {
    const requestedDuration = body.duration
      ?? 5
    const requestedAspectRatio = body.aspectRatio
      ?? '16:9'
    const requestedResolution = body.resolution
    const duration = normalizeSeedanceRouteDuration(requestedDuration)
    const aspectRatio = normalizeSeedanceRouteAspectRatio(requestedAspectRatio)
    const resolution = normalizeSeedanceRouteResolution(requestedResolution)

    // Validate before creating job
    const videoInputValidation = validateVideoInput({
      prompt,
      model: providerRow.model,
      requestedAspectRatio,
      requestedDuration,
      requestedResolution,
    })
    if (!videoInputValidation.ok) {
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: 'failed',
        errorMessage: videoInputValidation.message,
        errorCode: videoInputValidation.errorCode,
        requestId: routeRequestId,
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
        details: {
          model: providerRow.model,
          missingFields: videoInputValidation.missingFields,
          invalidFields: videoInputValidation.invalidFields,
        },
      })
    }
    const imageReadable = assertProviderReadableImageUrl(imageUrl)
    if (!imageReadable.ok) {
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: 'failed',
        errorMessage: imageReadable.message,
        errorCode: visibleProviderErrorCode(imageReadable.errorCode, undefined, imageReadable.message),
        requestId: routeRequestId,
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
          resolution: resolution ?? null,
        },
        details: { model: providerRow.model },
      })
    }

    // Create GenerationJob (QUEUED) — cn-executor will execute asynchronously
    const submittedAt = new Date().toISOString()
    const submittedInput = {
      providerId, model: providerRow.model,
      projectId: body.projectId ?? null,
      workflowId: body.workflowId ?? null,
      nodeId: body.nodeId ?? null,
      providerRegion,
      executionRegion,
      storageRegion,
      executorKind,
      promptChars: prompt.length,
      hasImageUrl: Boolean(imageUrl),
      imageUrl: summarizeInputUrl(imageUrl),
      duration, aspectRatio, resolution: resolution ?? null,
    }
    const generationJob = await db.generationJob.create({
      data: {
        userId: currentUser.id,
        projectId: body.projectId ?? null,
        nodeId: body.nodeId ?? null,
        providerId,
        provider: providerId,
        nodeType: 'video',
        kind: 'video',
        status: 'QUEUED',
        prompt: prompt.slice(0, 2000),
        input: {
          prompt,
          imageUrl: imageUrl ?? null,
          model: providerRow.model,
          duration,
          aspectRatio,
          resolution: resolution ?? null,
          workflowId: body.workflowId ?? null,
          nodeId: body.nodeId ?? null,
          projectId: body.projectId ?? null,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executorKind,
          submittedAt,
          submittedInput,
        },
      },
    }).catch((err: unknown) => {
      console.warn('[api/generate/video] failed to create GenerationJob', err)
      return null
    })

    if (!generationJob) {
      return videoErrorResponse({
        providerId, mode: 'real', status: 'failed',
        errorCode: 'job_create_failed',
        errorMessage: '视频任务创建失败，请重试。',
        requestId: routeRequestId,
        submittedInput,
      })
    }

    // Fire-and-forget to cn-executor — do NOT await
    const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
    const cnSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET ?? ''
    if (!cnBaseUrl) {
      const output = {
        errorCode: 'executor_trigger_failed',
        errorStage: 'executor_dispatch',
        stageTrace: ['api_route', 'create_generation_job', 'executor_dispatch'],
        message: 'CREATOR_CN_API_BASE_URL 未配置，cn-executor 无法访问。请在 Vercel 环境变量中设置阿里云 FC 函数的 URL。',
        submittedInput,
        executorKind,
      }
      await db.generationJob.update({
        where: { id: generationJob.id },
        data: {
          status: 'FAILED',
          errorMessage: output.message,
          output,
        },
      }).catch((err: unknown) => {
        console.warn('[api/generate/video] failed to mark job failed after missing cn executor url', err)
      })
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: 'failed',
        errorCode: output.errorCode,
        errorMessage: output.message,
        requestId: routeRequestId,
        submittedInput,
        details: {
          generationJobId: generationJob.id,
          jobId: generationJob.id,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          errorStage: output.errorStage,
          stageTrace: output.stageTrace,
        },
      })
    }
    // Await the trigger — bare fetch() without await is dropped when Vercel terminates the function.
    // Video generation takes 60-180s, so we only wait 12s for TCP delivery confirmation.
    // On timeout: request was delivered and cn-executor is processing — return queued.
    // On network error: cn-executor unreachable — mark FAILED and return error.
    let videoTriggerResponse: Response | null = null
    let videoTriggerError: unknown = null
    try {
      videoTriggerResponse = await fetch(`${cnBaseUrl}/api/jobs/run-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cnSecret}`,
          'x-creator-executor-secret': cnSecret,
        },
        body: JSON.stringify({ generationJobId: generationJob.id }),
        signal: AbortSignal.timeout(12_000),
      })
    } catch (err) {
      videoTriggerError = err
    }

    const videoTriggerTimedOut = videoTriggerError instanceof Error && (videoTriggerError.name === 'TimeoutError' || videoTriggerError.name === 'AbortError')

    if (videoTriggerError && !videoTriggerTimedOut) {
      // Network failure — cn-executor unreachable
      const errMsg = videoTriggerError instanceof Error ? videoTriggerError.message : String(videoTriggerError)
      const failOutput = {
        errorCode: 'executor_trigger_failed',
        errorStage: 'executor_dispatch',
        stageTrace: ['api_route', 'create_generation_job', 'executor_dispatch'],
        message: `cn-executor 触发失败（网络错误）：${errMsg}`,
        submittedInput,
        executorKind,
      }
      console.warn('[api/generate/video] cn-executor trigger network error:', errMsg, { generationJobId: generationJob.id })
      await db.generationJob.update({
        where: { id: generationJob.id },
        data: { status: 'FAILED', errorMessage: failOutput.message, output: failOutput },
      }).catch((e: unknown) => { console.warn('[api/generate/video] failed to mark FAILED after trigger error', e) })
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: 'failed',
        errorCode: failOutput.errorCode,
        errorMessage: failOutput.message,
        requestId: routeRequestId,
        submittedInput,
        details: {
          generationJobId: generationJob.id,
          jobId: generationJob.id,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          errorStage: failOutput.errorStage,
          stageTrace: failOutput.stageTrace,
        },
      })
    }

    if (videoTriggerResponse && !videoTriggerResponse.ok) {
      // cn-executor returned 4xx / 5xx
      const httpStatus = videoTriggerResponse.status
      const failOutput = {
        errorCode: 'executor_trigger_failed',
        errorStage: 'executor_dispatch',
        stageTrace: ['api_route', 'create_generation_job', 'executor_dispatch'],
        message: `cn-executor 返回 HTTP ${httpStatus}，触发失败`,
        providerHttpStatus: httpStatus,
        submittedInput,
        executorKind,
      }
      console.warn('[api/generate/video] cn-executor returned non-2xx', { httpStatus, generationJobId: generationJob.id })
      await db.generationJob.update({
        where: { id: generationJob.id },
        data: { status: 'FAILED', errorMessage: failOutput.message, output: failOutput },
      }).catch((e: unknown) => { console.warn('[api/generate/video] failed to mark FAILED after trigger HTTP error', e) })
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: 'failed',
        errorCode: failOutput.errorCode,
        errorMessage: failOutput.message,
        requestId: routeRequestId,
        submittedInput,
        details: {
          generationJobId: generationJob.id,
          jobId: generationJob.id,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          errorStage: failOutput.errorStage,
          stageTrace: failOutput.stageTrace,
        },
      })
    }

    if (videoTriggerTimedOut) {
      console.log('[api/generate/video] cn-executor trigger timed out after 12s — job delivered, Aliyun FC processing', { generationJobId: generationJob.id })
    } else if (videoTriggerResponse?.ok) {
      console.log('[api/generate/video] cn-executor trigger acknowledged', { generationJobId: generationJob.id, status: videoTriggerResponse.status })
    }

    return NextResponse.json({
      success: true,
      async: true,
      providerId,
      providerRegion,
      executionRegion,
      storageRegion,
      executor: resolvedExecutor,
      executorKind,
      model: providerRow.model,
      mode: 'real',
      status: 'queued',
      generationJobId: generationJob.id,
      jobId: generationJob.id,
      submittedAt,
      submittedInput,
      message: '视频生成任务已提交，正在处理中',
    }, { status: 200 })
  }

  // Guard: all cn providers must be handled above (Seedance block + future cn video providers).
  // If a cn provider reaches here it means the route has no handler for it — reject explicitly.
  if (providerRegion === 'cn') {
    console.error('[api/generate/video] provider_region_mismatch: cn provider reached Vercel-local handler', { providerId, providerRegion, executorKind })
    return videoErrorResponse({
      providerId,
      mode: 'unavailable',
      status: 'failed',
      errorCode: 'provider_region_mismatch',
      errorMessage: `中国 provider [${providerId}] 不能在 Vercel 上直接执行，必须通过 cn-executor（aliyun_fc）运行。如需支持该 provider，请在 cn-executor 中实现对应的 job runner。`,
      requestId: routeRequestId,
      submittedInput: safeVideoSubmittedInput(body, { providerId }),
    })
  }

  const billing = await setupBilling(request, providerId, 'video', prompt, { projectId, nodeId })
  if (!billing.ok) {
    const billingError = billing.errorResponse as Record<string, unknown>
    const billingMessage = stringParam(billingError.errorMessage)
      ?? stringParam(billingError.message)
      ?? '视频生成扣费检查失败。'
    return videoErrorResponse({
      providerId,
      mode: 'unavailable',
      status: 'failed',
      statusCode: billing.status,
      errorCode: stringParam(billingError.errorCode) ?? 'billing_error',
      errorMessage: billingMessage,
      requestId: routeRequestId,
      submittedInput: safeVideoSubmittedInput(body, {
        providerId,
      }),
      details: billingError,
    })
  }

  const raw = await runGenerate({
    providerId,
    nodeType: 'video',
    prompt,
    inputAssets: body.inputAssets,
    params: {
      ratio: body.aspectRatio ?? '16:9',
      aspectRatio: body.aspectRatio ?? '16:9',
      duration: body.duration ?? 5,
      ...(body.resolution ? { resolution: body.resolution } : {}),
    },
    projectId: body.projectId,
    nodeId: body.nodeId,
  })

  const result = await finalizeBilling(raw, billing.ctx.billingJobId)
  const resultWithMedia = result as typeof result & { resultVideoUrl?: string; videoUrl?: string; model?: string }
  const providerVideoUrl = result.result?.videoUrl ?? resultWithMedia.resultVideoUrl ?? resultWithMedia.videoUrl
  if (result.success && !providerVideoUrl) {
    return videoErrorResponse({
      providerId,
      mode: 'real',
      status: 'failed',
      errorMessage: '视频生成成功，但 Provider 未返回可下载视频 URL。',
      errorCode: 'provider_no_download_url',
      requestId: routeRequestId,
      submittedInput: safeVideoSubmittedInput(body, {
        providerId,
        model: resultWithMedia.model,
      }),
      details: {
        model: resultWithMedia.model,
        result,
      },
    })
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
    if (persistenceErrorCode) {
      return videoErrorResponse({
        providerId,
        mode: 'real',
        status: persisted.persistenceStatus ?? 'failed',
        errorCode: persistenceErrorCode,
        errorMessage: persisted.persistenceError?.message || persisted.warning || '视频生成成功，但 OSS 上传失败。',
        requestId: routeRequestId,
        submittedInput: safeVideoSubmittedInput(body, {
          providerId,
          model: resultModel,
        }),
        details: {
          model: resultModel,
          mediaDownloadUrl: providerVideoUrl,
          sourceUrl: providerVideoUrl,
          storageProvider: persisted.storageProvider,
          bucket: persisted.bucket,
          storageKey: persisted.storageKey,
          attemptedUploadKey: persisted.attemptedUploadKey,
          ossRequestId: persisted.ossRequestId,
          mediaPersistence: persisted.mediaPersistence,
          assetIntelligence: persisted.assetIntelligence,
          result,
        },
      })
    }
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
      submittedInput: safeVideoSubmittedInput(body, {
        providerId,
        model: resultModel,
      }),
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
    const failedResult = result as typeof result & {
      errorCode?: string
      message?: string
      errorMessage?: string
      upstreamStatus?: number
      upstreamMessage?: string
      requestId?: string
      rawCode?: string
      providerEndpoint?: string
      providerResponse?: unknown
      submittedInput?: unknown
      model?: string
    }
    const failedMessage = failedResult.errorMessage || failedResult.message || '视频生成失败。'
    return videoErrorResponse({
      providerId,
      mode: 'real',
      status: 'failed',
      errorCode: visibleProviderErrorCode(failedResult.errorCode, failedResult.upstreamStatus, failedMessage),
      errorMessage: failedMessage,
      requestId: failedResult.requestId || routeRequestId,
      upstreamStatus: failedResult.upstreamStatus,
      upstreamMessage: failedResult.upstreamMessage,
      submittedInput: failedResult.submittedInput ?? safeVideoSubmittedInput(body, {
        providerId,
        model: failedResult.model ?? resultWithMedia.model,
      }),
      details: {
        model: failedResult.model ?? resultWithMedia.model,
        rawCode: failedResult.rawCode,
        providerEndpoint: failedResult.providerEndpoint,
        providerResponse: failedResult.providerResponse,
        result,
      },
    })
  } catch (err) {
    const classified = classifyVideoException(err)
    console.error('[api/generate/video]', err)
    return videoErrorResponse({
      errorCode: classified.errorCode,
      errorMessage: classified.message,
      requestId: routeRequestId,
      mode: 'unavailable',
      status: 'failed',
      upstreamMessage: classified.message,
      submittedInput: safeVideoSubmittedInput(body),
      details: {
        errorStage: 'api_route_exception',
        stageTrace: ['api_route_exception'],
      },
    })
  }
}
