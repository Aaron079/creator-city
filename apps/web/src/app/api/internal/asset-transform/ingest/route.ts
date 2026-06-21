/**
 * CC Internal Asset Transform Ingest API
 *
 * POST /api/internal/asset-transform/ingest
 *
 * Called by the Railway Gateway Service after output validation (HEAD + SHA-256).
 * Creates the stable Asset record in Creator City.
 *
 * Security model:
 *  - HMAC-SHA256 verified on every request (shared secret with Gateway Service)
 *  - Nonce replay protection (checked against Redis or in-memory store)
 *  - Timestamp window: ±30 seconds
 *  - IP allowlist design: Railway Static Outbound IP (configured at infra level)
 *  - transformId ↔ objectKey prefix binding: rejects mismatches
 *  - Project + source ownership revalidation against DB
 *  - Idempotent: duplicate ingest for same ctid returns existing Asset
 *  - Never accepts outputAssetId, stableOutputMediaUrl, outputOwner from request body
 *
 * Status: OUTPUT_INGESTION_IMPLEMENTATION_PENDING
 *  - Contract and security boundary are defined and testable.
 *  - Asset creation business logic (db.asset.create, stable key PUT) is NOT implemented here yet.
 *  - The Founder must approve this route; set ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED=true to enable.
 *  - This file is intentionally non-functional to avoid accidental asset creation.
 *  - Implement when: artifact is APPROVED, Railway infra is ready, Founder confirms.
 */

import { type NextRequest } from 'next/server'
import { jsonOk, jsonError } from '@/lib/api/json-response'
import { verifyIngestHmac } from '@/lib/asset-transform/assetTransformHmac'
import { validateCreatorTransformId } from '@/lib/asset-transform/assetTransformOss'

// ─── Feature gate ─────────────────────────────────────────────────────────────
// This endpoint is inactive until Founder explicitly enables it.
// ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED must be 'true' AND the ingest secret must be set.

function isIngestEnabled(): boolean {
  return (
    process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED === 'true' &&
    !!process.env.CC_INTERNAL_INGEST_TOKEN
  )
}

function getIngestSecret(): string {
  return process.env.CC_INTERNAL_INGEST_TOKEN ?? ''
}

// ─── Request contract ─────────────────────────────────────────────────────────

interface IngestRequestBody {
  ctid: string
  outputKey: string
  outputSha256: string
  outputSizeBytes: number
  outputWidth: number
  outputHeight: number
  maskKey: string
  maskSha256: string
  maskSizeBytes: number
  userId: string
  projectId: string
  nodeId: string
  selectedIou: number
  selectedStability: number
  candidateCount: number
  artifactId: string
  artifactSha256: string
  timing: Record<string, number>
}

// ─── POST /api/internal/asset-transform/ingest ────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // Feature gate — hard closed until Founder enables
  if (!isIngestEnabled()) {
    return jsonError(
      'OUTPUT_INGESTION_IMPLEMENTATION_PENDING',
      '资产入库服务未启用。待 Founder 授权后启用。',
      503,
    )
  }

  // Read raw body for HMAC verification
  const bodyBuffer = Buffer.from(await req.arrayBuffer())

  // HMAC verification
  const { valid, reason } = await verifyIngestHmac(req, getIngestSecret(), bodyBuffer)
  if (!valid) {
    // Log security event (without logging the invalid token)
    console.error('[asset-transform/ingest] HMAC verification failed:', reason)
    return jsonError('TRANSFORM_TOKEN_INVALID', 'HMAC 验证失败', 401)
  }

  // Parse body
  let body: Partial<IngestRequestBody>
  try {
    body = JSON.parse(bodyBuffer.toString('utf-8'))
  } catch {
    return jsonError('TRANSFORM_INPUT_INVALID', '请求体解析失败', 400)
  }

  const { ctid, outputKey, outputSha256, outputSizeBytes, outputWidth, outputHeight,
    maskKey, maskSha256, maskSizeBytes, userId, projectId, nodeId,
    selectedIou, selectedStability, candidateCount, artifactId, artifactSha256, timing } = body

  // Required field validation
  if (!ctid || !outputKey || !outputSha256 || !outputSizeBytes || !outputWidth || !outputHeight
    || !maskKey || !maskSha256 || !maskSizeBytes || !userId || !projectId || !nodeId
    || selectedIou === undefined || selectedStability === undefined || !artifactId) {
    return jsonError('TRANSFORM_INPUT_INVALID', '缺少必要字段', 400)
  }

  // creatorTransformId format validation
  try {
    validateCreatorTransformId(ctid)
  } catch {
    return jsonError('TRANSFORM_TOKEN_INVALID', 'Invalid creatorTransformId format', 400)
  }

  // Object key prefix binding — output key must be under this ctid's prefix
  const expectedPrefix = `assets/transforms/${ctid}/`
  if (!outputKey.startsWith(expectedPrefix) || !maskKey.startsWith(expectedPrefix)) {
    console.error('[asset-transform/ingest] Key prefix mismatch', { ctid, outputKey, maskKey })
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Object key prefix does not match ctid', 400)
  }

  // Path traversal guard
  if (outputKey.includes('..') || maskKey.includes('..')) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Path traversal detected in object key', 400)
  }

  // ─── OUTPUT_INGESTION_IMPLEMENTATION_PENDING ──────────────────────────────
  //
  // The following steps are NOT YET IMPLEMENTED:
  //  1. Verify userId + projectId + nodeId ownership against DB
  //  2. Idempotency check: query Asset by metadataJson.assetTransform.transformId = ctid
  //  3. PUT stable key: putChinaObject({ key: `assets/transforms/${ctid}/subject-stable.png`, ... })
  //  4. PUT stable mask: putChinaObject({ key: `assets/transforms/${ctid}/mask-stable.png`, ... })
  //  5. db.asset.create({ type:'IMAGE', status:'READY', source:'transform', ... })
  //  6. Update CanvasWorkflow.metadataJson.pendingAssetTransforms (remove ctid entry)
  //  7. Return { outputAssetId, stableOutputMediaUrl, outputOwner: 'creator-city', ingestionStatus: 'validated' }
  //
  // This endpoint returns 503 in production until the above is implemented and Founder approves.
  // All contract validation above is active and testable NOW.

  return jsonError(
    'OUTPUT_INGESTION_IMPLEMENTATION_PENDING',
    'Asset 入库业务逻辑尚未实现。所有安全边界验证已通过。待实现阶段启用。',
    503,
  )
}
