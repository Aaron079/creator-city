export type TaskInputMode =
  | 'text-to-text'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'unsupported'

export type TaskInputCapabilities = {
  supportsReferenceImage: boolean
  supportsImageToVideo: boolean
}

// Volcengine Seedream image: supports `image` field for reference/conditioning (image-to-image).
// Wired through cn-executor → volcengine.ts reqBody.image. Max 1 https URL; base64 not supported.
// Volcengine Seedance video: full imageUrl support (image_url content part)
export const CURRENT_PROVIDER_CAPABILITIES: TaskInputCapabilities = {
  supportsReferenceImage: true,
  supportsImageToVideo: true,
}

export function getTaskInputMode(
  nodeKind: 'text' | 'image' | 'video',
  hasUpstreamImage: boolean,
  hasLocalReference: boolean,
  capabilities: TaskInputCapabilities,
): TaskInputMode {
  if (nodeKind === 'text') return 'text-to-text'

  const hasImageInput = hasUpstreamImage || hasLocalReference

  if (nodeKind === 'image') {
    if (!hasImageInput) return 'text-to-image'
    return capabilities.supportsReferenceImage ? 'image-to-image' : 'text-to-image'
  }

  if (nodeKind === 'video') {
    if (!hasImageInput) return 'text-to-video'
    return capabilities.supportsImageToVideo ? 'image-to-video' : 'text-to-video'
  }

  return 'unsupported'
}

const MODE_LABELS: Record<TaskInputMode, string> = {
  'text-to-text': '文生文',
  'text-to-image': '文生图',
  'image-to-image': '图生图',
  'text-to-video': '文生视频',
  'image-to-video': '图生视频',
  'unsupported': '不支持',
}

export function getTaskInputModeLabel(mode: TaskInputMode): string {
  return MODE_LABELS[mode] ?? '不支持'
}
