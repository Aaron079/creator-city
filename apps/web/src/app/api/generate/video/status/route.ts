import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getExecutorForProvider } from '@/lib/executors/executor-gateway'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
  } catch {
    return {} as Prisma.InputJsonObject
  }
}

async function findExistingVideoAsset(jobId: string, outputAssetId?: string | null) {
  if (outputAssetId) {
    const asset = await db.asset.findUnique({ where: { id: outputAssetId } }).catch(() => null)
    if (asset) return asset
  }
  return db.asset.findFirst({
    where: { generationJobId: jobId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)
}

async function writeCanvasNodeVideoResult(args: {
  workflowId?: string
  nodeId?: string | null
  providerId: string
  model?: string
  taskId?: string
  generationJobId: string
  assetId: string
  videoUrl: string
  storageKey?: string
  providerOriginalUrl?: string
  providerRegion?: 'cn' | 'global'
  executionRegion?: 'cn' | 'global'
  storageRegion?: 'cn' | 'global'
}) {
  if (!args.workflowId || !args.nodeId) return
  const node = await db.canvasNode.findUnique({
    where: {
      workflowId_nodeId: {
        workflowId: args.workflowId,
        nodeId: args.nodeId,
      },
    },
  }).catch(() => null)
  if (!node) return

  const metadata = record(node.metadataJson)
  await db.canvasNode.update({
    where: { id: node.id },
    data: {
      status: 'done',
      resultVideoUrl: args.videoUrl,
      resultPreview: '视频已生成',
      errorMessage: null,
      metadataJson: jsonValue({
        ...metadata,
        providerId: args.providerId,
        model: args.model ?? stringValue(metadata.model),
        taskId: args.taskId ?? metadata.taskId,
        generationJobId: args.generationJobId,
        assetId: args.assetId,
        outputAssetId: args.assetId,
        assetUrl: args.videoUrl,
        stableUrl: args.videoUrl,
        resolvedUrl: args.videoUrl,
        resultVideoUrl: args.videoUrl,
        originalProviderVideoUrl: args.providerOriginalUrl ?? metadata.originalProviderVideoUrl,
        providerOriginalUrl: args.providerOriginalUrl ?? metadata.providerOriginalUrl,
        temporaryUrl: args.providerOriginalUrl ?? metadata.temporaryUrl,
        providerRegion: args.providerRegion ?? null,
        executionRegion: args.executionRegion ?? null,
        storageRegion: args.storageRegion ?? null,
        sourceProviderRegion: args.providerRegion ?? null,
        executorKind: 'aliyun_fc',
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetStatus: 'ready',
        recoveryStatus: 'ready',
        mediaRecoveryStatus: 'regenerated',
        loading: false,
        isRegenerating: false,
        regenerating: false,
        errorCode: null,
        errorMessage: null,
        lastError: null,
        lastGenerationError: null,
        mediaPersistence: {
          ...record(metadata.mediaPersistence),
          status: 'persisted',
          persistenceStatus: 'persistence_success',
          assetId: args.assetId,
          outputAssetId: args.assetId,
          stableUrl: args.videoUrl,
          resolvedUrl: args.videoUrl,
          storageProvider: 'aliyun-oss',
          storageKey: args.storageKey,
        },
        generationJob: {
          ...record(metadata.generationJob),
          id: args.generationJobId,
          outputAssetId: args.assetId,
        },
      }),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/video/status] failed to update CanvasNode', error)
  })
}

export async function GET(request: NextRequest) {
  // Parse generationJobId BEFORE auth — lets unauthenticated requests get a safe degraded response
  // rather than a generic 401 when the job ID is valid.
  const { searchParams } = new URL(request.url)
  const generationJobId = searchParams.get('generationJobId')?.trim() ?? ''
  if (!generationJobId) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'generation_job_id_required',
      message: 'generationJobId is required',
    }, { status: 400 })
  }

  const currentUser = await getCurrentUser()

  // Authenticated: find job owned by this user.
  // Degraded (no session): find job by ID only — UUIDs are unguessable, safe to return status.
  // This handles: DB session-lookup failures, expired cookies, cross-device polling.
  const generationJob = currentUser
    ? await db.generationJob.findFirst({ where: { id: generationJobId, userId: currentUser.id } })
    : await db.generationJob.findFirst({ where: { id: generationJobId } })

  if (!generationJob) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'generation_job_not_found',
      message: currentUser ? 'GenerationJob not found.' : '视频任务不存在，或需要登录后查询。',
      generationJobId,
    }, { status: 404 })
  }

  const input = record(generationJob.input)
  const providerId = generationJob.providerId
  const taskId = generationJob.providerJobId ?? stringValue(input.taskId)
  const workflowId = stringValue(input.workflowId)
  const nodeId = generationJob.nodeId ?? stringValue(input.nodeId)
  const { providerRegion: sourceProviderRegion, executionRegion, storageRegion, executorKind } = getExecutorForProvider(providerId)

  if (generationJob.status === 'SUCCEEDED') {
    const asset = await findExistingVideoAsset(generationJob.id, generationJob.outputAssetId)
    const videoUrl = asset?.url || stringValue(record(generationJob.output).stableUrl) || stringValue(record(generationJob.output).resultVideoUrl)
    const assetId = asset?.id ?? generationJob.outputAssetId
    // Only write canvas node result when authenticated — degraded mode skips the DB write
    if (videoUrl && assetId && currentUser) {
      await writeCanvasNodeVideoResult({
        workflowId,
        nodeId,
        providerId,
        taskId: taskId || undefined,
        generationJobId: generationJob.id,
        assetId,
        videoUrl,
        storageKey: stringValue(record(generationJob.output).storageKey),
        providerOriginalUrl: stringValue(record(generationJob.output).providerOriginalUrl),
        providerRegion: sourceProviderRegion,
        executionRegion,
        storageRegion,
      })
    }
    return NextResponse.json({
      success: true,
      providerId,
      status: 'succeeded',
      taskId: taskId || null,
      generationJobId: generationJob.id,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      resultVideoUrl: videoUrl,
      videoUrl,
      stableUrl: videoUrl,
      // Asset details only returned when authenticated
      ...(currentUser ? {
        assetId,
        outputAssetId: assetId,
        asset: asset ? {
          id: asset.id,
          type: 'VIDEO',
          url: asset.url,
          generationJobId: generationJob.id,
          projectId: asset.projectId,
          workflowId: asset.workflowId,
          nodeId: asset.nodeId,
        } : undefined,
      } : {}),
      message: '视频生成完成',
    }, { status: 200 })
  }

  if (generationJob.status === 'FAILED') {
    const failOutput = record(generationJob.output)
    return NextResponse.json({
      success: false,
      providerId,
      status: 'failed',
      taskId: taskId || null,
      generationJobId: generationJob.id,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      errorCode: stringValue(failOutput.errorCode) || 'video_generation_failed',
      errorStage: failOutput.errorStage,
      message: generationJob.errorMessage || generationJob.error || '视频生成失败。',
      upstreamMessage: failOutput.upstreamMessage,
      upstreamStatus: failOutput.upstreamStatus,
      requestId: failOutput.requestId,
      providerEndpoint: failOutput.providerEndpoint,
      providerHttpStatus: failOutput.providerHttpStatus,
      submittedInput: failOutput.submittedInput,
      stageTrace: failOutput.stageTrace,
      // providerResponse omitted in degraded mode — may contain raw API data
      ...(currentUser ? { providerResponse: failOutput.providerResponse } : {}),
    }, { status: 200 })
  }

  // Detect stalled jobs: QUEUED >2 min = executor never started; PROCESSING >5 min = executor hung
  const ageMs = Date.now() - new Date(generationJob.updatedAt).getTime()
  if (generationJob.status === 'QUEUED' && ageMs > 2 * 60 * 1000) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'executor_not_started',
      errorStage: 'executor_dispatch',
      stageTrace: ['executor_dispatch', 'executor_not_started'],
      message: 'Video job stayed QUEUED for >2 min — cn-executor never started. Check: (1) CREATOR_CN_API_BASE_URL is set, (2) shared secret matches, (3) Aliyun FC function is running.',
      providerId,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      generationJobId: generationJob.id,
      taskId: taskId || null,
      jobStatus: generationJob.status,
      updatedAt: generationJob.updatedAt.toISOString(),
      ageMs,
    }, { status: 200 })
  }
  if (ageMs > 5 * 60 * 1000) {
    const stallOutput = record(generationJob.output)
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'generation_job_stalled',
      message: 'Video job stuck in PROCESSING — cn-executor started but did not finish. Check Aliyun FC function logs for this job.',
      providerId,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      generationJobId: generationJob.id,
      taskId: taskId || null,
      errorStage: stallOutput.errorStage ?? 'status_polling',
      stageTrace: stallOutput.stageTrace ?? ['status_polling', 'generation_job_stalled'],
      jobStatus: generationJob.status,
      updatedAt: generationJob.updatedAt.toISOString(),
      ageMs,
    }, { status: 200 })
  }

  return NextResponse.json({
    success: true,
    providerId,
    status: 'running',
    taskId: taskId || null,
    generationJobId: generationJob.id,
    providerRegion: sourceProviderRegion,
    executionRegion,
    storageRegion,
    executorKind,
    message: '视频生成中，请继续轮询',
  }, { status: 200 })
}
