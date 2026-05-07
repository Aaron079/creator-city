import { deepseekProviderConfigs } from './deepseek'
import { jimengProviderConfigs } from './jimeng'
import { kimiProviderConfigs } from './kimi'
import { klingProviderConfigs } from './kling'
import { getChinaProviderStatus, normalizeChinaProviderError, type ChinaProviderId } from './types'
import { volcengineProviderConfigs } from './volcengine'

export type { ChinaProviderConfig, ChinaProviderId, ChinaProviderStatus } from './types'
export { normalizeChinaProviderError }

export const CHINA_PROVIDER_CONFIGS = [
  ...deepseekProviderConfigs,
  ...kimiProviderConfigs,
  ...klingProviderConfigs,
  ...volcengineProviderConfigs,
  ...jimengProviderConfigs,
]

export function getChinaProviderConfig(providerId: string) {
  return CHINA_PROVIDER_CONFIGS.find((config) => config.providerId === providerId) ?? null
}

export function getChinaProviderRuntimeStatus(providerId: string) {
  const config = getChinaProviderConfig(providerId)
  return config ? getChinaProviderStatus(config) : null
}

export function testChinaProviderConnection(providerId: string) {
  return getChinaProviderRuntimeStatus(providerId as ChinaProviderId)
}

export function normalizeProviderError(error: unknown) {
  return normalizeChinaProviderError(error)
}
