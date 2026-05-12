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

export type GenerationHealthResponse = {
  ok: boolean
  checkedAt: string
  database: GenerationHealthSection
  storage: GenerationHealthSection
  imageGeneration: GenerationHealthSection
  videoGeneration: GenerationHealthSection
  missingEnv: string[]
}
