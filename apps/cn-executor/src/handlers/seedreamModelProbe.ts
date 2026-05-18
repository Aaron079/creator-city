import type { IncomingMessage, ServerResponse } from 'http'
import { isAuthorized } from '../auth'
import { jsonResponse } from '../response'
import { VOLCENGINE_ARK_DEFAULT_BASE_URL, imageEndpoint } from '../volcengine'

// Volcengine Seedream sizes that are known-valid (for reference in conclusion)
const VALID_SIZES = ['1920x1080', '1080x1920', '2048x2048', '1536x2048', '2048x1536']

// Probe body intentionally uses an invalid size so no real generation is ever triggered.
// Volcengine validates model first, then parameters:
//   - invalid model → 404 immediately (no generation cost)
//   - valid model + invalid size → 400 parameter error (no generation cost)
//   - valid model + valid size → would generate (we avoid this by using size='1x1')
const PROBE_SIZE = '1x1' // not in Volcengine's allowed list — guaranteed to fail parameter validation

function looksLikeEndpointId(v: string): boolean {
  return /^ep-[a-z0-9][a-z0-9-]*$/i.test(v.trim())
}

function looksLikeModelId(v: string): boolean {
  const n = v.trim().toLowerCase()
  if (!n || looksLikeEndpointId(v)) return false
  return /^(doubao-)?seedream-\d/.test(n) || /^doubao-/.test(n)
}

type ProbeResult = {
  model: string
  isCurrentEnvModel: boolean
  looksLikeEndpointId: boolean
  looksLikeModelId: boolean
  httpStatus: number | null
  errorCode: string | null
  message: string | null
  requestId: string | null
  rawErrorPreview: string | null
  error?: string
  conclusion: 'model_not_found' | 'auth_failed' | 'param_error_model_accessible' | 'server_error' | 'fetch_failed' | 'unknown'
}

async function probeModel(endpoint: string, apiKey: string, model: string, isCurrentEnvModel: boolean): Promise<ProbeResult> {
  const base: Omit<ProbeResult, 'httpStatus' | 'errorCode' | 'message' | 'requestId' | 'rawErrorPreview' | 'conclusion'> = {
    model,
    isCurrentEnvModel,
    looksLikeEndpointId: looksLikeEndpointId(model),
    looksLikeModelId: looksLikeModelId(model),
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // size=1x1 is invalid — ensures no real image is generated even if model is valid.
      body: JSON.stringify({
        model,
        prompt: 'diagnostic-probe',
        size: PROBE_SIZE,
        n: 1,
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return {
      ...base,
      httpStatus: null,
      errorCode: 'fetch_failed',
      message: err instanceof Error ? err.message : String(err),
      requestId: null,
      rawErrorPreview: null,
      error: err instanceof Error ? err.message : String(err),
      conclusion: 'fetch_failed',
    }
  }

  const requestId =
    response.headers.get('x-request-id') ??
    response.headers.get('x-tt-request-id') ??
    null

  let rawText = ''
  let data: Record<string, unknown> = {}
  try {
    rawText = await response.text()
    const parsed = JSON.parse(rawText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  } catch {
    // non-JSON response, use rawText
  }

  const errorObj = (data.error && typeof data.error === 'object' && !Array.isArray(data.error))
    ? (data.error as Record<string, unknown>)
    : data

  const upstreamMessage =
    typeof errorObj.message === 'string'
      ? errorObj.message
      : typeof data.message === 'string'
        ? data.message
        : rawText.slice(0, 400) || null

  const upstreamCode =
    typeof errorObj.code === 'string'
      ? errorObj.code
      : typeof errorObj.type === 'string'
        ? errorObj.type
        : null

  const bodyRequestId =
    typeof errorObj.request_id === 'string'
      ? errorObj.request_id
      : typeof data.request_id === 'string'
        ? data.request_id
        : null

  const effectiveRequestId = requestId ?? bodyRequestId

  const s = response.status
  let conclusion: ProbeResult['conclusion']
  if (s === 200) {
    // Unexpected — model accepted even with invalid size; treat as accessible
    conclusion = 'param_error_model_accessible'
  } else if (s === 400 || s === 422) {
    // Size/param validation error — model IS accessible, just needs valid params
    conclusion = 'param_error_model_accessible'
  } else if (s === 401 || s === 403) {
    conclusion = 'auth_failed'
  } else if (s === 404) {
    conclusion = 'model_not_found'
  } else if (s >= 500) {
    conclusion = 'server_error'
  } else {
    conclusion = 'unknown'
  }

  return {
    ...base,
    httpStatus: s,
    errorCode: upstreamCode,
    message: upstreamMessage,
    requestId: effectiveRequestId,
    rawErrorPreview: rawText.slice(0, 600) || null,
    conclusion,
  }
}

export async function handleSeedreamModelProbe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isAuthorized(req)) {
    jsonResponse(res, { ok: false, errorCode: 'cn_executor_auth_failed' }, 401)
    return
  }

  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim() ?? ''
  const currentEnvModel = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() ?? ''
  const baseUrl = (process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL).replace(/\/+$/, '')
  const endpoint = imageEndpoint(baseUrl)

  if (!apiKey) {
    jsonResponse(res, {
      ok: false,
      errorCode: 'provider_auth_failed',
      message: 'VOLCENGINE_ARK_API_KEY is not set — cannot probe.',
      endpoint,
      currentEnvModel: currentEnvModel || null,
    }, 200)
    return
  }

  // Deduplicate candidates: always probe the env model + known model IDs
  const candidateModels = [
    currentEnvModel || null,
    'doubao-seedream-5-0-260128',
    'doubao-seedream-4-0-250828',
    'seedream-5-0-260128',
  ].filter((m, i, arr): m is string => Boolean(m) && arr.indexOf(m) === i)

  console.log('[seedream-model-probe] starting', { endpoint, candidates: candidateModels })

  const results = await Promise.all(
    candidateModels.map((model) =>
      probeModel(endpoint, apiKey, model, model === currentEnvModel),
    ),
  )

  const accessible = results.filter((r) => r.conclusion === 'param_error_model_accessible')
  const notFound = results.filter((r) => r.conclusion === 'model_not_found')
  const authFailed = results.filter((r) => r.conclusion === 'auth_failed')

  let overallOk = false
  let conclusion: string

  if (authFailed.length === candidateModels.length) {
    conclusion = 'auth_failed: API Key 对所有候选 model 都返回 401/403，请检查 VOLCENGINE_ARK_API_KEY。'
  } else if (accessible.length > 0) {
    overallOk = true
    const accessibleModels = accessible.map((r) => r.model).join(', ')
    const envModelOk = accessible.some((r) => r.isCurrentEnvModel)
    if (envModelOk) {
      conclusion = `model_accessible: 当前 VOLCENGINE_SEEDREAM_MODEL 可访问 (${currentEnvModel})，但请求参数需修正（size 必须为 ${VALID_SIZES.slice(0, 3).join('/')} 等）。`
    } else {
      conclusion = `env_model_not_found_but_alternative_accessible: 当前 env model [${currentEnvModel || 'unset'}] 返回 404；备用 model 可访问: [${accessibleModels}]。请将 VOLCENGINE_SEEDREAM_MODEL 改为其中之一。`
    }
  } else if (notFound.length === candidateModels.length) {
    conclusion = `all_models_not_found: 所有候选 model (${candidateModels.join(', ')}) 均返回 404。当前 API Key 可能无权访问 Seedream image 模型，或接入点 ID 已过期/错误。请在火山方舟控制台确认可用模型。`
  } else {
    conclusion = `mixed_results: 部分 model 404，部分其他错误。请查看 candidates 详情。`
  }

  console.log('[seedream-model-probe] done', { conclusion, accessibleCount: accessible.length })

  jsonResponse(res, {
    ok: overallOk,
    endpoint,
    currentEnvModel: currentEnvModel || null,
    probeSize: PROBE_SIZE,
    probeNote: `size=${PROBE_SIZE} is intentionally invalid — model-not-found (404) happens before size validation, so 404 means model inaccessible; 400 means model accessible but params need fixing.`,
    candidates: results.map((r) => ({
      model: r.model,
      isCurrentEnvModel: r.isCurrentEnvModel,
      looksLikeEndpointId: r.looksLikeEndpointId,
      looksLikeModelId: r.looksLikeModelId,
      httpStatus: r.httpStatus,
      errorCode: r.errorCode,
      message: r.message,
      requestId: r.requestId,
      rawErrorPreview: r.rawErrorPreview,
      conclusion: r.conclusion,
    })),
    conclusion,
  }, 200)
}
