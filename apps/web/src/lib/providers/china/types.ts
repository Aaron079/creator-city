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
