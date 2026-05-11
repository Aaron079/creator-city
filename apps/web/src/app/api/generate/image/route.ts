import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'
import { persistGeneratedMedia, type PersistGeneratedMediaResult } from '@/lib/assets/persist-generated-media'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'
import { generateJimengImage } from '@/lib/providers/china/jimeng'
import { generateSeedreamImage } from '@/lib/providers/china/volcengine'
import type { GenerateResponse } from '@/lib/providers/types'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type ImageGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
  model?: string
  aspectRatio?: string
  size?: string
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

function failedMediaPersistence(errorCode: string, message: string, upstreamStatus?: number) {
  return {
    status: 'failed',
    errorCode,
    message,
    upstreamStatus,
  }
}

function normalizePersistFailure(result: Extract<PersistGeneratedMediaResult, { ok: false }>) {
  return failedMediaPersistence(result.errorCode, result.message, result.upstreamStatus)
}

function visiblePersistenceErrorCode(errorCode: string) {
  if (errorCode === 'MEDIA_FETCH_FAILED' || errorCode === 'ASSET_DOWNLOAD_FAILED' || errorCode === 'ASSET_DOWNLOAD_ERROR' || errorCode === 'PROVIDER_MEDIA_DOWNLOAD_FAILED') return 'provider_media_download_failed'
  if (errorCode === 'MEDIA_UPLOAD_FAILED') return 'oss_upload_error'
  if (errorCode === 'MEDIA_ASSET_CREATE_FAILED' || errorCode === 'MEDIA_PERSISTENCE_FAILED' || errorCode === 'MEDIA_PERSIST_FAILED' || errorCode === 'MEDIA_PERSIST_TIMEOUT') return 'asset_persistence_error'
  return errorCode
}

function visibleProviderErrorCode(errorCode: string | undefined, upstreamStatus?: number, message = '') {
  const code = errorCode ?? ''
  const haystack = `${code} ${message}`.toLowerCase()
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'VOLCENGINE_MODEL_REQUIRED' || code === 'provider_env_missing' || code.includes('MODEL_REQUIRED')) return 'provider_env_missing'
  if (code === 'PROMPT_REQUIRED' || code === 'MISSING_GENERATION_INPUT' || code === 'missing_generation_input') return 'missing_generation_input'
  if (code === 'PROVIDER_AUTH_ERROR' || upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_error'
  if (code === 'PROVIDER_QUOTA_OR_BILLING_ERROR' || code === 'INSUFFICIENT_CREDITS' || code === 'BILLING_ERROR' || upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (code === 'PROVIDER_INVALID_PARAMETER' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'IMAGE_URL_EMPTY' || code.includes('URL_EMPTY') || code.includes('URL_MISSING')) return 'provider_no_download_url'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(haystack)) return 'provider_media_download_failed'
  return code || 'generation_failed'
}

function imageUrlFromResponse(response: GenerateResponse & { imageUrl?: string; resultImageUrl?: string; dataUrl?: string }) {
  return response.result?.imageUrl
    ?? response.resultImageUrl
    ?? response.imageUrl
    ?? response.dataUrl
    ?? ''
}

async function createImageGenerationJob(args: {
  userId: string
  providerId: string
  prompt: string
  body: ImageGenerateBody
  model?: string | null
}) {
  return db.generationJob.create({
    data: {
      userId: args.userId,
      projectId: args.body.projectId ?? null,
      providerId: args.providerId,
      provider: args.providerId,
      nodeType: 'image',
      kind: 'image',
      status: 'PROCESSING',
      prompt: args.prompt.slice(0, 2000),
      input: {
        prompt: args.prompt,
        params: args.body.params ?? {},
        model: args.model ?? null,
        workflowId: args.body.workflowId,
        nodeId: args.body.nodeId,
      },
    },
  })
}

async function markImageGenerationJobFailed(jobId: string | undefined, message: string) {
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
    console.warn('[api/generate/image] failed to mark GenerationJob failed', error)
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
    const prompt = body.compiledPrompt?.trim() || body.prompt?.trim() || ''
    if (!prompt) {
      return NextResponse.json({
        success: false,
        errorCode: 'missing_generation_input',
        message: '请输入图片提示词',
        providerId,
        mode: 'unavailable',
        status: 'failed',
        missingFields: ['prompt'],
      }, { status: 200 })
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
    const submittedInput = {
      providerId,
      model: requestModel,
      promptChars: prompt.length,
      aspectRatio: aspectRatio ?? null,
      size: size ?? null,
      referenceImageCount: referenceImages?.length ?? 0,
      hasReferenceImages: Boolean(referenceImages?.length),
      nodeId: body.nodeId ?? null,
      projectId: body.projectId ?? null,
      workflowId: body.workflowId ?? null,
    }

    const billing = await setupBilling(request, providerId, 'image', prompt)
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

    const currentUser = await getCurrentUser()
    let raw: GenerateResponse & {
      model?: string
      upstreamStatus?: number
      upstreamMessage?: string
      rawCode?: string
      requestId?: string
      submittedInput?: unknown
      providerResponse?: unknown
    }
    if (providerId === 'volcengine-seedream-image' || providerId === 'jimeng-image') {
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
          const errorCode = visiblePersistenceErrorCode(persistence.errorCode)
          await markImageGenerationJobFailed(generationJobId, persistence.message)
          return NextResponse.json({
            success: false,
            errorCode,
            message: `图片生成成功，但媒体转存失败：${persistence.message}`,
            providerId,
            model: raw.model,
            mode: 'real',
            status: 'failed',
            upstreamStatus: persistence.upstreamStatus ?? raw.upstreamStatus,
            upstreamMessage: raw.upstreamMessage,
            requestId: raw.requestId,
            submittedInput: raw.submittedInput ?? submittedInput,
            providerResponse: raw.providerResponse,
            originalProviderImageUrl: providerImageUrl,
            mediaPersistence,
          }, { status: 200 })
        }
      } catch (error) {
        mediaPersistence = failedMediaPersistence(
          'asset_persistence_error',
          error instanceof Error ? error.message : '图片媒体转存失败。',
        )
        await markImageGenerationJobFailed(generationJobId, error instanceof Error ? error.message : '图片媒体转存失败。')
        return NextResponse.json({
          success: false,
          errorCode: 'asset_persistence_error',
          message: `图片生成成功，但媒体转存失败：${error instanceof Error ? error.message : '图片媒体转存失败。'}`,
          providerId,
          model: raw.model,
          mode: 'real',
          status: 'failed',
          upstreamStatus: raw.upstreamStatus,
          upstreamMessage: raw.upstreamMessage,
          requestId: raw.requestId,
          submittedInput: raw.submittedInput ?? submittedInput,
          providerResponse: raw.providerResponse,
          originalProviderImageUrl: providerImageUrl,
          mediaPersistence,
        }, { status: 200 })
      }
    }

    const persistedMedia = mediaPersistence && typeof mediaPersistence === 'object' && !Array.isArray(mediaPersistence)
      ? mediaPersistence as { resolvedUrl?: string | null; proxyUrl?: string | null; signedUrlAvailable?: boolean; proxyAvailable?: boolean }
      : {}
    const persistedStorage = mediaPersistence && typeof mediaPersistence === 'object' && !Array.isArray(mediaPersistence)
      ? mediaPersistence as { storageProvider?: string | null; bucket?: string | null; storageKey?: string | null }
      : {}
    const finalMetadata = {
      ...resultMetadata,
      ...(assetId ? { assetId, assetUrl: finalImageUrl } : {}),
      ...(persistedMedia.resolvedUrl ? { resolvedUrl: persistedMedia.resolvedUrl, stableUrl: persistedMedia.resolvedUrl } : {}),
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
      assetIntelligence,
      ...(warning ? { mediaPersistenceWarning: warning } : {}),
    }

    return NextResponse.json({
      ...finalized,
      resultImageUrl: finalImageUrl,
      imageUrl: finalImageUrl,
      assetUrl: assetId ? finalImageUrl : undefined,
      resolvedUrl: persistedMedia.resolvedUrl ?? undefined,
      proxyUrl: persistedMedia.proxyUrl ?? undefined,
      signedUrlAvailable: persistedMedia.signedUrlAvailable,
      proxyAvailable: persistedMedia.proxyAvailable,
      dataUrl: finalImageUrl.startsWith('data:image/') ? finalImageUrl : undefined,
      assetId,
      originalProviderImageUrl: providerImageUrl,
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
    }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/image]', err)
    return NextResponse.json({ success: false, message, errorCode: 'generation_failed' }, { status: 200 })
  }
}
