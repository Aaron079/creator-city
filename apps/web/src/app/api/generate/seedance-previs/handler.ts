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
  type SeedancePrevisSegmentReceipt,
  updateSeedancePrevisDeliverySegmentResults,
} from '@/lib/seedance-previs/deliveryPersistence'
import { buildSeedanceTakePackage, type DeliveryMode, type JsonValue } from '@/lib/seedance-previs/package'
import { partitionMasterTake } from '@/lib/seedance-previs/partition'
import { parseSpatialPrevisMetadata } from '@/lib/spatial-previs/persistence'
import { createSpatialPrevisTestTake, type SpatialPrevisTestDuration } from '@/lib/spatial-previs/test-delivery'

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
  nodeId?: string
  testDurationSec?: SpatialPrevisTestDuration
}

type WorkflowRecord = {
  id: string
  projectId: string
  metadataJson: unknown
  updatedAt: Date
}

type RouteUser = { id: string }

type CanvasNodeRecord = {
  kind: string
  status: string
  metadataJson: unknown
}

type GenerationJobInput = {
  userId: string
  projectId: string
  workflowId: string
  masterTakeId: string
  nodeId?: string
  testDurationSec?: SpatialPrevisTestDuration
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
  findCanvasNode: (workflowId: string, nodeId: string) => Promise<CanvasNodeRecord | null>
  updateWorkflowMetadata: (workflowId: string, metadata: Record<string, unknown>) => Promise<void>
  updateWorkflowMetadataIfCurrent: (workflow: WorkflowRecord, metadata: Record<string, unknown>) => Promise<boolean>
  reserveSpatialPrevisTestReceipt: (workflow: WorkflowRecord, metadata: Record<string, unknown>) => Promise<boolean>
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

function isSpatialPrevisTestDuration(value: unknown): value is SpatialPrevisTestDuration {
  return value === 5 || value === 10
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
  const nodeId = optionalString(body.nodeId)
  const testDurationSec = body.testDurationSec === undefined || body.testDurationSec === null
    ? undefined
    : isSpatialPrevisTestDuration(body.testDurationSec) ? body.testDurationSec : null
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
    || nodeId === null
    || testDurationSec === null
    || (testDurationSec !== undefined && !nodeId)
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
    ...(nodeId ? { nodeId } : {}),
    ...(testDurationSec ? { testDurationSec } : {}),
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
    select: { id: true, projectId: true, metadataJson: true, updatedAt: true },
  }),
  findCanvasNode: async (workflowId, nodeId) => db.canvasNode.findUnique({
    where: { workflowId_nodeId: { workflowId, nodeId } },
    select: { kind: true, status: true, metadataJson: true },
  }),
  updateWorkflowMetadata: async (workflowId, metadata) => {
    await db.canvasWorkflow.update({
      where: { id: workflowId },
      data: { metadataJson: metadata as Prisma.InputJsonValue },
    })
  },
  updateWorkflowMetadataIfCurrent: async (workflow, metadata) => {
    const update = await db.canvasWorkflow.updateMany({
      where: {
        id: workflow.id,
        projectId: workflow.projectId,
        updatedAt: workflow.updatedAt,
      },
      data: {
        metadataJson: metadata as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
    return update.count === 1
  },
  reserveSpatialPrevisTestReceipt: async (workflow, metadata) => {
    const reservation = await db.canvasWorkflow.updateMany({
      where: {
        id: workflow.id,
        projectId: workflow.projectId,
        updatedAt: workflow.updatedAt,
      },
      data: {
        metadataJson: metadata as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
    return reservation.count === 1
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
      nodeId: input.nodeId ?? input.masterTakeId,
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
        ...(input.testDurationSec ? { testDurationSec: input.testDurationSec } : {}),
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

function isRunningSpatialPrevisTestNode(node: CanvasNodeRecord | null): boolean {
  if (!node || node.kind !== 'video' || node.status !== 'running') return false
  const metadata = node.metadataJson
  return Boolean(
    metadata
    && typeof metadata === 'object'
    && !Array.isArray(metadata)
    && (metadata as Record<string, unknown>).spatialPrevisTest === true,
  )
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

      if (body.testDurationSec) {
        const testNode = await deps.findCanvasNode(workflow.id, body.nodeId!)
        if (!isRunningSpatialPrevisTestNode(testNode)) {
          return jsonError('SPATIAL_PREVIS_TEST_NODE_INVALID', '三维预演测试节点无效或已变更。', 409)
        }
      }

      let deliveryPrevis = previs
      if (body.testDurationSec) {
        try {
          deliveryPrevis = createSpatialPrevisTestTake(previs, body.testDurationSec)
        } catch {
          return jsonError('VALIDATION_FAILED', '预演测试时长超出主镜头范围。', 400)
        }
      }

      const capability = resolveSeedanceCapability({
        model,
        entryPoint: 'ark',
        entitlement: deps.resolveEntitlement(user),
      })
      const advice = adviseSeedanceDelivery({
        requestedDurationSec: deliveryPrevis.masterTake.durationSec,
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

      const takePackage = buildSeedanceTakePackage({ previs: deliveryPrevis, capability, deliveryMode })
      const chain = deliveryMode === 'continuity-chain'
        ? partitionMasterTake(deliveryPrevis, { maxSegmentSec: 30, userConfirmed: true })
        : null
      const deliveryId = deps.createDeliveryId()
      const segmentResults: SeedancePrevisSegmentReceipt[] = chain
        ? chain.segments.map((segment) => ({
          segmentId: segment.id,
          index: segment.index,
          status: segment.index === 0 ? 'submitting' : 'queued',
        }))
        : [{ segmentId: deliveryPrevis.masterTake.id, index: 0, status: 'submitting' }]
      const persistedPackage = serializable({
        ...takePackage,
        requestedMode: body.requestedMode,
        confirmedMode: body.confirmedMode,
        sourceReferences: {
          imageUrl: body.imageUrl ?? null,
          referenceImages: body.referenceImages,
          referenceVideos: body.referenceVideos,
          audioReferences: body.audioReferences,
          resolution: body.resolution ?? null,
        },
        ...(chain ? { chain } : {}),
        ...(body.testDurationSec ? { internalTest: true, testDurationSec: body.testDurationSec } : {}),
      })
      const nextMetadata = appendSeedancePrevisDeliveryMetadata(workflow.metadataJson, {
        deliveryId,
        masterTakeId: deliveryPrevis.masterTake.id,
        package: persistedPackage,
        capabilitySnapshot: serializable(capability),
        acknowledgements: body.acknowledgedFindingIds,
        segmentResults,
      })
      if (body.testDurationSec) {
        const reserved = await deps.reserveSpatialPrevisTestReceipt(workflow, nextMetadata)
        if (!reserved) {
          return jsonError('SPATIAL_PREVIS_TEST_IN_PROGRESS', '已有三维预演测试正在创建，请稍后重试。', 409)
        }
      } else {
        await deps.updateWorkflowMetadata(workflow.id, nextMetadata)
      }

      const persistSegmentResults = async (results: typeof segmentResults) => {
        if (!body.testDurationSec) {
          const metadata = updateSeedancePrevisDeliverySegmentResults(nextMetadata, deliveryId, results)
          await deps.updateWorkflowMetadata(workflow.id, metadata)
          return
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = await deps.findWorkflow(body.projectId, body.workflowId, user.id)
          if (!current) throw new Error('SPATIAL_PREVIS_TEST_WORKFLOW_NOT_FOUND')
          const metadata = updateSeedancePrevisDeliverySegmentResults(current.metadataJson, deliveryId, results)
          if (await deps.updateWorkflowMetadataIfCurrent(current, metadata)) return true
        }
        return false
      }

      const firstSegment = chain?.segments[0]
      const duration = firstSegment
        ? firstSegment.endSec - firstSegment.startSec
        : takePackage.durationSec
      const prompt = body.prompt ?? takePackage.direction
      const generationJob = await deps.createGenerationJob({
        userId: user.id,
        projectId: body.projectId,
        workflowId: body.workflowId,
        masterTakeId: deliveryPrevis.masterTake.id,
        ...(body.nodeId ? { nodeId: body.nodeId } : {}),
        ...(body.testDurationSec ? { testDurationSec: body.testDurationSec } : {}),
        prompt,
        model,
        deliveryId,
      })
      if (!generationJob) {
        await persistSegmentResults([
          { ...segmentResults[0]!, status: 'failed', errorCode: 'GENERATION_JOB_CREATE_FAILED' },
          ...segmentResults.slice(1),
        ])
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
        const message = body.testDurationSec
          ? '三维预演测试未能提交。'
          : safeErrorMessage(error, 'Seedance 预演请求未能发送。')
        await persistSegmentResults([
          { ...segmentResults[0]!, status: 'failed', errorCode: 'SEEDANCE_PREVIS_DISPATCH_FAILED' },
          ...segmentResults.slice(1),
        ])
        await deps.updateGenerationJob(generationJob.id, { status: 'FAILED', errorMessage: message })
        return jsonError('SEEDANCE_PREVIS_DISPATCH_FAILED', message, 502, { deliveryId })
      }

      if (!result.success) {
        await persistSegmentResults([
          { ...segmentResults[0]!, status: 'failed', errorCode: result.errorCode },
          ...segmentResults.slice(1),
        ])
        await deps.updateGenerationJob(generationJob.id, {
          status: 'FAILED',
          errorMessage: body.testDurationSec ? '三维预演测试未能提交。' : result.message,
          output: serializable(result),
        })
        return jsonError(
          result.errorCode,
          body.testDurationSec ? '三维预演测试未能提交。' : result.message,
          502,
          { deliveryId, requestedMode: body.requestedMode, deliveryMode },
        )
      }
      const completedSegment = result.async
        ? { ...segmentResults[0]!, status: 'submitted', providerTaskId: result.taskId, generationJobId: generationJob.id }
        : { ...segmentResults[0]!, status: 'succeeded', videoUrl: result.videoUrl, generationJobId: generationJob.id }
      const persistedFinalReceipt = await persistSegmentResults([
        completedSegment,
        ...segmentResults.slice(1),
      ])
      await deps.updateGenerationJob(generationJob.id, {
        status: result.async ? 'QUEUED' : 'SUCCEEDED',
        ...(result.async ? { providerJobId: result.taskId } : {}),
        output: serializable(result),
      })
      if (body.testDurationSec && !persistedFinalReceipt) {
        return jsonOk({
          accepted: true,
          status: 'running',
          deliveryId,
          generationJobId: generationJob.id,
          testDurationSec: body.testDurationSec,
        }, { status: 202 })
      }
      return jsonOk({
        deliveryId,
        requestedMode: body.requestedMode,
        deliveryMode,
        segmentCount: segmentResults.length,
        generationJobId: generationJob.id,
        ...(body.testDurationSec ? { testDurationSec: body.testDurationSec } : {}),
        result,
      })
    } catch (error) {
      return jsonError(
        'SEEDANCE_PREVIS_DELIVERY_FAILED',
        body.testDurationSec
          ? '三维预演测试未能提交。'
          : safeErrorMessage(error, '空间预演提交失败。'),
        500,
      )
    }
  }
}

export function createSeedancePrevisGetHandler(overrides: Partial<SeedancePrevisRouteDependencies> = {}) {
  const deps = { ...dependencies, ...overrides }

  return async function GET(request: Request) {
    const user = await deps.getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录后查看空间预演交付能力。', 401)

    const submittedModel = new URL(request.url).searchParams.get('model') ?? 'seedance-2.5'
    const model = requiredString(deps.resolveModel(submittedModel))
    if (!model) return jsonError('PROVIDER_NOT_CONFIGURED', 'Seedance Model 未配置。', 503)

    return jsonOk({
      capability: resolveSeedanceCapability({
        model,
        entryPoint: 'ark',
        entitlement: deps.resolveEntitlement(user),
      }),
    })
  }
}
