import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { jsonResponse } from '../response'
import { VOLCENGINE_ARK_DEFAULT_BASE_URL, imageEndpoint } from '../volcengine'

// Tests Volcengine with VALID params (real generation-grade request) to expose
// auth errors that only appear when Volcengine actually attempts inference.
// The probe with size=1x1 only tests parameter validation (pre-inference), not
// inference authorization. This endpoint tests the full path.
// It does NOT download or upload to OSS — only the Volcengine HTTP response is returned.
export async function handleSeedreamRealProbe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonResponse(res, { ok: false, errorCode: 'cn_executor_auth_failed' }, 401)
    return
  }

  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim() ?? ''
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() ?? ''
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const endpoint = imageEndpoint(baseUrl)

  if (!apiKey || !model) {
    jsonResponse(res, { ok: false, error: 'VOLCENGINE_ARK_API_KEY or VOLCENGINE_SEEDREAM_MODEL not set', endpoint, model: model || null }, 200)
    return
  }

  console.log('[seedream-real-probe] starting real-params test', { endpoint, model })
  const t0 = Date.now()

  let httpStatus: number | null = null
  let rawBody = ''
  let parsedBody: unknown = null
  let fetchError: string | null = null

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: 'a simple test image, one color',
        size: '2048x2048',  // valid size (>= 3,686,400 pixels)
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(25_000),
    })
    httpStatus = resp.status
    rawBody = await resp.text()
    try { parsedBody = JSON.parse(rawBody) } catch { parsedBody = rawBody.slice(0, 500) }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  const durationMs = Date.now() - t0
  console.log('[seedream-real-probe] done', { httpStatus, durationMs, fetchError })

  // Classify the result
  let conclusion: string
  if (fetchError) {
    conclusion = fetchError.includes('timeout') || fetchError.includes('abort')
      ? `TIMEOUT after ${durationMs}ms — model may be generating (good sign) but probe timed out. Try real generation.`
      : `NETWORK ERROR: ${fetchError}`
  } else if (httpStatus === 200) {
    conclusion = 'SUCCESS — Volcengine accepted the request and returned an image response. Generation should work.'
  } else if (httpStatus === 400) {
    conclusion = 'PARAM_ERROR — model accessible but rejected a parameter (unexpected for valid-size request).'
  } else if (httpStatus === 401) {
    conclusion = 'AUTH FAILED (401) — API key is invalid or the endpoint requires different credentials. Check VOLCENGINE_ARK_API_KEY.'
  } else if (httpStatus === 403) {
    conclusion = 'FORBIDDEN (403) — API key valid but no permission for this endpoint or model. Check endpoint status in Volcengine ARK console.'
  } else if (httpStatus === 404) {
    conclusion = 'NOT FOUND (404) — endpoint/model does not exist or was deleted.'
  } else if (httpStatus !== null && httpStatus >= 500) {
    conclusion = `SERVER ERROR (${httpStatus}) — Volcengine internal error. May be transient.`
  } else {
    conclusion = `UNKNOWN (status=${httpStatus})`
  }

  jsonResponse(res, {
    ok: httpStatus === 200,
    endpoint,
    model,
    httpStatus,
    durationMs,
    fetchError,
    conclusion,
    volcengineResponse: parsedBody,
    rawResponsePreview: typeof rawBody === 'string' ? rawBody.slice(0, 800) : null,
  }, 200)
}
