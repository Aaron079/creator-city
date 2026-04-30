import { createHmac, timingSafeEqual, createVerify } from 'crypto'

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyRsaSha256(publicKey: string, payload: string, signatureBase64: string): boolean {
  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(payload)
    verifier.end()
    return verifier.verify(publicKey, signatureBase64, 'base64')
  } catch {
    return false
  }
}
