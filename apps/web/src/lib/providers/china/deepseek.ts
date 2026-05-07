import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  type ChinaProviderConfig,
  type ChinaTextGenerationInput,
} from './types'

export const deepseekProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'deepseek-text',
    envKeys: ['DEEPSEEK_API_KEY'],
    optionalEnvKeys: ['DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL_TEXT'],
    defaultBaseUrl: 'https://api.deepseek.com',
    baseUrlEnvKey: 'DEEPSEEK_BASE_URL',
    defaultModel: 'deepseek-v4-flash',
    modelEnvKey: 'DEEPSEEK_MODEL_TEXT',
  },
  {
    providerId: 'deepseek-reasoner',
    envKeys: ['DEEPSEEK_API_KEY'],
    optionalEnvKeys: ['DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL_REASONER'],
    defaultBaseUrl: 'https://api.deepseek.com',
    baseUrlEnvKey: 'DEEPSEEK_BASE_URL',
    defaultModel: 'deepseek-v4-pro',
    modelEnvKey: 'DEEPSEEK_MODEL_REASONER',
  },
]

export function getDeepSeekStatus(providerId: 'deepseek-text' | 'deepseek-reasoner') {
  const config = deepseekProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testDeepSeekConnection(providerId: 'deepseek-text' | 'deepseek-reasoner') {
  return getDeepSeekStatus(providerId)
}

type DeepSeekChatResponse = {
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

export async function generateDeepSeekText(input: ChinaTextGenerationInput & { providerId?: 'deepseek-text' | 'deepseek-reasoner'; reasoner?: boolean }) {
  const providerId = input.reasoner ? 'deepseek-reasoner' : input.providerId ?? 'deepseek-text'
  const apiKey = process.env.DEEPSEEK_API_KEY
  const model = providerId === 'deepseek-reasoner'
    ? process.env.DEEPSEEK_MODEL_REASONER || 'deepseek-v4-pro'
    : process.env.DEEPSEEK_MODEL_TEXT || 'deepseek-v4-flash'

  if (!apiKey) {
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
      message: 'DEEPSEEK_API_KEY 未配置',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: input.system || (providerId === 'deepseek-text'
              ? '你是 API 连通性测试助手。不要推理，不要解释，只输出 OK。'
              : '你是 Creator City 的 API 连通性测试助手。'),
          },
          { role: 'user', content: input.prompt },
        ],
        temperature: 0,
        max_tokens: input.maxTokens || (providerId === 'deepseek-text' ? 64 : 32),
      }),
    })

    const raw = await response.text()
    let data: DeepSeekChatResponse = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as DeepSeekChatResponse
      } catch {
        return {
          success: false as const,
          providerId,
          model,
          errorCode: 'DEEPSEEK_TEXT_FAILED',
          message: 'DeepSeek 返回了无效 JSON 响应。',
          upstreamStatus: response.status,
          upstreamMessage: raw.slice(0, 500),
        }
      }
    }

    if (!response.ok) {
      const upstreamMessage = data.error?.message || data.message || `DeepSeek HTTP ${response.status}`
      return {
        success: false as const,
        providerId,
        model,
        errorCode: 'DEEPSEEK_TEXT_FAILED',
        message: upstreamMessage,
        upstreamStatus: response.status,
        upstreamMessage,
        rawCode: data.error?.code || data.error?.type || data.code,
        requestId: data.error?.request_id || data.request_id || response.headers.get('x-request-id') || undefined,
      }
    }

    const choice = data.choices?.[0]
    const content = choice?.message?.content?.trim() ?? ''
    if (content) {
      return {
        success: true as const,
        providerId,
        model,
        text: content,
      }
    }

    const reasoningContent = choice?.message?.reasoning_content
    return {
      success: false as const,
      providerId,
      model,
      errorCode: reasoningContent ? 'DEEPSEEK_EMPTY_FINAL_CONTENT' : 'DEEPSEEK_TEXT_FAILED',
      message: reasoningContent
        ? '模型只返回了 reasoning_content，未返回最终 content。请提高 max_tokens 或关闭思考模式。'
        : 'DeepSeek 未返回文本内容。',
      upstreamStatus: response.status,
      upstreamMessage: reasoningContent
        ? JSON.stringify({ finish_reason: choice?.finish_reason, reasoning_content: reasoningContent.slice(0, 200) })
        : raw.slice(0, 500),
      rawCode: reasoningContent ? 'DEEPSEEK_EMPTY_FINAL_CONTENT' : 'DEEPSEEK_TEXT_FAILED',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepSeek 调用失败。'
    return {
      success: false as const,
      providerId,
      model,
      errorCode: 'DEEPSEEK_TEXT_FAILED',
      message,
      upstreamMessage: message,
    }
  } finally {
    clearTimeout(timer)
  }
}

export const normalizeDeepSeekError = normalizeChinaProviderError
