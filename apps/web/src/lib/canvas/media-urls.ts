import { filterRenderableMediaUrlSources } from '@/lib/media/renderable-url'

type MediaNodeLike = {
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  preview?: {
    type?: string
    url?: string | null
  } | null
  metadataJson?: unknown
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function firstImageUrl(value: unknown) {
  const images = Array.isArray(value) ? value : []
  return stringValue(recordValue(images[0]).url)
}

function firstVideoUrl(value: unknown) {
  const videos = Array.isArray(value) ? value : []
  return stringValue(recordValue(videos[0]).url)
}

function nestedUrl(value: unknown, key = 'url') {
  return stringValue(recordValue(value)[key])
}

export type MediaUrlSource = {
  url: string
  source: string
}

function uniqueSources(candidates: Array<[string, string]>): MediaUrlSource[] {
  const seen = new Set<string>()
  return candidates.reduce<MediaUrlSource[]>((items, [source, url]) => {
    if (!url || seen.has(url)) return items
    seen.add(url)
    items.push({ source, url })
    return items
  }, [])
}

export function getNodeImageUrlSources(node?: MediaNodeLike | null): MediaUrlSource[] {
  if (!node) return []
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)
  const asset = recordValue(metadata.asset)

  // Whitelist-only: explicit known fields, no deep metadata scan.
  // Deep scanning found URLs in arbitrary keys (including provider API endpoints
  // stored at keys named "url"), causing those to enter candidates and be proxied.
  const candidates: Array<[string, string]> = [
    ['metadata.resolvedUrl', stringValue(metadata.resolvedUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.providerOriginalUrl', stringValue(metadata.providerOriginalUrl)],
    ['metadata.temporaryUrl', stringValue(metadata.temporaryUrl)],
    ['metadata.resultImageUrl', stringValue(metadata.resultImageUrl)],
    ['resultImageUrl', stringValue(node.resultImageUrl)],
    ['metadata.proxyUrl', stringValue(metadata.proxyUrl)],
    ['metadata.stableUrl', stringValue(metadata.stableUrl)],
    ['metadata.currentUrl', stringValue(metadata.currentUrl)],
    ['metadata.originalUrl', stringValue(metadata.originalUrl)],
    ['metadata.originalProviderImageUrl', stringValue(metadata.originalProviderImageUrl)],
    ['metadata.mediaPersistence.providerOriginalUrl', stringValue(recordValue(metadata.mediaPersistence).providerOriginalUrl)],
    ['metadata.mediaPersistence.temporaryUrl', stringValue(recordValue(metadata.mediaPersistence).temporaryUrl)],
    ['metadata.imageUrl', stringValue(metadata.imageUrl)],
    ['metadata.mediaPersistence.stableUrl', stringValue(recordValue(metadata.mediaPersistence).stableUrl)],
    ['metadata.mediaPersistence.resolvedUrl', stringValue(recordValue(metadata.mediaPersistence).resolvedUrl)],
    ['metadata.mediaPersistence.proxyUrl', stringValue(recordValue(metadata.mediaPersistence).proxyUrl)],
    ['metadata.mediaPersistence.assetUrl', stringValue(recordValue(metadata.mediaPersistence).assetUrl)],
    ['metadata.mediaPersistence.url', stringValue(recordValue(metadata.mediaPersistence).url)],
    ['metadata.asset.url', nestedUrl(metadata.asset)],
    ['metadata.asset.publicUrl', stringValue(asset.publicUrl)],
    ['metadata.asset.signedUrl', stringValue(asset.signedUrl)],
    ['metadata.providerUrl', stringValue(metadata.providerUrl)],
    ['metadata.originalProviderUrl', stringValue(metadata.originalProviderUrl)],
    ['metadata.sourceImageUrl', stringValue(metadata.sourceImageUrl)],
    ['metadata.pluginResult.imageUrl', stringValue(pluginResult.imageUrl)],
    ['metadata.pluginResult.resultImageUrl', stringValue(pluginResult.resultImageUrl)],
    ['metadata.pluginResult.assetUrl', stringValue(pluginResult.assetUrl)],
    ['metadata.pluginResult.originalProviderImageUrl', stringValue(pluginResult.originalProviderImageUrl)],
    ['metadata.pluginResult.data.imageUrl', stringValue(pluginData.imageUrl)],
    ['metadata.pluginResult.data.resultImageUrl', stringValue(pluginData.resultImageUrl)],
    ['metadata.pluginResult.data.assetUrl', stringValue(pluginData.assetUrl)],
    ['metadata.pluginResult.output.imageUrl', stringValue(pluginOutput.imageUrl)],
    ['metadata.pluginResult.output.resultImageUrl', stringValue(pluginOutput.resultImageUrl)],
    ['metadata.pluginResult.output.assetUrl', stringValue(pluginOutput.assetUrl)],
    ['metadata.pluginResult.images[0].url', firstImageUrl(pluginResult.images)],
    ['metadata.downloadUrl', stringValue(metadata.downloadUrl)],
    ['metadata.mediaUrl', stringValue(metadata.mediaUrl)],
    ['metadata.image_url', stringValue(metadata.image_url)],
  ]
  return filterRenderableMediaUrlSources(uniqueSources(candidates))
}

export function getNodeImageUrlSource(node?: MediaNodeLike | null): MediaUrlSource {
  return getNodeImageUrlSources(node)[0] ?? { url: '', source: '' }
}

export function getNodeImageUrl(node?: MediaNodeLike | null) {
  return getNodeImageUrlSource(node).url
}

export function getNodeVideoUrlSources(node?: MediaNodeLike | null): MediaUrlSource[] {
  if (!node) return []
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)
  const asset = recordValue(metadata.asset)

  // Whitelist-only: explicit known fields, no deep metadata scan.
  const candidates: Array<[string, string]> = [
    ['metadata.resolvedUrl', stringValue(metadata.resolvedUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.providerOriginalUrl', stringValue(metadata.providerOriginalUrl)],
    ['metadata.temporaryUrl', stringValue(metadata.temporaryUrl)],
    ['metadata.resultVideoUrl', stringValue(metadata.resultVideoUrl)],
    ['resultVideoUrl', stringValue(node.resultVideoUrl)],
    ['metadata.proxyUrl', stringValue(metadata.proxyUrl)],
    ['metadata.stableUrl', stringValue(metadata.stableUrl)],
    ['metadata.currentUrl', stringValue(metadata.currentUrl)],
    ['metadata.originalUrl', stringValue(metadata.originalUrl)],
    ['metadata.originalProviderVideoUrl', stringValue(metadata.originalProviderVideoUrl)],
    ['metadata.mediaPersistence.providerOriginalUrl', stringValue(recordValue(metadata.mediaPersistence).providerOriginalUrl)],
    ['metadata.mediaPersistence.temporaryUrl', stringValue(recordValue(metadata.mediaPersistence).temporaryUrl)],
    ['metadata.videoUrl', stringValue(metadata.videoUrl)],
    ['metadata.mediaPersistence.stableUrl', stringValue(recordValue(metadata.mediaPersistence).stableUrl)],
    ['metadata.mediaPersistence.resolvedUrl', stringValue(recordValue(metadata.mediaPersistence).resolvedUrl)],
    ['metadata.mediaPersistence.proxyUrl', stringValue(recordValue(metadata.mediaPersistence).proxyUrl)],
    ['metadata.mediaPersistence.assetUrl', stringValue(recordValue(metadata.mediaPersistence).assetUrl)],
    ['metadata.mediaPersistence.url', stringValue(recordValue(metadata.mediaPersistence).url)],
    ['metadata.asset.url', nestedUrl(metadata.asset)],
    ['metadata.asset.publicUrl', stringValue(asset.publicUrl)],
    ['metadata.asset.signedUrl', stringValue(asset.signedUrl)],
    ['metadata.providerUrl', stringValue(metadata.providerUrl)],
    ['metadata.originalProviderUrl', stringValue(metadata.originalProviderUrl)],
    ['metadata.sourceVideoUrl', stringValue(metadata.sourceVideoUrl)],
    ['metadata.pluginResult.videoUrl', stringValue(pluginResult.videoUrl)],
    ['metadata.pluginResult.resultVideoUrl', stringValue(pluginResult.resultVideoUrl)],
    ['metadata.pluginResult.assetUrl', stringValue(pluginResult.assetUrl)],
    ['metadata.pluginResult.originalProviderVideoUrl', stringValue(pluginResult.originalProviderVideoUrl)],
    ['metadata.pluginResult.data.videoUrl', stringValue(pluginData.videoUrl)],
    ['metadata.pluginResult.data.resultVideoUrl', stringValue(pluginData.resultVideoUrl)],
    ['metadata.pluginResult.data.assetUrl', stringValue(pluginData.assetUrl)],
    ['metadata.pluginResult.output.videoUrl', stringValue(pluginOutput.videoUrl)],
    ['metadata.pluginResult.output.resultVideoUrl', stringValue(pluginOutput.resultVideoUrl)],
    ['metadata.pluginResult.output.assetUrl', stringValue(pluginOutput.assetUrl)],
    ['metadata.pluginResult.videos[0].url', firstVideoUrl(pluginResult.videos)],
    ['preview.url', node.preview?.type === 'remote-video' ? stringValue(node.preview.url) : ''],
    ['metadata.downloadUrl', stringValue(metadata.downloadUrl)],
    ['metadata.mediaUrl', stringValue(metadata.mediaUrl)],
    ['metadata.video_url', stringValue(metadata.video_url)],
  ]
  return filterRenderableMediaUrlSources(uniqueSources(candidates))
}

export function getNodeVideoUrlSource(node?: MediaNodeLike | null): MediaUrlSource {
  return getNodeVideoUrlSources(node)[0] ?? { url: '', source: '' }
}

export function getNodeVideoUrl(node?: MediaNodeLike | null) {
  return getNodeVideoUrlSource(node).url
}
