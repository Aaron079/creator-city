/**
 * /api/asset-transform — Asset Transform Gateway
 *
 * Security model:
 *  - sourceMediaUrl is NEVER accepted from client. Server resolves it from DB.
 *  - projectId + sourceNodeId are verified against the authenticated user before any
 *    data is sent to the executor.
 *  - Executor URL and token are server-side only; never returned to clients.
 *  - Feature gate: ASSET_TRANSFORM_ENABLED must be 'true' AND executor URL must be set.
 *
 * Async job contract:
 *  - POST submits to executor /submit (async only) with a 20s timeout.
 *    Returns immediately with { transformId, status: 'queued' | 'running' | 'done' }.
 *    No synchronous /transform fallback — Vercel Functions must not block on GPU inference.
 *  - GET /api/asset-transform?transformId=... polls executor /status/{id}.
 *  - GET /api/asset-transform (no params) returns capability discovery response.
 *
 * Design constraints (unchanged):
 *  - No GPU models run inside Vercel Functions.
 *  - No generate routes touched. No cn-executor involvement.
 *  - Source assets are NEVER modified.
 *  - No billing / credits changes.
 */

import { type NextRequest } from 'next/server'
import { jsonOk, jsonError } from '@/lib/api/json-response'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import type { AssetTransformClientBody, AssetTransformRequest, AssetTransformResult } from '@/lib/asset-transform/assetTransformTypes'
import { getV1TransformKinds } from '@/lib/asset-transform/assetTransformRegistry'

// ─── Feature gate ────────────────────────────────────────────────────────────

function isFeatureEnabled(): boolean {
  return process.env.ASSET_TRANSFORM_ENABLED === 'true' && !!process.env.ASSET_TRANSFORM_EXECUTOR_URL
}

// Output ingestion gate — blocks all job submission until the server-side ingestion
// pipeline (executor → CC OSS → Asset record) has been validated and enabled.
// Set ASSET_TRANSFORM_OUTPUT_INGESTION_READY='true' only when the full pipeline is ready.
function isIngestionReady(): boolean {
  return process.env.ASSET_TRANSFORM_OUTPUT_INGESTION_READY === 'true'
}

function getExecutorUrl(): string | null {
  return process.env.ASSET_TRANSFORM_EXECUTOR_URL ?? null
}

function getExecutorToken(): string | null {
  return process.env.ASSET_TRANSFORM_EXECUTOR_TOKEN
    ?? process.env.ASSET_TRANSFORM_EXECUTOR_API_KEY
    ?? null
}

// ─── Source URL allowlist (must match Creator City OSS domains only) ──────────
// Prevents SSRF if a corrupted DB record ever contained a non-OSS URL.

const ALLOWED_SOURCE_URL_PATTERNS: Array<(host: string) => boolean> = [
  (h) => h.includes('.oss-') || h.includes('.oss.') || (h.endsWith('.aliyuncs.com') && h.includes('oss')),
  (h) => (h.endsWith('.volces.com') || h.endsWith('.volcengine.com')) && /^tos[-.]/i.test(h),
  (h) => h.endsWith('.byteimg.com') || h === 'byteimg.com',
  (h) => h.endsWith('.bytecdn.cn'),
]

function isAllowedSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    // Reject localhost / RFC-1918 addresses
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    if (/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d/.test(host)) return false
    return ALLOWED_SOURCE_URL_PATTERNS.some((fn) => fn(host))
  } catch {
    return false
  }
}

// ─── Param allowlists ─────────────────────────────────────────────────────────

function sanitizeParams(
  kind: 'remove-background' | 'upscale',
  raw: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === 'remove-background') {
    return {
      mode: raw.mode === 'text' ? 'text' : 'auto',
      // subjectHint only forwarded in text mode; max 120 chars
      ...(raw.mode === 'text' && typeof raw.subjectHint === 'string'
        ? { subjectHint: String(raw.subjectHint).slice(0, 120) }
        : {}),
      featherRadius: typeof raw.featherRadius === 'number'
        ? Math.max(0, Math.min(10, Math.round(raw.featherRadius)))
        : 2,
    }
  }
  if (kind === 'upscale') {
    const scale = raw.scale === 4 ? 4 : 2
    return {
      scale,
      mode: raw.mode === 'illustration' ? 'illustration' : 'general',
      denoisingStrength: typeof raw.denoisingStrength === 'number'
        ? Math.max(0, Math.min(0.8, raw.denoisingStrength))
        : 0.35,
    }
  }
  return {}
}

// ─── POST /api/asset-transform ────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // Auth
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '需要登录', 401)

  // Feature gate
  if (!isFeatureEnabled()) {
    return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '资产变换功能未启用', 503)
  }
  const executorUrl = getExecutorUrl()!

  // Output ingestion gate — must be ready before any job is submitted.
  // Prevents executor-ephemeral URLs from reaching the client before ingestion is implemented.
  if (!isIngestionReady()) {
    return jsonError('TRANSFORM_OUTPUT_INGESTION_BLOCKED', '输出入库服务未就绪，任务未提交', 503)
  }

  // Parse body — NOTE: sourceMediaUrl is NOT accepted from client
  let body: Partial<AssetTransformClientBody>
  try {
    body = (await req.json()) as Partial<AssetTransformClientBody>
  } catch {
    return jsonError('TRANSFORM_INPUT_INVALID', '请求体解析失败', 400)
  }

  const { transformKind, sourceNodeId, projectId, params } = body

  // Required field check
  if (!transformKind || !sourceNodeId || !projectId) {
    return jsonError('TRANSFORM_INPUT_INVALID', '缺少必要字段: transformKind, sourceNodeId, projectId', 400)
  }

  // Validate kind is in V1 registry
  const registeredKinds = getV1TransformKinds()
  const kindMeta = registeredKinds.find((m) => m.kind === transformKind)
  if (!kindMeta) {
    return jsonError('TRANSFORM_UNSUPPORTED', `不支持的变换类型: ${transformKind}`, 400)
  }

  // ── Ownership verification ──────────────────────────────────────────────────
  // Verify that projectId belongs to the authenticated user.

  const workflow = await db.canvasWorkflow.findFirst({
    where: {
      projectId,
      project: { ownerId: user.id },
    },
    select: { id: true },
  })

  if (!workflow) {
    return jsonError('TRANSFORM_PROJECT_FORBIDDEN', '项目不存在或无权访问', 403)
  }

  // ── Source node verification ────────────────────────────────────────────────
  // Resolve the source media URL from our own DB — never from client body.

  const sourceNode = await db.canvasNode.findFirst({
    where: {
      workflowId: workflow.id,
      nodeId: sourceNodeId,
      kind: 'image',
    },
    select: { resultImageUrl: true },
  })

  if (!sourceNode) {
    return jsonError('TRANSFORM_SOURCE_NOT_FOUND', '源节点不存在于该项目', 404)
  }
  if (!sourceNode.resultImageUrl) {
    return jsonError('TRANSFORM_INPUT_INVALID', '源节点暂无生成结果，请先完成图片生成', 400)
  }

  // ── Source URL domain allowlist ─────────────────────────────────────────────
  const sourceMediaUrl = sourceNode.resultImageUrl
  if (!isAllowedSourceUrl(sourceMediaUrl)) {
    return jsonError('TRANSFORM_INPUT_INVALID', '源资产 URL 不在允许的存储域名范围内', 400)
  }

  // ── Params sanitization ────────────────────────────────────────────────────
  const sanitizedParams = sanitizeParams(
    transformKind as 'remove-background' | 'upscale',
    (params ?? {}) as Record<string, unknown>,
  )

  // ── Build executor request ─────────────────────────────────────────────────
  // requestId generated server-side for idempotency; not accepted from client.
  const requestId = `${user.id.slice(0, 8)}-${sourceNodeId.slice(0, 8)}-${Date.now()}`

  const executorRequest: AssetTransformRequest = {
    transformKind,
    projectId,
    workflowId: body.workflowId,
    sourceNodeId,
    sourceMediaUrl,         // server-resolved only
    params: sanitizedParams,
    executorId: 'asset-transform-executor',
    billingMode: 'platform',
    requestId,
  }

  // ── Submit to executor ─────────────────────────────────────────────────────
  // Short submission timeout: 20s. Executor should return a queued job ID.
  // Long-running work is handled via polling (GET /api/asset-transform?transformId=...).

  const token = getExecutorToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Request-Id': requestId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20_000)

  try {
    let executorRes: Response
    try {
      // Async-only: POST to executor /submit. No synchronous /transform fallback.
      // Vercel Functions must not block on GPU inference. Executor must implement async /submit.
      executorRes = await fetch(`${executorUrl}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(executorRequest),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    // Executor does not implement async /submit — hard-fail, never sync-fallback.
    if (executorRes.status === 404 || executorRes.status === 405 || executorRes.status === 501) {
      return jsonError('TRANSFORM_EXECUTOR_UNSUPPORTED', '执行器未实现异步 /submit，请升级执行器', 503)
    }

    if (!executorRes.ok) {
      const errBody = await executorRes.json().catch(() => ({})) as Record<string, unknown>
      const errCode = typeof errBody.errorCode === 'string' ? errBody.errorCode : 'TRANSFORM_UNKNOWN'
      return jsonError(errCode, typeof errBody.message === 'string' ? errBody.message : '执行器返回错误', executorRes.status)
    }

    const result = await executorRes.json() as AssetTransformResult
    return jsonOk({ result })

  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return jsonError('TRANSFORM_TIMEOUT', '执行器提交超时（20s）', 504)
    }
    return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '无法连接到变换执行器', 503)
  }
}

// ─── GET /api/asset-transform ─────────────────────────────────────────────────
//
// Two modes:
//   ?transformId=...  → poll job status from executor
//   (no params)       → capability discovery (returns enabled state + available kinds)

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '需要登录', 401)

  const { searchParams } = new URL(req.url)
  const transformId = searchParams.get('transformId')

  if (transformId) {
    // ── Job status poll ──────────────────────────────────────────────────────
    if (!isFeatureEnabled()) {
      return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '资产变换功能未启用', 503)
    }
    const executorUrl = getExecutorUrl()!
    const token = getExecutorToken()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    try {
      let statusRes: Response
      try {
        statusRes = await fetch(
          `${executorUrl}/status/${encodeURIComponent(transformId)}`,
          {
            headers: {
              Accept: 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          },
        )
      } finally {
        clearTimeout(timeoutId)
      }

      if (!statusRes.ok) {
        return jsonError('TRANSFORM_UNKNOWN', '执行器状态查询失败', statusRes.status)
      }
      const result = await statusRes.json() as AssetTransformResult
      return jsonOk({ result })

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return jsonError('TRANSFORM_TIMEOUT', '状态查询超时', 504)
      }
      return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '执行器不可达', 503)
    }
  }

  // ── Capability discovery ───────────────────────────────────────────────────
  // Returns the runtime capability state. Executor is NOT probed if feature is disabled.
  // Response is intentionally minimal: no executor URL, no token, no internal details.

  if (!isFeatureEnabled()) {
    return jsonOk({
      enabled: false,
      executorReady: false,
      capabilities: [],
    })
  }

  // Output ingestion gate — capabilities are unavailable until the ingestion pipeline is ready.
  // Returning executorReady: false ensures the VCW capability cache stays disabled,
  // keeping all toolbar entries hidden regardless of executor health.
  if (!isIngestionReady()) {
    return jsonOk({
      enabled: true,
      executorReady: false,
      capabilities: [],
    })
  }

  const executorUrl = getExecutorUrl()!
  const token = getExecutorToken()

  // Probe executor /capabilities with short timeout (5s)
  const capController = new AbortController()
  const capTimeoutId = setTimeout(() => capController.abort(), 5_000)

  try {
    let capRes: Response
    try {
      capRes = await fetch(`${executorUrl}/capabilities`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: capController.signal,
      })
    } finally {
      clearTimeout(capTimeoutId)
    }

    if (capRes.ok) {
      const caps = await capRes.json() as {
        capabilities?: Array<{ kind: string; available: boolean }>
      }
      return jsonOk({
        enabled: true,
        executorReady: true,
        capabilities: caps.capabilities ?? [],
      })
    }
  } catch {
    // Executor unreachable — return disabled state without logging to console
  }

  // Executor configured but not responding
  return jsonOk({
    enabled: true,
    executorReady: false,
    capabilities: [],
  })
}
