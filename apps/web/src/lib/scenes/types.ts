export type SceneProfile = {
  id: string
  name: string
  logline?: string
  location?: string
  era?: string
  atmosphere?: string
  architecture?: string
  lighting?: string
  weather?: string
  colorRules?: string
  keyObjects?: string
  continuityRules?: string
  negativeRules?: string
  referenceKeywords?: string[]
  createdAt?: string
  updatedAt?: string
}

export type SceneBible = {
  scenes: SceneProfile[]
  updatedAt?: string
}

export type SceneBoundNode = {
  metadataJson?: unknown
}
