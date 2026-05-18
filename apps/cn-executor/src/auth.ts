import type { IncomingMessage } from 'http'
import { getSharedSecret } from './env'

export function isAuthorized(req: IncomingMessage): boolean {
  const secret = getSharedSecret()
  // If no secret is configured, deny all authenticated requests.
  // /health is exempt from auth and never calls this.
  if (!secret) return false

  // Accept custom header — used by manual/debug callers and direct curl
  const customHeader = req.headers['x-creator-executor-secret']
  const customProvided = Array.isArray(customHeader) ? customHeader[0] : customHeader
  if (typeof customProvided === 'string' && customProvided === secret) return true

  // Accept Authorization: Bearer <secret> — used by Vercel programmatic calls
  const authHeader = req.headers['authorization']
  const authProvided = Array.isArray(authHeader) ? authHeader[0] : authHeader
  if (typeof authProvided === 'string' && authProvided === `Bearer ${secret}`) return true

  return false
}
