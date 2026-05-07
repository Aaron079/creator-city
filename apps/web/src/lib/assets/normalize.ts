export function normalizeAssetType(type?: string | null) {
  const value = String(type || '').trim().toLowerCase()
  if (!value) return 'file'
  if (value === 'image' || value === 'img') return 'image'
  if (value === 'text' || value === 'script') return 'text'
  if (value === 'video') return 'video'
  if (value === 'audio') return 'audio'
  if (value === 'file' || value === 'document' || value === 'model_3d' || value === 'preset' || value === 'template') return 'file'
  return value
}
