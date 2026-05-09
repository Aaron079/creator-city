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

export type MediaUrlSource = {
  url: string
  source: string
}

export function getNodeImageUrlSource(node?: MediaNodeLike | null): MediaUrlSource {
  if (!node) return { url: '', source: '' }
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)

  const candidates: Array<[string, string]> = [
    ['resultImageUrl', stringValue(node.resultImageUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.resultImageUrl', stringValue(metadata.resultImageUrl)],
    ['metadata.imageUrl', stringValue(metadata.imageUrl)],
    ['metadata.pluginResult.imageUrl', stringValue(pluginResult.imageUrl)],
    ['metadata.pluginResult.resultImageUrl', stringValue(pluginResult.resultImageUrl)],
    ['metadata.pluginResult.data.imageUrl', stringValue(pluginData.imageUrl)],
    ['metadata.pluginResult.output.imageUrl', stringValue(pluginOutput.imageUrl)],
    ['metadata.pluginResult.images[0].url', firstImageUrl(pluginResult.images)],
    ['metadata.sourceImageUrl', stringValue(metadata.sourceImageUrl)],
  ]
  const found = candidates.find(([, url]) => url)
  return found ? { source: found[0], url: found[1] } : { url: '', source: '' }
}

export function getNodeImageUrl(node?: MediaNodeLike | null) {
  return getNodeImageUrlSource(node).url
}

export function getNodeVideoUrlSource(node?: MediaNodeLike | null): MediaUrlSource {
  if (!node) return { url: '', source: '' }
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)

  const candidates: Array<[string, string]> = [
    ['resultVideoUrl', stringValue(node.resultVideoUrl)],
    ['metadata.assetUrl', stringValue(metadata.assetUrl)],
    ['metadata.resultVideoUrl', stringValue(metadata.resultVideoUrl)],
    ['metadata.videoUrl', stringValue(metadata.videoUrl)],
    ['metadata.pluginResult.videoUrl', stringValue(pluginResult.videoUrl)],
    ['metadata.pluginResult.resultVideoUrl', stringValue(pluginResult.resultVideoUrl)],
    ['metadata.pluginResult.data.videoUrl', stringValue(pluginData.videoUrl)],
    ['metadata.pluginResult.output.videoUrl', stringValue(pluginOutput.videoUrl)],
    ['metadata.pluginResult.videos[0].url', firstVideoUrl(pluginResult.videos)],
    ['preview.url', node.preview?.type === 'remote-video' ? stringValue(node.preview.url) : ''],
  ]
  const found = candidates.find(([, url]) => url)
  return found ? { source: found[0], url: found[1] } : { url: '', source: '' }
}

export function getNodeVideoUrl(node?: MediaNodeLike | null) {
  return getNodeVideoUrlSource(node).url
}
