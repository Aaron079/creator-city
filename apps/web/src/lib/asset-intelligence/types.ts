export type AssetIntelligence = {
  version: string
  mediaType: 'image' | 'video'

  scene?: {
    location?: string
    architecture?: string[]
    environment?: string[]
    weather?: string[]
    timeOfDay?: string[]
  }

  characters?: Array<{
    name?: string
    species?: string
    gender?: string
    ageGroup?: string
    clothing?: string[]
    pose?: string[]
    emotion?: string[]
  }>

  cinematography?: {
    shotType?: string[]
    lensStyle?: string[]
    cameraAngle?: string[]
    movement?: string[]
    composition?: string[]
  }

  visualStyle?: {
    colorPalette?: string[]
    lighting?: string[]
    texture?: string[]
    realism?: string[]
    artStyle?: string[]
  }

  props?: string[]
  mood?: string[]
  keywords?: string[]
  reusableTags?: string[]
  generatedAt: string
}

export type AnalyzeAssetIntelligenceInput = {
  mediaType: 'image' | 'video'
  prompt?: string
  compiledPrompt?: string
  providerId?: string
  metadata?: Record<string, unknown>
}
