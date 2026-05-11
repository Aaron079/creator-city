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

export const dynamic = 'force-dynamic'

type ImageGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
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
    errorCode: 'PROVIDER_NOT_CONFIGURED',
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

function imageUrlFromResponse(response: GenerateResponse & { imageUrl?: string; resultImageUrl?: string; dataUrl?: string }) {
  return response.result?.imageUrl
    ?? response.resultImageUrl
    ?? response.imageUrl
    ?? response.dataUrl
    ?? ''
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
          errorCode: 'OPENAI_IMAGE_UNAVAILABLE',
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
        errorCode: 'PROMPT_REQUIRED',
        message: '请输入图片提示词',
        providerId,
        mode: 'unavailable',
        status: 'failed',
      }, { status: 200 })
    }
    if (providerId === 'volcengine-seedream-image' && !process.env.VOLCENGINE_SEEDREAM_MODEL?.trim()) {
      return NextResponse.json({
        success: false,
        errorCode: 'VOLCENGINE_MODEL_REQUIRED',
        message: '请在火山方舟控制台复制真实 Model ID 或 Endpoint ID 到 VOLCENGINE_SEEDREAM_MODEL。',
        providerId,
        model: '',
        mode: 'unavailable',
        status: 'not-configured',
      }, { status: 200 })
    }

    const billing = await setupBilling(request, providerId, 'image', prompt)
    if (!billing.ok) {
      if (providerId === 'openai-image' && billing.errorResponse.errorCode === 'BILLING_ERROR') {
        return NextResponse.json({
          success: false,
          errorCode: 'OPENAI_IMAGE_UNAVAILABLE',
          message: 'OpenAI Image 暂不可用。当前环境建议使用 Volcengine Seedream 或 Jimeng 图片模型。',
          providerId,
          mode: 'unavailable',
          status: 'failed',
        }, { status: 200 })
      }
      return NextResponse.json(billing.errorResponse, { status: billing.status })
    }

    const currentUser = await getCurrentUser()
    let raw: GenerateResponse & {
      model?: string
      upstreamStatus?: number
      upstreamMessage?: string
      rawCode?: string
      requestId?: string
    }
    if (providerId === 'volcengine-seedream-image' || providerId === 'jimeng-image') {
      const params = body.params ?? {}
      const aspectRatio = body.aspectRatio
        ?? (typeof params.ratio === 'string' ? params.ratio : undefined)
        ?? (typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined)
      const size = body.size ?? (typeof params.size === 'string' ? params.size : undefined)
      const referenceImages = body.inputAssets
        ?.filter((asset) => asset.type === 'image' && asset.url)
        .map((asset) => asset.url as string)
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
          }
        : {
            success: false,
            providerId,
            mode: 'unavailable',
            status: chinaResult.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'not-configured' : 'failed',
            message: chinaResult.message,
            errorCode: chinaResult.errorCode,
            model: chinaResult.model,
            upstreamStatus: chinaResult.upstreamStatus,
            upstreamMessage: chinaResult.upstreamMessage,
            rawCode: chinaResult.rawCode,
            requestId: chinaResult.requestId,
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
        model: raw.model,
        upstreamStatus: raw.upstreamStatus,
        upstreamMessage: raw.upstreamMessage,
        rawCode: raw.rawCode,
        requestId: raw.requestId,
      }, { status: 200 })
    }

    const providerImageUrl = imageUrlFromResponse(finalized)
    if (!providerImageUrl) {
      return NextResponse.json({
        ...finalized,
        success: false,
        errorCode: 'IMAGE_URL_EMPTY',
        message: finalized.message || '图片生成成功，但 Provider 未返回图片 URL。',
        model: raw.model,
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
    let mediaPersistence: unknown = providerImageUrl.startsWith('data:')
      ? { status: 'skipped' }
      : mediaPersistenceEnabled
        ? { status: 'pending' }
        : { status: 'disabled' }
    let warning: string | undefined

    if (mediaPersistenceEnabled && !providerImageUrl.startsWith('data:')) {
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
            generationJobId: finalized.billingJobId ?? finalized.jobId,
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
          return NextResponse.json({
            success: false,
            errorCode: persistence.errorCode,
            message: `图片生成成功，但媒体转存失败：${persistence.message}`,
            providerId,
            model: raw.model,
            mode: 'real',
            status: 'failed',
            upstreamStatus: persistence.upstreamStatus ?? raw.upstreamStatus,
            upstreamMessage: raw.upstreamMessage,
            requestId: raw.requestId,
            originalProviderImageUrl: providerImageUrl,
            mediaPersistence,
          }, { status: 200 })
        }
      } catch (error) {
        mediaPersistence = failedMediaPersistence(
          'MEDIA_PERSISTENCE_FAILED',
          error instanceof Error ? error.message : '图片媒体转存失败。',
        )
        return NextResponse.json({
          success: false,
          errorCode: 'MEDIA_PERSISTENCE_FAILED',
          message: `图片生成成功，但媒体转存失败：${error instanceof Error ? error.message : '图片媒体转存失败。'}`,
          providerId,
          model: raw.model,
          mode: 'real',
          status: 'failed',
          upstreamStatus: raw.upstreamStatus,
          upstreamMessage: raw.upstreamMessage,
          requestId: raw.requestId,
          originalProviderImageUrl: providerImageUrl,
          mediaPersistence,
        }, { status: 200 })
      }
    }

    const finalMetadata = {
      ...resultMetadata,
      ...(assetId ? { assetId, assetUrl: finalImageUrl } : {}),
      originalProviderImageUrl: providerImageUrl,
      mediaPersistence,
      assetIntelligence,
      ...(warning ? { mediaPersistenceWarning: warning } : {}),
    }

    return NextResponse.json({
      ...finalized,
      resultImageUrl: finalImageUrl,
      imageUrl: finalImageUrl,
      assetUrl: assetId ? finalImageUrl : undefined,
      dataUrl: finalImageUrl.startsWith('data:image/') ? finalImageUrl : undefined,
      assetId,
      originalProviderImageUrl: providerImageUrl,
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
        generationJobId: finalized.billingJobId ?? finalized.jobId,
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
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 200 })
  }
}
