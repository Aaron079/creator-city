import type { IncomingMessage } from 'http'
import { getSharedSecret } from './env'

export function isAuthorized(req: IncomingMessage): boolean {
  const secret = getSharedSecret()
  // If no secret is configured, deny all authenticated requests.
  // /health is exempt from auth and never calls this.
  if (!secret) return false
  const header = req.headers['x-creator-executor-secret']
  const provided = Array.isArray(header) ? header[0] : header
  return typeof provided === 'string' && provided === secret
}
