export type Vec3 = {
  x: number
  y: number
  z: number
}

export type CoverageMode = 'verified' | 'constrained' | 'unavailable'

export type SpatialPrevisMode = 'continuous' | 'beats'

export type SpatialPrevisSourceMode = 'single-image-exterior' | 'multi-view' | 'video-scan' | 'manual'

export type CameraFreedom = 'corridor-only' | 'full'

export type CameraIntent = 'push' | 'pull' | 'pan-tilt' | 'dolly' | 'follow' | 'crane' | 'static'

export type CameraKeyframe = {
  id: string
  timeSec: number
  position: Vec3
  target: Vec3
  focalLengthMm: number
  intent: CameraIntent
}

export type SpatialPrevisBeat = {
  id: string
  startSec: number
  endSec: number
}

export type MasterTake = {
  id: string
  durationSec: number
  aspectRatio: string
  actorTracks: string[]
  cameraTrack: CameraKeyframe[]
  beats: SpatialPrevisBeat[]
}

export type SpatialPrevisScene = {
  sourceMode: SpatialPrevisSourceMode
  coverage: {
    mode: CoverageMode
    cameraFreedom: CameraFreedom
  }
}

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
  aspectRatio?: string
  editorMode?: SpatialPrevisMode
  updatedAt?: string
}

export type BeatPatch = {
  position: Vec3
  target: Vec3
}
