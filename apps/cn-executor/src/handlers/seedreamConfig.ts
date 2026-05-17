import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { jsonResponse } from '../response'
import { getSeedreamConfigDebugPayload } from '../volcengine'

export function handleSeedreamConfigDebug(req: IncomingMessage, res: ServerResponse): void {
  if (!isAuthorized(req)) {
    jsonResponse(res, {
      ok: false,
      errorCode: 'cn_executor_auth_failed',
    }, 401)
    return
  }

  jsonResponse(res, getSeedreamConfigDebugPayload(), 200)
}
