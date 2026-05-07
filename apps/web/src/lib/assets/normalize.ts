export function normalizeAssetType(type?: string | null) {
  return String(type || '').toLowerCase()
}
