import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { releaseJobCredits } from '@/lib/billing/settle'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import { generateJimengImage } from '@/lib/providers/china/jimeng'
import { generateSeedreamImage } from '@/lib/providers/china/volcengine'
import type { GenerateResponse } from '@/lib/providers/types'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { db } from '@/lib/db'
import { missingGenerationInput, prepareGenerationContext, stringInput } from '@/lib/generation/generation-context'
import { startImageGenerationViaRegion, getExecutorForProvider } from '@/lib/executors/executor-gateway'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type ImageGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
  model?: string
  aspectRatio?: string
  size?: string
  resolution?: string
  system?: string
  compiledPrompt?: string
}

const IMAGE_PROVIDER_ORDER = ['volcengine-seedream-image', 'jimeng-image', 'openai-image'] as const

async function getImageProviderRows() {
  const status = await buildProviderManagementStatus()
  const rowById = new Map(status.providers.map((provider) => [provider.providerId, provider]))
  return IMAGE_PROVIDER_ORDER.map((providerId) => rowById.get(providerId)).filter((row): row is NonNullable<typeof row> => Boolean(row))
}

function defaultImageProviderId(rows: Awaited<ReturnType<typeof getImageProviderRows>>) {
  return rows.find((row) => row.providerId === 'volcengine-seedream-image' && row.available)?.providerId
    ?? rows.find((row) => row.providerId === 'jimeng-image' && row.available)?.providerId
    ?? rows.find((row) => row.providerId === 'openai-image' && row.available)?.providerId
    ?? null
}

function providerNotConfiguredResponse(providerId: string, missingEnv: string[] = []) {
  return NextResponse.json({
    success: false,
    errorCode: 'provider_env_missing',
    message: '图片 Provider 未配置，请先在 /admin/providers 配置环境变量。',
    providerId,
    missingEnv,
    missingEnvKeys: missingEnv,
    mode: 'unavailable',
    status: 'not-configured',
  }, { status: 200 })
}

function failedMediaPersistence(errorCode: string, message: string, upstreamStatus?: number, upstreamMessage?: string, providerFetchError?: string, providerFetchCause?: Record<string, unknown>) {
  return {
    status: 'failed',
    errorCode,
    errorMessage: message,
    message,
    upstreamStatus,
    upstreamMessage,
    providerFetchError,
    providerFetchCause,
  }
}

function normalizePersistFailure(result: Extract<PersistGeneratedMediaResult, { ok: false }>) {
  const pending = result.persistenceStatus === 'pending_persistence'
  return {
    status: pending ? 'pending_persistence' : 'failed',
    ...result,
    errorMessage: result.errorMessage || result.message,
    retryPersistenceAvailable: result.retryPersistenceAvailable ?? Boolean(result.assetId),
  }
}

function visibleProviderErrorCode(errorCode: string | undefined, upstreamStatus?: number, message = '') {
  const code = errorCode ?? ''
  const haystack = `${code} ${message}`.toLowerCase()
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'VOLCENGINE_MODEL_REQUIRED' || code === 'provider_env_missing' || code.includes('MODEL_REQUIRED')) return 'provider_env_missing'
  if (code === 'PROMPT_REQUIRED' || code === 'MISSING_GENERATION_INPUT' || code === 'missing_generation_input') return 'missing_generation_input'
  if (code === 'provider_timeout' || code.includes('TIMEOUT') || /timeout|abort/.test(haystack)) return 'provider_timeout'
  if (code === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(haystack)) return 'provider_network_failed'
  if (code === 'provider_response_parse_failed') return 'provider_response_parse_failed'
  if (code === 'provider_request_failed') return 'provider_request_failed'
  if (code === 'PROVIDER_AUTH_ERROR' || code === 'provider_auth_failed' || code === 'provider_auth_error' || upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_failed'
  if (code === 'provider_model_invalid' || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|does not exist)|模型|接入点/.test(haystack)) return 'provider_model_invalid'
  if (code === 'PROVIDER_QUOTA_OR_BILLING_ERROR' || code === 'provider_quota_or_billing_error' || code === 'INSUFFICIENT_CREDITS' || code === 'BILLING_ERROR' || upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (code === 'PROVIDER_INVALID_PARAMETER' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'IMAGE_URL_EMPTY' || code.includes('URL_EMPTY') || code.includes('URL_MISSING')) return 'provider_no_download_url'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(haystack)) return 'provider_media_download_failed'
  return code || 'generation_failed'
}

function imageUrlFromResponse(response: GenerateResponse & { imageUrl?: string; resultImageUrl?: string; dataUrl?: string; displayUrl?: string; providerOriginalUrl?: string; temporaryUrl?: string }) {
  return response.result?.imageUrl
    ?? response.displayUrl
    ?? response.resultImageUrl
    ?? response.imageUrl
    ?? response.dataUrl
    ?? response.providerOriginalUrl
    ?? response.temporaryUrl
    ?? ''
}

function extractMissingColumn(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err)
  // Prisma v5: "The column `X` does not exist in the current database."
  return msg.match(/The column `([^`]+)` does not exist/)?.[1]
    ?? msg.match(/Unknown arg `([^`]+)`/)?.[1]
    ?? null
}

async function createImageGenerationJob(args: {
  userId: string
  providerId: string
  prompt: string
  body: ImageGenerateBody
  model?: string | null
}) {
  const inputJson = {
    prompt: args.prompt,
    projectId: args.body.projectId ?? null,
    params: args.body.params ?? {},
    model: args.model ?? null,
    workflowId: args.body.workflowId,
    nodeId: args.body.nodeId,
  }
  // Production DB may lag behind schema. Retry stripping each missing column until insert succeeds.
  // Missing columns come one at a time from Prisma, so each retry strips exactly one more.
  const skip = new Set<string>()
  for (let attempt = 0; attempt < 10; attempt++) {
    const data = {
      userId: args.userId,
      providerId: args.providerId,
      nodeType: 'image',
      status: 'PROCESSING' as const,
      prompt: args.prompt.slice(0, 2000),
      ...(skip.has('projectId') ? {} : { projectId: args.body.projectId ?? null }),
      ...(skip.has('provider') ? {} : { provider: args.providerId }),
      ...(skip.has('nodeId') ? {} : { nodeId: args.body.nodeId ?? null }),
      ...(skip.has('kind') ? {} : { kind: 'image' as const }),
      ...(skip.has('input') ? {} : { input: inputJson }),
    }
    try {
      return await db.generationJob.create({ data })
    } catch (err) {
      const col = extractMissingColumn(err)
      if (!col || skip.has(col)) throw err
      skip.add(col)
    }
  }
  throw new Error('createImageGenerationJob: too many missing columns — run the production DB migration')
}

async function markImageGenerationJobFailed(jobId: string | undefined | null, message: string, errorCode?: string) {
  if (!jobId) return
  await db.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      error: message,
      errorMessage: message.slice(0, 1000),
      output: {
        errorCode: errorCode ?? 'image_generation_failed',
        message,
      },
      completedAt: new Date(),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/image] failed to mark GenerationJob failed', error)
  })
  await releaseJobCredits(jobId).catch((error: unknown) => {
    console.warn('[api/generate/image] failed to release image generation credits', error)
  })
}

export async function GET() {
  try {
    const providers = await getImageProviderRows()
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
      defaultProviderId: defaultImageProviderId(providers),
    })
  } catch (error) {
    console.error('[api/generate/image][status]', error)
    return NextResponse.json({
      success: false,
      errorCode: 'IMAGE_PROVIDER_STATUS_FAILED',
      message: error instanceof Error ? error.message : '加载图片 Provider 状态失败。',
      providers: [],
      defaultProviderId: null,
    }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: ImageGenerateBody
    try {
      body = await request.json() as ImageGenerateBody
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON', errorCode: 'INVALID_INPUT' }, { status: 400 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({
        success: false,
        errorCode: 'UNAUTHORIZED',
        message: '请先登录后再生成图片。',
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

    const providers = await getImageProviderRows()
    const defaultProviderId = defaultImageProviderId(providers)
    const providerId = body.providerId || defaultProviderId || 'volcengine-seedream-image'
    const providerRow = providers.find((provider) => provider.providerId === providerId)
    if (!providerRow?.available) {
      if (providerId === 'openai-image' && providerRow && !providerRow.available) {
        return NextResponse.json({
          success: false,
          errorCode: 'provider_env_missing',
          message: 'OpenAI Image 暂不可用。当前环境建议使用 Volcengine Seedream 或 Jimeng 图片模型。',
          providerId,
          missingEnv: providerRow.missingEnv,
          missingEnvKeys: providerRow.missingEnvKeys,
          mode: 'unavailable',
          status: 'not-configured',
        }, { status: 200 })
      }
      return providerNotConfiguredResponse(providerId, providerRow?.missingEnv ?? [])
    }
    if (providerId === 'volcengine-seedream-image' && !process.env.VOLCENGINE_SEEDREAM_MODEL?.trim()) {
      return NextResponse.json({
        success: false,
        errorCode: 'provider_env_missing',
        message: '请在火山方舟控制台复制真实 Model ID 或 Endpoint ID 到 VOLCENGINE_SEEDREAM_MODEL。',
        providerId,
        model: '',
        mode: 'unavailable',
        status: 'not-configured',
        missingEnv: ['VOLCENGINE_SEEDREAM_MODEL'],
        missingEnvKeys: ['VOLCENGINE_SEEDREAM_MODEL'],
      }, { status: 200 })
    }

    const params = body.params ?? {}
    const aspectRatio = body.aspectRatio
      ?? (typeof params.ratio === 'string' ? params.ratio : undefined)
      ?? (typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined)
    const size = body.size ?? (typeof params.size === 'string' ? params.size : undefined)
    const referenceImages = body.inputAssets
      ?.filter((asset) => asset.type === 'image' && asset.url)
      .map((asset) => asset.url as string)
    const requestModel = typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : providerRow?.model ?? null
    const submittedModel = providerId === 'volcengine-seedream-image'
      ? (process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() || requestModel)
      : requestModel
    const generationContext = await prepareGenerationContext({
      userId: currentUser.id,
      projectId,
      workflowId: workflowId || undefined,
      nodeId,
      kind: 'image',
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
    const executorResolution = getExecutorForProvider(providerId)
    const { providerRegion, executionRegion, storageRegion, executor: resolvedExecutor, unknownProvider } = executorResolution
    const submittedInput = {
      providerId,
      providerRegion,
      executionRegion,
      storageRegion,
      executor: resolvedExecutor,
      ...(unknownProvider ? { unknownProvider: true } : {}),
      model: submittedModel,
      ...(providerId === 'volcengine-seedream-image' ? { modelSource: 'VOLCENGINE_SEEDREAM_MODEL' } : {}),
      promptChars: prompt.length,
      aspectRatio: aspectRatio ?? null,
      size: size ?? null,
      referenceImageCount: referenceImages?.length ?? 0,
      hasReferenceImages: Boolean(referenceImages?.length),
      nodeId: body.nodeId ?? null,
      projectId: body.projectId ?? null,
      workflowId: body.workflowId ?? null,
    }

    const billing = await setupBilling(request, providerId, 'image', prompt, { projectId, nodeId })
    if (!billing.ok) {
      if (providerId === 'openai-image' && billing.errorResponse.errorCode === 'BILLING_ERROR') {
        return NextResponse.json({
          success: false,
          errorCode: 'provider_env_missing',
          message: 'OpenAI Image 暂不可用。当前环境建议使用 Volcengine Seedream 或 Jimeng 图片模型。',
          providerId,
          mode: 'unavailable',
          status: 'failed',
          submittedInput,
        }, { status: 200 })
      }
      return NextResponse.json({
        ...billing.errorResponse,
        errorCode: visibleProviderErrorCode(billing.errorResponse.errorCode, billing.status, billing.errorResponse.message),
        submittedInput,
      }, { status: billing.status })
    }

    let raw: GenerateResponse & {
      model?: string
      upstreamStatus?: number
        upstreamMessage?: string
        rawCode?: string
        requestId?: string
        providerEndpoint?: string
        providerRequestMethod?: string
        providerHttpStatus?: number
        providerFetchError?: string
        providerFetchCause?: Record<string, unknown>
        submittedInput?: unknown
        providerResponse?: unknown
      }
    const useCnExecutor = resolvedExecutor === 'cn'

    if (useCnExecutor) {
      let generationJobId = billing.ctx.billingJobId
      if (!generationJobId) {
        let jobCreateError: unknown = null
        const imageGenerationJob = await createImageGenerationJob({
          userId: billing.ctx.userId,
          providerId,
          prompt,
          body,
          model: requestModel,
        }).catch((error: unknown) => {
          jobCreateError = error
          console.warn('[api/generate/image] failed to create async GenerationJob', error)
          return null
        })
        generationJobId = imageGenerationJob?.id ?? null

        if (!generationJobId) {
          const errMsg = jobCreateError instanceof Error ? jobCreateError.message : String(jobCreateError ?? '未知错误')
          return NextResponse.json({
            success: false,
            errorCode: 'generation_job_create_failed',
            message: `图片任务创建失败：${errMsg}`,
            mode: 'unavailable',
            status: 'failed',
            submittedInput,
          }, { status: 200 })
        }
      }

      await db.generationJob.update({
        where: { id: generationJobId },
        data: {
          status: 'PROCESSING',
          provider: providerId,
          kind: 'image',
          input: {
            prompt,
            providerId,
            projectId: body.projectId ?? null,
            workflowId: body.workflowId ?? null,
            nodeId: body.nodeId ?? null,
            params,
            model: requestModel ?? null,
            aspectRatio: aspectRatio ?? null,
            size: size ?? null,
            submittedInput,
          },
        },
      }).catch((error: unknown) => {
        console.warn('[api/generate/image] failed to mark async GenerationJob processing', error)
      })

      const executorResult = await startImageGenerationViaRegion({
        userId: currentUser.id,
        projectId: body.projectId ?? null,
        nodeId: body.nodeId ?? null,
        prompt,
        provider: providerId,
        model: requestModel ?? null,
        aspectRatio: aspectRatio ?? null,
        resolution: typeof body.resolution === 'string' ? body.resolution : null,
      })
      if (!executorResult.success) {
        // cn-executor returns { success, errorCode, message, ... } — note: message not errorMessage
        const execErr = executorResult as Record<string, unknown>
        const errCode = typeof execErr.errorCode === 'string' ? execErr.errorCode : 'cn_executor_failed'
        const errMsg = typeof execErr.message === 'string' ? execErr.message
          : typeof execErr.errorMessage === 'string' ? execErr.errorMessage
          : 'CN executor returned an error.'
        await markImageGenerationJobFailed(generationJobId, errMsg, errCode)
        return NextResponse.json({
          success: false,
          errorCode: visibleProviderErrorCode(errCode, typeof execErr.upstreamStatus === 'number' ? execErr.upstreamStatus : undefined, errMsg),
          message: errMsg,
          mode: 'unavailable',
          status: 'failed',
          submittedInput: (execErr.submittedInput as Record<string, unknown> | undefined) ?? submittedInput,
          upstreamMessage: execErr.upstreamMessage,
          upstreamStatus: execErr.upstreamStatus,
          requestId: execErr.requestId,
          providerEndpoint: execErr.providerEndpoint,
          providerHttpStatus: execErr.providerHttpStatus,
          providerResponse: execErr.providerResponse,
        }, { status: 200 })
      }

      const taskId = typeof executorResult.taskId === 'string' ? executorResult.taskId : ''
      if (!taskId) {
        const message = 'CN executor did not return taskId from /api/generate/image/start.'
        await markImageGenerationJobFailed(generationJobId, message, 'cn_executor_task_id_missing')
        return NextResponse.json({
          success: false,
          errorCode: 'cn_executor_task_id_missing',
          message,
          mode: 'unavailable',
          status: 'failed',
          submittedInput,
        }, { status: 200 })
      }

      await db.generationJob.update({
        where: { id: generationJobId },
        data: {
          status: 'PROCESSING',
          providerJobId: taskId,
          input: {
            prompt,
            providerId,
            projectId: body.projectId ?? null,
            workflowId: body.workflowId ?? null,
            nodeId: body.nodeId ?? null,
            params,
            model: requestModel ?? null,
            aspectRatio: aspectRatio ?? null,
            size: size ?? null,
            taskId,
            submittedInput,
          },
        },
      }).catch((error: unknown) => {
        console.warn('[api/generate/image] failed to save cn executor taskId', error)
      })

      return NextResponse.json({
        success: true,
        providerId,
        providerRegion,
        executionRegion,
        storageRegion,
        executor: resolvedExecutor,
        mode: 'real',
        status: 'running',
        async: true,
        generationJobId,
        jobId: generationJobId,
        taskId,
        message: 'Image generation submitted to cn executor',
        model: submittedModel,
        submittedInput,
      }, { status: 200 })
    } else if (providerId === 'volcengine-seedream-image' || providerId === 'jimeng-image') {
      const chinaResult = providerId === 'volcengine-seedream-image'
        ? await generateSeedreamImage({ prompt, aspectRatio, size, referenceImages })
        : await generateJimengImage({ prompt, aspectRatio, size, referenceImages })

      raw = chinaResult.success
        ? {
            success: true,
            providerId,
            mode: 'real',
            status: 'succeeded',
            result: {
              imageUrl: chinaResult.imageUrl ?? chinaResult.dataUrl,
              previewUrl: chinaResult.imageUrl ?? chinaResult.dataUrl,
              metadata: {
                ...(chinaResult.metadata ?? {}),
                providerId,
                model: chinaResult.model,
                generationSource: providerId,
              },
            },
            message: `图片生成成功（${chinaResult.model}）`,
            model: chinaResult.model,
            submittedInput: chinaResult.submittedInput ?? submittedInput,
            providerResponse: chinaResult.providerResponse,
            requestId: chinaResult.requestId,
            providerEndpoint: chinaResult.providerEndpoint,
            providerRequestMethod: chinaResult.providerRequestMethod,
            providerHttpStatus: chinaResult.providerHttpStatus,
            upstreamMessage: chinaResult.upstreamMessage,
          }
        : {
            success: false,
            providerId,
            mode: 'unavailable',
            status: chinaResult.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'not-configured' : 'failed',
            message: chinaResult.message,
            errorCode: visibleProviderErrorCode(chinaResult.errorCode, chinaResult.upstreamStatus, chinaResult.message),
            model: chinaResult.model,
            upstreamStatus: chinaResult.upstreamStatus,
              upstreamMessage: chinaResult.upstreamMessage,
              rawCode: chinaResult.rawCode,
              requestId: chinaResult.requestId,
              providerEndpoint: chinaResult.providerEndpoint,
              providerRequestMethod: chinaResult.providerRequestMethod,
              providerHttpStatus: chinaResult.providerHttpStatus,
              providerFetchError: chinaResult.providerFetchError,
              providerFetchCause: chinaResult.providerFetchCause,
              submittedInput: {
                ...(chinaResult.submittedInput ?? submittedInput),
                model: chinaResult.model ?? submittedInput.model,
            },
            providerResponse: chinaResult.providerResponse,
          }
    } else {
      raw = await gatewayGenerate({
        providerId,
        nodeType: 'image',
        prompt,
        inputAssets: body.inputAssets,
        params: body.params,
        projectId: body.projectId,
        nodeId: body.nodeId,
      }, currentUser?.id)
    }

    const finalized = await finalizeBilling(raw, billing.ctx.billingJobId)
    if (!finalized.success || !finalized.result) {
      return NextResponse.json({
        ...finalized,
        errorCode: visibleProviderErrorCode(finalized.errorCode, raw.upstreamStatus, finalized.message),
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
          submittedInput: raw.submittedInput ?? submittedInput,
          providerResponse: raw.providerResponse,
        }, { status: 200 })
    }

    const providerImageUrl = imageUrlFromResponse(finalized)
    if (!providerImageUrl) {
      return NextResponse.json({
        ...finalized,
        success: false,
        errorCode: 'provider_no_download_url',
          message: finalized.message || '图片生成成功，但 Provider 未返回图片 URL。',
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
          submittedInput: raw.submittedInput ?? submittedInput,
          providerResponse: raw.providerResponse,
        }, { status: 200 })
    }

    const resultMetadata = finalized.result.metadata && typeof finalized.result.metadata === 'object'
      ? finalized.result.metadata as Record<string, unknown>
      : {}
    const assetIntelligence = analyzeAssetIntelligence({
      mediaType: 'image',
      prompt: body.prompt,
      compiledPrompt: body.compiledPrompt || prompt,
      providerId,
      metadata: resultMetadata,
    })
    const mediaPersistenceEnabled = process.env.MEDIA_PERSISTENCE_ENABLED !== 'false'
    let finalImageUrl = providerImageUrl
    let assetId: string | undefined
    let mediaPersistence: unknown = mediaPersistenceEnabled ? { status: 'pending' } : { status: 'disabled' }
    let warning: string | undefined
    let generationJobId = finalized.billingJobId ?? finalized.jobId

    if (!generationJobId) {
      const imageGenerationJob = await createImageGenerationJob({
        userId: billing.ctx.userId,
        providerId,
        prompt,
        body,
        model: raw.model,
      }).catch((error: unknown) => {
        console.warn('[api/generate/image] failed to create GenerationJob', error)
        return null
      })
      generationJobId = imageGenerationJob?.id
    }

    if (mediaPersistenceEnabled) {
      try {
        const persistence = await persistGeneratedMedia({
          url: providerImageUrl,
          type: 'image',
          projectId: body.projectId,
          workflowId: body.workflowId,
          nodeId: body.nodeId,
          filenameHint: 'generated-image.png',
          sourceProvider: providerId,
          userId: currentUser?.id ?? billing.ctx.userId,
          metadata: {
            model: resultMetadata.model ?? raw.model,
            prompt,
            generationJobId,
            assetIntelligence,
            requestId: raw.requestId,
            providerEndpoint: raw.providerEndpoint,
            providerRequestMethod: raw.providerRequestMethod,
            providerHttpStatus: raw.providerHttpStatus,
            providerFetchError: raw.providerFetchError,
            providerFetchCause: raw.providerFetchCause,
            submittedInput: raw.submittedInput ?? submittedInput,
          },
        })
        if (persistence.ok) {
          finalImageUrl = persistence.stableUrl
          assetId = persistence.assetId
          mediaPersistence = {
            status: 'persisted',
            ...persistence,
          }
        } else {
          mediaPersistence = normalizePersistFailure(persistence)
          finalImageUrl = persistence.providerOriginalUrl || persistence.temporaryUrl || providerImageUrl
          assetId = persistence.assetId
          warning = '媒体已生成，资产库上传待重试。'
        }
      } catch (error) {
        mediaPersistence = failedMediaPersistence(
          'asset_persistence_error',
          error instanceof Error ? error.message : '图片媒体转存失败。',
        )
        finalImageUrl = providerImageUrl
        warning = '媒体已生成，资产库上传待重试。'
      }
    }

    const persistedMedia = mediaPersistence && typeof mediaPersistence === 'object' && !Array.isArray(mediaPersistence)
      ? mediaPersistence as { status?: string | null; resolvedUrl?: string | null; proxyUrl?: string | null; signedUrlAvailable?: boolean; proxyAvailable?: boolean; errorCode?: string | null; errorMessage?: string | null; message?: string | null; persistenceStatus?: string | null; generationStatus?: string | null; assetStatus?: string | null; retryPersistenceAvailable?: boolean | null; attemptedUploadKey?: string | null; ossRequestId?: string | null; sourceUrl?: string | null; mediaDownloadUrl?: string | null }
      : {}
    const persistedStorage = mediaPersistence && typeof mediaPersistence === 'object' && !Array.isArray(mediaPersistence)
      ? mediaPersistence as { storageProvider?: string | null; bucket?: string | null; storageKey?: string | null }
      : {}
    const persistencePending = persistedMedia.status === 'pending_persistence' || persistedMedia.persistenceStatus === 'pending_persistence'
    const persistenceError = typeof persistedMedia.errorCode === 'string' ? persistedMedia.errorCode : undefined
    const persistenceFailed = !persistencePending && Boolean(persistenceError || persistedMedia.status === 'failed' || persistedMedia.persistenceStatus === 'persistence_failed')
    const responsePersistenceStatus = persistencePending ? 'pending_persistence' : persistenceFailed ? 'persistence_failed' : mediaPersistenceEnabled ? 'persistence_success' : 'disabled'
    const responseAssetStatus = persistencePending ? 'pending_persistence' : persistenceFailed ? 'failed' : assetId ? 'ready' : undefined
    const resolvedResultUrl = persistencePending ? finalImageUrl : (persistedMedia.resolvedUrl ?? finalImageUrl)
    const finalMetadata = {
      ...resultMetadata,
      generationStatus: 'generation_success',
      persistenceStatus: responsePersistenceStatus,
      assetStatus: responseAssetStatus,
      providerOriginalUrl: providerImageUrl,
      temporaryUrl: providerImageUrl,
      ...(assetId ? { assetId, outputAssetId: assetId } : {}),
      ...(assetId && !persistencePending ? { assetUrl: finalImageUrl } : {}),
      ...(persistencePending ? {} : { resolvedUrl: resolvedResultUrl }),
      stableUrl: resolvedResultUrl,
      resultImageUrl: finalImageUrl,
      ...(persistedMedia.proxyUrl ? { proxyUrl: persistedMedia.proxyUrl } : {}),
      signedUrlAvailable: persistedMedia.signedUrlAvailable,
      proxyAvailable: persistedMedia.proxyAvailable,
      storageProvider: persistedStorage.storageProvider,
      bucket: persistedStorage.bucket,
      storageKey: persistedStorage.storageKey,
      generationJobId,
      originalProviderImageUrl: providerImageUrl,
      submittedInput: raw.submittedInput ?? submittedInput,
      providerResponse: raw.providerResponse,
      mediaPersistence,
      lastGenerationError: null,
      ...(persistenceError ? {
        persistenceError,
        attemptedUploadKey: persistedMedia.attemptedUploadKey,
        ossRequestId: persistedMedia.ossRequestId,
        sourceUrl: persistedMedia.sourceUrl,
        mediaDownloadUrl: persistedMedia.mediaDownloadUrl,
        retryPersistenceAvailable: persistedMedia.retryPersistenceAvailable ?? Boolean(assetId),
        nextAction: 'retry_persistence',
      } : {}),
      assetIntelligence,
      ...(warning ? { mediaPersistenceWarning: warning } : {}),
    }

    return NextResponse.json({
      ...finalized,
      success: true,
      status: persistencePending ? 'succeeded_with_persistence_pending' : persistenceFailed ? 'succeeded_with_persistence_failed' : 'succeeded',
      message: warning ?? finalized.message,
      displayUrl: finalImageUrl,
      resultImageUrl: finalImageUrl,
      imageUrl: finalImageUrl,
      assetUrl: assetId && !persistencePending ? finalImageUrl : undefined,
      resolvedUrl: persistencePending ? undefined : resolvedResultUrl,
      stableUrl: resolvedResultUrl,
      proxyUrl: persistedMedia.proxyUrl ?? undefined,
      signedUrlAvailable: persistedMedia.signedUrlAvailable,
      proxyAvailable: persistedMedia.proxyAvailable,
      dataUrl: finalImageUrl.startsWith('data:image/') ? finalImageUrl : undefined,
      assetId,
      outputAssetId: assetId,
      generationJobId,
      originalProviderImageUrl: providerImageUrl,
      providerOriginalUrl: providerImageUrl,
      temporaryUrl: providerImageUrl,
      generationStatus: 'generation_success',
      persistenceStatus: responsePersistenceStatus,
      assetStatus: responseAssetStatus,
      persistenceError,
      retryPersistenceAvailable: persistencePending ? (persistedMedia.retryPersistenceAvailable ?? Boolean(assetId)) : false,
      generationStage: persistencePending ? 'oss_upload' : undefined,
      nextAction: persistencePending ? 'retry_persistence' : 'show_media',
      storageProvider: persistedStorage.storageProvider ?? undefined,
      bucket: persistedStorage.bucket ?? undefined,
      storageKey: persistedStorage.storageKey ?? undefined,
      mediaPersistence,
      assetIntelligence,
      warning,
      asset: assetId ? {
        id: assetId,
        type: 'IMAGE',
        url: finalImageUrl,
        dataUrl: null,
        thumbnailUrl: finalImageUrl,
        providerId: 'generated-media-persistence',
        generationJobId,
        projectId: body.projectId,
        workflowId: body.workflowId,
        nodeId: body.nodeId,
        status: persistencePending ? 'pending_persistence' : 'ready',
      } : undefined,
      result: {
        ...finalized.result,
        imageUrl: finalImageUrl,
        previewUrl: finalImageUrl,
        metadata: finalMetadata,
      },
      model: typeof resultMetadata.model === 'string' ? resultMetadata.model : raw.model,
        upstreamStatus: raw.upstreamStatus,
        upstreamMessage: raw.upstreamMessage,
        rawCode: raw.rawCode,
        requestId: raw.requestId,
        providerEndpoint: raw.providerEndpoint,
        providerRequestMethod: raw.providerRequestMethod,
        providerHttpStatus: raw.providerHttpStatus,
        providerFetchError: raw.providerFetchError,
        providerFetchCause: raw.providerFetchCause,
      }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/image]', err)
    return NextResponse.json({ success: false, message, errorCode: 'generation_failed' }, { status: 200 })
  }
}
