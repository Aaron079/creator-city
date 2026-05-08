import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runGenerate } from '@/lib/providers/generate'
import type { GenerateRequest } from '@/lib/providers/types'
import { setupBilling, finalizeBilling } from '@/lib/credits/billing-middleware'
import { buildProviderManagementStatus } from '@/lib/provider-management'
import { generateSeedanceVideo } from '@/lib/providers/china/volcengine'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'

type VideoGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
  imageUrl?: string
  duration?: number
  aspectRatio?: string
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
    errorCode: 'PROVIDER_NOT_CONFIGURED',
    message: '视频 Provider 未配置，请先在 /admin/providers 配置环境变量。',
    providerId,
    missingEnv,
    missingEnvKeys: missingEnv,
    mode: 'unavailable',
    status: 'not-configured',
  }, { status: 200 })
}

function firstImageInput(body: VideoGenerateBody) {
  return body.imageUrl
    ?? body.inputAssets?.find((asset) => asset.type === 'image' && asset.url)?.url
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
      status: 'failed',
    }, { status: 401 })
  }

  const providers = await getVideoProviderRows()
  const defaultProviderId = defaultVideoProviderId(providers)
  const providerId = body.providerId || defaultProviderId || 'volcengine-seedance-video'
  const prompt = body.prompt ?? ''
  const imageUrl = firstImageInput(body)

  if (!prompt.trim() && !imageUrl) {
    return NextResponse.json({
      success: false,
      errorCode: 'PROMPT_REQUIRED',
      message: '请输入视频提示词，或连接一个上游图片作为视频输入。',
      providerId,
      mode: 'unavailable',
      status: 'failed',
    }, { status: 200 })
  }

  const providerRow = providers.find((provider) => provider.providerId === providerId)
  if (!providerRow?.available) {
    return providerNotConfiguredResponse(providerId, providerRow?.missingEnv ?? [])
  }

  if (providerId === 'volcengine-seedance-video') {
    const params = body.params ?? {}
    const duration = body.duration
      ?? (typeof params.duration === 'number' ? params.duration : 5)
    const aspectRatio = body.aspectRatio
      ?? (typeof params.ratio === 'string' ? params.ratio : undefined)
      ?? (typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined)
      ?? '16:9'
    const raw = await generateSeedanceVideo({
      prompt,
      imageUrl,
      providerId,
      duration,
      aspectRatio,
      projectId: body.projectId,
      workflowId: body.workflowId,
      nodeId: body.nodeId,
    })

    if (!raw.success) {
      return NextResponse.json({
        success: false,
        providerId,
        mode: raw.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'unavailable' : 'real',
        status: raw.errorCode === 'PROVIDER_NOT_CONFIGURED' ? 'not-configured' : 'failed',
        message: raw.message,
        errorCode: raw.errorCode,
        model: raw.model,
        upstreamStatus: raw.upstreamStatus,
        upstreamMessage: raw.upstreamMessage,
        rawCode: raw.rawCode,
        requestId: raw.requestId,
      }, { status: 200 })
    }

    if (raw.async) {
      const submittedAt = new Date().toISOString()
      return NextResponse.json({
        success: true,
        async: true,
        taskId: raw.taskId,
        jobId: raw.taskId,
        providerId,
        model: raw.model,
        mode: 'real',
        status: 'running',
        message: '视频任务已提交，正在生成中',
        submittedAt,
        result: {
          metadata: {
            providerId,
            model: raw.model,
            taskId: raw.taskId,
            generationJobId: raw.taskId,
            submittedAt,
          },
        },
      }, { status: 200 })
    }

    const completedAt = new Date().toISOString()
    return NextResponse.json({
      success: true,
      async: false,
      videoUrl: raw.videoUrl,
      providerId,
      model: raw.model,
      mode: 'real',
      status: 'succeeded',
      message: `视频生成成功（${raw.model}）`,
      completedAt,
      result: {
        videoUrl: raw.videoUrl,
        previewUrl: raw.videoUrl,
        metadata: {
          providerId,
          model: raw.model,
          completedAt,
        },
      },
    }, { status: 200 })
  }

  const billing = await setupBilling(request, providerId, 'video', prompt)
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
  return NextResponse.json(result)
}
