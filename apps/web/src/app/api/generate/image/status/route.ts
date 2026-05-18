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


async function findExistingAsset(jobId: string, outputAssetId?: string | null) {
  if (outputAssetId) {
    const asset = await db.asset.findUnique({ where: { id: outputAssetId } }).catch(() => null)
    if (asset) return asset
  }
  return db.asset.findFirst({
    where: { generationJobId: jobId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null)
}

async function writeCanvasNodeResult(args: {
  workflowId?: string
  nodeId?: string | null
  providerId: string
  model?: string
  taskId: string
  generationJobId: string
  assetId: string
  imageUrl: string
  storageKey?: string
  providerOriginalUrl?: string
  providerResponse?: unknown
  submittedInput?: unknown
  providerRegion?: 'cn' | 'global'
  executionRegion?: 'cn' | 'global'
  storageRegion?: 'cn' | 'global'
  sourceProviderRegion?: 'cn' | 'global'
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
      resultImageUrl: args.imageUrl,
      resultPreview: '图片已生成',
      errorMessage: null,
      metadataJson: jsonValue({
        ...metadata,
        providerId: args.providerId,
        model: args.model ?? stringValue(metadata.model),
        taskId: args.taskId,
        generationJobId: args.generationJobId,
        assetId: args.assetId,
        outputAssetId: args.assetId,
        assetUrl: args.imageUrl,
        stableUrl: args.imageUrl,
        resolvedUrl: args.imageUrl,
        resultImageUrl: args.imageUrl,
        providerOriginalUrl: args.providerOriginalUrl ?? metadata.providerOriginalUrl,
        originalProviderImageUrl: args.providerOriginalUrl ?? metadata.originalProviderImageUrl,
        providerRegion: args.providerRegion ?? null,
        executionRegion: args.executionRegion ?? null,
        storageRegion: args.storageRegion ?? null,
        sourceProviderRegion: args.sourceProviderRegion ?? args.providerRegion ?? null,
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
        submittedInput: args.submittedInput ?? metadata.submittedInput,
        providerResponse: args.providerResponse ?? metadata.providerResponse,
        generationJob: {
          ...record(metadata.generationJob),
          id: args.generationJobId,
          outputAssetId: args.assetId,
        },
        mediaPersistence: {
          ...record(metadata.mediaPersistence),
          status: 'persisted',
          persistenceStatus: 'persistence_success',
          assetId: args.assetId,
          outputAssetId: args.assetId,
          stableUrl: args.imageUrl,
          resolvedUrl: args.imageUrl,
          storageProvider: 'aliyun-oss',
          storageKey: args.storageKey,
        },
      }),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/image/status] failed to update CanvasNode', error)
  })
}


export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'UNAUTHORIZED',
      message: '请先登录后再查询图片任务。',
    }, { status: 401 })
  }

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

  const generationJob = await db.generationJob.findFirst({
    where: { id: generationJobId, userId: currentUser.id },
  })

  if (!generationJob) {
    return NextResponse.json({
      success: false,
      status: 'failed',
      errorCode: 'generation_job_not_found',
      message: 'GenerationJob not found.',
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
    const asset = await findExistingAsset(generationJob.id, generationJob.outputAssetId)
    const imageUrl = asset?.url ?? stringValue(record(generationJob.output).stableUrl) ?? stringValue(record(generationJob.output).resultImageUrl)
    const assetId = asset?.id ?? generationJob.outputAssetId
    if (imageUrl && assetId) {
      await writeCanvasNodeResult({
        workflowId,
        nodeId,
        providerId,
        taskId,
        generationJobId: generationJob.id,
        assetId,
        imageUrl,
        storageKey: stringValue(record(generationJob.output).storageKey),
        providerOriginalUrl: stringValue(record(generationJob.output).providerOriginalUrl),
        submittedInput: record(generationJob.output).submittedInput ?? record(generationJob.input).submittedInput,
        providerRegion: sourceProviderRegion,
        executionRegion,
        storageRegion,
        sourceProviderRegion,
      })
    }
    return NextResponse.json({
      success: true,
      providerId,
      status: 'succeeded',
      taskId,
      generationJobId: generationJob.id,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      resultImageUrl: imageUrl,
      imageUrl,
      stableUrl: imageUrl,
      assetId,
      outputAssetId: assetId,
      asset: asset ? {
        id: asset.id,
        type: 'IMAGE',
        url: asset.url,
        generationJobId: generationJob.id,
        projectId: asset.projectId,
        workflowId: asset.workflowId,
        nodeId: asset.nodeId,
      } : undefined,
      message: 'Image generation succeeded',
    }, { status: 200 })
  }

  if (generationJob.status === 'FAILED') {
    const failOutput = record(generationJob.output)
    return NextResponse.json({
      success: false,
      providerId,
      status: 'failed',
      taskId,
      generationJobId: generationJob.id,
      providerRegion: sourceProviderRegion,
      executionRegion,
      storageRegion,
      executorKind,
      errorCode: stringValue(failOutput.errorCode) || 'image_generation_failed',
      message: generationJob.errorMessage || generationJob.error || 'Image generation failed.',
      upstreamMessage: failOutput.upstreamMessage,
      upstreamStatus: failOutput.upstreamStatus,
      requestId: failOutput.requestId,
      providerEndpoint: failOutput.providerEndpoint,
      providerHttpStatus: failOutput.providerHttpStatus,
      submittedInput: failOutput.submittedInput,
      providerResponse: failOutput.providerResponse,
    }, { status: 200 })
  }

  // QUEUED or PROCESSING — cn-executor is working on it, return running status
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
    message: '图片生成中，请继续轮询',
  }, { status: 200 })
}
