/**
 * Server-side only. Extracts userId from a Bearer JWT without verifying
 * the signature — the NestJS server is the authority for signature verification.
 * We only need the subject to attach billing context.
 */

export interface JwtPayload {
  sub: string
  username: string
  role: string
  iat?: number
  exp?: number
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const encoded = parts[1]
    if (!encoded) return null
    const payload = Buffer.from(encoded, 'base64url').toString('utf-8')
    return JSON.parse(payload) as JwtPayload
  } catch {
    return null
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export function getUserIdFromRequest(headers: Headers): string | null {
  const auth = headers.get('authorization')
  const token = extractBearerToken(auth)
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload?.sub) return null
  return payload.sub
}
