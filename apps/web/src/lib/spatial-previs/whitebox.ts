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

function floorFor(reference: SpatialSceneReference): WhiteboxEntity {
  return entity(reference, `floor-${reference.id}`, 'floor', { ...FLOOR.position }, { ...FLOOR.size })
}

function referencePlaneFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `reference-plane-${reference.id}`, 'referencePlane', {
    ...REFERENCE_PLANE.position,
    x: REFERENCE_PLANE.position.x + index * REFERENCE_OFFSET_X,
  }, { ...REFERENCE_PLANE.size })
}

function volumeFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `volume-${reference.id}`, 'volume', {
    ...VOLUME.position,
    x: VOLUME.position.x + index * REFERENCE_OFFSET_X,
  }, { ...VOLUME.size })
}

function wallFor(reference: SpatialSceneReference, index: number): WhiteboxEntity {
  return entity(reference, `wall-${reference.id}`, 'wall', {
    ...WALL.position,
    x: WALL.position.x + index * REFERENCE_OFFSET_X,
  }, { ...WALL.size })
}

export function buildWhiteboxDraft(references: readonly SpatialSceneReference[]) {
  return {
    entities: references.flatMap((reference, index) => [
      index === 0 ? floorFor(reference) : null,
      referencePlaneFor(reference, index),
      volumeFor(reference, index),
      wallFor(reference, index),
    ].filter((item): item is WhiteboxEntity => item !== null)),
  }
}

export function replaceWhiteboxDraft(
  state: SpatialPrevisState,
  references: SpatialSceneReference[],
): SpatialPrevisState {
  return {
    ...state,
    scene: {
      ...state.scene,
      references,
      whitebox: buildWhiteboxDraft(references),
    },
  }
}
