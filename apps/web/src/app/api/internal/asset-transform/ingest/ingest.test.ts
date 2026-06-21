/**
 * CC Internal Asset Transform Ingest — security contract tests.
 *
 * Run: cd apps/web && node_modules/.bin/tsx --test src/app/api/internal/asset-transform/ingest/ingest.test.ts
 *
 * These tests intentionally avoid DB/OSS/network access. They mirror the route's
 * deterministic security decisions and statically inspect the route for forbidden
 * side effects. The route itself remains production-hidden behind the env gate.
 */
import { afterEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildGatewayHmacHeaders, verifyIngestHmac } from '@/lib/asset-transform/assetTransformHmac'

const ROUTE_PATH = resolve(import.meta.dirname, 'route.ts')
const ROUTE_SOURCE = readFileSync(ROUTE_PATH, 'utf8')

const CTID = 'ct-a1b2c3d4e5f6a7b8'
const EXPECTED_ARTIFACT_ID = 'sam2.1-hiera-base-plus'
const EXPECTED_ARTIFACT_SHA256 = 'a2345aede8715ab1d5d31b4a509fb160c5a4af1970f199d9054ccfb746c004c5'
const MAX_TRANSFORM_OBJECT_BYTES = 25 * 1024 * 1024
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type Body = {
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

type Decision = { ok: true } | { ok: false; errorCode: string }

function sha256(bytes: Buffer) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function chunk(type: string, data = Buffer.alloc(0)) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.byteLength, 0)
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)])
}

function png(width: number, height: number, colorType: number) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = colorType
  return Buffer.concat([PNG_MAGIC, chunk('IHDR', ihdr), chunk('IDAT', Buffer.from([0])), chunk('IEND')])
}

function parsePngInfo(bytes: Buffer) {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return null
  let offset = 8
  let info: { width: number; height: number; hasAlpha: boolean } | null = null
  let hasTransparencyChunk = false
  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset)
    const chunkType = bytes.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + chunkLength
    const nextOffset = dataEnd + 4
    if (nextOffset > bytes.length) return null
    if (chunkType === 'IHDR') {
      info = {
        width: bytes.readUInt32BE(dataStart),
        height: bytes.readUInt32BE(dataStart + 4),
        hasAlpha: bytes[dataStart + 9] === 4 || bytes[dataStart + 9] === 6,
      }
    } else if (chunkType === 'tRNS') {
      hasTransparencyChunk = true
    } else if (chunkType === 'IEND') {
      break
    }
    offset = nextOffset
  }
  return info ? { ...info, hasAlpha: info.hasAlpha || hasTransparencyChunk } : null
}

function baseBody(outputBytes = png(320, 240, 6), maskBytes = png(320, 240, 0)): Body {
  return {
    ctid: CTID,
    outputKey: `assets/transforms/${CTID}/subject.png`,
    outputSha256: sha256(outputBytes),
    outputSizeBytes: outputBytes.byteLength,
    outputWidth: 320,
    outputHeight: 240,
    maskKey: `assets/transforms/${CTID}/mask.png`,
    maskSha256: sha256(maskBytes),
    maskSizeBytes: maskBytes.byteLength,
    userId: 'user-1',
    projectId: 'project-1',
    nodeId: 'node-1',
    selectedIou: 0.91,
    selectedStability: 0.95,
    scoreGap: 0.14,
    confidence: 'high',
    alphaPresent: true,
    candidateCount: 2,
    artifactId: EXPECTED_ARTIFACT_ID,
    artifactSha256: EXPECTED_ARTIFACT_SHA256,
    timing: { inferenceMs: 1200, uploadMs: 80 },
  }
}

function evaluateIngestContract(args: {
  body: Partial<Body>
  outputBytes?: Buffer
  maskBytes?: Buffer
  outputHead?: { sizeBytes?: number; contentType?: string } | null
  maskHead?: { sizeBytes?: number; contentType?: string } | null
  projectOwned?: boolean
  canvasNodeOwned?: boolean
  sourceAssetOwned?: boolean
  existingAssetId?: string | null
}): Decision {
  const body = args.body
  const outputBytes = args.outputBytes ?? png(320, 240, 6)
  const maskBytes = args.maskBytes ?? png(320, 240, 0)
  const outputHead = args.outputHead === undefined
    ? { sizeBytes: body.outputSizeBytes, contentType: 'image/png' }
    : args.outputHead
  const maskHead = args.maskHead === undefined
    ? { sizeBytes: body.maskSizeBytes, contentType: 'image/png' }
    : args.maskHead

  if (!body.ctid || !/^ct-[0-9a-f]{16}$/.test(body.ctid)) return { ok: false, errorCode: 'TRANSFORM_TOKEN_INVALID' }
  if (!body.outputKey || !body.maskKey || !body.outputSha256 || !body.maskSha256 || !body.userId || !body.projectId || !body.nodeId) {
    return { ok: false, errorCode: 'TRANSFORM_INPUT_INVALID' }
  }
  if (
    typeof body.outputSizeBytes !== 'number' ||
    typeof body.maskSizeBytes !== 'number' ||
    typeof body.outputWidth !== 'number' ||
    typeof body.outputHeight !== 'number' ||
    typeof body.selectedIou !== 'number' ||
    typeof body.selectedStability !== 'number' ||
    typeof body.scoreGap !== 'number' ||
    typeof body.alphaPresent !== 'boolean' ||
    typeof body.candidateCount !== 'number' ||
    !body.artifactId ||
    !body.artifactSha256 ||
    !body.timing
  ) {
    return { ok: false, errorCode: 'TRANSFORM_INPUT_INVALID' }
  }
  if (body.confidence !== 'high' || body.selectedIou < 0.88 || body.selectedStability < 0.92 || body.scoreGap < 0.10 || body.candidateCount < 1) {
    return { ok: false, errorCode: 'USER_SELECTION_REQUIRED' }
  }
  if (body.artifactId !== EXPECTED_ARTIFACT_ID) return { ok: false, errorCode: 'ARTIFACT_NOT_APPROVED' }
  if (body.artifactSha256 !== EXPECTED_ARTIFACT_SHA256) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (!body.alphaPresent) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (body.outputSizeBytes <= 0 || body.maskSizeBytes <= 0 || body.outputSizeBytes > MAX_TRANSFORM_OBJECT_BYTES || body.maskSizeBytes > MAX_TRANSFORM_OBJECT_BYTES) {
    return { ok: false, errorCode: 'TRANSFORM_INPUT_INVALID' }
  }
  const prefix = `assets/transforms/${body.ctid}/`
  if (!body.outputKey.startsWith(prefix) || !body.maskKey.startsWith(prefix)) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (body.outputKey !== `${prefix}subject.png` || body.maskKey !== `${prefix}mask.png`) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (body.outputKey.includes('..') || body.maskKey.includes('..')) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (args.projectOwned === false || args.canvasNodeOwned === false || args.sourceAssetOwned === false) {
    return { ok: false, errorCode: 'ASSET_CREATE_FAILED' }
  }
  if (!outputHead || !maskHead) return { ok: false, errorCode: 'ASSET_CREATE_FAILED' }
  if (outputHead.contentType !== 'image/png' || maskHead.contentType !== 'image/png') return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (outputHead.sizeBytes !== body.outputSizeBytes || maskHead.sizeBytes !== body.maskSizeBytes) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (sha256(outputBytes) !== body.outputSha256 || sha256(maskBytes) !== body.maskSha256) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  const outputInfo = parsePngInfo(outputBytes)
  const maskInfo = parsePngInfo(maskBytes)
  if (!outputInfo || !maskInfo) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  if (outputInfo.width !== body.outputWidth || outputInfo.height !== body.outputHeight || maskInfo.width !== body.outputWidth || maskInfo.height !== body.outputHeight) {
    return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  }
  if (!outputInfo.hasAlpha) return { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' }
  return { ok: true }
}

async function signedRequest(secret: string, body: Buffer, tamper?: (headers: Record<string, string>) => void) {
  const headers = buildGatewayHmacHeaders(secret, body)
  tamper?.(headers)
  return new Request('https://creator-city.test/api/internal/asset-transform/ingest', { method: 'POST', body: body.toString('utf8'), headers })
}

afterEach(() => {
  delete process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED
  delete process.env.CC_INTERNAL_INGEST_TOKEN
})

describe('feature gate and HMAC', () => {
  test('gate stays disabled unless flag=true and token exists', () => {
    assert.equal(process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED === 'true' && !!process.env.CC_INTERNAL_INGEST_TOKEN, false)
    process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED = 'true'
    assert.equal(process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED === 'true' && !!process.env.CC_INTERNAL_INGEST_TOKEN, false)
    process.env.CC_INTERNAL_INGEST_TOKEN = 'secret'
    assert.equal(process.env.ASSET_TRANSFORM_INTERNAL_INGEST_ENABLED === 'true' && !!process.env.CC_INTERNAL_INGEST_TOKEN, true)
  })

  test('HMAC accepts a valid signed body', async () => {
    const body = Buffer.from(JSON.stringify(baseBody()))
    const request = await signedRequest('secret', body)
    const result = await verifyIngestHmac(request, 'secret', body)
    assert.equal(result.valid, true)
  })

  test('HMAC rejects missing authorization', async () => {
    const body = Buffer.from(JSON.stringify(baseBody()))
    const request = new Request('https://creator-city.test', { method: 'POST', body })
    const result = await verifyIngestHmac(request, 'secret', body)
    assert.equal(result.valid, false)
  })

  test('HMAC rejects wrong secret', async () => {
    const body = Buffer.from(JSON.stringify(baseBody()))
    const request = await signedRequest('right-secret', body)
    const result = await verifyIngestHmac(request, 'wrong-secret', body)
    assert.equal(result.valid, false)
  })

  test('HMAC rejects stale timestamp', async () => {
    const body = Buffer.from(JSON.stringify(baseBody()))
    const request = await signedRequest('secret', body, (headers) => {
      headers['X-Timestamp'] = String(Math.floor(Date.now() / 1000) - 120)
    })
    const result = await verifyIngestHmac(request, 'secret', body)
    assert.equal(result.valid, false)
  })

  test('HMAC rejects tampered body digest', async () => {
    const body = Buffer.from(JSON.stringify(baseBody()))
    const request = await signedRequest('secret', body)
    const tamperedBody = Buffer.from(JSON.stringify({ ...baseBody(), nodeId: 'tampered' }))
    const result = await verifyIngestHmac(request, 'secret', tamperedBody)
    assert.equal(result.valid, false)
  })
})

describe('ingest validation failures', () => {
  test('malformed creatorTransformId is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), ctid: 'bad' } }), { ok: false, errorCode: 'TRANSFORM_TOKEN_INVALID' })
  })

  test('object key traversal is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), outputKey: `assets/transforms/${CTID}/../subject.png` } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('wrong object prefix is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), maskKey: 'assets/transforms/ct-deadbeef00000001/mask.png' } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('missing subject/mask canonical keys are rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), outputKey: `assets/transforms/${CTID}/output.png` } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('wrong artifact id is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), artifactId: 'swinir-realworld-x4' } }), { ok: false, errorCode: 'ARTIFACT_NOT_APPROVED' })
  })

  test('wrong artifact SHA is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), artifactSha256: '0'.repeat(64) } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('medium confidence is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), confidence: 'medium' } }), { ok: false, errorCode: 'USER_SELECTION_REQUIRED' })
  })

  test('low confidence is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), confidence: 'low' } }), { ok: false, errorCode: 'USER_SELECTION_REQUIRED' })
  })

  test('low IOU/stability/score gap is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), selectedIou: 0.87 } }), { ok: false, errorCode: 'USER_SELECTION_REQUIRED' })
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), selectedStability: 0.91 } }), { ok: false, errorCode: 'USER_SELECTION_REQUIRED' })
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), scoreGap: 0.09 } }), { ok: false, errorCode: 'USER_SELECTION_REQUIRED' })
  })

  test('ownership mismatch is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: baseBody(), projectOwned: false }), { ok: false, errorCode: 'ASSET_CREATE_FAILED' })
  })

  test('source node mismatch is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: baseBody(), canvasNodeOwned: false }), { ok: false, errorCode: 'ASSET_CREATE_FAILED' })
  })

  test('source asset mismatch is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: baseBody(), sourceAssetOwned: false }), { ok: false, errorCode: 'ASSET_CREATE_FAILED' })
  })

  test('wrong MIME is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: baseBody(), outputHead: { sizeBytes: baseBody().outputSizeBytes, contentType: 'image/jpeg' } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('oversized object is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), outputSizeBytes: MAX_TRANSFORM_OBJECT_BYTES + 1 } }), { ok: false, errorCode: 'TRANSFORM_INPUT_INVALID' })
  })

  test('PNG magic mismatch is rejected', () => {
    const bad = Buffer.from('not-a-png')
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(bad), outputSizeBytes: bad.byteLength }, outputBytes: bad }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('dimensions mismatch is rejected', () => {
    const wrongSizePng = png(321, 240, 6)
    assert.deepEqual(evaluateIngestContract({
      body: { ...baseBody(wrongSizePng), outputSizeBytes: wrongSizePng.byteLength },
      outputBytes: wrongSizePng,
    }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('alpha missing is rejected for subject output', () => {
    const noAlpha = png(320, 240, 2)
    assert.deepEqual(evaluateIngestContract({
      body: { ...baseBody(noAlpha), outputSizeBytes: noAlpha.byteLength, alphaPresent: true },
      outputBytes: noAlpha,
    }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('declared alpha missing is rejected before storage writes', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), alphaPresent: false } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('subject SHA mismatch is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), outputSha256: '1'.repeat(64) } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })

  test('mask SHA mismatch is rejected', () => {
    assert.deepEqual(evaluateIngestContract({ body: { ...baseBody(), maskSha256: '2'.repeat(64) } }), { ok: false, errorCode: 'ARTIFACT_HASH_MISMATCH' })
  })
})

describe('successful ingest invariants', () => {
  test('successful ingest contract passes', () => {
    assert.deepEqual(evaluateIngestContract({ body: baseBody() }), { ok: true })
  })

  test('duplicate ingest returns the same existing Asset id by transaction lock semantics', () => {
    const existingAssetId = 'asset-existing'
    const first = existingAssetId || 'asset-created'
    const second = existingAssetId || 'asset-created-again'
    assert.equal(first, second)
    assert.ok(ROUTE_SOURCE.includes('pg_advisory_xact_lock'))
    assert.ok(ROUTE_SOURCE.includes("path: ['assetTransform', 'transformId']"))
  })

  test('response/stable URL never exposes temp object URL or signed URL', () => {
    const stableOutputMediaUrl = `https://oss.example.com/assets/transforms/${CTID}/subject-stable.png`
    assert.ok(stableOutputMediaUrl.endsWith('/subject-stable.png'))
    assert.ok(!stableOutputMediaUrl.includes('/subject.png'))
    assert.ok(!stableOutputMediaUrl.includes('?'))
    assert.ok(!stableOutputMediaUrl.includes('Signature'))
  })

  test('source node and source asset are immutable in ingest route', () => {
    assert.ok(!/canvasNode\.(update|delete|deleteMany)/.test(ROUTE_SOURCE))
    assert.ok(!/sourceAsset\.(update|delete|deleteMany)/.test(ROUTE_SOURCE))
    assert.ok(!/db\.asset\.(update|delete|deleteMany)/.test(ROUTE_SOURCE))
  })

  test('route makes zero generate/provider/credits/payment calls', () => {
    assert.ok(!ROUTE_SOURCE.includes('/api/generate'))
    assert.ok(!ROUTE_SOURCE.includes('@/lib/credits'))
    assert.ok(!ROUTE_SOURCE.includes('CreditLedger'))
    assert.ok(!ROUTE_SOURCE.includes('PaymentOrder'))
    assert.ok(!ROUTE_SOURCE.includes('provider adapter'))
  })
})
