import type { TemplateAssetSearchInput, TemplateMediaAsset } from './types'

interface PexelsPhoto {
  id: number
  url: string
  width: number
  height: number
  alt?: string
  photographer?: string
  photographer_url?: string
  src: {
    medium?: string
    large?: string
    landscape?: string
    portrait?: string
    original?: string
  }
}

interface PexelsVideoFile {
  id: number
  quality?: string
  file_type?: string
  width?: number
  height?: number
  link: string
}

interface PexelsVideoPicture {
  id: number
  picture: string
}

interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  user?: {
    name?: string
    url?: string
  }
  video_files?: PexelsVideoFile[]
  video_pictures?: PexelsVideoPicture[]
}

function getPexelsKey() {
  return process.env.PEXELS_API_KEY?.trim()
}

function choosePexelsVideoFile(files: PexelsVideoFile[] | undefined) {
  const mp4Files = (files ?? []).filter((file) => file.file_type?.includes('mp4') || file.link.includes('.mp4'))
  return mp4Files.find((file) => file.quality === 'hd')
    ?? mp4Files.find((file) => file.quality === 'sd')
    ?? mp4Files[0]
}

export function isPexelsConfigured() {
  return Boolean(getPexelsKey())
}

export async function searchPexelsAssets(input: TemplateAssetSearchInput): Promise<TemplateMediaAsset[]> {
  const key = getPexelsKey()
  if (!key) return []

  const endpoint = input.type === 'video'
    ? 'https://api.pexels.com/videos/search'
    : 'https://api.pexels.com/v1/search'
  const url = new URL(endpoint)
  url.searchParams.set('query', input.q)
  url.searchParams.set('per_page', String(Math.min(Math.max(input.limit, 1), 20)))

  const response = await fetch(url, {
    headers: {
      Authorization: key,
    },
    next: { revalidate: 60 * 60 },
  })

  if (!response.ok) {
    throw new Error(`Pexels API returned HTTP ${response.status}`)
  }

  const data = await response.json() as { photos?: PexelsPhoto[]; videos?: PexelsVideo[] }

  if (input.type === 'video') {
    return (data.videos ?? []).map<TemplateMediaAsset>((video) => {
      const file = choosePexelsVideoFile(video.video_files)
      return {
        id: `pexels-video-${video.id}`,
        title: `Pexels video ${video.id}`,
        type: 'video',
        thumbnailUrl: video.video_pictures?.[0]?.picture ?? '',
        previewUrl: file?.link,
        sourceUrl: video.url,
        sourceName: 'Pexels',
        licenseType: 'pexels',
        attribution: video.user?.name ? `Video by ${video.user.name} on Pexels` : 'Video provided by Pexels',
        width: file?.width ?? video.width,
        height: file?.height ?? video.height,
        duration: video.duration,
      }
    }).filter((asset) => asset.thumbnailUrl || asset.previewUrl)
  }

  return (data.photos ?? []).map<TemplateMediaAsset>((photo) => ({
    id: `pexels-photo-${photo.id}`,
    title: photo.alt || `Pexels photo ${photo.id}`,
    type: 'image',
    thumbnailUrl: photo.src.landscape ?? photo.src.large ?? photo.src.medium ?? '',
    previewUrl: photo.src.large ?? photo.src.original,
    sourceUrl: photo.url,
    sourceName: 'Pexels',
    licenseType: 'pexels',
    attribution: photo.photographer ? `Photo by ${photo.photographer} on Pexels` : 'Photo provided by Pexels',
    width: photo.width,
    height: photo.height,
  })).filter((asset) => asset.thumbnailUrl)
}
