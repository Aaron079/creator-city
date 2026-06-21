/**
 * Asset Transform OSS Helpers
 *
 * Transform-specific presigned URL generation with security constraints:
 *  - Only serves assets/transforms/{creatorTransformId}/subject.png and mask.png
 *  - PUT-only signed URLs for worker output (never GET signed for writes)
 *  - GET signed URL for worker source input (read-only, from verified platform keys)
 *  - Never accepts arbitrary client-supplied object keys
 *  - creatorTransformId format validated before use
 *  - No bucket listing, no wildcard keys, no traversal
 *
 * Note on Content-Length enforcement:
 *  Aliyun OSS presigned PUT URLs cannot enforce Content-Length at the signing layer
 *  (the SDK does not include it in the HMAC). The CC Internal Ingest API performs
 *  HEAD + buffer SHA-256 verification after the worker PUT to enforce size + integrity.
 */

import { getSignedDownloadUrl, getSignedUploadUrl } from '@/lib/storage/china/gateway'

// ─── creatorTransformId validation ───────────────────────────────────────────
// Format: "ct-" + 16 lowercase hex chars

const CTID_RE = /^ct-[0-9a-f]{16}$/

export function validateCreatorTransformId(ctid: string): void {
  if (!CTID_RE.test(ctid)) {
    throw new Error(`Invalid creatorTransformId format: ${JSON.stringify(ctid)}`)
  }
}

// ─── Object key construction (server-side only) ───────────────────────────────

type TransformOutputKind = 'subject' | 'mask'

const OBJECT_KIND_MAP: Record<TransformOutputKind, string> = {
  subject: 'subject.png',
  mask:    'mask.png',
}

function buildTransformTempKey(ctid: string, kind: TransformOutputKind): string {
  validateCreatorTransformId(ctid)
  const filename = OBJECT_KIND_MAP[kind]
  if (!filename) throw new Error(`Unknown transform output kind: ${kind}`)
  return `assets/transforms/${ctid}/${filename}`
}

function buildTransformStableKey(ctid: string, kind: TransformOutputKind): string {
  validateCreatorTransformId(ctid)
  const base = OBJECT_KIND_MAP[kind].replace('.png', '')
  return `assets/transforms/${ctid}/${base}-stable.png`
}

// ─── Presigned PUT URLs (for worker output upload) ────────────────────────────

export type TransformPresignedPutUrls = {
  subjectPutUrl: string
  maskPutUrl: string
  subjectObjectKey: string
  maskObjectKey: string
  expiresInSeconds: number
}

/**
 * Generate presigned PUT URLs for worker to upload subject + mask PNGs.
 *
 * Security constraints enforced here:
 *  - ctid format validated
 *  - Only temp prefix allowed (assets/transforms/{ctid}/)
 *  - Content-Type: image/png is included in the HMAC signature
 *  - TTL: 600s (10 min) — generous for worker inference + upload, short enough for security
 *  - PUT only — worker cannot read or delete other objects with these URLs
 */
export async function getTransformPresignedPutUrls(ctid: string): Promise<TransformPresignedPutUrls> {
  validateCreatorTransformId(ctid)
  const expiresInSeconds = 600 // 10 minutes

  const subjectObjectKey = buildTransformTempKey(ctid, 'subject')
  const maskObjectKey = buildTransformTempKey(ctid, 'mask')

  const [subjectResult, maskResult] = await Promise.all([
    getSignedUploadUrl({ key: subjectObjectKey, expiresInSeconds, contentType: 'image/png' }),
    getSignedUploadUrl({ key: maskObjectKey,    expiresInSeconds, contentType: 'image/png' }),
  ])

  const subjectPutUrl = subjectResult.signedUrl ?? subjectResult.url ?? ''
  const maskPutUrl    = maskResult.signedUrl    ?? maskResult.url    ?? ''

  if (!subjectPutUrl || !maskPutUrl) {
    throw new Error('Failed to generate presigned PUT URLs — OSS credentials may not be configured')
  }

  return { subjectPutUrl, maskPutUrl, subjectObjectKey, maskObjectKey, expiresInSeconds }
}

// ─── Presigned GET URL (for worker source image download) ─────────────────────

export type TransformPresignedGetUrl = {
  signedGetUrl: string
  expiresInSeconds: number
}

/**
 * Generate a presigned GET URL for the worker to download the source image.
 *
 * Security constraints:
 *  - `sourceObjectKey` must be a platform OSS key (not an arbitrary URL)
 *  - The caller (CC asset-transform route) is responsible for verifying the key
 *    originates from a verified platform CanvasNode.resultImageUrl stored in the DB.
 *  - TTL: 300s (5 minutes) — source URL must be consumed before worker starts
 *  - GET only — worker cannot modify this object
 */
export async function getTransformSourceGetUrl(sourceObjectKey: string): Promise<TransformPresignedGetUrl> {
  // Defensive: key must look like a platform OSS path (no http://, no absolute URLs)
  if (sourceObjectKey.startsWith('http://') || sourceObjectKey.startsWith('https://')) {
    throw new Error('sourceObjectKey must be a storage key, not a URL')
  }
  if (sourceObjectKey.includes('..')) {
    throw new Error('Path traversal detected in sourceObjectKey')
  }
  const expiresInSeconds = 300
  const result = await getSignedDownloadUrl({ key: sourceObjectKey, expiresInSeconds })
  const signedGetUrl = result.signedUrl ?? result.url ?? ''
  if (!signedGetUrl) {
    throw new Error('Failed to generate presigned GET URL — OSS credentials may not be configured')
  }
  return { signedGetUrl, expiresInSeconds }
}

// ─── Stable key derivation (after ingestion) ─────────────────────────────────

export function getTransformStableKeys(ctid: string): { subjectStableKey: string; maskStableKey: string } {
  validateCreatorTransformId(ctid)
  return {
    subjectStableKey: buildTransformStableKey(ctid, 'subject'),
    maskStableKey:    buildTransformStableKey(ctid, 'mask'),
  }
}

// ─── Source key extraction from URL ──────────────────────────────────────────

/**
 * Extract the OSS object key from a stored resultImageUrl.
 *
 * The URL format is: {ALIYUN_OSS_PUBLIC_BASE_URL}/{key}
 * Example: https://example.oss-cn-hangzhou.aliyuncs.com/generated/abc.png → generated/abc.png
 */
export function extractOssKeyFromUrl(url: string): string | null {
  const baseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim()
  if (!baseUrl || !url) return null
  const prefix = baseUrl.replace(/\/+$/, '') + '/'
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length)
  // Paranoia: reject traversal
  if (key.includes('..') || key.startsWith('/')) return null
  return key
}
