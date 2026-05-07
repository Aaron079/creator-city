import {
  getChinaProviderStatus,
  normalizeChinaProviderError,
  postOpenAICompatibleChat,
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

  return postOpenAICompatibleChat({
    providerId,
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model,
    prompt: input.prompt,
    system: input.system,
    maxTokens: input.maxTokens,
    errorCode: 'DEEPSEEK_TEXT_FAILED',
  })
}

export const normalizeDeepSeekError = normalizeChinaProviderError
