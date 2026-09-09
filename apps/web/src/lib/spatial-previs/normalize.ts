import type {
  BeatPatch,
  CameraKeyframe,
  CameraTrack,
  SpatialPrevisInput,
  SpatialPrevisScene,
  SpatialPrevisState,
} from './types'

const DEFAULT_DURATION_SEC = 30
const MIN_DURATION_SEC = 5
const MAX_DURATION_SEC = 180
const MIDPOINT_EPSILON = 1e-6
const DEFAULT_POSITION = { x: 0, y: 1.6, z: 8 }
const DEFAULT_TARGET = { x: 0, y: 1.6, z: 0 }

function normalizeDuration(durationSec?: number) {
  const duration = Number.isFinite(durationSec) ? durationSec as number : DEFAULT_DURATION_SEC
  return Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, duration))
}

function coverageFor(sourceMode: NonNullable<SpatialPrevisInput['sourceMode']>): SpatialPrevisScene['coverage'] {
  if (sourceMode === 'multi-view' || sourceMode === 'video-scan') {
    return { mode: 'verified', cameraFreedom: 'full' }
  }

  return {
    mode: 'constrained',
    cameraFreedom: 'corridor-only',
    corridor: {
      min: { x: -12, y: 0, z: -12 },
      max: { x: 12, y: 12, z: 12 },
    },
  }
}

function createCameraTrack(durationSec: number): CameraTrack {
  const createKeyframe = (id: string, timeSec: number): CameraKeyframe => ({
    id,
    timeSec,
    position: { ...DEFAULT_POSITION },
    target: { ...DEFAULT_TARGET },
    focalLengthMm: 35,
    intent: 'static',
  })

  return {
    id: 'camera-track',
    keyframes: [
      createKeyframe('camera-start', 0),
      createKeyframe('camera-mid', durationSec / 2),
      createKeyframe('camera-end', durationSec),
    ],
  }
}

export function normalizeSpatialPrevis(input: SpatialPrevisInput): SpatialPrevisState {
  const durationSec = normalizeDuration(input.durationSec)
  const sourceMode = input.sourceMode ?? 'manual'

  return {
    version: 1,
    projectId: input.projectId,
    scene: {
      sourceMode,
      coverage: coverageFor(sourceMode),
    },
    masterTake: {
      id: 'master-take',
      durationSec,
      aspectRatio: input.aspectRatio ?? '16:9',
      actorTracks: [],
      cameraTrack: createCameraTrack(durationSec),
      beats: [{ id: 'beat-entry', label: 'Entry', startSec: 0, endSec: durationSec }],
    },
    editorMode: input.editorMode ?? 'continuous',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function applyBeatPatch(state: SpatialPrevisState, beatId: string, patch: BeatPatch): SpatialPrevisState {
  const beat = state.masterTake.beats.find((item) => item.id === beatId)
  if (!beat) throw new Error(`Unknown spatial previs beat: ${beatId}`)

  const midpoint = (beat.startSec + beat.endSec) / 2
  const matchingKeyframes = state.masterTake.cameraTrack.keyframes.filter(
    (keyframe) => Math.abs(keyframe.timeSec - midpoint) <= MIDPOINT_EPSILON,
  )
  if (matchingKeyframes.length === 0) throw new Error(`No camera keyframe at midpoint for beat: ${beatId}`)
  if (matchingKeyframes.length > 1) throw new Error(`Ambiguous camera keyframes at midpoint for beat: ${beatId}`)

  const [matchingKeyframe] = matchingKeyframes
  const keyframes = state.masterTake.cameraTrack.keyframes.map((keyframe) => {
    if (keyframe !== matchingKeyframe) return keyframe
    return {
      ...keyframe,
      position: { ...patch.position },
      target: { ...patch.target },
    }
  })

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes,
      },
    },
  }
}
