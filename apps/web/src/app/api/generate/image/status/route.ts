import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { releaseJobCredits, settleJobCredits } from '@/lib/billing/settle'
import { getImageGenerationStatusViaRegion, getExecutorForProvider } from '@/lib/executors/executor-gateway'
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

function visibleProviderErrorCode(errorCode: string | undefined, upstreamStatus?: number, message = '') {
  const code = errorCode ?? ''
  const haystack = `${code} ${message}`.toLowerCase()
  if (code === 'provider_timeout' || code.includes('TIMEOUT') || /timeout|abort/.test(haystack)) return 'provider_timeout'
  if (code === 'provider_network_failed' || /fetch failed|failed to fetch|network|econn|enotfound|dns/.test(haystack)) return 'provider_network_failed'
  if (code === 'provider_response_parse_failed') return 'provider_response_parse_failed'
  if (code === 'provider_request_failed') return 'provider_request_failed'
  if (code === 'PROVIDER_AUTH_ERROR' || code === 'provider_auth_failed' || code === 'provider_auth_error' || upstreamStatus === 401 || upstreamStatus === 403 || /auth|unauthorized|forbidden|permission|access denied/.test(haystack)) return 'provider_auth_failed'
  if (code === 'provider_model_invalid' || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|does not exist)|模型|接入点/.test(haystack)) return 'provider_model_invalid'
  if (code === 'PROVIDER_QUOTA_OR_BILLING_ERROR' || code === 'provider_quota_or_billing_error' || upstreamStatus === 402 || upstreamStatus === 429 || /quota|billing|credits|insufficient|余额|额度|rate limit/.test(haystack)) return 'provider_quota_or_billing_error'
  if (code === 'PROVIDER_INVALID_PARAMETER' || code === 'provider_invalid_parameter' || /invalid parameter|invalid_param|invalid request|bad request|parameter/.test(haystack)) return 'provider_invalid_parameter'
  if (code === 'PROVIDER_MEDIA_DOWNLOAD_FAILED' || code === 'provider_media_download_failed' || code === 'MEDIA_FETCH_FAILED' || code === 'ASSET_DOWNLOAD_FAILED' || code === 'ASSET_DOWNLOAD_ERROR' || /media download failed|download failed/.test(haystack)) return 'provider_media_download_failed'
  if (code === 'PROVIDER_NO_DOWNLOAD_URL' || code === 'provider_no_download_url' || code.includes('URL_EMPTY') || code.includes('URL_MISSING')) return 'provider_no_download_url'
  return code || 'generation_failed'
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

async function markJobFailed(args: {
  jobId: string
  errorCode: string
  message: string
  providerResponse?: unknown
  upstreamMessage?: unknown
}) {
  console.error('[api/generate/image/status] job failed', {
    jobId: args.jobId,
    errorCode: args.errorCode,
    message: args.message.slice(0, 300),
  })
  await db.generationJob.update({
    where: { id: args.jobId },
    data: {
      status: 'FAILED',
      error: args.message,
      errorMessage: args.message.slice(0, 1000),
      output: jsonValue({
        errorCode: args.errorCode,
        message: args.message,
        upstreamMessage: args.upstreamMessage,
        providerResponse: args.providerResponse,
      }),
      completedAt: new Date(),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/image/status] failed to mark GenerationJob failed', error)
  })
  await releaseJobCredits(args.jobId).catch((error: unknown) => {
    console.warn('[api/generate/image/status] failed to release credits', error)
  })
}

async function writeCanvasNodeError(args: {
  workflowId?: string
  nodeId?: string | null
  generationJobId: string
  taskId: string
  errorCode: string
  message: string
  upstreamMessage?: unknown
  requestId?: unknown
  submittedInput?: unknown
  providerResponse?: unknown
  providerHttpStatus?: unknown
  providerEndpoint?: unknown
}) {
  if (!args.workflowId || !args.nodeId) return
  const node = await db.canvasNode.findUnique({
    where: { workflowId_nodeId: { workflowId: args.workflowId, nodeId: args.nodeId } },
  }).catch(() => null)
  if (!node) return
  const metadata = record(node.metadataJson)
  await db.canvasNode.update({
    where: { id: node.id },
    data: {
      status: 'error',
      errorMessage: args.message.slice(0, 500),
      metadataJson: jsonValue({
        ...metadata,
        generationJobId: args.generationJobId,
        taskId: args.taskId,
        errorCode: args.errorCode,
        errorMessage: args.message,
        recoveryStatus: args.errorCode,
        mediaRecoveryStatus: 'generation_failed',
        loading: false,
        isRegenerating: false,
        regenerating: false,
        upstreamMessage: args.upstreamMessage,
        requestId: args.requestId,
        submittedInput: args.submittedInput,
        providerResponse: args.providerResponse,
        providerHttpStatus: args.providerHttpStatus,
        providerEndpoint: args.providerEndpoint,
        lastGenerationError: jsonValue({
          errorCode: args.errorCode,
          message: args.message,
          upstreamMessage: args.upstreamMessage,
          requestId: args.requestId,
          providerHttpStatus: args.providerHttpStatus,
          at: new Date().toISOString(),
        }),
      }),
    },
  }).catch((error: unknown) => {
    console.warn('[api/generate/image/status] failed to update CanvasNode error state', error)
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

  if (!taskId) {
    const message = 'GenerationJob has no cn-executor taskId.'
    await markJobFailed({ jobId: generationJob.id, errorCode: 'cn_executor_task_id_missing', message })
    return NextResponse.json({
      success: false,
      providerId,
      status: 'failed',
      generationJobId: generationJob.id,
      errorCode: 'cn_executor_task_id_missing',
      message,
    }, { status: 200 })
  }

  console.info('[api/generate/image/status] polling cn-executor', {
    generationJobId: generationJob.id,
    taskId,
    providerId,
  })
  const executorStatus = await getImageGenerationStatusViaRegion(providerId, taskId)
  const status = typeof executorStatus.status === 'string' ? executorStatus.status : ''

  if (executorStatus.success && status === 'running') {
    return NextResponse.json({
      success: true,
      providerId,
      status: 'running',
      taskId,
      generationJobId: generationJob.id,
      message: '图片生成中',
      submittedInput: executorStatus.submittedInput,
    }, { status: 200 })
  }

  if (!executorStatus.success || status === 'failed') {
    const errCode = typeof executorStatus.errorCode === 'string' ? executorStatus.errorCode : 'cn_executor_failed'
    const errMsg = typeof executorStatus.message === 'string' ? executorStatus.message
      : typeof executorStatus.errorMessage === 'string' ? executorStatus.errorMessage
      : 'CN executor image task failed.'
    const visibleCode = visibleProviderErrorCode(errCode, typeof executorStatus.upstreamStatus === 'number' ? executorStatus.upstreamStatus : undefined, errMsg)
    console.error('[api/generate/image/status] executor reported failure', {
      generationJobId: generationJob.id,
      taskId,
      errorCode: visibleCode,
      rawCode: errCode,
      upstreamStatus: executorStatus.upstreamStatus,
      requestId: executorStatus.requestId,
      message: errMsg.slice(0, 300),
    })
    await markJobFailed({
      jobId: generationJob.id,
      errorCode: visibleCode,
      message: errMsg,
      upstreamMessage: executorStatus.upstreamMessage,
      providerResponse: executorStatus.providerResponse,
    })
    await writeCanvasNodeError({
      workflowId,
      nodeId,
      generationJobId: generationJob.id,
      taskId,
      errorCode: visibleCode,
      message: errMsg,
      upstreamMessage: executorStatus.upstreamMessage,
      requestId: executorStatus.requestId,
      submittedInput: executorStatus.submittedInput,
      providerResponse: executorStatus.providerResponse,
      providerHttpStatus: executorStatus.providerHttpStatus,
      providerEndpoint: executorStatus.providerEndpoint,
    })
    return NextResponse.json({
      success: false,
      providerId,
      status: 'failed',
      taskId,
      generationJobId: generationJob.id,
      errorCode: visibleCode,
      message: errMsg,
      upstreamStatus: executorStatus.upstreamStatus,
      upstreamMessage: executorStatus.upstreamMessage,
      requestId: executorStatus.requestId,
      providerEndpoint: executorStatus.providerEndpoint,
      providerHttpStatus: executorStatus.providerHttpStatus,
      submittedInput: executorStatus.submittedInput,
      providerResponse: executorStatus.providerResponse,
    }, { status: 200 })
  }

  const resultImageUrl = stringValue(executorStatus.resultImageUrl)
    || stringValue(executorStatus.stableUrl)
    || stringValue(record(executorStatus.asset).resolvedUrl)
  if (!resultImageUrl) {
    const message = 'CN executor image task succeeded without resultImageUrl.'
    await markJobFailed({
      jobId: generationJob.id,
      errorCode: 'provider_no_download_url',
      message,
      providerResponse: executorStatus.providerResponse,
    })
    return NextResponse.json({
      success: false,
      providerId,
      status: 'failed',
      taskId,
      generationJobId: generationJob.id,
      errorCode: 'provider_no_download_url',
      message,
      providerResponse: executorStatus.providerResponse,
    }, { status: 200 })
  }

  const existingAsset = await findExistingAsset(generationJob.id, generationJob.outputAssetId)
  const assetModel = typeof executorStatus.model === 'string' ? executorStatus.model : stringValue(input.model)
  const assetStorageKey = stringValue(record(executorStatus.asset).storageKey)
  const assetProviderOriginalUrl = stringValue(executorStatus.providerOriginalUrl) || stringValue(record(executorStatus.asset).providerOriginalUrl) || resultImageUrl
  const assetMetadata = {
    model: assetModel,
    taskId,
    providerJobId: taskId,
    generationJobId: generationJob.id,
    providerOriginalUrl: assetProviderOriginalUrl,
    stableUrl: resultImageUrl,
    resolvedUrl: resultImageUrl,
    storageKey: assetStorageKey,
    storageRegion,
    sourceProviderRegion,
    executionRegion,
    submittedInput: executorStatus.submittedInput ?? input.submittedInput,
    providerResponse: executorStatus.providerResponse,
  }
  const asset = existingAsset ?? await db.asset.create({
    data: {
      name: `generated-image-${generationJob.id}.png`,
      title: '生成图片',
      type: 'IMAGE',
      status: 'READY',
      ownerId: currentUser.id,
      projectId: generationJob.projectId ?? (stringValue(input.projectId) || null),
      workflowId: workflowId || null,
      nodeId: nodeId || null,
      source: 'generated',
      provider: providerId,
      providerId,
      providerJobId: taskId,
      storageProvider: 'aliyun-oss',
      storageKey: assetStorageKey || null,
      url: resultImageUrl,
      originalUrl: assetProviderOriginalUrl,
      thumbnailUrl: resultImageUrl,
      filename: `generated-image-${generationJob.id}.png`,
      mimeType: 'image/png',
      prompt: generationJob.prompt,
      metadata: jsonValue(assetMetadata),
      metadataJson: jsonValue(assetMetadata),
      generationJobId: generationJob.id,
      recoveryStatus: 'ready',
      tags: [],
    },
  })

  const output = {
    ...executorStatus,
    status: 'succeeded',
    taskId,
    generationJobId: generationJob.id,
    resultImageUrl,
    stableUrl: resultImageUrl,
    assetId: asset.id,
    outputAssetId: asset.id,
  }
  await db.generationJob.update({
    where: { id: generationJob.id },
    data: {
      status: 'SUCCEEDED',
      outputAssetId: asset.id,
      output: jsonValue(output),
      completedAt: new Date(),
    },
  })
  await writeCanvasNodeResult({
    workflowId,
    nodeId,
    providerId,
    model: assetModel,
    taskId,
    generationJobId: generationJob.id,
    assetId: asset.id,
    imageUrl: resultImageUrl,
    storageKey: assetStorageKey,
    providerOriginalUrl: assetProviderOriginalUrl,
    submittedInput: executorStatus.submittedInput ?? input.submittedInput,
    providerResponse: executorStatus.providerResponse,
    providerRegion: sourceProviderRegion,
    executionRegion,
    storageRegion,
    sourceProviderRegion,
  })
  await settleJobCredits(generationJob.id).catch((error: unknown) => {
    console.warn('[api/generate/image/status] failed to settle credits', error)
  })

  return NextResponse.json({
    success: true,
    providerId,
    mode: 'real',
    status: 'succeeded',
    taskId,
    generationJobId: generationJob.id,
    jobId: generationJob.id,
    providerRegion: sourceProviderRegion,
    executionRegion,
    storageRegion,
    executorKind,
    resultImageUrl,
    imageUrl: resultImageUrl,
    stableUrl: resultImageUrl,
    resolvedUrl: resultImageUrl,
    assetId: asset.id,
    outputAssetId: asset.id,
    asset: {
      id: asset.id,
      type: 'IMAGE',
      url: asset.url,
      generationJobId: generationJob.id,
      projectId: asset.projectId,
      workflowId: asset.workflowId,
      nodeId: asset.nodeId,
    },
    result: {
      imageUrl: resultImageUrl,
      previewUrl: resultImageUrl,
      metadata: {
        ...assetMetadata,
        assetId: asset.id,
        outputAssetId: asset.id,
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetStatus: 'ready',
      },
    },
    model: executorStatus.model ?? input.model,
    message: 'Image generation succeeded',
    submittedInput: executorStatus.submittedInput ?? input.submittedInput,
    providerResponse: executorStatus.providerResponse,
  }, { status: 200 })
}
