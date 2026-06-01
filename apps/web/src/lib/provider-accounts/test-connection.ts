/**
 * Server-side only. Lightweight connection tests for user-owned provider API keys.
 *
 * Strategy: GET /models (OpenAI-compatible endpoint) — zero token cost, pure auth
 * validation. Never generates content, writes assets, or uses platform keys.
 *
 * Supported providers: deepseek-text, deepseek-reasoner, kimi-text, openai-text
 * Image/video/audio providers return 'unsupported'.
 *
 * Error messages are fixed user-facing strings. Raw provider responses are never
 * forwarded — this prevents leaking key fragments, request IDs, or internal messages.
 */

export type TestStatus =
  | 'ok'
  | 'auth_failed'
  | 'timeout'
  | 'rate_limited'
  | 'insufficient_quota'
  | 'unsupported'
  | 'error'

export type ProviderTestResult = {
  status: TestStatus
  message: string
}

const TEST_TIMEOUT_MS = 10_000

/**
 * Calls GET /models on the provider's base URL to validate the API key.
 * This is the OpenAI-compatible models list endpoint — free, no content generated.
 * Status code mapping uses fixed strings; raw API error bodies are discarded.
 */
async function pingModelsEndpoint(
  baseUrl: string,
  apiKey: string,
  providerLabel: string,
): Promise<ProviderTestResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS)
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })

    if (res.ok) return { status: 'ok', message: '连接成功。' }

    if (res.status === 401 || res.status === 403) {
      return { status: 'auth_failed', message: 'API Key 无效，请检查后重新添加。' }
    }
    if (res.status === 402) {
      return { status: 'insufficient_quota', message: 'Provider 账户额度不足，请检查账户余额。' }
    }
    if (res.status === 429) {
      return { status: 'rate_limited', message: 'Provider 请求频率限制，请稍后重试。' }
    }
    return { status: 'error', message: `${providerLabel} 返回异常状态，请稍后重试。` }
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
    if (isAbort) return { status: 'timeout', message: '测试连接超时，请稍后重试。' }
    return { status: 'error', message: `无法连接到 ${providerLabel}，请稍后重试。` }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Tests whether the given user-owned API key can authenticate with its provider.
 * The apiKey is used only in-memory for the HTTP request; it is never logged.
 */
export async function testProviderConnection(
  providerId: string,
  apiKey: string,
): Promise<ProviderTestResult> {
  switch (providerId) {
    case 'deepseek-text':
    case 'deepseek-reasoner':
      return pingModelsEndpoint('https://api.deepseek.com', apiKey, 'DeepSeek')
    case 'kimi-text':
      return pingModelsEndpoint('https://api.moonshot.cn/v1', apiKey, 'Kimi')
    case 'openai-text':
      return pingModelsEndpoint('https://api.openai.com/v1', apiKey, 'OpenAI')
    default:
      return { status: 'unsupported', message: '该 Provider 暂不支持自动测试连接。' }
  }
}
