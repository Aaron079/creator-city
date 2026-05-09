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

function isPersistedMedia(value: unknown) {
  const record = recordValue(value)
  return record.ok === true || record.status === 'persisted' || stringValue(record.persistedAt) !== ''
}

function stableAssetUrl(metadata: Record<string, unknown>) {
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(metadata.assetUrl)
    || stringValue(mediaPersistence.stableUrl)
    || stringValue(recordValue(metadata.asset).url)
}

function resultAssetUrl(metadata: Record<string, unknown>) {
  const assetUrl = stableAssetUrl(metadata)
  if (!assetUrl) return ''
  return isPersistedMedia(metadata.mediaPersistence) || stringValue(metadata.assetId) ? assetUrl : ''
}

function firstImageUrl(value: unknown) {
  const images = Array.isArray(value) ? value : []
  return stringValue(recordValue(images[0]).url)
}

export function getNodeImageUrl(node?: MediaNodeLike | null) {
  if (!node) return ''
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)

  return resultAssetUrl(metadata)
    || stringValue(node.resultImageUrl)
    || stableAssetUrl(metadata)
    || stringValue(metadata.resultImageUrl)
    || stringValue(metadata.imageUrl)
    || stringValue(pluginResult.imageUrl)
    || stringValue(pluginResult.resultImageUrl)
    || stringValue(pluginData.imageUrl)
    || stringValue(pluginOutput.imageUrl)
    || firstImageUrl(pluginResult.images)
    || stringValue(metadata.sourceImageUrl)
}

export function getNodeVideoUrl(node?: MediaNodeLike | null) {
  if (!node) return ''
  const metadata = recordValue(node.metadataJson)
  const pluginResult = recordValue(metadata.pluginResult)
  const pluginData = recordValue(pluginResult.data)
  const pluginOutput = recordValue(pluginResult.output)

  return resultAssetUrl(metadata)
    || stringValue(node.resultVideoUrl)
    || stableAssetUrl(metadata)
    || stringValue(metadata.resultVideoUrl)
    || stringValue(metadata.videoUrl)
    || stringValue(pluginResult.videoUrl)
    || stringValue(pluginResult.resultVideoUrl)
    || stringValue(pluginData.videoUrl)
    || stringValue(pluginOutput.videoUrl)
    || (node.preview?.type === 'remote-video' ? stringValue(node.preview.url) : '')
}
