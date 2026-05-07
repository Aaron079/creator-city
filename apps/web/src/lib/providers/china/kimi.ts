import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  postOpenAICompatibleChat,
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

  return postOpenAICompatibleChat({
    providerId,
    apiKey,
    baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
    model,
    prompt: input.prompt,
    system: input.system || '你是 Creator City 的 API 连通性测试助手。',
    maxTokens: input.maxTokens,
    errorCode: 'KIMI_TEXT_FAILED',
  })
}

export const normalizeKimiError = normalizeChinaProviderError
