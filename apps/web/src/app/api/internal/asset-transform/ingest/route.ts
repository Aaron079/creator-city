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
 * Implementation: Phase 1A — internal-alpha only, feature-gated.
 * Enable: ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED=true + CC_INTERNAL_INGEST_TOKEN set.
 */

import crypto from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/api/json-response'
import { verifyIngestHmac } from '@/lib/asset-transform/assetTransformHmac'
import { validateCreatorTransformId, getTransformStableKeys } from '@/lib/asset-transform/assetTransformOss'
import type { ChinaStorageObjectMetadataResult } from '@/lib/storage/china/types'
import { getObject, headObject, putObject } from '@/lib/storage/china/gateway'
import { db } from '@/lib/db'

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

// ─── PNG magic bytes ──────────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const EXPECTED_ARTIFACT_ID = 'sam2.1-hiera-base-plus'
const EXPECTED_ARTIFACT_SHA256 = 'a2345aede8715ab1d5d31b4a509fb160c5a4af1970f199d9054ccfb746c004c5'
const MAX_TRANSFORM_OBJECT_BYTES = 25 * 1024 * 1024
const MIN_SELECTED_IOU = 0.88
const MIN_SELECTED_STABILITY = 0.92
const MIN_SCORE_GAP = 0.10

// ─── Stable URL builder ───────────────────────────────────────────────────────

function buildStablePublicUrl(key: string): string {
  const base = (process.env.ALIYUN_OSS_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
  return `${base}/${key}`
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
  scoreGap: number
  confidence: 'high' | 'medium' | 'low'
  alphaPresent: boolean
  candidateCount: number
  artifactId: string
  artifactSha256: string
  timing: Record<string, number>
}

type PngInfo = {
  width: number
  height: number
  colorType: number
  hasAlpha: boolean
}

type ValidationError = {
  errorCode: string
  message: string
  status: number
}

function validationError(errorCode: string, message: string, status = 400): ValidationError {
  return { errorCode, message, status }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function numberFromUnknown(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanFromUnknown(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function validateTiming(value: unknown): boolean {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0)
}

function getNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value
  for (const segment of path) {
    if (!isRecord(current)) return null
    current = current[segment]
  }
  return stringFromUnknown(current)
}

function parsePngInfo(bytes: Buffer): PngInfo | null {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return null

  let offset = 8
  let info: PngInfo | null = null
  let hasTransparencyChunk = false

  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset)
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + chunkLength
    const nextOffset = dataEnd + 4
    if (chunkLength < 0 || nextOffset > bytes.length) return null

    if (chunkType === 'IHDR') {
      if (chunkLength !== 13) return null
      const width = bytes.readUInt32BE(dataStart)
      const height = bytes.readUInt32BE(dataStart + 4)
      const bitDepth = bytes[dataStart + 8]
      const colorType = bytes[dataStart + 9]
      if (width <= 0 || height <= 0 || bitDepth === undefined || colorType === undefined || bitDepth === 0) return null
      info = {
        width,
        height,
        colorType,
        hasAlpha: colorType === 4 || colorType === 6,
      }
    } else if (chunkType === 'tRNS') {
      hasTransparencyChunk = true
    } else if (chunkType === 'IEND') {
      break
    }

    offset = nextOffset
  }

  if (!info) return null
  return { ...info, hasAlpha: info.hasAlpha || hasTransparencyChunk }
}

function validatePngObject(args: {
  label: 'Output' | 'Mask'
  bytes: Buffer
  expectedWidth: number
  expectedHeight: number
  requireAlpha: boolean
}): ValidationError | null {
  const pngInfo = parsePngInfo(args.bytes)
  if (!pngInfo) {
    return validationError('ARTIFACT_HASH_MISMATCH', `${args.label} is not a valid PNG`, 409)
  }
  if (pngInfo.width !== args.expectedWidth || pngInfo.height !== args.expectedHeight) {
    return validationError('ARTIFACT_HASH_MISMATCH', `${args.label} PNG dimensions mismatch`, 409)
  }
  if (args.requireAlpha && !pngInfo.hasAlpha) {
    return validationError('ARTIFACT_HASH_MISMATCH', `${args.label} PNG alpha channel missing`, 409)
  }
  return null
}

function validateObjectMetadata(
  label: 'Output' | 'Mask',
  headResult: ChinaStorageObjectMetadataResult | null,
  expectedSizeBytes: number,
): ValidationError | null {
  if (!headResult) {
    return validationError('ASSET_CREATE_FAILED', `${label} object not found in storage`, 404)
  }
  if (headResult.contentType !== 'image/png') {
    return validationError('ARTIFACT_HASH_MISMATCH', `${label} object MIME type mismatch`, 409)
  }
  if (typeof headResult.sizeBytes === 'number' && headResult.sizeBytes !== expectedSizeBytes) {
    return validationError('ARTIFACT_HASH_MISMATCH', `${label} object size mismatch`, 409)
  }
  return null
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

  const {
    ctid,
    outputKey,
    outputSha256,
    outputSizeBytes,
    outputWidth,
    outputHeight,
    maskKey,
    maskSha256,
    maskSizeBytes,
    userId,
    projectId,
    nodeId,
    selectedIou,
    selectedStability,
    scoreGap,
    confidence,
    alphaPresent,
    candidateCount,
    artifactId,
    artifactSha256,
    timing,
  } = body

  if (!ctid || !outputKey || !outputSha256 || !maskKey || !maskSha256 || !userId || !projectId || !nodeId
    || numberFromUnknown(outputSizeBytes) === null
    || numberFromUnknown(outputWidth) === null
    || numberFromUnknown(outputHeight) === null
    || numberFromUnknown(maskSizeBytes) === null
    || numberFromUnknown(selectedIou) === null
    || numberFromUnknown(selectedStability) === null
    || numberFromUnknown(scoreGap) === null
    || booleanFromUnknown(alphaPresent) === null
    || numberFromUnknown(candidateCount) === null
    || !artifactId
    || !artifactSha256
    || !validateTiming(timing)
  ) {
    return jsonError('TRANSFORM_INPUT_INVALID', '缺少必要字段', 400)
  }
  const declaredOutputSizeBytes = outputSizeBytes as number
  const declaredOutputWidth = outputWidth as number
  const declaredOutputHeight = outputHeight as number
  const declaredMaskSizeBytes = maskSizeBytes as number
  const declaredSelectedIou = selectedIou as number
  const declaredSelectedStability = selectedStability as number
  const declaredScoreGap = scoreGap as number
  const declaredCandidateCount = candidateCount as number
  const declaredAlphaPresent = alphaPresent as boolean
  const declaredTiming = timing as Record<string, number>

  if (confidence !== 'high') {
    return jsonError('USER_SELECTION_REQUIRED', 'Only high-confidence transform output can be ingested in Phase 1A', 409)
  }
  if (
    declaredSelectedIou < MIN_SELECTED_IOU ||
    declaredSelectedStability < MIN_SELECTED_STABILITY ||
    declaredScoreGap < MIN_SCORE_GAP ||
    declaredCandidateCount < 1
  ) {
    return jsonError('USER_SELECTION_REQUIRED', 'Transform output confidence is not high enough for ingestion', 409)
  }
  if (artifactId !== EXPECTED_ARTIFACT_ID) {
    return jsonError('ARTIFACT_NOT_APPROVED', 'Transform artifact is not approved for internal-alpha ingestion', 409)
  }
  if (artifactSha256 !== EXPECTED_ARTIFACT_SHA256) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Transform artifact SHA-256 mismatch', 409)
  }
  if (!declaredAlphaPresent) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Transform output must include alpha channel', 409)
  }
  if (
    declaredOutputSizeBytes <= 0 ||
    declaredMaskSizeBytes <= 0 ||
    declaredOutputSizeBytes > MAX_TRANSFORM_OBJECT_BYTES ||
    declaredMaskSizeBytes > MAX_TRANSFORM_OBJECT_BYTES
  ) {
    return jsonError('TRANSFORM_INPUT_INVALID', 'Transform output object size is out of range', 400)
  }
  if (declaredOutputWidth <= 0 || declaredOutputHeight <= 0 || declaredOutputWidth > 12000 || declaredOutputHeight > 12000) {
    return jsonError('TRANSFORM_INPUT_INVALID', 'Transform output dimensions are out of range', 400)
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
    console.error('[asset-transform/ingest] Key prefix mismatch')
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Object key prefix does not match ctid', 400)
  }
  if (outputKey !== `${expectedPrefix}subject.png` || maskKey !== `${expectedPrefix}mask.png`) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Transform subject/mask object keys are invalid', 400)
  }

  // Path traversal guard
  if (outputKey.includes('..') || maskKey.includes('..')) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Path traversal detected in object key', 400)
  }

  // ─── Track E: Ownership revalidation ─────────────────────────────────────────

  const project = await db.project.findFirst({
    where: { id: projectId!, ownerId: userId! },
    select: { id: true },
  }).catch(() => null)
  if (!project) {
    console.error('[asset-transform/ingest] Project ownership check failed')
    return jsonError('ASSET_CREATE_FAILED', '项目不存在或无权限', 403)
  }

  const canvasNode = await db.canvasNode.findFirst({
    where: { nodeId, kind: 'image', workflow: { projectId } },
    select: { workflowId: true, resultImageUrl: true, metadataJson: true },
  }).catch(() => null)
  if (!canvasNode) {
    console.error('[asset-transform/ingest] Canvas node ownership check failed')
    return jsonError('ASSET_CREATE_FAILED', '画布节点不存在或无权限', 403)
  }

  const sourceAssetId = getNestedString(canvasNode.metadataJson, ['assetId'])
    ?? getNestedString(canvasNode.metadataJson, ['mediaPersistence', 'assetId'])
  const sourceAssetWhere = [
    ...(sourceAssetId ? [{ id: sourceAssetId }] : []),
    ...(canvasNode.resultImageUrl ? [{ url: canvasNode.resultImageUrl }, { originalUrl: canvasNode.resultImageUrl }] : []),
  ]
  if (sourceAssetWhere.length === 0) {
    console.error('[asset-transform/ingest] Source asset reference missing')
    return jsonError('ASSET_CREATE_FAILED', '源资产引用缺失', 403)
  }
  const sourceAsset = await db.asset.findFirst({
    where: {
      ownerId: userId,
      projectId,
      type: 'IMAGE',
      status: 'READY',
      OR: sourceAssetWhere,
    },
    select: { id: true },
  }).catch(() => null)
  if (!sourceAsset) {
    console.error('[asset-transform/ingest] Source asset ownership check failed')
    return jsonError('ASSET_CREATE_FAILED', '源资产不存在或无权限', 403)
  }

  // ─── Track F: OSS temporary object validation ─────────────────────────────────

  // HEAD: verify output object exists and size is consistent
  const headResult = await headObject({ key: outputKey! }).catch(() => null)
  const outputHeadError = validateObjectMetadata('Output', headResult, declaredOutputSizeBytes)
  if (outputHeadError) {
    console.error('[asset-transform/ingest] Output object metadata validation failed:', outputHeadError.message)
    return jsonError(outputHeadError.errorCode, outputHeadError.message, outputHeadError.status)
  }
  const maskHeadResult = await headObject({ key: maskKey! }).catch(() => null)
  const maskHeadError = validateObjectMetadata('Mask', maskHeadResult, declaredMaskSizeBytes)
  if (maskHeadError) {
    console.error('[asset-transform/ingest] Mask object metadata validation failed:', maskHeadError.message)
    return jsonError(maskHeadError.errorCode, maskHeadError.message, maskHeadError.status)
  }

  // GET output object and verify SHA-256 + PNG magic bytes
  let outputBytes: Buffer
  try {
    const getResult = await getObject({ key: outputKey! })
    outputBytes = getResult.body
  } catch {
    console.error('[asset-transform/ingest] Failed to GET output object')
    return jsonError('ASSET_CREATE_FAILED', 'Output object download failed', 502)
  }

  const actualOutputSha256 = crypto.createHash('sha256').update(outputBytes).digest('hex')
  if (actualOutputSha256 !== (outputSha256 as string)) {
    console.error('[asset-transform/ingest] Output SHA-256 mismatch')
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Output SHA-256 mismatch', 409)
  }
  if (outputBytes.byteLength !== declaredOutputSizeBytes) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Output object byte length mismatch', 409)
  }
  const outputPngError = validatePngObject({
    label: 'Output',
    bytes: outputBytes,
    expectedWidth: declaredOutputWidth,
    expectedHeight: declaredOutputHeight,
    requireAlpha: true,
  })
  if (outputPngError) {
    console.error('[asset-transform/ingest] Output PNG validation failed:', outputPngError.message)
    return jsonError(outputPngError.errorCode, outputPngError.message, outputPngError.status)
  }

  // GET mask object and verify SHA-256 + PNG metadata
  let maskBytes: Buffer
  try {
    const maskResult = await getObject({ key: maskKey! })
    maskBytes = maskResult.body
  } catch {
    console.error('[asset-transform/ingest] Failed to GET mask object')
    return jsonError('ASSET_CREATE_FAILED', 'Mask object download failed', 502)
  }

  const actualMaskSha256 = crypto.createHash('sha256').update(maskBytes).digest('hex')
  if (actualMaskSha256 !== (maskSha256 as string)) {
    console.error('[asset-transform/ingest] Mask SHA-256 mismatch')
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Mask SHA-256 mismatch', 409)
  }
  if (maskBytes.byteLength !== declaredMaskSizeBytes) {
    return jsonError('ARTIFACT_HASH_MISMATCH', 'Mask object byte length mismatch', 409)
  }
  const maskPngError = validatePngObject({
    label: 'Mask',
    bytes: maskBytes,
    expectedWidth: declaredOutputWidth,
    expectedHeight: declaredOutputHeight,
    requireAlpha: false,
  })
  if (maskPngError) {
    console.error('[asset-transform/ingest] Mask PNG validation failed:', maskPngError.message)
    return jsonError(maskPngError.errorCode, maskPngError.message, maskPngError.status)
  }

  // ─── Track G: Stable object ingestion ─────────────────────────────────────────
  // GET+PUT (no copyObject available in OSS helper). Keys are deterministic by ctid.

  const { subjectStableKey, maskStableKey } = getTransformStableKeys(ctid!)

  try {
    await putObject({ key: subjectStableKey, body: outputBytes, contentType: 'image/png' })
    await putObject({ key: maskStableKey, body: maskBytes, contentType: 'image/png' })
  } catch {
    console.error('[asset-transform/ingest] Failed to PUT stable objects')
    return jsonError('ASSET_CREATE_FAILED', 'Stable object PUT failed', 502)
  }

  const stableOutputMediaUrl = buildStablePublicUrl(subjectStableKey)

  // ─── Track B/H: Asset creation with advisory lock + idempotency ───────────────
  // pg_advisory_xact_lock serializes concurrent requests for the same ctid.
  // findFirst inside the lock ensures exactly-once without a unique DB constraint.
  // If stable PUT above succeeded but DB create fails, retry is safe: PUT is idempotent
  // (same key + content), and findFirst will return null again on retry.

  let outputAssetId: string
  try {
    const lockKey = `ingest:${ctid!}`
    const txResult = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`

      const existing = await tx.asset.findFirst({
        where: {
          metadataJson: {
            path: ['assetTransform', 'transformId'],
            equals: ctid!,
          },
        },
        select: { id: true },
      })
      if (existing) return { id: existing.id }

      const asset = await tx.asset.create({
        data: {
          ownerId: userId!,
          projectId: projectId!,
          workflowId: canvasNode.workflowId,
          nodeId: nodeId!,
          name: `transform-${ctid!}`,
          type: 'IMAGE',
          status: 'READY',
          source: 'transform',
          mimeType: 'image/png',
          url: stableOutputMediaUrl,
          storageKey: subjectStableKey,
          storageProvider: 'aliyun-oss',
          bucket: process.env.ALIYUN_OSS_BUCKET ?? null,
          sizeBytes: BigInt(declaredOutputSizeBytes),
          width: declaredOutputWidth,
          height: declaredOutputHeight,
          tags: [],
          metadata: {},
          metadataJson: {
            assetTransform: {
              transformId: ctid!,
              transformKind: 'remove-background',
              artifactId: artifactId!,
              artifactSha256: artifactSha256!,
              sourceNodeId: nodeId!,
              sourceAssetId: sourceAsset.id,
              nodeId: nodeId!,
              maskStorageKey: maskStableKey,
              selectedIou: declaredSelectedIou,
              selectedStability: declaredSelectedStability,
              scoreGap: declaredScoreGap,
              confidence: confidence!,
              alphaPresent: declaredAlphaPresent,
              candidateCount: declaredCandidateCount,
              timing: declaredTiming,
              ingestedAt: new Date().toISOString(),
            },
          },
        },
        select: { id: true },
      })
      return { id: asset.id }
    })
    outputAssetId = txResult.id
  } catch (err) {
    console.error('[asset-transform/ingest] Asset DB create failed:', err instanceof Error ? err.message : 'unknown error')
    return jsonError('ASSET_CREATE_FAILED', 'Asset 入库失败', 500)
  }

  // ─── Track I: Response ────────────────────────────────────────────────────────

  return NextResponse.json({
    outputAssetId,
    stableOutputMediaUrl,
    outputOwner: 'creator-city' as const,
    ingestionStatus: 'validated' as const,
  }, { status: 200 })
}
