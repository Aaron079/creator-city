import type { ServerResponse } from 'http'

export function jsonResponse(
  res: ServerResponse,
  body: unknown,
  status = 200,
): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

export function jsonOk(res: ServerResponse, body: unknown): void {
  jsonResponse(res, body, 200)
}

export function jsonError(
  res: ServerResponse,
  body: { errorCode: string; message: string; [key: string]: unknown },
  status = 200,
): void {
  jsonResponse(res, { success: false, ...body }, status)
}

export function jsonNotFound(res: ServerResponse, path: string): void {
  jsonError(res, { errorCode: 'route_not_found', message: `No route for ${path}`, path }, 404)
}

export function jsonUnauthorized(res: ServerResponse): void {
  jsonError(
    res,
    { errorCode: 'unauthorized', message: 'Missing or invalid X-Creator-Executor-Secret header.' },
    401,
  )
}
