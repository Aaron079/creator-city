/**
 * CC → Railway Gateway Service HMAC signing utility.
 *
 * Scheme: HMAC-SHA256(key=secret, msg="{timestamp}:{nonce}:{body_sha256_hex}")
 * Headers:
 *   Authorization: Bearer {mac_hex}
 *   X-Timestamp: {unix_seconds}
 *   X-Nonce: {uuid4}
 *   X-Body-Digest: {sha256_hex of raw body bytes}
 *   Content-Type: application/json
 *
 * Matches the scheme verified by gateway/app/auth.py on the Railway side.
 */

import crypto from 'crypto'

function hexSha256(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function hmacSha256Hex(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message).digest('hex')
}

export function buildGatewayHmacHeaders(
  secret: string,
  bodyBuffer: Buffer,
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomUUID()
  const bodyDigest = hexSha256(bodyBuffer)
  const message = `${timestamp}:${nonce}:${bodyDigest}`
  const mac = hmacSha256Hex(secret, message)
  return {
    Authorization: `Bearer ${mac}`,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Body-Digest': bodyDigest,
    'Content-Type': 'application/json',
  }
}

/**
 * Verify incoming HMAC from Railway Gateway (for CC Internal Ingest API).
 * Constant-time compare to prevent timing attacks.
 */
export async function verifyIngestHmac(
  request: Request,
  secret: string,
  bodyBuffer: Buffer,
): Promise<{ valid: boolean; reason?: string }> {
  const authHeader = request.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'missing Authorization header' }
  }
  const providedMac = authHeader.slice('Bearer '.length)
  const timestamp = request.headers.get('X-Timestamp') ?? ''
  const nonce = request.headers.get('X-Nonce') ?? ''
  const bodyDigest = request.headers.get('X-Body-Digest') ?? ''

  if (!timestamp || !nonce || !bodyDigest) {
    return { valid: false, reason: 'missing HMAC headers' }
  }

  // Timestamp window: ±30 seconds
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 30) {
    return { valid: false, reason: 'timestamp out of window' }
  }

  // Body digest verify
  const actualDigest = hexSha256(bodyBuffer)
  if (!crypto.timingSafeEqual(Buffer.from(actualDigest), Buffer.from(bodyDigest))) {
    return { valid: false, reason: 'body digest mismatch' }
  }

  // HMAC verify
  const message = `${timestamp}:${nonce}:${bodyDigest}`
  const expectedMac = hmacSha256Hex(secret, message)
  const providedBuf = Buffer.from(providedMac.padEnd(expectedMac.length, '\0'))
  const expectedBuf = Buffer.from(expectedMac)
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: 'HMAC mismatch' }
  }

  return { valid: true }
}
