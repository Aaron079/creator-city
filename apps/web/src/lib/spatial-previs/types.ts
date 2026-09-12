export type Vec3 = {
  x: number
  y: number
  z: number
}

export type SpatialSceneReference = {
  id: string
  assetId: string
  title: string
  mediaType: 'image' | 'video'
  url: string
  source: 'project' | 'library' | 'upload'
}

export type SpatialAssetRole = 'scene' | 'character' | 'prop' | 'reference'

export type SpatialAssetSet = {
  id: string
  role: SpatialAssetRole
  referenceIds: string[]
}

export type WhiteboxEntity = {
  id: string
  label: string
  confidence: number
  kind: 'floor' | 'wall' | 'opening' | 'volume' | 'furniture' | 'referencePlane' | 'prop'
  position: Vec3
  rotationY: number
  size: Vec3
  sourceAssetIds: string[]
}

export type CoverageMode = 'verified' | 'constrained' | 'unavailable'

export type SpatialPrevisMode = 'continuous' | 'beats'

export type AspectRatio = '16:9' | '9:16' | '1:1'

export type SpatialPrevisSourceMode = 'single-image-exterior' | 'multi-view' | 'video-scan' | 'manual'

export type CameraFreedom = 'corridor-only' | 'full' | 'disabled'

export type CameraIntent = 'push' | 'pull' | 'pan-tilt' | 'dolly' | 'follow' | 'crane' | 'static'

export type SpatialPrevisCameraMode = 'director' | 'aerial'

export type CameraRotation = {
  pitch: number
  yaw: number
  roll: number
}

export type ShotScale =
  | 'extreme-close-up'
  | 'close-up'
  | 'near'
  | 'medium-close'
  | 'medium'
  | 'medium-wide'
  | 'wide'
  | 'long'
  | 'extreme-long'
  | 'establishing'

export type CameraMotionBaseline = 'push' | 'pull' | 'pan' | 'move' | 'follow' | 'rise' | 'fall' | 'static'

export type CameraKeyframe = {
  id: string
  timeSec: number
  position: Vec3
  target: Vec3
  rotation: CameraRotation
  focalLengthMm: number
  shotScale: ShotScale
  motionBaseline: CameraMotionBaseline
  intent: CameraIntent
}

export type CameraTrack = {
  id: string
  keyframes: CameraKeyframe[]
}

export type ActorKeyframe = {
  id: string
  timeSec: number
  position: Vec3
  action: string
}

export type ActorTrack = {
  id: string
  anchorId: string
  keyframes: ActorKeyframe[]
}

export type SpatialPrevisBeat = {
  id: string
  label: string
  startSec: number
  endSec: number
}

export type MasterTake = {
  id: string
  durationSec: number
  aspectRatio: AspectRatio
  actorTracks: ActorTrack[]
  cameraTrack: CameraTrack
  aerialCameraTrack: CameraTrack
  beats: SpatialPrevisBeat[]
}

export type SpatialPrevisScene = {
  sourceMode: SpatialPrevisSourceMode
  coverage: SpatialCoverage
  references: SpatialSceneReference[]
  assetSets: SpatialAssetSet[]
  whitebox: { entities: WhiteboxEntity[] }
}

export type CoverageCorridor = {
  min: Vec3
  max: Vec3
}

export type SpatialCoverage =
  | { mode: 'verified'; cameraFreedom: 'full' }
  | { mode: 'constrained'; cameraFreedom: 'corridor-only'; corridor: CoverageCorridor }
  | { mode: 'unavailable'; cameraFreedom: 'disabled' }

export type SpatialPrevisState = {
  studio?: import('./studio-types').SpatialStudio
  version: 4
  projectId: string
  scene: SpatialPrevisScene
  masterTake: MasterTake
  editorMode: SpatialPrevisMode
  updatedAt: string
}

export type SpatialPrevisInput = {
  projectId: string
  sourceMode?: SpatialPrevisSourceMode
  durationSec?: number
  aspectRatio?: AspectRatio
  editorMode?: SpatialPrevisMode
  updatedAt?: string
}

export type BeatPatch = {
  position: Vec3
  target: Vec3
}
