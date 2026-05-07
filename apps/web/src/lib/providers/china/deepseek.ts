import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderConfig } from './types'

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

export const normalizeDeepSeekError = normalizeChinaProviderError
