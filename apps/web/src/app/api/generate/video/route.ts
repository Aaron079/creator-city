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

export const dynamic = 'force-dynamic'

type VideoGenerateBody = Partial<GenerateRequest> & {
  workflowId?: string
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

function failedMediaPersistence(result: Extract<PersistGeneratedMediaResult, { ok: false }>) {
  return {
    status: 'failed',
    errorCode: result.errorCode,
    message: result.message,
    upstreamStatus: result.upstreamStatus,
  }
}

function visiblePersistenceErrorCode(errorCode: string) {
  if (errorCode === 'MEDIA_FETCH_FAILED' || errorCode === 'ASSET_DOWNLOAD_FAILED' || errorCode === 'ASSET_DOWNLOAD_ERROR') return 'PROVIDER_MEDIA_DOWNLOAD_FAILED'
  return errorCode
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
  return db.generationJob.create({
    data: {
      userId: args.userId,
      projectId: args.body.projectId ?? null,
      providerId: args.providerId,
      provider: args.providerId,
      nodeType: 'video',
      kind: 'video',
      status: 'PROCESSING',
      prompt: args.prompt.slice(0, 2000),
      input: {
        prompt: args.prompt,
        imageUrl: args.imageUrl,
        params: args.body.params ?? {},
        workflowId: args.body.workflowId,
        nodeId: args.body.nodeId,
      },
    },
  })
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
      mediaPersistence: { status: 'disabled' },
      assetIntelligence,
      warning: undefined,
      assetId: undefined,
      asset: undefined,
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
      assetIntelligence,
    },
  }).catch((error: unknown): PersistGeneratedMediaResult => ({
    ok: false,
    errorCode: 'MEDIA_PERSIST_FAILED',
    message: error instanceof Error ? error.message : '生成视频转存失败。',
  }))

  if (!persistence.ok) {
    return {
      videoUrl: args.videoUrl,
      mediaPersistence: failedMediaPersistence(persistence),
      assetIntelligence,
      warning: '视频生成成功，但媒体转存失败，该链接可能会过期。',
      assetId: undefined,
      asset: undefined,
      persistenceError: persistence,
    }
  }

  return {
    videoUrl: persistence.stableUrl,
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
  const prompt = body.compiledPrompt?.trim() || body.prompt || ''
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
    const generationJob = await createVideoGenerationJob({
      userId: currentUser.id,
      providerId,
      prompt,
      body,
      imageUrl,
    })
    const params = body.params ?? {}
    const duration = body.duration
      ?? numberParam(params.duration)
      ?? 5
    const aspectRatio = body.aspectRatio
      ?? (typeof params.ratio === 'string' ? params.ratio : undefined)
      ?? (typeof params.aspectRatio === 'string' ? params.aspectRatio : undefined)
      ?? '16:9'
    const resolution = stringParam(params.resolution)
      ?? body.resolution
      ?? stringParam(params.quality)
      ?? stringParam(params.size)
    const imageReadable = await assertProviderReadableImageUrl(imageUrl)
    if (!imageReadable.ok) {
      await markVideoGenerationJobFailed(generationJob.id, imageReadable.message)
      return NextResponse.json({
        success: false,
        providerId,
        mode: 'real',
        status: 'failed',
        message: imageReadable.message,
        errorCode: imageReadable.errorCode,
        model: providerRow.model,
        upstreamStatus: imageReadable.upstreamStatus,
        upstreamMessage: imageReadable.upstreamMessage,
        submittedInput: {
          providerId,
          model: providerRow.model,
          promptChars: prompt.length,
          hasImageUrl: Boolean(imageUrl),
          imageUrl,
          duration,
          aspectRatio,
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
        errorCode: raw.errorCode,
        model: raw.model,
        upstreamStatus: raw.upstreamStatus,
        upstreamMessage: raw.upstreamMessage,
        rawCode: raw.rawCode,
        requestId: raw.requestId,
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
            providerJobId: raw.taskId,
            generationJobId: generationJob.id,
            submittedAt,
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
    })
    if (persisted.persistenceError) {
      await markVideoGenerationJobFailed(generationJob.id, persisted.persistenceError.message)
      const errorCode = visiblePersistenceErrorCode(persisted.persistenceError.errorCode)
      return NextResponse.json({
        success: false,
        providerId,
        mode: 'real',
        status: 'failed',
        message: `视频生成成功，但媒体转存失败：${persisted.persistenceError.message}`,
        errorCode,
        model: raw.model,
        upstreamStatus: persisted.persistenceError.upstreamStatus ?? ('upstreamStatus' in raw ? raw.upstreamStatus : undefined),
        upstreamMessage: 'upstreamMessage' in raw ? raw.upstreamMessage : undefined,
        rawCode: 'rawCode' in raw ? raw.rawCode : undefined,
        requestId: 'requestId' in raw ? raw.requestId : undefined,
        originalProviderVideoUrl: raw.videoUrl,
        mediaPersistence: persisted.mediaPersistence,
        submittedInput: 'submittedInput' in raw ? raw.submittedInput : undefined,
        providerResponse: 'providerResponse' in raw ? raw.providerResponse : undefined,
      }, { status: 200 })
    }
    return NextResponse.json({
      success: true,
      async: false,
      videoUrl: persisted.videoUrl,
      resultVideoUrl: persisted.videoUrl,
      assetUrl: persisted.assetId ? persisted.videoUrl : undefined,
      assetId: persisted.assetId,
      asset: persisted.asset,
      originalProviderVideoUrl: raw.videoUrl,
      mediaPersistence: persisted.mediaPersistence,
      assetIntelligence: persisted.assetIntelligence,
      warning: persisted.warning,
      providerId,
      model: raw.model,
      mode: 'real',
      status: 'succeeded',
      message: `视频生成成功（${raw.model}）`,
      completedAt,
      result: {
        videoUrl: persisted.videoUrl,
        previewUrl: persisted.videoUrl,
        metadata: {
          providerId,
          model: raw.model,
          completedAt,
          generationJobId: generationJob.id,
          ...(persisted.assetId ? { assetId: persisted.assetId, assetUrl: persisted.videoUrl } : {}),
          originalProviderVideoUrl: raw.videoUrl,
          mediaPersistence: persisted.mediaPersistence,
          assetIntelligence: persisted.assetIntelligence,
          submittedInput: 'submittedInput' in raw ? raw.submittedInput : undefined,
          providerResponse: 'providerResponse' in raw ? raw.providerResponse : undefined,
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
  const resultWithMedia = result as typeof result & { resultVideoUrl?: string; videoUrl?: string; model?: string }
  const providerVideoUrl = result.result?.videoUrl ?? resultWithMedia.resultVideoUrl ?? resultWithMedia.videoUrl
  if (result.success && !providerVideoUrl) {
    return NextResponse.json({
      success: false,
      providerId,
      mode: 'real',
      status: 'failed',
      message: '视频生成成功，但 Provider 未返回可下载视频 URL。',
      errorCode: 'PROVIDER_NO_DOWNLOAD_URL',
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
    if (persisted.persistenceError) {
      const errorCode = visiblePersistenceErrorCode(persisted.persistenceError.errorCode)
      return NextResponse.json({
        success: false,
        providerId,
        mode: 'real',
        status: 'failed',
        message: `视频生成成功，但媒体转存失败：${persisted.persistenceError.message}`,
        errorCode,
        upstreamStatus: persisted.persistenceError.upstreamStatus,
        originalProviderVideoUrl: providerVideoUrl,
        mediaPersistence: persisted.mediaPersistence,
      }, { status: 200 })
    }
    return NextResponse.json({
      ...result,
      videoUrl: persisted.videoUrl,
      resultVideoUrl: persisted.videoUrl,
      assetUrl: persisted.assetId ? persisted.videoUrl : undefined,
      assetId: persisted.assetId,
      asset: persisted.asset,
      originalProviderVideoUrl: providerVideoUrl,
      mediaPersistence: persisted.mediaPersistence,
      assetIntelligence: persisted.assetIntelligence,
      warning: persisted.warning,
      result: {
        ...result.result,
        videoUrl: persisted.videoUrl,
        previewUrl: persisted.videoUrl,
        metadata: {
          ...(result.result?.metadata ?? {}),
          ...(persisted.assetId ? { assetId: persisted.assetId, assetUrl: persisted.videoUrl } : {}),
          originalProviderVideoUrl: providerVideoUrl,
          mediaPersistence: persisted.mediaPersistence,
          assetIntelligence: persisted.assetIntelligence,
        },
      },
    })
  }
  return NextResponse.json(result)
}
