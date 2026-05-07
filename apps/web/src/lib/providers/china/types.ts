export type ChinaProviderId =
  | 'deepseek-text'
  | 'deepseek-reasoner'
  | 'kimi-text'
  | 'kimi-multimodal'
  | 'kling-video'
  | 'kling-image'
  | 'kling-image-to-video'
  | 'volcengine-seedance-video'
  | 'volcengine-seedream-image'
  | 'jimeng-image'
  | 'jimeng-video'

export interface ChinaProviderConfig {
  providerId: ChinaProviderId
  envKeys: string[]
  optionalEnvKeys?: string[]
  defaultModel: string
  modelEnvKey: string
  defaultBaseUrl?: string
  baseUrlEnvKey?: string
}

export interface ChinaProviderStatus {
  success: true
  mode: 'env-only'
  providerId: ChinaProviderId
  configured: boolean
  missingEnv: string[]
  model: string
  baseUrl: string | null
}

export interface ChinaTextGenerationInput {
  prompt: string
  system?: string
  maxTokens?: number
}

export type ChinaTextGenerationResult =
  | {
      success: true
      providerId: ChinaProviderId
      model: string
      text: string
    }
  | {
      success: false
      providerId: ChinaProviderId
      model?: string
      errorCode: string
      message: string
    }

export function getChinaProviderStatus(config: ChinaProviderConfig): ChinaProviderStatus {
  const missingEnv = config.envKeys.filter((key) => !process.env[key])
  const baseUrl = config.baseUrlEnvKey
    ? process.env[config.baseUrlEnvKey] || config.defaultBaseUrl || null
    : config.defaultBaseUrl || null

  return {
    success: true,
    mode: 'env-only',
    providerId: config.providerId,
    configured: missingEnv.length === 0,
    missingEnv,
    model: process.env[config.modelEnvKey] || config.defaultModel,
    baseUrl,
  }
}

export function normalizeChinaProviderError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : typeof error === 'string' ? error : 'China provider error',
    retryable: false,
  }
}

export async function postOpenAICompatibleChat(options: {
  providerId: ChinaProviderId
  apiKey: string
  baseUrl: string
  model: string
  prompt: string
  system?: string
  maxTokens?: number
  errorCode: string
}): Promise<ChinaTextGenerationResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(`${options.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: options.system || '你是 Creator City 的创作助手。' },
          { role: 'user', content: options.prompt },
        ],
        temperature: 0.7,
        max_tokens: options.maxTokens || 512,
      }),
    })

    const raw = await response.text()
    let data: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as typeof data
      } catch {
        return {
          success: false,
          providerId: options.providerId,
          model: options.model,
          errorCode: options.errorCode,
          message: `${options.providerId} 返回了无效 JSON 响应。`,
        }
      }
    }

    if (!response.ok) {
      return {
        success: false,
        providerId: options.providerId,
        model: options.model,
        errorCode: options.errorCode,
        message: data.error?.message || `${options.providerId} HTTP ${response.status}`,
      }
    }

    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) {
      return {
        success: false,
        providerId: options.providerId,
        model: options.model,
        errorCode: options.errorCode,
        message: `${options.providerId} 未返回文本内容。`,
      }
    }

    return {
      success: true,
      providerId: options.providerId,
      model: options.model,
      text,
    }
  } catch (error) {
    return {
      success: false,
      providerId: options.providerId,
      model: options.model,
      errorCode: options.errorCode,
      message: error instanceof Error ? error.message : `${options.providerId} 调用失败。`,
    }
  } finally {
    clearTimeout(timer)
  }
}
