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

function looksLikeMediaUrlKey(key: string, kind: 'image' | 'video') {
  const normalized = key.toLowerCase()
  if (!/(url|uri|href)$/i.test(key)) return false
  if (kind === 'image') return /(image|asset|media|provider|original|stable|resolved|result|output|thumbnail|preview|source|url|uri|href)/.test(normalized)
  return /(video|asset|media|provider|original|stable|resolved|result|output|preview|source|url|uri|href)/.test(normalized)
}

function collectMetadataMediaUrls(
  value: unknown,
  kind: 'image' | 'video',
  path = 'metadataJson',
  depth = 0,
): Array<[string, string]> {
  if (!value || depth > 5) return []
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return [[path, value]]
    return []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectMetadataMediaUrls(item, kind, `${path}[${index}]`, depth + 1))
  }
  if (typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const items: Array<[string, string]> = []
  for (const [key, nested] of Object.entries(record)) {
    const nextPath = `${path}.${key}`
    if (typeof nested === 'string' && looksLikeMediaUrlKey(key, kind)) {
      const url = stringValue(nested)
      if (/^https?:\/\//i.test(url) || url.startsWith('data:')) items.push([nextPath, url])
      continue
    }
    items.push(...collectMetadataMediaUrls(nested, kind, nextPath, depth + 1))
  }
  return items
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

  const candidates: Array<[string, string]> = [
    ['metadata.resolvedUrl', stringValue(metadata.resolvedUrl)],
    ['metadata.proxyUrl', stringValue(metadata.proxyUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.stableUrl', stringValue(metadata.stableUrl)],
    ['metadata.resultImageUrl', stringValue(metadata.resultImageUrl)],
    ['resultImageUrl', stringValue(node.resultImageUrl)],
    ['metadata.currentUrl', stringValue(metadata.currentUrl)],
    ['metadata.originalUrl', stringValue(metadata.originalUrl)],
    ['metadata.originalProviderImageUrl', stringValue(metadata.originalProviderImageUrl)],
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
    ...collectMetadataMediaUrls(metadata, 'image'),
  ]
  return uniqueSources(candidates)
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

  const candidates: Array<[string, string]> = [
    ['metadata.resolvedUrl', stringValue(metadata.resolvedUrl)],
    ['metadata.proxyUrl', stringValue(metadata.proxyUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.stableUrl', stringValue(metadata.stableUrl)],
    ['metadata.resultVideoUrl', stringValue(metadata.resultVideoUrl)],
    ['resultVideoUrl', stringValue(node.resultVideoUrl)],
    ['metadata.currentUrl', stringValue(metadata.currentUrl)],
    ['metadata.originalUrl', stringValue(metadata.originalUrl)],
    ['metadata.originalProviderVideoUrl', stringValue(metadata.originalProviderVideoUrl)],
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
    ...collectMetadataMediaUrls(metadata, 'video'),
  ]
  return uniqueSources(candidates)
}

export function getNodeVideoUrlSource(node?: MediaNodeLike | null): MediaUrlSource {
  return getNodeVideoUrlSources(node)[0] ?? { url: '', source: '' }
}

export function getNodeVideoUrl(node?: MediaNodeLike | null) {
  return getNodeVideoUrlSource(node).url
}
