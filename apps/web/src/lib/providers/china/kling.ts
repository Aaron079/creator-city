import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderConfig } from './types'

export const klingProviderConfigs: ChinaProviderConfig[] = [
  {
    providerId: 'kling-video',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_VIDEO'],
    baseUrlEnvKey: 'KLING_BASE_URL',
    defaultModel: 'kling-v3',
    modelEnvKey: 'KLING_MODEL_VIDEO',
  },
  {
    providerId: 'kling-image',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_IMAGE'],
    baseUrlEnvKey: 'KLING_BASE_URL',
    defaultModel: 'kling-image-v3',
    modelEnvKey: 'KLING_MODEL_IMAGE',
  },
  {
    providerId: 'kling-image-to-video',
    envKeys: ['KLING_ACCESS_KEY', 'KLING_SECRET_KEY'],
    optionalEnvKeys: ['KLING_BASE_URL', 'KLING_MODEL_I2V'],
    baseUrlEnvKey: 'KLING_BASE_URL',
    defaultModel: 'kling-i2v-v3',
    modelEnvKey: 'KLING_MODEL_I2V',
  },
]

export function getKlingStatus(providerId: 'kling-video' | 'kling-image' | 'kling-image-to-video') {
  const config = klingProviderConfigs.find((item) => item.providerId === providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testKlingConnection(providerId: 'kling-video' | 'kling-image' | 'kling-image-to-video') {
  return getKlingStatus(providerId)
}

export const normalizeKlingError = normalizeChinaProviderError
