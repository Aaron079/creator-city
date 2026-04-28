import { searchPexelsAssets, isPexelsConfigured } from './pexels'
import { searchPixabayAssets, isPixabayConfigured } from './pixabay'
import type { TemplateAssetSearchInput, TemplateAssetSearchResponse, TemplateMediaAsset } from './types'

export function normalizeTemplateAssetSearch(input: Partial<Record<string, string | null>>): TemplateAssetSearchInput {
  const type = input.type === 'video' ? 'video' : 'image'
  const source = input.source === 'pexels' || input.source === 'pixabay' ? input.source : 'all'
  const parsedLimit = Number.parseInt(input.limit ?? '8', 10)

  return {
    q: input.q?.trim() || 'creative commercial video',
    type,
    source,
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 8,
  }
}

export async function searchTemplateAssets(input: TemplateAssetSearchInput): Promise<TemplateAssetSearchResponse> {
  const pexelsConfigured = isPexelsConfigured()
  const pixabayConfigured = isPixabayConfigured()
  const results: TemplateMediaAsset[] = []
  const errors: string[] = []

  if ((input.source === 'all' || input.source === 'pexels') && pexelsConfigured) {
    try {
      results.push(...await searchPexelsAssets(input))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Pexels search failed')
    }
  }

  if ((input.source === 'all' || input.source === 'pixabay') && pixabayConfigured) {
    try {
      results.push(...await searchPixabayAssets(input))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Pixabay search failed')
    }
  }

  return {
    configured: pexelsConfigured || pixabayConfigured,
    sources: [
      { name: 'Pexels', configured: pexelsConfigured },
      { name: 'Pixabay', configured: pixabayConfigured },
    ],
    results: results.slice(0, input.limit),
    message: errors.length > 0 ? errors.join('; ') : undefined,
  }
}
