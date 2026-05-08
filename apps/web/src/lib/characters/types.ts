export type CharacterProfile = {
  id: string
  name: string
  role?: string
  logline?: string
  appearance?: string
  ageAndTemperament?: string
  costume?: string
  hairstyle?: string
  props?: string
  behaviorRules?: string
  negativeRules?: string
  referenceKeywords?: string[]
  createdAt?: string
  updatedAt?: string
}

export type CharacterBible = {
  characters: CharacterProfile[]
  updatedAt?: string
}

export type CharacterBoundNode = {
  metadataJson?: unknown
}
