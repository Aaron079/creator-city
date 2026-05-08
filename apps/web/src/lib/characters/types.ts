export type CharacterReferenceKind =
  | 'hero'
  | 'full-body'
  | 'medium-shot'
  | 'close-up'
  | 'extreme-close-up'
  | 'front'
  | 'side'
  | 'back'
  | 'three-quarter'
  | 'expression'
  | 'costume'
  | 'prop'
  | 'pose'
  | 'other'

export type CharacterReferenceAsset = {
  id: string
  characterId: string
  kind: CharacterReferenceKind
  label: string
  imageUrl: string
  sourceNodeId?: string
  sourceImageUrl?: string
  sourcePrompt?: string
  providerId?: string
  model?: string
  isHero?: boolean
  generationTemplate?: string
  notes?: string
  createdAt: string
  updatedAt?: string
}

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
  referencePack?: CharacterReferenceAsset[]
  createdAt?: string
  updatedAt?: string
}

export type CharacterBible = {
  characters: CharacterProfile[]
  nodeReferenceBindings?: Record<string, string[]>
  updatedAt?: string
}

export type CharacterBoundNode = {
  metadataJson?: unknown
}
