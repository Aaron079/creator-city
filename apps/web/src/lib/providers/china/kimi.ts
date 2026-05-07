import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaProviderConfig,
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
  return config ? getChinaProviderStatus(config) : null
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

export async function generateKimiText(input: ChinaTextGenerationInput & { providerId?: 'kimi-text' | 'kimi-multimodal' }) {
  const providerId = input.providerId ?? 'kimi-text'
  const apiKey = process.env.MOONSHOT_API_KEY
  const model = providerId === 'kimi-multimodal'
    ? process.env.KIMI_MODEL_MULTIMODAL || process.env.KIMI_MODEL_TEXT || 'kimi-k2.6'
    : process.env.KIMI_MODEL_TEXT || 'kimi-k2.6'
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
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const baseUrl = (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1').replace(/\/+$/, '')
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: input.system || '你是 Creator City 的 API 连通性测试助手。只输出 OK，不要解释。' },
        { role: 'user', content: input.prompt },
      ],
      max_tokens: input.maxTokens || 32,
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
      errorCode: reasoningContent ? 'KIMI_EMPTY_FINAL_CONTENT' : 'KIMI_TEXT_FAILED',
      message: reasoningContent
        ? '模型只返回了 reasoning_content，未返回最终 content。'
        : 'Kimi 未返回文本内容。',
      upstreamStatus: response.status,
      upstreamMessage: reasoningContent
        ? JSON.stringify({ finish_reason: choice?.finish_reason, reasoning_content: reasoningContent.slice(0, 200) })
        : raw.slice(0, 500),
      rawCode: reasoningContent ? 'KIMI_EMPTY_FINAL_CONTENT' : 'KIMI_TEXT_FAILED',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kimi 调用失败。'
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'KIMI_TEXT_FAILED',
      message,
      upstreamMessage: message,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeKimiError = normalizeChinaProviderError
