import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { readBody } from './generateImage'
import { jsonError, jsonOk, jsonUnauthorized } from '../response'
import { query, writeQuery } from '../db'
import { submitSeedanceTask, pollSeedanceTaskUntilDone, buildVideoOssKey, downloadVideoBuffer } from '../seedance'
import { uploadToOss } from '../oss'

// cn-executor only executes cn providers. Mirrors registry.ts cn runtimeProviderIds.
const CN_PROVIDER_IDS = new Set([
  'volcengine-seedance-video', 'volcengine_seedance',
  'volcengine-seedream-image', 'volcengine_seedream',
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

type VideoJobRow = {
  id: string
  userId: string
  projectId: string | null
  nodeId: string | null
  providerId: string
  status: string
  prompt: string
  input: Record<string, unknown> | null
}

async function fetchJob(generationJobId: string): Promise<VideoJobRow | null> {
  const rows = await query<VideoJobRow>(
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

async function storeProviderTaskId(generationJobId: string, taskId: string): Promise<void> {
  await writeQuery(
    `UPDATE "GenerationJob"
     SET "providerJobId" = $1, "updatedAt" = NOW()
     WHERE id = $2`,
    [taskId, generationJobId],
  ).catch((err: unknown) => {
    console.warn('[cn-executor][videoJobRunner] failed to store providerJobId', {
      generationJobId, taskId, error: err instanceof Error ? err.message : String(err),
    })
  })
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
  const fallbackCount = await writeQuery(
    `UPDATE "GenerationJob" SET status = 'FAILED', "updatedAt" = NOW() WHERE id = $1`,
    [args.id],
  )
  if (fallbackCount === 0) {
    console.warn('[cn-executor][db] markJobFailed minimal fallback: 0 rows updated — RLS may be blocking writes', { id: args.id })
  }
}

async function createVideoAsset(args: {
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
       $1, $2, '生成视频', 'VIDEO', 'READY',
       $3, $4, $5, $6,
       'generated', $7, $7, 'aliyun_oss', $8, $9,
       $10, $11, NULL, $12, 'video/mp4',
       $13, '{}', $14::jsonb, $15,
       'ready', '{}', false, 0, NOW(), NOW()
     )`,
    [
      args.id,
      `generated-video-${Date.now()}.mp4`,
      args.ownerId,
      args.projectId,
      args.workflowId,
      args.nodeId,
      args.providerId,
      process.env.ALIYUN_OSS_BUCKET ?? '',
      args.storageKey,
      args.url,
      args.originalUrl,
      `generated-video-${args.generationJobId}.mp4`,
      args.prompt.slice(0, 2000),
      JSON.stringify(args.metadataJson),
      args.generationJobId,
    ],
  )
}

async function updateCanvasNodeForVideo(args: {
  workflowId: string
  nodeId: string
  videoUrl: string
  assetId: string
  generationJobId: string
  model: string | null
  taskId: string | null
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
    providerId: 'volcengine-seedance-video',
    assetId: args.assetId,
    outputAssetId: args.assetId,
    generationJobId: args.generationJobId,
    taskId: args.taskId ?? existing.taskId,
    assetUrl: args.videoUrl,
    stableUrl: args.videoUrl,
    resolvedUrl: args.videoUrl,
    resultVideoUrl: args.videoUrl,
    model: args.model ?? existing.model,
    providerOriginalUrl: args.providerOriginalUrl ?? existing.providerOriginalUrl,
    originalProviderVideoUrl: args.providerOriginalUrl ?? existing.originalProviderVideoUrl,
    temporaryUrl: args.providerOriginalUrl ?? existing.temporaryUrl,
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
      stableUrl: args.videoUrl,
      resolvedUrl: args.videoUrl,
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
         "resultVideoUrl" = $1,
         "resultPreview" = '视频已生成',
         "errorMessage" = NULL,
         "metadataJson" = $2::jsonb,
         "updatedAt" = NOW()
     WHERE id = $3`,
    [args.videoUrl, JSON.stringify(newMeta), node.id],
  )
  if (rowCount === 0) {
    console.warn('[cn-executor][db] updateCanvasNodeForVideo: 0 rows updated — RLS may be blocking writes', {
      workflowId: args.workflowId, nodeId: args.nodeId,
    })
  }
}

export async function handleRunVideoJob(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  // Run synchronously — keeps Aliyun FC alive for the full job duration.
  // Caller (Vercel) uses fire-and-forget with an 8s timeout; the HTTP response
  // may not be received by Vercel, but the job runs to completion on FC.
  try {
    await runVideoJob(generationJobId)
  } catch (err) {
    console.error('[cn-executor][videoJobRunner] unhandled error in runVideoJob', {
      generationJobId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Best-effort response — Vercel caller may have already timed out.
  try {
    jsonOk(res, { success: true, message: 'Video job completed.', generationJobId })
  } catch {
    // Client disconnected — normal for fire-and-forget pattern.
  }
}

async function runVideoJob(generationJobId: string): Promise<void> {
  console.log('[cn-executor][videoJobRunner] starting job', { generationJobId })

  let job: VideoJobRow | null
  try {
    job = await fetchJob(generationJobId)
  } catch (err) {
    console.error('[cn-executor][videoJobRunner] failed to fetch job from DB', {
      generationJobId, error: err instanceof Error ? err.message : String(err),
    })
    return
  }

  if (!job) {
    console.error('[cn-executor][videoJobRunner] job not found', { generationJobId })
    return
  }

  if (job.status === 'SUCCEEDED' || job.status === 'FAILED' || job.status === 'CANCELED') {
    console.warn('[cn-executor][videoJobRunner] job already in terminal state, skipping', {
      generationJobId, status: job.status,
    })
    return
  }

  // Region isolation: cn-executor must only execute cn providers.
  const input = job.input ?? {}
  const jobProviderRegion = typeof input.providerRegion === 'string' ? input.providerRegion : null
  if (jobProviderRegion === 'global' || (!jobProviderRegion && !CN_PROVIDER_IDS.has(job.providerId))) {
    const errMsg = `cn-executor received a video job for non-cn provider [${job.providerId}] (providerRegion=${jobProviderRegion ?? 'unknown'}). This is a routing error.`
    console.error('[cn-executor][videoJobRunner] provider_region_mismatch', { generationJobId, providerId: job.providerId, jobProviderRegion })
    await markJobFailed({
      id: generationJobId,
      errorCode: 'provider_region_mismatch',
      message: errMsg,
      output: { errorCode: 'provider_region_mismatch', message: errMsg, providerId: job.providerId, jobProviderRegion },
    }).catch(() => {/* best-effort */})
    return
  }
  const workflowId = typeof input.workflowId === 'string' ? input.workflowId : ''
  const nodeId = job.nodeId ?? (typeof input.nodeId === 'string' ? input.nodeId : '')
  const projectId = job.projectId ?? (typeof input.projectId === 'string' ? input.projectId : null)
  const model = typeof input.model === 'string' ? input.model : undefined
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl : undefined
  const duration = typeof input.duration === 'number' ? input.duration : undefined
  const aspectRatio = typeof input.aspectRatio === 'string' ? input.aspectRatio : undefined
  const resolution = typeof input.resolution === 'string' ? input.resolution : undefined
  const submittedInput = (
    input.submittedInput && typeof input.submittedInput === 'object' && !Array.isArray(input.submittedInput)
      ? input.submittedInput as Record<string, unknown>
      : null
  )

  try {
    await markJobProcessing(generationJobId, {
      ...input,
      processingStartedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[cn-executor][videoJobRunner] failed to mark job PROCESSING', {
      generationJobId, error: err instanceof Error ? err.message : String(err),
    })
  }

  // Step 1: submit task to Volcengine Seedance
  const submitResult = await submitSeedanceTask({
    prompt: job.prompt,
    imageUrl,
    model,
    duration,
    aspectRatio,
    resolution,
  })

  if (!submitResult.success) {
    const errCode = submitResult.errorCode
    const errMsg = submitResult.message
    await markJobFailed({
      id: generationJobId,
      errorCode: errCode,
      message: errMsg,
      output: {
        errorCode: errCode, message: errMsg,
        providerRegion: 'cn', executionRegion: 'cn', storageRegion: 'cn', executorKind: 'aliyun_fc',
        submittedInput: submitResult.submittedInput ?? submittedInput,
        upstreamStatus: 'upstreamStatus' in submitResult ? submitResult.upstreamStatus : undefined,
        providerEndpoint: 'endpoint' in submitResult ? submitResult.endpoint : undefined,
      },
    }).catch((dbErr: unknown) => {
      console.error('[cn-executor][videoJobRunner] failed to mark job FAILED', {
        generationJobId, error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      })
    })
    console.error('[cn-executor][videoJobRunner] Seedance task submit failed', { generationJobId, errCode, errMsg })
    return
  }

  const { taskId, model: usedModel } = submitResult
  console.log('[cn-executor][videoJobRunner] Seedance task submitted', { generationJobId, taskId })

  // Persist taskId immediately so status route can reference it
  await storeProviderTaskId(generationJobId, taskId)

  // Step 2: poll until done
  const pollResult = await pollSeedanceTaskUntilDone(taskId)

  if (!pollResult.success || pollResult.status !== 'done') {
    const errCode = !pollResult.success ? pollResult.errorCode : 'poll_timeout'
    const errMsg = !pollResult.success ? pollResult.message : 'Seedance task did not complete in time.'
    await markJobFailed({
      id: generationJobId,
      errorCode: errCode,
      message: errMsg,
      output: {
        errorCode: errCode, message: errMsg, taskId,
        providerRegion: 'cn', executionRegion: 'cn', storageRegion: 'cn', executorKind: 'aliyun_fc',
        submittedInput: submitResult.submittedInput ?? submittedInput,
      },
    }).catch((dbErr: unknown) => {
      console.error('[cn-executor][videoJobRunner] failed to mark job FAILED after poll timeout', {
        generationJobId, error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      })
    })
    console.error('[cn-executor][videoJobRunner] Seedance poll failed', { generationJobId, taskId, errCode, errMsg })
    return
  }

  const providerVideoUrl = pollResult.videoUrl
  console.log('[cn-executor][videoJobRunner] Seedance task done', { generationJobId, taskId, providerVideoUrl: providerVideoUrl.slice(0, 80) })

  // Step 3: download video buffer
  const videoBuffer = await downloadVideoBuffer(providerVideoUrl)
  if (!videoBuffer || videoBuffer.byteLength === 0) {
    const errMsg = 'Failed to download generated video from Volcengine.'
    await markJobFailed({
      id: generationJobId,
      errorCode: 'provider_media_download_failed',
      message: errMsg,
      output: {
        errorCode: 'provider_media_download_failed', message: errMsg, taskId,
        providerOriginalUrl: providerVideoUrl,
        providerRegion: 'cn', executionRegion: 'cn', storageRegion: 'cn', executorKind: 'aliyun_fc',
        submittedInput: submitResult.submittedInput ?? submittedInput,
      },
    }).catch(() => undefined)
    console.error('[cn-executor][videoJobRunner] video download failed', { generationJobId, taskId })
    return
  }

  // Step 4: upload to Aliyun OSS
  const ossKey = buildVideoOssKey(projectId, nodeId || undefined)
  const uploadResult = await uploadToOss(ossKey, videoBuffer, 'video/mp4')
  if (!uploadResult.success) {
    await markJobFailed({
      id: generationJobId,
      errorCode: uploadResult.errorCode,
      message: uploadResult.message,
      output: {
        errorCode: uploadResult.errorCode, message: uploadResult.message, taskId,
        providerOriginalUrl: providerVideoUrl,
        providerRegion: 'cn', executionRegion: 'cn', storageRegion: 'cn', executorKind: 'aliyun_fc',
        submittedInput: submitResult.submittedInput ?? submittedInput,
      },
    }).catch(() => undefined)
    console.error('[cn-executor][videoJobRunner] OSS upload failed', { generationJobId, taskId, errorCode: uploadResult.errorCode })
    return
  }

  const stableVideoUrl = uploadResult.url
  const storageKey = uploadResult.storageKey

  // Step 5: create Asset
  const assetId = uuid()
  const assetMetadata: Record<string, unknown> = {
    model: usedModel,
    taskId,
    generationJobId,
    providerOriginalUrl: providerVideoUrl,
    stableUrl: stableVideoUrl,
    resolvedUrl: stableVideoUrl,
    storageKey,
    storageRegion: 'cn',
    sourceProviderRegion: 'cn',
    executionRegion: 'cn',
    executorKind: 'aliyun_fc',
    submittedInput: submitResult.submittedInput ?? submittedInput,
  }

  try {
    await createVideoAsset({
      id: assetId,
      ownerId: job.userId,
      projectId,
      workflowId: workflowId || null,
      nodeId: nodeId || null,
      url: stableVideoUrl,
      originalUrl: providerVideoUrl,
      storageKey,
      generationJobId,
      prompt: job.prompt,
      providerId: job.providerId,
      metadataJson: assetMetadata,
    })
  } catch (err) {
    console.warn('[cn-executor][videoJobRunner] failed to create Asset — continuing', {
      generationJobId, error: err instanceof Error ? err.message : String(err),
    })
  }

  // Step 6: mark job SUCCEEDED
  const successOutput: Record<string, unknown> = {
    resultVideoUrl: stableVideoUrl,
    stableUrl: stableVideoUrl,
    assetId,
    outputAssetId: assetId,
    taskId,
    storageKey,
    storageProvider: 'aliyun_oss',
    storageRegion: 'cn',
    executionRegion: 'cn',
    providerRegion: 'cn',
    executorKind: 'aliyun_fc',
    model: usedModel,
    providerOriginalUrl: providerVideoUrl,
    originalProviderVideoUrl: providerVideoUrl,
    submittedInput: submitResult.submittedInput ?? submittedInput,
  }

  try {
    await markJobSucceeded({ id: generationJobId, outputAssetId: assetId, output: successOutput })
  } catch (err) {
    console.error('[cn-executor][videoJobRunner] failed to mark job SUCCEEDED', {
      generationJobId, error: err instanceof Error ? err.message : String(err),
    })
    return
  }

  // Step 7: update CanvasNode
  if (workflowId && nodeId) {
    try {
      await updateCanvasNodeForVideo({
        workflowId,
        nodeId,
        videoUrl: stableVideoUrl,
        assetId,
        generationJobId,
        model: usedModel,
        taskId,
        storageKey,
        providerOriginalUrl: providerVideoUrl,
        submittedInput: submitResult.submittedInput ?? submittedInput,
      })
    } catch (err) {
      console.warn('[cn-executor][videoJobRunner] failed to update CanvasNode', {
        generationJobId, error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log('[cn-executor][videoJobRunner] job completed', {
    generationJobId, assetId, taskId, stableVideoUrl: stableVideoUrl.slice(0, 80),
  })
}
