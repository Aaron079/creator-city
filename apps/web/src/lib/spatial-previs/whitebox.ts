import type { SpatialPrevisState, SpatialSceneReference, WhiteboxEntity } from './types'

// Fixed editor units make this a stable, editable starting template, not a media-derived scale estimate.
const FLOOR = {
  position: { x: 0, y: -0.05, z: 0 },
  size: { x: 24, y: 0.1, z: 16 },
}
const REFERENCE_PLANE = {
  position: { x: 0, y: 2, z: -4 },
  size: { x: 6, y: 4, z: 0.1 },
}
const VOLUME = {
  position: { x: 0, y: 1.5, z: 1 },
  size: { x: 4, y: 3, z: 4 },
}
const WALL = {
  position: { x: 3, y: 1.5, z: 1 },
  size: { x: 0.2, y: 3, z: 8 },
}
const REFERENCE_OFFSET_X = 8

function entity(
  reference: SpatialSceneReference,
  id: string,
  kind: WhiteboxEntity['kind'],
  position: WhiteboxEntity['position'],
  size: WhiteboxEntity['size'],
): WhiteboxEntity {
  return {
    id,
    kind,
    position,
    rotationY: 0,
    size,
    sourceAssetIds: [reference.assetId],
  }
}

function floorFor(
  reference: SpatialSceneReference,
  index: number,
  proxies: readonly WhiteboxEntity[],
): WhiteboxEntity {
  const minX = Math.min(
    FLOOR.position.x - FLOOR.size.x / 2,
    ...proxies.map((proxy) => proxy.position.x - proxy.size.x / 2),
  )
  const maxX = Math.max(
    FLOOR.position.x + FLOOR.size.x / 2,
    ...proxies.map((proxy) => proxy.position.x + proxy.size.x / 2),
  )
  const minZ = Math.min(
    FLOOR.position.z - FLOOR.size.z / 2,
    ...proxies.map((proxy) => proxy.position.z - proxy.size.z / 2),
  )
  const maxZ = Math.max(
    FLOOR.position.z + FLOOR.size.z / 2,
    ...proxies.map((proxy) => proxy.position.z + proxy.size.z / 2),
  )

  return entity(reference, `floor-${reference.id}-${index}`, 'floor', {
    ...FLOOR.position,
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
  }, {
    ...FLOOR.size,
    x: maxX - minX,
    z: maxZ - minZ,
  })
}

function referencePlaneFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `reference-plane-${reference.id}-${index}`, 'referencePlane', {
    ...REFERENCE_PLANE.position,
    x: REFERENCE_PLANE.position.x + index * REFERENCE_OFFSET_X,
  }, { ...REFERENCE_PLANE.size })
}

function volumeFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `volume-${reference.id}-${index}`, 'volume', {
    ...VOLUME.position,
    x: VOLUME.position.x + index * REFERENCE_OFFSET_X,
  }, { ...VOLUME.size })
}

function wallFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `wall-${reference.id}-${index}`, 'wall', {
    ...WALL.position,
    x: WALL.position.x + index * REFERENCE_OFFSET_X,
  }, { ...WALL.size })
}

export function buildWhiteboxDraft(references: readonly SpatialSceneReference[]) {
  const proxies = references.flatMap((reference, index) => [
    referencePlaneFor(reference, index),
    volumeFor(reference, index),
    wallFor(reference, index),
  ])

  return {
    entities: references.length === 0 ? [] : [floorFor(references[0]!, 0, proxies), ...proxies],
  }
}

export function replaceWhiteboxDraft(
  state: SpatialPrevisState,
  references: SpatialSceneReference[],
): SpatialPrevisState {
  const nextReferences = references.map((reference) => ({ ...reference }))

  return {
    ...state,
    scene: {
      ...state.scene,
      references: nextReferences,
      whitebox: buildWhiteboxDraft(nextReferences),
    },
  }
}
