export type TemplateMediaAssetType = 'image' | 'video'
export type TemplateMediaAssetSource = 'pexels' | 'pixabay'

export interface TemplateMediaAsset {
  id: string
  title: string
  type: TemplateMediaAssetType
  thumbnailUrl: string
  previewUrl?: string
  sourceUrl: string
  sourceName: 'Pexels' | 'Pixabay' | 'Creator City'
  licenseType: 'pexels' | 'pixabay' | 'original'
  attribution?: string
  width?: number
  height?: number
  duration?: number
}

export interface TemplateAssetSearchInput {
  q: string
  type: TemplateMediaAssetType
  source: TemplateMediaAssetSource | 'all'
  limit: number
}

export interface TemplateAssetSearchResponse {
  configured: boolean
  sources: Array<{
    name: 'Pexels' | 'Pixabay'
    configured: boolean
  }>
  results: TemplateMediaAsset[]
  message?: string
}
