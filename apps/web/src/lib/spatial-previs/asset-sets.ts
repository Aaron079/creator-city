import type {
  SpatialAssetRole,
  SpatialAssetSet,
  SpatialPrevisState,
  SpatialSceneReference,
} from './types'
import { buildWhiteboxDraft, retainManualWhiteboxEntities } from './whitebox'

const SPATIAL_ASSET_ROLES: readonly SpatialAssetRole[] = ['scene', 'character', 'prop', 'reference']

function appendUniqueReferences(
  current: readonly SpatialSceneReference[],
  additions: readonly SpatialSceneReference[],
) {
  const next = [...current]
  for (const reference of additions) {
    if (!next.some((item) => item.id === reference.id || item.assetId === reference.assetId)) {
      next.push(reference)
    }
  }
  return next
}

export function replaceSpatialSceneInputs(
  state: SpatialPrevisState,
  references: readonly SpatialSceneReference[],
  assetSets: readonly SpatialAssetSet[],
): SpatialPrevisState {
  const nextReferences = references.map((reference) => ({ ...reference }))
  const referenceIds = new Set<string>()
  const assetIds = new Set<string>()
  for (const reference of nextReferences) {
    if (referenceIds.has(reference.id)) {
      throw new TypeError(`Duplicate spatial scene reference id: ${reference.id}`)
    }
    if (assetIds.has(reference.assetId)) {
      throw new TypeError(`Duplicate spatial scene asset id: ${reference.assetId}`)
    }
    referenceIds.add(reference.id)
    assetIds.add(reference.assetId)
  }

  const nextAssetSets = assetSets.map((assetSet) => ({
    ...assetSet,
    referenceIds: [...assetSet.referenceIds],
  }))
  for (const assetSet of nextAssetSets) {
    if (!assetSet.id.trim()) throw new TypeError('Missing spatial asset set id')
    if (!SPATIAL_ASSET_ROLES.includes(assetSet.role)) {
      throw new TypeError(`Invalid spatial asset set role: ${assetSet.role}`)
    }
  }

  return {
    ...state,
    scene: {
      ...state.scene,
      references: nextReferences,
      assetSets: nextAssetSets,
      whitebox: retainManualWhiteboxEntities(
        state,
        buildWhiteboxDraft(nextReferences, nextAssetSets),
      ),
    },
  }
}

export function addSpatialSceneAssetSet(
  state: SpatialPrevisState,
  references: readonly SpatialSceneReference[],
  role: SpatialAssetRole,
): SpatialPrevisState {
  const selectedReferences = appendUniqueReferences([], references)
  const nextReferences = appendUniqueReferences(state.scene.references, selectedReferences)
  const nextReferenceIds = selectedReferences.map((reference) => (
    nextReferences.find((item) => item.id === reference.id || item.assetId === reference.assetId)!.id
  ))
  const assetSetIds = new Set(state.scene.assetSets.map((assetSet) => assetSet.id))
  let suffix = state.scene.assetSets.length + 1
  while (assetSetIds.has(`asset-set-${role}-${suffix}`)) suffix += 1
  const nextAssetSets = [...state.scene.assetSets, {
    id: `asset-set-${role}-${suffix}`,
    role,
    referenceIds: nextReferenceIds,
  }]

  return replaceSpatialSceneInputs(state, nextReferences, nextAssetSets)
}
