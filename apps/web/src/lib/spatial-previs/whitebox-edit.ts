import type { SpatialPrevisState, Vec3, WhiteboxEntity } from './types'

export function updateWhiteboxEntity(
  state: SpatialPrevisState,
  entityId: string,
  patch: Partial<Pick<WhiteboxEntity, 'position' | 'rotationY' | 'size'>>,
): SpatialPrevisState {
  const entityIndex = state.scene.whitebox.entities.findIndex((entity) => entity.id === entityId)
  if (entityIndex === -1) return state

  const entities = state.scene.whitebox.entities.map((entity, index) => index === entityIndex
    ? {
        ...entity,
        position: patch.position ? { ...patch.position } : { ...entity.position },
        rotationY: patch.rotationY ?? entity.rotationY,
        size: patch.size ? { ...patch.size } : { ...entity.size },
      }
    : entity)

  return {
    ...state,
    scene: {
      ...state.scene,
      whitebox: { entities },
    },
  }
}

export function applyWhiteboxGroundDrag(
  state: SpatialPrevisState,
  entityId: string,
  point: Pick<Vec3, 'x' | 'z'>,
): SpatialPrevisState {
  const entity = state.scene.whitebox.entities.find((item) => item.id === entityId)
  return entity
    ? updateWhiteboxEntity(state, entityId, {
        position: { ...entity.position, x: point.x, z: point.z },
      })
    : state
}

const MANUAL_LABELS: Record<WhiteboxEntity['kind'], string> = {
  floor: '地面',
  wall: '墙体',
  opening: '开口',
  volume: '体块',
  furniture: '家具',
  referencePlane: '参考面',
  prop: '道具',
}

const MANUAL_DEFAULTS: Record<
  WhiteboxEntity['kind'],
  Pick<WhiteboxEntity, 'position' | 'size'>
> = {
  floor: { position: { x: 0, y: -0.05, z: 0 }, size: { x: 8, y: 0.1, z: 8 } },
  wall: { position: { x: 0, y: 1.5, z: 0 }, size: { x: 4, y: 3, z: 0.2 } },
  opening: { position: { x: 0, y: 1.1, z: 0 }, size: { x: 1.2, y: 2.2, z: 0.2 } },
  volume: { position: { x: 0, y: 1, z: 0 }, size: { x: 2, y: 2, z: 2 } },
  furniture: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 2, y: 1, z: 1 } },
  referencePlane: { position: { x: 0, y: 1.5, z: 0 }, size: { x: 4, y: 3, z: 0.1 } },
  prop: { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } },
}

export function createManualWhiteboxEntity(
  kind: WhiteboxEntity['kind'],
  index: number,
): WhiteboxEntity {
  const defaults = MANUAL_DEFAULTS[kind]
  const offset = index * 0.5
  return {
    id: `manual-${kind}-${index}`,
    label: `手动${MANUAL_LABELS[kind]} ${index}`,
    confidence: 1,
    kind,
    position: { ...defaults.position, x: defaults.position.x + offset, z: defaults.position.z + offset },
    rotationY: 0,
    size: { ...defaults.size },
    sourceAssetIds: ['manual'],
  }
}
