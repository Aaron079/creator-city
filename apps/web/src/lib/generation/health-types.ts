export type GenerationHealthSection = {
  ok: boolean
  provider?: string
  missingEnv: string[]
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
