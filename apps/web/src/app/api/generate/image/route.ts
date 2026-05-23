import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'

import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import type { GenerateResponse } from '@/lib/providers/types'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { db } from '@/lib/db'
import { missingGenerationInput, prepareGenerationContext, stringInput } from '@/lib/generation/generation-context'
import { getExecutorForProvider } from '@/lib/executors/executor-gateway'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

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
  let body: ImageGenerateBody | undefined
  try {
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

    const prompt = body.prompt?.trim() || ''
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

    const aspectRatio = body!.aspectRatio ?? '16:9'
    const size = body.size
    const referenceImages: string[] = []
    const requestModel = providerRow?.model ?? null
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
    const { providerRegion, executionRegion, storageRegion, executor: resolvedExecutor, executorKind, unknownProvider } = executorResolution
    const submittedInput = {
      providerId,
      providerRegion,
      executionRegion,
      storageRegion,
      executor: resolvedExecutor,
      executorKind,
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

    // CN providers must route through cn-executor — block Vercel-direct to protect mainland network
    if (providerRegion === 'cn' && !useCnExecutor) {
      return NextResponse.json({
        success: false,
        errorCode: 'executor_region_missing',
        message: `国内 provider [${providerId}] 需要 cn-executor（executorKind=aliyun_fc），但 CREATOR_CN_API_BASE_URL 未配置，无法执行。请检查环境变量并重新部署。`,
        providerId,
        providerRegion,
        executionRegion,
        storageRegion,
        executorKind,
        mode: 'unavailable',
        status: 'failed',
        submittedInput,
      }, { status: 200 })
    }

    if (useCnExecutor) {
      // --- DB Job Queue path ---
      // 1. Create/get GenerationJob (QUEUED)
      // 2. Fire-and-forget POST to cn-executor /api/jobs/run-image
      // 3. Return immediately — frontend polls /api/generate/image/status

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
          console.warn('[api/generate/image] failed to create GenerationJob', error)
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

      // Write full regional input into job and set QUEUED
      await db.generationJob.update({
        where: { id: generationJobId },
        data: {
          status: 'QUEUED',
          provider: providerId,
          kind: 'image',
          input: {
            prompt,
            providerId,
            projectId: body.projectId ?? null,
            workflowId: body.workflowId ?? null,
            nodeId: body.nodeId ?? null,
            params: {
              ratio: aspectRatio,
              aspectRatio,
              ...(size ? { size } : {}),
            },
            model: requestModel ?? null,
            aspectRatio: aspectRatio ?? null,
            size: size ?? null,
            providerRegion,
            executionRegion,
            storageRegion,
            executorKind,
            submittedInput,
          },
        },
      }).catch((error: unknown) => {
        console.warn('[api/generate/image] failed to update GenerationJob to QUEUED', error)
      })

      // Await cn-executor synchronously — Vercel maxDuration=90 allows up to 90s.
      // cn-executor executes the job within the HTTP request lifecycle (no setImmediate).
      const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
      console.log('[api/generate/image] cn-executor dispatch', {
        generationJobId,
        cnBaseUrlConfigured: Boolean(cnBaseUrl),
        cnBaseUrlLength: cnBaseUrl.length,
        secretConfigured: Boolean(process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim()),
      })
      let cnResult: Record<string, unknown> | null = null
      if (!cnBaseUrl) {
        console.error('[api/generate/image] CREATOR_CN_API_BASE_URL is not set — cn-executor cannot be reached. Job will stay QUEUED.', { generationJobId })
      } else {
        try {
          const cnSecret = process.env.CREATOR_EXECUTOR_SHARED_SECRET ?? ''
          const cnResp = await fetch(`${cnBaseUrl}/api/jobs/run-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Send both headers: Bearer for new cn-executor, x-creator-executor-secret for old code
              Authorization: `Bearer ${cnSecret}`,
              'x-creator-executor-secret': cnSecret,
            },
            body: JSON.stringify({ generationJobId }),
            signal: AbortSignal.timeout(90_000),
          })
          console.log('[api/generate/image] cn-executor HTTP response', { generationJobId, httpStatus: cnResp.status })
          const rawText = await cnResp.text()
          // 401 = auth failure — cn-executor rejected the secret. Do NOT stay QUEUED.
          if (cnResp.status === 401) {
            console.error('[api/generate/image] cn-executor rejected auth (401). Check CREATOR_EXECUTOR_SHARED_SECRET matches on both Vercel and Aliyun FC.', { generationJobId, preview: rawText.slice(0, 200) })
            cnResult = { status: 'failed', errorCode: 'cn_executor_auth_rejected', message: 'cn-executor 返回 401：共享密钥不匹配。请检查 Vercel 和阿里云 FC 的 CREATOR_EXECUTOR_SHARED_SECRET 是否一致。' }
          } else {
            try {
              const parsed = JSON.parse(rawText)
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                cnResult = parsed as Record<string, unknown>
                console.log('[api/generate/image] cn-executor result', { generationJobId, status: cnResult.status, ok: cnResult.ok, errorCode: cnResult.errorCode })
              }
            } catch {
              console.warn('[api/generate/image] cn-executor returned non-JSON', { generationJobId, httpStatus: cnResp.status, preview: rawText.slice(0, 200) })
            }
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          console.warn('[api/generate/image] cn-executor request failed (timeout or network):', errMsg, { generationJobId })
          cnResult = {
            status: 'failed',
            errorCode: errMsg.includes('timeout') || errMsg.includes('AbortError') ? 'cn_executor_timeout' : 'cn_executor_network_error',
            message: `cn-executor 无法连接：${errMsg}`,
          }
        }
      }

      // If URL is not configured, fail immediately with a clear error instead of QUEUED forever
      if (!cnBaseUrl) {
        return NextResponse.json({
          success: false,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          mode: 'unavailable',
          status: 'failed',
          errorCode: 'cn_executor_url_not_configured',
          generationJobId,
          jobId: generationJobId,
          message: 'CREATOR_CN_API_BASE_URL 未配置，cn-executor 无法访问。请在 Vercel 环境变量中设置阿里云 FC 函数的 URL。',
          submittedInput,
        }, { status: 200 })
      }

      if (cnResult?.status === 'succeeded') {
        return NextResponse.json({
          success: true,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          mode: 'real',
          status: 'succeeded',
          async: false,
          generationJobId,
          jobId: generationJobId,
          model: (typeof cnResult.model === 'string' ? cnResult.model : null) ?? submittedModel,
          resultImageUrl: cnResult.resultImageUrl,
          stableUrl: cnResult.stableUrl,
          assetId: cnResult.assetId,
          submittedInput,
          stageTrace: cnResult.stageTrace,
          message: '图片生成完成',
        }, { status: 200 })
      }

      if (cnResult?.status === 'failed') {
        return NextResponse.json({
          success: false,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          mode: 'real',
          status: 'failed',
          async: false,
          generationJobId,
          jobId: generationJobId,
          errorCode: (typeof cnResult.errorCode === 'string' ? cnResult.errorCode : null) ?? 'image_generation_failed',
          errorStage: cnResult.errorStage,
          message: (typeof cnResult.message === 'string' ? cnResult.message : null) ?? 'Image generation failed.',
          upstreamMessage: cnResult.upstreamMessage,
          upstreamStatus: cnResult.upstreamStatus,
          providerHttpStatus: cnResult.providerHttpStatus,
          requestId: cnResult.requestId,
          providerResponse: cnResult.providerResponse,
          submittedInput: cnResult.submittedInput ?? submittedInput,
          stageTrace: cnResult.stageTrace,
        }, { status: 200 })
      }

      // cn-executor returned HTTP 200 but no status field — old cn-executor format (uses setImmediate, never completes on Aliyun FC)
      // Treat as immediate failure so the user sees a clear error, not QUEUED forever.
      if (cnResult && typeof cnResult === 'object' && cnResult.ok === true && !cnResult.status) {
        console.error('[api/generate/image] cn-executor returned old fire-and-forget format (no status field). Upload new cn-executor ZIP to Aliyun FC.', { generationJobId, cnResult })
        return NextResponse.json({
          success: false,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executor: resolvedExecutor,
          executorKind,
          mode: 'real',
          status: 'failed',
          errorCode: 'cn_executor_outdated',
          generationJobId,
          jobId: generationJobId,
          message: 'cn-executor 运行旧版本代码（使用了 setImmediate，任务无法在阿里云 FC 上完成）。请将新版 ZIP 上传至阿里云 FC 函数并重新部署。文件位置：~/Downloads/cn-executor.zip',
          submittedInput,
        }, { status: 200 })
      }

      // cn-executor timed out or returned unexpected status — frontend polls DB
      return NextResponse.json({
        success: true,
        providerId,
        providerRegion,
        executionRegion,
        storageRegion,
        executor: resolvedExecutor,
        executorKind,
        mode: 'real',
        status: 'queued',
        async: true,
        generationJobId,
        jobId: generationJobId,
        model: submittedModel,
        submittedInput,
        message: '图片生成任务已提交，正在处理中',
      }, { status: 200 })
    } else {
      // Defense-in-depth: cn providers must never reach this branch.
      // Guard 1 above (providerRegion === 'cn' && !useCnExecutor) blocks cn without executor.
      // If somehow a cn provider arrives here it is a routing bug — reject immediately.
      if (providerRegion === 'cn') {
        console.error('[api/generate/image] provider_region_mismatch: cn provider reached Vercel-local handler', { providerId, providerRegion, executorKind })
        return NextResponse.json({
          success: false,
          errorCode: 'provider_region_mismatch',
          message: `中国 provider [${providerId}] 不能在 Vercel 上直接执行，必须通过 cn-executor（aliyun_fc）运行。`,
          providerId,
          providerRegion,
          executionRegion,
          storageRegion,
          executorKind,
          mode: 'unavailable',
          status: 'failed',
          submittedInput,
        }, { status: 200 })
      }
      raw = await gatewayGenerate({
        providerId,
        nodeType: 'image',
        prompt,
        inputAssets: body.inputAssets,
        params: {
          ratio: aspectRatio,
          aspectRatio,
          ...(size ? { size } : {}),
        },
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
      submittedInput: raw.submittedInput ?? submittedInput,
      providerResponse: raw.providerResponse,
      }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/image]', err)
    return NextResponse.json({
      success: false,
      message,
      errorMessage: message,
      errorCode: 'generation_failed',
      errorStage: 'api_route_exception',
      stageTrace: ['api_route_exception'],
      submittedInput: body ? {
        providerId: body.providerId ?? null,
        projectId: body.projectId ?? null,
        workflowId: body.workflowId ?? null,
        nodeId: body.nodeId ?? null,
        promptChars: body.prompt?.trim().length ?? 0,
        aspectRatio: body.aspectRatio ?? null,
        size: body.size ?? null,
      } : null,
    }, { status: 200 })
  }
}
