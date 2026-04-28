import type { TemplateAssetSearchInput, TemplateMediaAsset } from './types'

interface PixabayImageHit {
  id: number
  pageURL: string
  tags?: string
  previewURL?: string
  webformatURL?: string
  largeImageURL?: string
  imageWidth?: number
  imageHeight?: number
  user?: string
}

interface PixabayVideoVariant {
  url?: string
  width?: number
  height?: number
  size?: number
  thumbnail?: string
}

interface PixabayVideoHit {
  id: number
  pageURL: string
  tags?: string
  duration?: number
  user?: string
  videos?: {
    tiny?: PixabayVideoVariant
    small?: PixabayVideoVariant
    medium?: PixabayVideoVariant
    large?: PixabayVideoVariant
  }
}

function getPixabayKey() {
  return process.env.PIXABAY_API_KEY?.trim()
}

function choosePixabayVideo(hit: PixabayVideoHit) {
  return hit.videos?.medium ?? hit.videos?.small ?? hit.videos?.large ?? hit.videos?.tiny
}

export function isPixabayConfigured() {
  return Boolean(getPixabayKey())
}

export async function searchPixabayAssets(input: TemplateAssetSearchInput): Promise<TemplateMediaAsset[]> {
  const key = getPixabayKey()
  if (!key) return []

  const endpoint = input.type === 'video'
    ? 'https://pixabay.com/api/videos/'
    : 'https://pixabay.com/api/'
  const url = new URL(endpoint)
  url.searchParams.set('key', key)
  url.searchParams.set('q', input.q)
  url.searchParams.set('per_page', String(Math.min(Math.max(input.limit, 3), 20)))
  url.searchParams.set('safesearch', 'true')

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
  })

  if (!response.ok) {
    throw new Error(`Pixabay API returned HTTP ${response.status}`)
  }

  const data = await response.json() as { hits?: Array<PixabayImageHit | PixabayVideoHit> }

  if (input.type === 'video') {
    return (data.hits as PixabayVideoHit[] | undefined ?? []).map<TemplateMediaAsset>((hit) => {
      const video = choosePixabayVideo(hit)
      return {
        id: `pixabay-video-${hit.id}`,
        title: hit.tags || `Pixabay video ${hit.id}`,
        type: 'video',
        thumbnailUrl: video?.thumbnail ?? '',
        previewUrl: video?.url,
        sourceUrl: hit.pageURL,
        sourceName: 'Pixabay',
        licenseType: 'pixabay',
        attribution: hit.user ? `Video by ${hit.user} on Pixabay` : 'Video provided by Pixabay',
        width: video?.width,
        height: video?.height,
        duration: hit.duration,
      }
    }).filter((asset) => asset.thumbnailUrl || asset.previewUrl)
  }

  return (data.hits as PixabayImageHit[] | undefined ?? []).map<TemplateMediaAsset>((hit) => ({
    id: `pixabay-image-${hit.id}`,
    title: hit.tags || `Pixabay image ${hit.id}`,
    type: 'image',
    thumbnailUrl: hit.webformatURL ?? hit.previewURL ?? '',
    previewUrl: hit.largeImageURL ?? hit.webformatURL,
    sourceUrl: hit.pageURL,
    sourceName: 'Pixabay',
    licenseType: 'pixabay',
    attribution: hit.user ? `Image by ${hit.user} on Pixabay` : 'Image provided by Pixabay',
    width: hit.imageWidth,
    height: hit.imageHeight,
  })).filter((asset) => asset.thumbnailUrl)
}
