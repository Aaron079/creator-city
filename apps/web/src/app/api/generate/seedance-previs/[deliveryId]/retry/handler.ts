import type { Prisma } from '@prisma/client'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { generateSeedancePrevisVideo, type SeedancePrevisVideoInput, type SeedanceVideoResult } from '@/lib/providers/china/volcengine'
import {
  parseSeedancePrevisDeliveries,
  replaceSeedancePrevisDeliveryMetadata,
} from '@/lib/seedance-previs/deliveryPersistence'
import { resolveSeedanceCapability, type SeedanceEntitlement } from '@/lib/seedance-previs/capabilities'
import { receiptFromDelivery, recordSegmentResult } from '@/lib/seedance-previs/receipts'
import { buildSegmentRetry } from '@/lib/seedance-previs/retry'

type RouteUser = { id: string }

type WorkflowRecord = {
  id: string
  projectId: string
  metadataJson: unknown
}

type RetryBody = {
  projectId: string
  workflowId: string
  segmentId: string
  reviewFindingCode?: 'MANUAL_REVIEW' | 'CAMERA_HANDOFF_DRIFT'
}

type GenerationJobInput = {
  userId: string
  projectId: string
  workflowId: string
  masterTakeId: string
  segmentId: string
  prompt: string
  model: string
  deliveryId: string
}

type GenerationJobUpdate = {
  status: 'QUEUED' | 'SUCCEEDED' | 'FAILED'
  providerJobId?: string
  errorMessage?: string
  output?: Record<string, unknown>
}

export type SeedancePrevisRetryRouteDependencies = {
  getCurrentUser: () => Promise<RouteUser | null>
  findWorkflow: (projectId: string, workflowId: string, userId: string) => Promise<WorkflowRecord | null>
  updateWorkflowMetadata: (workflowId: string, metadata: Record<string, unknown>) => Promise<void>
  resolveEntitlement: (user: RouteUser) => SeedanceEntitlement
  resolveModel: () => string
  platformDispatchEnabled: () => boolean
  createGenerationJob: (input: GenerationJobInput) => Promise<{ id: string } | null>
  updateGenerationJob: (generationJobId: string, update: GenerationJobUpdate) => Promise<void>
  generate: (input: SeedancePrevisVideoInput) => Promise<SeedanceVideoResult>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(requiredString).filter((item): item is string => Boolean(item))
    : []
}

function parseBody(value: unknown): RetryBody | null {
  if (!isRecord(value)) return null
  const projectId = requiredString(value.projectId)
  const workflowId = requiredString(value.workflowId)
  const segmentId = requiredString(value.segmentId)
  const reviewFindingCode = value.reviewFindingCode
  if (!projectId || !workflowId || !segmentId || (reviewFindingCode !== undefined && reviewFindingCode !== 'MANUAL_REVIEW' && reviewFindingCode !== 'CAMERA_HANDOFF_DRIFT')) {
    return null
  }
  return {
    projectId,
    workflowId,
    segmentId,
    ...(reviewFindingCode ? { reviewFindingCode } : {}),
  }
}

function serverEntitlement(user: RouteUser): SeedanceEntitlement {
  const allowlist = (process.env.SEEDANCE_LONG_TAKE_BETA_USER_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return allowlist.includes(user.id) ? 'long-take-beta' : 'standard'
}

function serializable(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function sourceReferences(packageValue: Record<string, unknown> | null) {
  const source = packageValue && isRecord(packageValue.sourceReferences)
    ? packageValue.sourceReferences
    : {}
  return {
    imageUrl: requiredString(source.imageUrl) ?? undefined,
    referenceImages: stringArray(source.referenceImages),
    referenceVideos: stringArray(source.referenceVideos),
    audioReferences: stringArray(source.audioReferences),
    resolution: requiredString(source.resolution) ?? undefined,
  }
}

const dependencies: SeedancePrevisRetryRouteDependencies = {
  getCurrentUser,
  findWorkflow: async (projectId, workflowId, userId) => db.canvasWorkflow.findFirst({
    where: { id: workflowId, projectId, project: { ownerId: userId } },
    select: { id: true, projectId: true, metadataJson: true },
  }),
  updateWorkflowMetadata: async (workflowId, metadata) => {
    await db.canvasWorkflow.update({
      where: { id: workflowId },
      data: { metadataJson: metadata as Prisma.InputJsonValue },
    })
  },
  resolveEntitlement: serverEntitlement,
  resolveModel: () => process.env.VOLCENGINE_SEEDANCE_MODEL?.trim() || 'seedance-2.5',
  platformDispatchEnabled: () => (
    process.env.ENABLE_PLATFORM_VIDEO_GENERATION === 'true'
    && process.env.ENABLE_SEEDANCE_PREVIS_DELIVERY === 'true'
  ),
  createGenerationJob: async (input) => db.generationJob.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      nodeId: input.masterTakeId,
      providerId: 'volcengine-seedance-video',
      provider: 'volcengine-seedance-video',
      nodeType: 'video',
      kind: 'video',
      status: 'QUEUED',
      prompt: input.prompt,
      input: serializable({
        workflowId: input.workflowId,
        masterTakeId: input.masterTakeId,
        segmentId: input.segmentId,
        model: input.model,
        deliveryId: input.deliveryId,
      }) as Prisma.InputJsonValue,
    },
    select: { id: true },
  }).catch(() => null),
  updateGenerationJob: async (generationJobId, update) => {
    await db.generationJob.update({
      where: { id: generationJobId },
      data: {
        status: update.status,
        ...(update.providerJobId ? { providerJobId: update.providerJobId } : {}),
        ...(update.errorMessage ? { errorMessage: update.errorMessage } : {}),
        ...(update.output ? { output: update.output as Prisma.InputJsonValue } : {}),
      },
    })
  },
  generate: generateSeedancePrevisVideo,
}

export function createSeedancePrevisRetryPostHandler(overrides: Partial<SeedancePrevisRetryRouteDependencies> = {}) {
  const deps = { ...dependencies, ...overrides }

  return async function POST(
    request: Request,
    context: { params: Promise<{ deliveryId: string }> },
  ) {
    const user = await deps.getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录后再恢复预演片段。', 401)
    if (!deps.platformDispatchEnabled()) {
      return jsonError('VIDEO_GENERATION_NOT_READY', '空间预演的平台视频生成尚未开放。', 403)
    }

    const { deliveryId } = await context.params
    if (!requiredString(deliveryId)) return jsonError('VALIDATION_FAILED', '交付记录无效。', 400)
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonError('VALIDATION_FAILED', '请求数据不是有效 JSON。', 400)
    }
    const body = parseBody(rawBody)
    if (!body) return jsonError('VALIDATION_FAILED', '片段恢复参数无效。', 400)

    try {
      const workflow = await deps.findWorkflow(body.projectId, body.workflowId, user.id)
      if (!workflow) return jsonError('PROJECT_OR_WORKFLOW_NOT_FOUND', '项目或画布不存在，或没有写入权限。', 404)
      const deliveries = parseSeedancePrevisDeliveries(workflow.metadataJson)
      const delivery = deliveries?.items.find((item) => item.deliveryId === deliveryId)
      if (!delivery) return jsonError('SEEDANCE_PREVIS_DELIVERY_NOT_FOUND', '找不到该空间预演交付记录。', 404)

      const receipt = receiptFromDelivery(delivery)
      let retry
      try {
        retry = buildSegmentRetry(receipt, body.segmentId, {
          hasReviewFinding: body.reviewFindingCode === 'MANUAL_REVIEW' || body.reviewFindingCode === 'CAMERA_HANDOFF_DRIFT',
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : 'SEGMENT_RETRY_NOT_ELIGIBLE'
        const status = code === 'SEEDANCE_PREVIS_SEGMENT_NOT_FOUND' ? 404 : 409
        return jsonError(code, '此片段当前不允许重新生成。', status)
      }

      const model = requiredString(deps.resolveModel())
      if (!model) return jsonError('PROVIDER_NOT_CONFIGURED', 'Seedance Model 未配置。', 503)
      const capability = resolveSeedanceCapability({
        model,
        entryPoint: 'ark',
        entitlement: deps.resolveEntitlement(user),
      })
      const source = sourceReferences(retry.package.sourcePackage)
      const previousSegment = receipt.segments.find((segment) => segment.index === retry.segment.index - 1)
      const previousVideoUrl = previousSegment
        ? receipt.segmentResults.find((result) => result.segmentId === previousSegment.id)?.videoUrl
        : undefined
      const direction = requiredString(retry.package.sourcePackage?.direction)
      if (!direction) return jsonError('SEEDANCE_PREVIS_RETRY_CONTEXT_MISSING', '原始预演交付缺少镜头方向，无法安全恢复。', 409)
      const generationJob = await deps.createGenerationJob({
        userId: user.id,
        projectId: body.projectId,
        workflowId: body.workflowId,
        masterTakeId: receipt.masterTakeId,
        segmentId: retry.segment.id,
        prompt: direction,
        model,
        deliveryId,
      })
      if (!generationJob) return jsonError('GENERATION_JOB_CREATE_FAILED', '视频任务创建失败，请稍后重试。', 503)

      let result: SeedanceVideoResult
      try {
        result = await deps.generate({
          prompt: direction,
          imageUrl: source.imageUrl,
          referenceImages: source.referenceImages,
          referenceVideos: previousVideoUrl
            ? [...source.referenceVideos, previousVideoUrl]
            : source.referenceVideos,
          audioReferences: source.audioReferences,
          duration: retry.segment.endSec - retry.segment.startSec,
          aspectRatio: requiredString(retry.package.sourcePackage?.aspectRatio) ?? '16:9',
          resolution: source.resolution,
          continuation: retry.segment.index > 0 && Boolean(previousVideoUrl),
          capability,
          model,
          projectId: body.projectId,
          workflowId: body.workflowId,
        })
      } catch (error) {
        const message = safeErrorMessage(error, 'Seedance 片段恢复请求未能发送。')
        await deps.updateGenerationJob(generationJob.id, { status: 'FAILED', errorMessage: message })
        return jsonError('SEEDANCE_PREVIS_RETRY_DISPATCH_FAILED', message, 502)
      }

      const nextReceipt = recordSegmentResult(receipt, result.success
        ? {
          segmentId: retry.segment.id,
          status: result.async ? 'submitted' : 'succeeded',
          ...(result.async ? { providerTaskId: result.taskId } : { videoUrl: result.videoUrl }),
          generationJobId: generationJob.id,
          ...(result.async ? { submittedAt: new Date().toISOString() } : { completedAt: new Date().toISOString() }),
        }
        : {
          segmentId: retry.segment.id,
          status: 'failed',
          errorCode: result.errorCode,
          errorMessage: result.message,
          generationJobId: generationJob.id,
          completedAt: new Date().toISOString(),
        })
      const nextMetadata = replaceSeedancePrevisDeliveryMetadata(workflow.metadataJson, nextReceipt)
      await deps.updateWorkflowMetadata(workflow.id, nextMetadata)

      if (!result.success) {
        await deps.updateGenerationJob(generationJob.id, {
          status: 'FAILED',
          errorMessage: result.message,
          output: serializable(result),
        })
        return jsonError(result.errorCode, result.message, 502)
      }
      await deps.updateGenerationJob(generationJob.id, {
        status: result.async ? 'QUEUED' : 'SUCCEEDED',
        ...(result.async ? { providerJobId: result.taskId } : {}),
        output: serializable(result),
      })
      return jsonOk({ deliveryId, segmentId: retry.segment.id, result })
    } catch (error) {
      return jsonError('SEEDANCE_PREVIS_RETRY_FAILED', safeErrorMessage(error, '空间预演片段恢复失败。'), 500)
    }
  }
}
