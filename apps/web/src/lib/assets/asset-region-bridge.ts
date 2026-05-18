type Region = 'cn' | 'global'

export type AssetRegionBridgeResult = {
  required: boolean
  reason?: 'asset_region_bridge_required'
  sourceStorageRegion: Region | null
  targetExecutionRegion: Region
}

function normalizeRegion(value: unknown): Region | null {
  return value === 'cn' ? 'cn' : value === 'global' ? 'global' : null
}

export function detectAssetRegionBridgeRequirement(
  asset: { storageRegion?: string | null; metadataJson?: unknown } | null | undefined,
  targetExecutionRegion: Region,
): AssetRegionBridgeResult {
  if (!asset) {
    return { required: false, sourceStorageRegion: null, targetExecutionRegion }
  }

  const metaRecord = asset.metadataJson && typeof asset.metadataJson === 'object' && !Array.isArray(asset.metadataJson)
    ? asset.metadataJson as Record<string, unknown>
    : {}

  const sourceStorageRegion = normalizeRegion(asset.storageRegion)
    ?? normalizeRegion(metaRecord.storageRegion)
    ?? normalizeRegion(metaRecord.sourceProviderRegion)

  if (!sourceStorageRegion) {
    return { required: false, sourceStorageRegion: null, targetExecutionRegion }
  }

  if (sourceStorageRegion !== targetExecutionRegion) {
    return {
      required: true,
      reason: 'asset_region_bridge_required',
      sourceStorageRegion,
      targetExecutionRegion,
    }
  }

  return { required: false, sourceStorageRegion, targetExecutionRegion }
}
