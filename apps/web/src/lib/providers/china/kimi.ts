import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaProviderConfig,
  type ChinaTextGenerationResult,
  type ChinaTextGenerationInput,
} from './types'

export const kimiProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'kimi-text',
    envKeys: ['MOONSHOT_API_KEY'],
    optionalEnvKeys: ['MOONSHOT_BASE_URL', 'KIMI_MODEL_TEXT'],
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    baseUrlEnvKey: 'MOONSHOT_BASE_URL',
    defaultModel: 'kimi-k2.6',
    modelEnvKey: 'KIMI_MODEL_TEXT',
  },
  {
    providerId: 'kimi-multimodal',
    envKeys: ['MOONSHOT_API_KEY'],
    optionalEnvKeys: ['MOONSHOT_BASE_URL', 'KIMI_MODEL_MULTIMODAL'],
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    baseUrlEnvKey: 'MOONSHOT_BASE_URL',
    defaultModel: 'kimi-k2.6',
    modelEnvKey: 'KIMI_MODEL_MULTIMODAL',
  },
]

export function getKimiStatus(providerId: 'kimi-text' | 'kimi-multimodal') {
  const config = kimiProviderConfigs.find((item) => item.providerId === providerId)
  if (!config) return null
  const status = getChinaProviderStatus(config)
  return {
    ...status,
    model: getKimiModel(providerId),
    baseUrl: status.baseUrl?.replace(/\/+$/, '') ?? null,
  }
}

export function testKimiConnection(providerId: 'kimi-text' | 'kimi-multimodal') {
  return getKimiStatus(providerId)
}

type KimiChatResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string
      reasoning_content?: string
    }
  }>
  error?: {
    message?: string
    code?: string
    type?: string
    request_id?: string
  }
  message?: string
  code?: string
  request_id?: string
}

function isKimiK2Model(model: string) {
  return /^kimi-k2\.(5|6)(?:\b|[-_])/i.test(model)
}

function getKimiModel(providerId: 'kimi-text' | 'kimi-multimodal') {
  return (providerId === 'kimi-multimodal' ? process.env.KIMI_MODEL_MULTIMODAL : undefined)
    || process.env.KIMI_MODEL_TEXT || 'kimi-k2.6'
}

const TRANSPORT_ERROR_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
])

function transportErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined
  const cause = error.cause
  const code = cause && typeof cause === 'object' && 'code' in cause
    ? cause.code
    : (error as Error & { code?: unknown }).code
  return typeof code === 'string' && TRANSPORT_ERROR_CODES.has(code) ? code : undefined
}

export async function generateKimiText(input: ChinaTextGenerationInput & { providerId?: 'kimi-text' | 'kimi-multimodal'; purpose?: 'ping' | 'generate'; apiKeyOverride?: string }): Promise<ChinaTextGenerationResult> {
  const providerId = input.providerId ?? 'kimi-text'
  const purpose = input.purpose ?? 'ping'
  const apiKey = input.apiKeyOverride ?? process.env.MOONSHOT_API_KEY
  const model = getKimiModel(providerId)
  if (!apiKey) {
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'MOONSHOT_API_KEY 未配置',
    }
  }

  const controller = new AbortController()
  const timeoutMs = purpose === 'generate' ? 60000 : 20000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const baseUrl = (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/+$/, '')
    const body: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: input.system || (purpose === 'ping'
            ? '你是 Creator City 的 API 连通性测试助手。只输出 OK，不要解释。'
            : '你是 Creator City 的创作助手。请直接输出创作内容，不要解释调用过程。'),
        },
        { role: 'user', content: purpose === 'ping' ? '请只回复 OK' : input.prompt },
      ],
      max_tokens: purpose === 'ping' ? 16 : input.maxTokens || 1024,
    }
    if (isKimiK2Model(model)) {
      body.thinking = { type: 'disabled' }
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    let data: KimiChatResponse = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as KimiChatResponse
      } catch {
        return {
          success: false as const,
          providerId,
          model,
          errorCode: 'KIMI_TEXT_FAILED',
          message: 'Kimi 返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
        }
      }
    }

    if (!response.ok) {
      const upstreamMessage = data.error?.message || data.message || `Kimi HTTP ${response.status}`
      return {
        success: false as const,
        providerId,
        model,
        errorCode: 'KIMI_TEXT_FAILED',
        message: upstreamMessage,
        upstreamStatus: response.status,
        upstreamMessage,
        rawCode: data.error?.code || data.error?.type || data.code,
        requestId: data.error?.request_id || data.request_id || response.headers.get('x-request-id') || undefined,
      }
    }

    const choice = data.choices?.[0]
    const text = choice?.message?.content?.trim() ?? ''
    if (text) {
      return {
        success: true as const,
        providerId,
        model,
        text,
      }
    }

    const reasoningContent = choice?.message?.reasoning_content
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'KIMI_EMPTY_FINAL_CONTENT',
      message: reasoningContent
        ? '模型只返回了 reasoning_content，未返回最终 content。'
        : 'Kimi 未返回最终文本内容',
      upstreamStatus: response.status,
      upstreamMessage: reasoningContent
        ? JSON.stringify({ finish_reason: choice?.finish_reason, reasoning_content: reasoningContent.slice(0, 200) })
        : raw.slice(0, 500),
      rawCode: 'KIMI_EMPTY_FINAL_CONTENT',
    }
  } catch (error) {
    const isAbort = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
    if (isAbort) {
      return {
        success: false as const,
        providerId,
        model,
        errorCode: 'KIMI_REQUEST_TIMEOUT',
        message: 'Kimi 请求超时或被中断，请重试。',
        upstreamMessage: 'Kimi request aborted or timed out.',
      }
    }
    const rawCode = transportErrorCode(error)
    const message = 'Kimi 网络请求失败，请稍后重试。'
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'KIMI_TEXT_FAILED',
      message,
      upstreamMessage: rawCode ? `Kimi network request failed (${rawCode}).` : 'Kimi network request failed.',
      rawCode,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeKimiError = normalizeChinaProviderError
