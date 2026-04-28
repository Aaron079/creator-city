import type { TemplateMediaAsset } from './types'

export function buildGradientPlaceholderAsset(input: {
  id: string
  title: string
  type?: 'image' | 'video'
}): TemplateMediaAsset {
  return {
    id: input.id,
    title: input.title,
    type: input.type ?? 'image',
    thumbnailUrl: '',
    sourceUrl: 'creator-city://local-placeholder',
    sourceName: 'Creator City',
    licenseType: 'original',
    attribution: 'Creator City local gradient placeholder; no external media asset is embedded.',
  }
}
