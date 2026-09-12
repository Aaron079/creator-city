import type {
  CameraTrack,
  MasterTake,
  SpatialPrevisScene,
  SpatialPrevisState,
  Vec3,
} from './types'

export type PrevisDeliveryPackage = Readonly<{
  kind: 'spatial-previs-delivery'
  version: 1
  projectId: string
  masterTake: MasterTake
  scene: SpatialPrevisScene
  studio?: SpatialPrevisState['studio']
}>

function cloneVec3(value: Vec3): Vec3 {
  return { ...value }
}

function cloneCameraTrack(track: CameraTrack): CameraTrack {
  return {
    ...track,
    keyframes: track.keyframes.map((keyframe) => ({
      ...keyframe,
      position: cloneVec3(keyframe.position),
      target: cloneVec3(keyframe.target),
      rotation: { ...keyframe.rotation },
    })),
  }
}

function cloneScene(scene: SpatialPrevisScene): SpatialPrevisScene {
  return {
    ...scene,
    references: scene.references.map((reference) => ({ ...reference })),
    assetSets: scene.assetSets.map((assetSet) => ({
      ...assetSet,
      referenceIds: [...assetSet.referenceIds],
    })),
    whitebox: {
      entities: scene.whitebox.entities.map((entity) => ({
        ...entity,
        position: cloneVec3(entity.position),
        size: cloneVec3(entity.size),
        sourceAssetIds: [...entity.sourceAssetIds],
      })),
    },
  }
}

function cloneMasterTake(masterTake: MasterTake): MasterTake {
  return {
    ...masterTake,
    actorTracks: masterTake.actorTracks.map((track) => ({
      ...track,
      keyframes: track.keyframes.map((keyframe) => ({
        ...keyframe,
        position: cloneVec3(keyframe.position),
      })),
    })),
    cameraTrack: cloneCameraTrack(masterTake.cameraTrack),
    aerialCameraTrack: cloneCameraTrack(masterTake.aerialCameraTrack),
    beats: masterTake.beats.map((beat) => ({ ...beat })),
  }
}

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const item of Object.values(value)) freezeDeep(item)
  return Object.freeze(value)
}

export function buildPrevisDeliveryPackage(state: SpatialPrevisState): PrevisDeliveryPackage {
  return freezeDeep({
    kind: 'spatial-previs-delivery' as const,
    version: 1 as const,
    projectId: state.projectId,
    masterTake: cloneMasterTake(state.masterTake),
    scene: cloneScene(state.scene),
    ...(state.studio ? { studio: structuredClone(state.studio) } : {}),
  })
}
