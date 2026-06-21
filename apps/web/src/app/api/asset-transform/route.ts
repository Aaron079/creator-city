/**
 * /api/asset-transform — Asset Transform Gateway (Option B — Railway Gateway)
 *
 * Security model:
 *  - sourceMediaUrl is NEVER accepted from client. Server resolves it from DB.
 *  - projectId + sourceNodeId are verified against the authenticated user before any
 *    data is sent to the Railway Gateway Service.
 *  - Gateway URL, HMAC secret, and presigned URLs are server-side only; never in responses.
 *  - Feature gate: ASSET_TRANSFORM_ENABLED must be 'true' AND ASSET_TRANSFORM_GATEWAY_URL set.
 *  - Output ingestion gate: ASSET_TRANSFORM_OUTPUT_INGESTION_READY must be 'true'.
 *
 * Async job contract (Option B):
 *  - POST: generates ctid + presigned GET/PUT URLs → calls Railway Gateway /submit → returns { transformId: ctid, status: 'queued' }
 *  - GET ?transformId=...: calls Railway Gateway GET /status/{ctid} → returns current status
 *  - GET (no params): capability discovery via Railway Gateway /capabilities
 *
 * Design constraints (unchanged):
 *  - No GPU models run inside Vercel Functions.
 *  - No generate routes touched. No cn-executor involvement.
 *  - Source assets are NEVER modified.
 *  - No billing / credits changes.
 *  - RunPod job ID NEVER returned to client — opaque ctid only.
 *  - Presigned PUT URLs NEVER returned to client.
 */

import crypto from 'crypto'
import { type NextRequest } from 'next/server'
import { jsonOk, jsonError } from '@/lib/api/json-response'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import type { AssetTransformClientBody, AssetTransformResult } from '@/lib/asset-transform/assetTransformTypes'
import { getV1TransformKinds } from '@/lib/asset-transform/assetTransformRegistry'
import {
  extractOssKeyFromUrl,
  getTransformPresignedPutUrls,
  getTransformSourceGetUrl,
} from '@/lib/asset-transform/assetTransformOss'
import {
  getCapabilities,
  getTransformStatus,
  submitTransform,
} from '@/lib/asset-transform/gatewayServiceClient'

// ─── Feature gate ────────────────────────────────────────────────────────────

function isFeatureEnabled(): boolean {
  return process.env.ASSET_TRANSFORM_ENABLED === 'true' && !!process.env.ASSET_TRANSFORM_GATEWAY_URL
}

// Output ingestion gate — blocks all job submission until the full pipeline is validated.
function isIngestionReady(): boolean {
  return process.env.ASSET_TRANSFORM_OUTPUT_INGESTION_READY === 'true'
}

// ─── creatorTransformId generation ───────────────────────────────────────────
// Format: "ct-" + hex(sha256(uid + ":" + nid + ":" + nonce)[0:16])
// Random nonce ensures different ctids even for same (uid, nid) pair.

function generateCtid(userId: string, nodeId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex')
  const raw = `${userId}:${nodeId}:${nonce}`
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return `ct-${hash.slice(0, 16)}`
}

// ─── Source URL allowlist ─────────────────────────────────────────────────────

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
      mode: 'auto' as const,
      featherRadius: typeof raw.featherRadius === 'number'
        ? Math.max(0, Math.min(10, Math.round(raw.featherRadius)))
        : 2,
    }
  }
  if (kind === 'upscale') {
    return {
      scale: raw.scale === 4 ? 4 : 2,
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
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '需要登录', 401)

  if (!isFeatureEnabled()) {
    return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '资产变换功能未启用', 503)
  }

  if (!isIngestionReady()) {
    return jsonError('TRANSFORM_OUTPUT_INGESTION_BLOCKED', '输出入库服务未就绪，任务未提交', 503)
  }

  let body: Partial<AssetTransformClientBody>
  try {
    body = (await req.json()) as Partial<AssetTransformClientBody>
  } catch {
    return jsonError('TRANSFORM_INPUT_INVALID', '请求体解析失败', 400)
  }

  const { transformKind, sourceNodeId, projectId, params } = body

  if (!transformKind || !sourceNodeId || !projectId) {
    return jsonError('TRANSFORM_INPUT_INVALID', '缺少必要字段: transformKind, sourceNodeId, projectId', 400)
  }

  // Only remove-background is supported in Phase 1A
  const registeredKinds = getV1TransformKinds()
  const kindMeta = registeredKinds.find((m) => m.kind === transformKind)
  if (!kindMeta) {
    return jsonError('TRANSFORM_UNSUPPORTED', `不支持的变换类型: ${transformKind}`, 400)
  }

  // ── Ownership verification ──────────────────────────────────────────────────
  const workflow = await db.canvasWorkflow.findFirst({
    where: { projectId, project: { ownerId: user.id } },
    select: { id: true },
  })
  if (!workflow) {
    return jsonError('TRANSFORM_PROJECT_FORBIDDEN', '项目不存在或无权访问', 403)
  }

  // ── Source node verification ────────────────────────────────────────────────
  const sourceNode = await db.canvasNode.findFirst({
    where: { workflowId: workflow.id, nodeId: sourceNodeId, kind: 'image' },
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

  // ── Extract OSS key from stored URL ────────────────────────────────────────
  const sourceObjectKey = extractOssKeyFromUrl(sourceMediaUrl)
  if (!sourceObjectKey) {
    // URL is OSS-allowlisted but key extraction failed (e.g., different bucket domain).
    // Fall back: cannot generate signed GET URL — block submission.
    return jsonError(
      'TRANSFORM_INPUT_INVALID',
      '无法从源资产 URL 提取存储路径，请确认 ALIYUN_OSS_PUBLIC_BASE_URL 配置',
      400,
    )
  }

  // ── Sanitize params ────────────────────────────────────────────────────────
  const sanitizedParams = sanitizeParams(
    transformKind as 'remove-background' | 'upscale',
    (params ?? {}) as Record<string, unknown>,
  )

  // ── Generate creatorTransformId ────────────────────────────────────────────
  const ctid = generateCtid(user.id, sourceNodeId)

  // ── Generate presigned URLs (server-side only, never returned to client) ────
  let signedGetUrl: string
  let subjectPutUrl: string
  let maskPutUrl: string
  let subjectObjectKey: string
  let maskObjectKey: string

  try {
    const [getResult, putResult] = await Promise.all([
      getTransformSourceGetUrl(sourceObjectKey),
      getTransformPresignedPutUrls(ctid),
    ])
    signedGetUrl    = getResult.signedGetUrl
    subjectPutUrl   = putResult.subjectPutUrl
    maskPutUrl      = putResult.maskPutUrl
    subjectObjectKey = putResult.subjectObjectKey
    maskObjectKey    = putResult.maskObjectKey
  } catch (ossErr) {
    console.error('[asset-transform] Failed to generate presigned URLs:', ossErr)
    return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', 'OSS 签名 URL 生成失败', 503)
  }

  // ── Submit to Railway Gateway Service ──────────────────────────────────────
  try {
    const result = await submitTransform({
      ctid,
      userId: user.id,
      projectId,
      nodeId: sourceNodeId,
      sourceUrl: signedGetUrl,       // server-generated, never from client
      outputKey: subjectObjectKey,
      outputPutUrl: subjectPutUrl,   // never returned to client
      maskKey: maskObjectKey,
      maskPutUrl,                    // never returned to client
      transformKind: 'remove-background',
      params: {
        mode: 'auto',
        featherRadius: typeof sanitizedParams.featherRadius === 'number' ? sanitizedParams.featherRadius : 2,
      },
    })

    // transformId = ctid (opaque to client — RunPod job ID is NEVER returned)
    const clientResult: AssetTransformResult = {
      transformId: result.transformId,
      status: result.status,
    }
    return jsonOk({ result: clientResult })

  } catch (err) {
    const gatewayErr = err as { gatewayStatus?: number }
    if (gatewayErr.gatewayStatus === 503) {
      return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', 'Gateway Service 返回 503', 503)
    }
    if (err instanceof Error && err.message.includes('AbortError')) {
      return jsonError('TRANSFORM_TIMEOUT', '执行器提交超时', 504)
    }
    console.error('[asset-transform] Gateway submit error:', err)
    return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '无法连接到 Gateway Service', 503)
  }
}

// ─── GET /api/asset-transform ─────────────────────────────────────────────────

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
    try {
      const gatewayStatus = await getTransformStatus(transformId)

      // Map Gateway response to CC AssetTransformResult
      const result: AssetTransformResult = {
        transformId: gatewayStatus.transformId,
        status: mapGatewayStatus(gatewayStatus.status),
        errorCode: gatewayStatus.errorCode,
        outputAssetId: gatewayStatus.outputAssetId,
        stableOutputMediaUrl: gatewayStatus.stableOutputMediaUrl,
        maskUrl: gatewayStatus.maskUrl,
        outputOwner: gatewayStatus.outputOwner,
        ingestionStatus: gatewayStatus.ingestionStatus,
        metadata: gatewayStatus.metadata,
      }
      return jsonOk({ result })

    } catch (err) {
      const gatewayErr = err as { gatewayStatus?: number }
      if (gatewayErr.gatewayStatus === 404) {
        return jsonError('TRANSFORM_NOT_FOUND', '变换任务不存在', 404)
      }
      return jsonError('TRANSFORM_EXECUTOR_UNAVAILABLE', '执行器不可达', 503)
    }
  }

  // ── Capability discovery ───────────────────────────────────────────────────
  if (!isFeatureEnabled()) {
    return jsonOk({ enabled: false, executorReady: false, capabilities: [] })
  }
  if (!isIngestionReady()) {
    return jsonOk({ enabled: true, executorReady: false, capabilities: [] })
  }

  // Probe Gateway /capabilities
  try {
    const caps = await getCapabilities()
    return jsonOk({ enabled: true, executorReady: true, capabilities: caps })
  } catch {
    // Gateway unreachable or returned error
  }

  return jsonOk({ enabled: true, executorReady: false, capabilities: [] })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type GatewayStatus = 'queued' | 'running' | 'uploading' | 'ingesting' | 'done' | 'failed' | 'cancelled' | 'expired' | 'needs_user_selection'
type CCStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

function mapGatewayStatus(s: GatewayStatus): CCStatus {
  if (s === 'done') return 'done'
  if (s === 'failed' || s === 'expired' || s === 'needs_user_selection') return 'failed'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'queued') return 'queued'
  return 'running'
}
