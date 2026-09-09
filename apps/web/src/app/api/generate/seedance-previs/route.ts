import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { generateSeedancePrevisVideo, type SeedancePrevisVideoInput, type SeedanceVideoResult } from '@/lib/providers/china/volcengine'
import { adviseSeedanceDelivery } from '@/lib/seedance-previs/advisory'
import { resolveSeedanceCapability, type SeedanceEntitlement } from '@/lib/seedance-previs/capabilities'
import {
  appendSeedancePrevisDeliveryMetadata,
  updateSeedancePrevisDeliverySegmentResults,
} from '@/lib/seedance-previs/deliveryPersistence'
import { buildSeedanceTakePackage, type DeliveryMode, type JsonValue } from '@/lib/seedance-previs/package'
import { partitionMasterTake } from '@/lib/seedance-previs/partition'
import { parseSpatialPrevisMetadata } from '@/lib/spatial-previs/persistence'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type DeliveryBody = {
  projectId: string
  workflowId: string
  model: string
  requestedMode: DeliveryMode
  confirmedMode: DeliveryMode | null
  acknowledgedFindingIds: string[]
  prompt?: string
  imageUrl?: string
  referenceImages: string[]
  referenceVideos: string[]
  audioReferences: string[]
  resolution?: string
}

type WorkflowRecord = {
  id: string
  projectId: string
  metadataJson: unknown
}

type RouteUser = { id: string }

type GenerationJobInput = {
  userId: string
  projectId: string
  workflowId: string
  masterTakeId: string
  prompt: string
  model: string
  deliveryId: string
}

type GenerationJobUpdate = {
  status: 'QUEUED' | 'SUCCEEDED' | 'FAILED'
  providerJobId?: string
  errorMessage?: string
  output?: Record<string, JsonValue>
}

export type SeedancePrevisRouteDependencies = {
  getCurrentUser: () => Promise<RouteUser | null>
  findWorkflow: (projectId: string, workflowId: string, userId: string) => Promise<WorkflowRecord | null>
  updateWorkflowMetadata: (workflowId: string, metadata: Record<string, unknown>) => Promise<void>
  resolveEntitlement: (user: RouteUser) => SeedanceEntitlement
  resolveModel: (submittedModel: string) => string
  platformDispatchEnabled: () => boolean
  createGenerationJob: (input: GenerationJobInput) => Promise<{ id: string } | null>
  updateGenerationJob: (generationJobId: string, update: GenerationJobUpdate) => Promise<void>
  generate: (input: SeedancePrevisVideoInput) => Promise<SeedanceVideoResult>
  createDeliveryId: () => string
}

function isDeliveryMode(value: unknown): value is DeliveryMode {
  return value === 'direct' || value === 'continuity-chain'
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined
  return requiredString(value)
}

function stringArray(value: unknown): string[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const values = value.map(requiredString)
  return values.every((item): item is string => Boolean(item)) ? values : null
}

function parseBody(value: unknown): DeliveryBody | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const projectId = requiredString(body.projectId)
  const workflowId = requiredString(body.workflowId)
  const model = requiredString(body.model)
  const prompt = optionalString(body.prompt)
  const imageUrl = optionalString(body.imageUrl)
  const resolution = optionalString(body.resolution)
  const referenceImages = stringArray(body.referenceImages)
  const referenceVideos = stringArray(body.referenceVideos)
  const audioReferences = stringArray(body.audioReferences)
  const acknowledgedFindingIds = stringArray(body.acknowledgedFindingIds)
  const confirmedMode = body.confirmedMode === null || body.confirmedMode === undefined
    ? null
    : isDeliveryMode(body.confirmedMode) ? body.confirmedMode : null

  if (
    !projectId
    || !workflowId
    || !model
    || !isDeliveryMode(body.requestedMode)
    || (body.confirmedMode !== null && body.confirmedMode !== undefined && !confirmedMode)
    || prompt === null
    || imageUrl === null
    || resolution === null
    || !referenceImages
    || !referenceVideos
    || !audioReferences
    || !acknowledgedFindingIds
    || new Set(acknowledgedFindingIds).size !== acknowledgedFindingIds.length
  ) {
    return null
  }

  return {
    projectId,
    workflowId,
    model,
    requestedMode: body.requestedMode,
    confirmedMode,
    acknowledgedFindingIds,
    ...(prompt ? { prompt } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    referenceImages,
    referenceVideos,
    audioReferences,
    ...(resolution ? { resolution } : {}),
  }
}

function serverEntitlement(user: RouteUser): SeedanceEntitlement {
  const allowlist = (process.env.SEEDANCE_LONG_TAKE_BETA_USER_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return allowlist.includes(user.id) ? 'long-take-beta' : 'standard'
}

const dependencies: SeedancePrevisRouteDependencies = {
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
  resolveModel: (submittedModel) => process.env.VOLCENGINE_SEEDANCE_MODEL?.trim() || submittedModel,
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
  createDeliveryId: () => `seedance-previs-${randomUUID()}`,
}

function selectedMode(body: DeliveryBody): DeliveryMode {
  return body.confirmedMode ?? body.requestedMode
}

function serializable(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Record<string, JsonValue>
}

export function createSeedancePrevisPostHandler(overrides: Partial<SeedancePrevisRouteDependencies> = {}) {
  const deps = { ...dependencies, ...overrides }

  return async function POST(request: Request) {
    const user = await deps.getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录后再提交空间预演。', 401)
    if (!deps.platformDispatchEnabled()) {
      return jsonError(
        'VIDEO_GENERATION_NOT_READY',
        '空间预演的平台视频生成尚未开放。请联系管理员开启受控交付权限。',
        403,
      )
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonError('VALIDATION_FAILED', '请求数据不是有效 JSON。', 400)
    }
    const body = parseBody(rawBody)
    if (!body) return jsonError('VALIDATION_FAILED', '空间预演提交参数无效。', 400)
    const model = requiredString(deps.resolveModel(body.model))
    if (!model) return jsonError('PROVIDER_NOT_CONFIGURED', 'Seedance Model 未配置。', 503)

    try {
      const workflow = await deps.findWorkflow(body.projectId, body.workflowId, user.id)
      if (!workflow) return jsonError('PROJECT_OR_WORKFLOW_NOT_FOUND', '项目或画布不存在，或没有写入权限。', 404)

      const previs = parseSpatialPrevisMetadata(workflow.metadataJson)
      if (!previs || previs.projectId !== workflow.projectId) {
        return jsonError('SPATIAL_PREVIS_NOT_FOUND', '请先保存有效的空间预演，再生成到 Seedance。', 400)
      }

      const capability = resolveSeedanceCapability({
        model,
        entryPoint: 'ark',
        entitlement: deps.resolveEntitlement(user),
      })
      const advice = adviseSeedanceDelivery({
        requestedDurationSec: previs.masterTake.durationSec,
        capability,
        coverageFindings: [],
      })
      const deliveryMode = selectedMode(body)
      if (body.requestedMode === 'continuity-chain' && body.confirmedMode !== 'continuity-chain') {
        return jsonError('CHAIN_CONFIRMATION_REQUIRED', '请明确确认 30 秒连续组接后再提交。', 400)
      }
      if (deliveryMode === 'continuity-chain') {
        const missingAcknowledgements = advice.findings
          .filter((finding) => !body.acknowledgedFindingIds.includes(finding.id))
          .map((finding) => finding.id)
        if (missingAcknowledgements.length) {
          return jsonError('CHAIN_ACKNOWLEDGEMENT_REQUIRED', '请确认连续组接提示后再提交。', 400, { missingAcknowledgements })
        }
      }

      const takePackage = buildSeedanceTakePackage({ previs, capability, deliveryMode })
      const chain = deliveryMode === 'continuity-chain'
        ? partitionMasterTake(previs, { maxSegmentSec: 30, userConfirmed: true })
        : null
      const deliveryId = deps.createDeliveryId()
      const segmentResults = chain
        ? chain.segments.map((segment) => ({
          segmentId: segment.id,
          index: segment.index,
          status: segment.index === 0 ? 'submitting' : 'queued',
        }))
        : [{ segmentId: previs.masterTake.id, index: 0, status: 'submitting' }]
      const persistedPackage = serializable({
        ...takePackage,
        requestedMode: body.requestedMode,
        confirmedMode: body.confirmedMode,
        ...(chain ? { chain } : {}),
      })
      const nextMetadata = appendSeedancePrevisDeliveryMetadata(workflow.metadataJson, {
        deliveryId,
        masterTakeId: previs.masterTake.id,
        package: persistedPackage,
        capabilitySnapshot: serializable(capability),
        acknowledgements: body.acknowledgedFindingIds,
        segmentResults,
      })
      await deps.updateWorkflowMetadata(workflow.id, nextMetadata)

      const firstSegment = chain?.segments[0]
      const duration = firstSegment
        ? firstSegment.endSec - firstSegment.startSec
        : takePackage.durationSec
      const prompt = body.prompt ?? takePackage.direction
      const generationJob = await deps.createGenerationJob({
        userId: user.id,
        projectId: body.projectId,
        workflowId: body.workflowId,
        masterTakeId: previs.masterTake.id,
        prompt,
        model,
        deliveryId,
      })
      if (!generationJob) {
        const failedMetadata = updateSeedancePrevisDeliverySegmentResults(nextMetadata, deliveryId, [
          { ...segmentResults[0]!, status: 'failed', errorCode: 'GENERATION_JOB_CREATE_FAILED' },
          ...segmentResults.slice(1),
        ])
        await deps.updateWorkflowMetadata(workflow.id, failedMetadata)
        return jsonError('GENERATION_JOB_CREATE_FAILED', '视频任务创建失败，请稍后重试。', 503, { deliveryId })
      }

      let result: SeedanceVideoResult
      try {
        result = await deps.generate({
          prompt,
        imageUrl: body.imageUrl,
        referenceImages: body.referenceImages,
        referenceVideos: body.referenceVideos,
        audioReferences: body.audioReferences,
        duration,
        aspectRatio: takePackage.aspectRatio,
        resolution: body.resolution,
        continuation: Boolean(chain && chain.segments.length > 1),
        capability,
        model,
        projectId: body.projectId,
        workflowId: body.workflowId,
        })
      } catch (error) {
        const message = safeErrorMessage(error, 'Seedance 预演请求未能发送。')
        const failedMetadata = updateSeedancePrevisDeliverySegmentResults(nextMetadata, deliveryId, [
          { ...segmentResults[0]!, status: 'failed', errorCode: 'SEEDANCE_PREVIS_DISPATCH_FAILED' },
          ...segmentResults.slice(1),
        ])
        await deps.updateWorkflowMetadata(workflow.id, failedMetadata)
        await deps.updateGenerationJob(generationJob.id, { status: 'FAILED', errorMessage: message })
        return jsonError('SEEDANCE_PREVIS_DISPATCH_FAILED', message, 502, { deliveryId })
      }

      if (!result.success) {
        const failedMetadata = updateSeedancePrevisDeliverySegmentResults(nextMetadata, deliveryId, [
          { ...segmentResults[0]!, status: 'failed', errorCode: result.errorCode },
          ...segmentResults.slice(1),
        ])
        await deps.updateWorkflowMetadata(workflow.id, failedMetadata)
        await deps.updateGenerationJob(generationJob.id, {
          status: 'FAILED',
          errorMessage: result.message,
          output: serializable(result),
        })
        return jsonError(result.errorCode, result.message, 502, { deliveryId, requestedMode: body.requestedMode, deliveryMode })
      }
      const completedSegment = result.async
        ? { ...segmentResults[0]!, status: 'submitted', providerTaskId: result.taskId, generationJobId: generationJob.id }
        : { ...segmentResults[0]!, status: 'succeeded', videoUrl: result.videoUrl, generationJobId: generationJob.id }
      const completedMetadata = updateSeedancePrevisDeliverySegmentResults(nextMetadata, deliveryId, [
        completedSegment,
        ...segmentResults.slice(1),
      ])
      await deps.updateWorkflowMetadata(workflow.id, completedMetadata)
      await deps.updateGenerationJob(generationJob.id, {
        status: result.async ? 'QUEUED' : 'SUCCEEDED',
        ...(result.async ? { providerJobId: result.taskId } : {}),
        output: serializable(result),
      })
      return jsonOk({
        deliveryId,
        requestedMode: body.requestedMode,
        deliveryMode,
        segmentCount: segmentResults.length,
        result,
      })
    } catch (error) {
      return jsonError('SEEDANCE_PREVIS_DELIVERY_FAILED', safeErrorMessage(error, '空间预演提交失败。'), 500)
    }
  }
}

export const POST = createSeedancePrevisPostHandler()
