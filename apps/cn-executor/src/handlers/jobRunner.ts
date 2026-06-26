import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { readBody, executeImageGeneration } from './generateImage'
import type { ImageExecutionInput } from './generateImage'
import { jsonError, jsonOk, jsonUnauthorized } from '../response'
import { query, writeQuery } from '../db'

// cn-executor only executes cn providers. This set mirrors the runtimeProviderIds
// from apps/web/src/lib/regions/registry.ts for all cn-region adapters.
const CN_PROVIDER_IDS = new Set([
  'volcengine-seedream-image', 'volcengine_seedream',
  'volcengine-seedance-video', 'volcengine_seedance',
  'jimeng', 'jimeng-image', 'jimeng-video',
  'deepseek', 'deepseek-chat', 'deepseek-v3', 'deepseek-r1', 'deepseek-text',
])

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

type GenerationJobRow = {
  id: string
  userId: string
  projectId: string | null
  nodeId: string | null
  providerId: string
  status: string
  prompt: string
  input: Record<string, unknown> | null
}

type ImageJobResult = {
  ok: boolean
  status: 'succeeded' | 'failed' | 'skipped'
  generationJobId: string
  resultImageUrl?: string | null
  stableUrl?: string | null
  assetId?: string
  model?: string | null
  errorCode?: string
  errorStage?: string
  message?: string
  submittedInput?: Record<string, unknown> | null
  upstreamMessage?: unknown
  upstreamStatus?: unknown
  requestId?: unknown
  providerResponse?: unknown
  providerRegion?: string
  executionRegion?: string
  storageRegion?: string
  executorKind?: string
  stageTrace?: Array<{ stage: string; ok: boolean; durationMs: number; providerHttpStatus?: number }>
}

async function fetchJob(generationJobId: string): Promise<GenerationJobRow | null> {
  const rows = await query<GenerationJobRow>(
    `SELECT id, "userId", "projectId", "nodeId", "providerId", status, prompt, input
     FROM "GenerationJob" WHERE id = $1 LIMIT 1`,
    [generationJobId],
  )
  return rows[0] ?? null
}

async function markJobProcessing(generationJobId: string, inputJson: Record<string, unknown>): Promise<void> {
  try {
    const rowCount = await writeQuery(
      `UPDATE "GenerationJob"
       SET status = 'PROCESSING', input = $1::jsonb, "updatedAt" = NOW()
       WHERE id = $2`,
      [JSON.stringify(inputJson), generationJobId],
    )
    if (rowCount === 0) {
      console.warn('[cn-executor][db] markJobProcessing: 0 rows updated — RLS may be blocking writes', { id: generationJobId })
    }
    return
  } catch (fullErr) {
    console.error('[cn-executor][db] markJobProcessing failed, trying minimal', {
      id: generationJobId,
      error: fullErr instanceof Error ? fullErr.message : String(fullErr),
    })
  }
  const fallbackCount = await writeQuery(
    `UPDATE "GenerationJob" SET status = 'PROCESSING', "updatedAt" = NOW() WHERE id = $1`,
    [generationJobId],
  )
  if (fallbackCount === 0) {
    console.warn('[cn-executor][db] markJobProcessing minimal fallback: 0 rows updated — RLS may be blocking writes', { id: generationJobId })
  }
}

async function markJobSucceeded(args: {
  id: string
  outputAssetId: string
  output: Record<string, unknown>
}): Promise<void> {
  try {
    const rowCount = await writeQuery(
      `UPDATE "GenerationJob"
       SET status = 'SUCCEEDED', "outputAssetId" = $1, output = $2::jsonb,
           "completedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $3`,
      [args.outputAssetId, JSON.stringify(args.output), args.id],
    )
    if (rowCount === 0) {
      console.warn('[cn-executor][db] markJobSucceeded: 0 rows updated — RLS may be blocking writes', { id: args.id })
    }
    return
  } catch (fullErr) {
    console.error('[cn-executor][db] markJobSucceeded full update failed, trying minimal', {
      id: args.id,
      error: fullErr instanceof Error ? fullErr.message : String(fullErr),
    })
  }
  const fallbackCount = await writeQuery(
    `UPDATE "GenerationJob" SET status = 'SUCCEEDED', "updatedAt" = NOW() WHERE id = $1`,
    [args.id],
  )
  if (fallbackCount === 0) {
    console.warn('[cn-executor][db] markJobSucceeded minimal fallback: 0 rows updated — RLS may be blocking writes', { id: args.id })
  }
}

async function markJobFailed(args: {
  id: string
  errorCode: string
  message: string
  output: Record<string, unknown>
}): Promise<void> {
  // Try full update with all optional columns first. If it fails (column missing in
  // production DB or write-replica), fall back to minimal status-only update.
  try {
    const rowCount = await writeQuery(
      `UPDATE "GenerationJob"
       SET status = 'FAILED', error = $1, "errorMessage" = $2, output = $3::jsonb,
           "completedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $4`,
      [args.message, args.message.slice(0, 1000), JSON.stringify(args.output), args.id],
    )
    if (rowCount === 0) {
      console.warn('[cn-executor][db] markJobFailed: 0 rows updated — RLS may be blocking writes', { id: args.id })
    }
    return
  } catch (fullErr) {
    console.error('[cn-executor][db] markJobFailed full update failed, trying minimal', {
      id: args.id,
      error: fullErr instanceof Error ? fullErr.message : String(fullErr),
    })
  }
  // Minimal fallback — only status and updatedAt
  const fallbackCount = await writeQuery(
    `UPDATE "GenerationJob" SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
    [args.id],
  )
  if (fallbackCount === 0) {
    console.warn('[cn-executor][db] markJobFailed minimal fallback: 0 rows updated — RLS may be blocking writes', { id: args.id })
  }
}

async function createAsset(args: {
  id: string
  ownerId: string
  projectId: string | null
  workflowId: string | null
  nodeId: string | null
  url: string
  originalUrl: string | null
  storageKey: string | null
  generationJobId: string
  prompt: string
  providerId: string
  metadataJson: Record<string, unknown>
}): Promise<void> {
  await writeQuery(
    `INSERT INTO "Asset" (
       id, name, title, type, status,
       "ownerId", "projectId", "workflowId", "nodeId",
       source, provider, "providerId", "storageProvider", bucket, "storageKey",
       url, "originalUrl", "thumbnailUrl", filename, "mimeType",
       prompt, metadata, "metadataJson", "generationJobId",
       "recoveryStatus", tags, "isPublic", "sizeBytes", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, '生成图片', 'IMAGE', 'READY',
       $3, $4, $5, $6,
       'generated', $7, $7, 'aliyun-oss', $8, $9,
       $10, $11, $10, $12, 'image/png',
       $13, '{}', $14::jsonb, $15,
       'ready', '{}', false, 0, NOW(), NOW()
     )`,
    [
      args.id,
      `generated-image-${Date.now()}.png`,
      args.ownerId,
      args.projectId,
      args.workflowId,
      args.nodeId,
      args.providerId,
      process.env.ALIYUN_OSS_BUCKET ?? '',
      args.storageKey,
      args.url,
      args.originalUrl,
      `generated-image-${args.generationJobId}.png`,
      args.prompt.slice(0, 2000),
      JSON.stringify(args.metadataJson),
      args.generationJobId,
    ],
  )
}

async function updateCanvasNode(args: {
  workflowId: string
  nodeId: string
  imageUrl: string
  assetId: string
  generationJobId: string
  model: string | null
  storageKey: string | null
  providerOriginalUrl: string | null
  submittedInput: Record<string, unknown> | null
}): Promise<void> {
  const rows = await query<{ id: string; metadataJson: unknown }>(
    `SELECT id, "metadataJson" FROM "CanvasNode"
     WHERE "workflowId" = $1 AND "nodeId" = $2 LIMIT 1`,
    [args.workflowId, args.nodeId],
  )
  const node = rows[0]
  if (!node) return

  const existing = (
    node.metadataJson && typeof node.metadataJson === 'object' && !Array.isArray(node.metadataJson)
      ? node.metadataJson
      : {}
  ) as Record<string, unknown>

  const newMeta: Record<string, unknown> = {
    ...existing,
    assetId: args.assetId,
    outputAssetId: args.assetId,
    generationJobId: args.generationJobId,
    assetUrl: args.imageUrl,
    stableUrl: args.imageUrl,
    resolvedUrl: args.imageUrl,
    resultImageUrl: args.imageUrl,
    model: args.model ?? existing.model,
    providerOriginalUrl: args.providerOriginalUrl ?? existing.providerOriginalUrl,
    storageKey: args.storageKey,
    storageRegion: 'cn',
    executionRegion: 'cn',
    sourceProviderRegion: 'cn',
    providerRegion: 'cn',
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
    submittedInput: args.submittedInput ?? existing.submittedInput,
    mediaPersistence: {
      status: 'persisted',
      persistenceStatus: 'persistence_success',
      assetId: args.assetId,
      outputAssetId: args.assetId,
      stableUrl: args.imageUrl,
      resolvedUrl: args.imageUrl,
      storageProvider: 'aliyun-oss',
      storageKey: args.storageKey,
    },
    generationJob: {
      ...(typeof existing.generationJob === 'object' && existing.generationJob !== null && !Array.isArray(existing.generationJob)
        ? existing.generationJob
        : {}),
      id: args.generationJobId,
      outputAssetId: args.assetId,
    },
  }

  const rowCount = await writeQuery(
    `UPDATE "CanvasNode"
     SET status = 'done',
         "resultImageUrl" = $1,
         "resultPreview" = '图片已生成',
         "errorMessage" = NULL,
         "metadataJson" = $2::jsonb,
         "updatedAt" = NOW()
     WHERE id = $3`,
    [args.imageUrl, JSON.stringify(newMeta), node.id],
  )
  if (rowCount === 0) {
    console.warn('[cn-executor][db] updateCanvasNode: 0 rows updated — RLS may be blocking writes', {
      workflowId: args.workflowId, nodeId: args.nodeId,
    })
  }
}

export async function handleRunImageJob(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonUnauthorized(res)
    return
  }

  let body: Record<string, unknown> = {}
  try {
    const raw = await readBody(req)
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    jsonError(res, { errorCode: 'invalid_request', message: 'Request body must be valid JSON.' }, 400)
    return
  }

  const generationJobId = typeof body.generationJobId === 'string' ? body.generationJobId.trim() : ''
  if (!generationJobId) {
    jsonError(res, { errorCode: 'invalid_request', message: 'generationJobId is required.' }, 400)
    return
  }

  // BYOK: optional user credential passed via HTTPS trigger body — never logged, never stored to DB.
  const userCredential = (() => {
    const cred = body.userCredential
    if (!cred || typeof cred !== 'object' || Array.isArray(cred)) return null
    const c = cred as Record<string, unknown>
    const apiKey = typeof c.apiKey === 'string' ? c.apiKey.trim() : ''
    const endpointId = typeof c.endpointId === 'string' ? c.endpointId.trim() : ''
    return apiKey && endpointId ? { apiKey, endpointId } : null
  })()

  console.log('[cn-executor][jobRunner] received job, executing synchronously', {
    generationJobId,
    hasByokCredential: userCredential !== null,
  })

  let result: ImageJobResult
  try {
    result = await runImageJob(generationJobId, userCredential)
  } catch (err) {
    result = {
      ok: false,
      status: 'failed',
      generationJobId,
      errorCode: 'job_execution_error',
      message: err instanceof Error ? err.message : String(err),
    }
  }

  // Always respond 200 so Vercel can read the JSON body regardless of outcome
  jsonOk(res, result)
}

async function runImageJob(
  generationJobId: string,
  userCredential?: { apiKey: string; endpointId: string } | null,
): Promise<ImageJobResult> {
  console.log('[cn-executor][jobRunner] starting job', { generationJobId })

  let job: GenerationJobRow | null
  try {
    job = await fetchJob(generationJobId)
  } catch (err) {
    console.error('[cn-executor][jobRunner] failed to fetch job from DB', {
      generationJobId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, status: 'failed', generationJobId, errorCode: 'db_error', message: err instanceof Error ? err.message : String(err) }
  }

  if (!job) {
    console.error('[cn-executor][jobRunner] job not found', { generationJobId })
    return { ok: false, status: 'failed', generationJobId, errorCode: 'job_not_found', message: `Job ${generationJobId} not found in DB.` }
  }

  if (job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELED') {
    console.warn('[cn-executor][jobRunner] job already in terminal state, skipping', {
      generationJobId,
      status: job.status,
    })
    return { ok: true, status: 'skipped', generationJobId, message: `Job already in terminal state: ${job.status}` }
  }

  // Region isolation: cn-executor must only execute cn providers.
  const input = job.input ?? {}
  const jobProviderRegion = typeof input.providerRegion === 'string' ? input.providerRegion : null
  if (jobProviderRegion === 'global' || (!jobProviderRegion && !CN_PROVIDER_IDS.has(job.providerId))) {
    const errMsg = `cn-executor received a job for non-cn provider [${job.providerId}] (providerRegion=${jobProviderRegion ?? 'unknown'}). This is a routing error.`
    console.error('[cn-executor][jobRunner] provider_region_mismatch', { generationJobId, providerId: job.providerId, jobProviderRegion })
    await markJobFailed({
      id: generationJobId,
      errorCode: 'provider_region_mismatch',
      message: errMsg,
      output: { errorCode: 'provider_region_mismatch', message: errMsg, providerId: job.providerId, jobProviderRegion },
    }).catch(() => {/* best-effort */})
    return { ok: false, status: 'failed', generationJobId, errorCode: 'provider_region_mismatch', message: errMsg }
  }

  const workflowId = typeof input.workflowId === 'string' ? input.workflowId : ''
  const nodeId = job.nodeId ?? (typeof input.nodeId === 'string' ? input.nodeId : '')
  const projectId = job.projectId ?? (typeof input.projectId === 'string' ? input.projectId : null)
  const model = typeof input.model === 'string' ? input.model : null
  const aspectRatio = typeof input.aspectRatio === 'string' ? input.aspectRatio : undefined
  const submittedInput =
    input.submittedInput && typeof input.submittedInput === 'object' && !Array.isArray(input.submittedInput)
      ? (input.submittedInput as Record<string, unknown>)
      : null
  // Read reference images from job input — validated server-side before storage
  const rawRefImages = Array.isArray(input.referenceImages) ? input.referenceImages : []
  const referenceImages = rawRefImages
    .filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u))
    .slice(0, 1)

  const execInput: ImageExecutionInput = {
    prompt: job.prompt,
    model: model ?? undefined,
    providerId: job.providerId,
    aspectRatio,
    projectId: projectId ?? undefined,
    nodeId: nodeId || undefined,
    ...(referenceImages.length > 0 ? { referenceImages } : {}),
    // BYOK: inject user credentials if provided — never log these values
    ...(userCredential ? { apiKeyOverride: userCredential.apiKey, endpointOverride: userCredential.endpointId } : {}),
  }

  try {
    await markJobProcessing(generationJobId, {
      ...input,
      processingStartedAt: new Date().toISOString(),
    })
    console.log('[cn-executor][jobRunner] marked PROCESSING', { generationJobId })
  } catch (err) {
    console.error('[cn-executor][jobRunner] FAILED to mark job PROCESSING — DB write error, continuing anyway', {
      generationJobId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  console.log('[cn-executor][jobRunner] starting executeImageGeneration', { generationJobId, providerId: job.providerId, aspectRatio: execInput.aspectRatio })
  const t0 = Date.now()
  let result
  try {
    result = await executeImageGeneration(execInput)
  } catch (err) {
    result = {
      success: false as const,
      errorCode: 'cn_executor_image_task_failed',
      message: err instanceof Error ? err.message : 'Unexpected error during image generation.',
    }
  }
  const execMs = Date.now() - t0
  console.log('[cn-executor][jobRunner] executeImageGeneration done', { generationJobId, success: result.success, execMs })

  if (!result.success) {
    const errCode = result.errorCode ?? 'image_generation_failed'
    const errMsg = result.message ?? 'Image generation failed.'
    const errorOutput: Record<string, unknown> = {
      errorCode: errCode,
      errorStage: result.errorStage,
      message: errMsg,
      providerRegion: 'cn',
      executionRegion: 'cn',
      storageRegion: 'cn',
      executorKind: 'aliyun_fc',
      submittedInput,
      stageTrace: result.stageTrace,
    }
    if ('upstreamMessage' in result) errorOutput.upstreamMessage = result.upstreamMessage
    if ('upstreamStatus' in result) errorOutput.upstreamStatus = result.upstreamStatus
    if ('providerEndpoint' in result) errorOutput.providerEndpoint = result.providerEndpoint
    if ('providerHttpStatus' in result) errorOutput.providerHttpStatus = result.providerHttpStatus
    if ('requestId' in result) errorOutput.requestId = result.requestId
    if ('providerResponse' in result) errorOutput.providerResponse = result.providerResponse
    if ('ossBucket' in result) errorOutput.ossBucket = result.ossBucket
    if ('ossRegion' in result) errorOutput.ossRegion = result.ossRegion
    if ('ossEndpoint' in result) errorOutput.ossEndpoint = result.ossEndpoint
    if ('ossErrorCode' in result) errorOutput.ossErrorCode = result.ossErrorCode
    if ('ossStatusCode' in result) errorOutput.ossStatusCode = result.ossStatusCode
    if ('ossRequestId' in result) errorOutput.ossRequestId = result.ossRequestId

    console.error('[cn-executor][jobRunner] job failed, writing FAILED to DB', { generationJobId, errorCode: errCode, errorStage: result.errorStage, message: errMsg.slice(0, 300), stageTrace: result.stageTrace })
    try {
      await markJobFailed({ id: generationJobId, errorCode: errCode, message: errMsg, output: errorOutput })
      console.log('[cn-executor][jobRunner] FAILED written to DB', { generationJobId })
    } catch (dbErr) {
      console.error('[cn-executor][jobRunner] CRITICAL: failed to write FAILED to DB', {
        generationJobId,
        dbError: dbErr instanceof Error ? dbErr.message : String(dbErr),
        originalError: errCode,
      })
    }
    return {
      ok: false,
      status: 'failed',
      generationJobId,
      errorCode: errCode,
      errorStage: result.errorStage,
      message: errMsg,
      submittedInput,
      upstreamMessage: 'upstreamMessage' in result ? result.upstreamMessage : undefined,
      upstreamStatus: 'upstreamStatus' in result ? result.upstreamStatus : undefined,
      requestId: 'requestId' in result ? result.requestId : undefined,
      providerResponse: 'providerResponse' in result ? result.providerResponse : undefined,
      stageTrace: result.stageTrace,
    }
  }

  const resultImageUrl = result.resultImageUrl ?? ''
  const storageKey =
    result.asset && typeof result.asset.storageKey === 'string' ? result.asset.storageKey : null
  const providerOriginalUrl = result.providerOriginalUrl ?? null
  const modelUsed = result.model ?? null

  console.log('[cn-executor][jobRunner] image generation OK, creating Asset', { generationJobId, resultImageUrl: resultImageUrl.slice(0, 80), hasStorageKey: Boolean(storageKey) })

  const assetId = uuid()
  const assetMetadata: Record<string, unknown> = {
    model: modelUsed,
    generationJobId,
    providerOriginalUrl,
    stableUrl: resultImageUrl,
    resolvedUrl: resultImageUrl,
    storageKey,
    storageRegion: 'cn',
    sourceProviderRegion: 'cn',
    executionRegion: 'cn',
    executorKind: 'aliyun_fc',
    submittedInput,
    providerResponse: result.providerResponse,
  }

  try {
    await createAsset({
      id: assetId,
      ownerId: job.userId,
      projectId,
      workflowId: workflowId || null,
      nodeId: nodeId || null,
      url: resultImageUrl,
      originalUrl: providerOriginalUrl,
      storageKey,
      generationJobId,
      prompt: job.prompt,
      providerId: job.providerId,
      metadataJson: assetMetadata,
    })
    console.log('[cn-executor][jobRunner] Asset created in DB', { generationJobId, assetId })
  } catch (err) {
    console.error('[cn-executor][jobRunner] failed to create Asset in DB — continuing to mark SUCCEEDED', {
      generationJobId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const successOutput: Record<string, unknown> = {
    resultImageUrl,
    stableUrl: resultImageUrl,
    assetId,
    outputAssetId: assetId,
    storageKey,
    storageProvider: 'aliyun-oss',
    storageRegion: 'cn',
    executionRegion: 'cn',
    providerRegion: 'cn',
    executorKind: 'aliyun_fc',
    model: modelUsed,
    submittedInput,
    providerResponse: result.providerResponse,
    stageTrace: result.stageTrace,
  }

  console.log('[cn-executor][jobRunner] writing SUCCEEDED to DB', { generationJobId, assetId })
  try {
    await markJobSucceeded({ id: generationJobId, outputAssetId: assetId, output: successOutput })
    console.log('[cn-executor][jobRunner] SUCCEEDED written to DB', { generationJobId })
  } catch (err) {
    console.error('[cn-executor][jobRunner] CRITICAL: failed to write SUCCEEDED to DB', {
      generationJobId,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      status: 'failed',
      generationJobId,
      errorCode: 'db_write_failed',
      message: `Image generated but failed to save result to DB: ${err instanceof Error ? err.message : String(err)}`,
      resultImageUrl,
      model: modelUsed,
    }
  }

  if (workflowId && nodeId) {
    console.log('[cn-executor][jobRunner] updating CanvasNode', { generationJobId, workflowId, nodeId })
    try {
      await updateCanvasNode({
        workflowId,
        nodeId,
        imageUrl: resultImageUrl,
        assetId,
        generationJobId,
        model: modelUsed,
        storageKey,
        providerOriginalUrl,
        submittedInput,
      })
      console.log('[cn-executor][jobRunner] CanvasNode updated', { generationJobId })
    } catch (err) {
      console.error('[cn-executor][jobRunner] failed to update CanvasNode — job still SUCCEEDED', {
        generationJobId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('[cn-executor][jobRunner] job completed successfully', {
    generationJobId,
    assetId,
    resultImageUrl: resultImageUrl.slice(0, 80),
  })

  return {
    ok: true,
    status: 'succeeded',
    generationJobId,
    resultImageUrl,
    stableUrl: resultImageUrl,
    assetId,
    model: modelUsed,
    submittedInput,
    storageRegion: 'cn',
    executionRegion: 'cn',
    providerRegion: 'cn',
    executorKind: 'aliyun_fc',
    stageTrace: result.stageTrace,
  }
}
