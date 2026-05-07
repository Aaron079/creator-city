import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderConfig } from './types'

export const volcengineProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'volcengine-seedance-video',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDANCE_MODEL'],
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: 'seedance-2-0',
    modelEnvKey: 'VOLCENGINE_SEEDANCE_MODEL',
  },
  {
    providerId: 'volcengine-seedream-image',
    envKeys: ['VOLCENGINE_ACCESS_KEY_ID', 'VOLCENGINE_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['VOLCENGINE_REGION', 'VOLCENGINE_ARK_BASE_URL', 'VOLCENGINE_SEEDREAM_MODEL'],
    baseUrlEnvKey: 'VOLCENGINE_ARK_BASE_URL',
    defaultModel: 'seedream-5-0-lite',
    modelEnvKey: 'VOLCENGINE_SEEDREAM_MODEL',
  },
]

export function getVolcengineStatus(providerId: 'volcengine-seedance-video' | 'volcengine-seedream-image') {
  const config = volcengineProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testVolcengineConnection(providerId: 'volcengine-seedance-video' | 'volcengine-seedream-image') {
  return getVolcengineStatus(providerId)
}

export const normalizeVolcengineError = normalizeChinaProviderError
