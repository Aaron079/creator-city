export type GenerationHealthSection = {
  ok: boolean
  provider?: string
  missingEnv: string[]
  accessMode?: 'public_base_url_or_signed_url' | 'signed_url_or_proxy'
  publicBaseUrlConfigured?: boolean
  isPrivateBucket?: boolean
  signedUrlAvailable?: boolean
  proxyAvailable?: boolean
}

export type ExecutorHealthStatus = {
  configured: boolean
  baseUrlConfigured: boolean
  providers?: Array<{ id: string; label: string; runtimeProviderIds: string[] }>
}

export type GenerationHealthResponse = {
  ok: boolean
  checkedAt: string
  database: GenerationHealthSection
  storage: GenerationHealthSection
  imageGeneration: GenerationHealthSection
  videoGeneration: GenerationHealthSection
  textGeneration: GenerationHealthSection
  missingEnv: string[]
  executors: {
    cn: ExecutorHealthStatus
    global: ExecutorHealthStatus
  }
}
