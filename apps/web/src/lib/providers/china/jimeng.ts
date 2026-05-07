import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderConfig } from './types'

export const jimengProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'jimeng-image',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_IMAGE'],
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    defaultModel: 'jimeng-image-4-0',
    modelEnvKey: 'JIMENG_MODEL_IMAGE',
  },
  {
    providerId: 'jimeng-video',
    envKeys: ['JIMENG_ACCESS_KEY_ID', 'JIMENG_SECRET_ACCESS_KEY'],
    optionalEnvKeys: ['JIMENG_BASE_URL', 'JIMENG_MODEL_VIDEO'],
    baseUrlEnvKey: 'JIMENG_BASE_URL',
    defaultModel: 'jimeng-video-3-0-pro',
    modelEnvKey: 'JIMENG_MODEL_VIDEO',
  },
]

export function getJimengStatus(providerId: 'jimeng-image' | 'jimeng-video') {
  const config = jimengProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testJimengConnection(providerId: 'jimeng-image' | 'jimeng-video') {
  return getJimengStatus(providerId)
}

export const normalizeJimengError = normalizeChinaProviderError
