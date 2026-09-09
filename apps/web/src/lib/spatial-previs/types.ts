export type Vec3 = {
  x: number
  y: number
  z: number
}

export type CoverageMode = 'verified' | 'constrained' | 'unavailable'

export type SpatialPrevisMode = 'continuous' | 'beats'

export type AspectRatio = '16:9' | '9:16' | '1:1'

export type SpatialPrevisSourceMode = 'single-image-exterior' | 'multi-view' | 'video-scan' | 'manual'

export type CameraFreedom = 'corridor-only' | 'full' | 'disabled'

export type CameraIntent = 'push' | 'pull' | 'pan-tilt' | 'dolly' | 'follow' | 'crane' | 'static'

export type CameraKeyframe = {
  id: string
  timeSec: number
  position: Vec3
  target: Vec3
  focalLengthMm: number
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
  beats: SpatialPrevisBeat[]
}

export type SpatialPrevisScene = {
  sourceMode: SpatialPrevisSourceMode
  coverage: SpatialCoverage
}

export type SpatialCoverage =
  | { mode: 'verified'; cameraFreedom: 'full' }
  | { mode: 'constrained'; cameraFreedom: 'corridor-only' }
  | { mode: 'unavailable'; cameraFreedom: 'disabled' }

export type SpatialPrevisState = {
  version: 1
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
