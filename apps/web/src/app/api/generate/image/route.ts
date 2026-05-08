import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { gatewayGenerate } from '@/lib/gateway/generate'
import { getCurrentUser } from '@/lib/auth/current-user'
import { attachGeneratedAsset } from '@/lib/assets/generated-assets'
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

    const result = await attachGeneratedAsset(await finalizeBilling(raw, billing.ctx.billingJobId), {
      userId: currentUser?.id ?? billing.ctx.userId,
      providerId,
      nodeType: 'image',
      prompt,
      projectId: body.projectId,
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    })
    const resultMetadata = result.result?.metadata && typeof result.result.metadata === 'object'
      ? result.result.metadata as Record<string, unknown>
      : {}
    return NextResponse.json({
      ...result,
      imageUrl: result.result?.imageUrl,
      dataUrl: result.result?.imageUrl?.startsWith('data:image/') ? result.result.imageUrl : undefined,
      model: typeof resultMetadata.model === 'string' ? resultMetadata.model : raw.model,
      upstreamStatus: raw.upstreamStatus,
      upstreamMessage: raw.upstreamMessage,
      rawCode: raw.rawCode,
      requestId: raw.requestId,
    }, { status: result.success ? 200 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成请求失败'
    console.error('[api/generate/image]', err)
    return NextResponse.json({ success: false, message, errorCode: 'PROVIDER_REQUEST_FAILED' }, { status: 500 })
  }
}
