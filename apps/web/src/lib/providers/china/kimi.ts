import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderConfig } from './types'

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

export const normalizeKimiError = normalizeChinaProviderError
