import type {
  BeatPatch,
  CameraKeyframe,
  CameraTrack,
  SpatialPrevisInput,
  SpatialPrevisScene,
  SpatialPrevisState,
} from './types'
import { rotationFromTarget } from './camera'
import { ensureCameraKeyframeAt } from './direct-manipulation'
import { retimeStudio } from './studio'

const DEFAULT_DURATION_SEC = 30
const MIN_DURATION_SEC = 5
const MAX_DURATION_SEC = 180
const MIDPOINT_EPSILON = 1e-6
const DEFAULT_POSITION = { x: 0, y: 1.6, z: 8 }
const DEFAULT_TARGET = { x: 0, y: 1.6, z: 0 }
const DEFAULT_AERIAL_POSITION = { x: 0, y: 9, z: 8 }

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

function createCameraTrack(
  id: string,
  keyframePrefix: string,
  durationSec: number,
  position: CameraKeyframe['position'],
): CameraTrack {
  const createKeyframe = (id: string, timeSec: number): CameraKeyframe => ({
    id,
    timeSec,
    position: { ...position },
    target: { ...DEFAULT_TARGET },
    rotation: rotationFromTarget(position, DEFAULT_TARGET),
    focalLengthMm: 35,
    shotScale: 'medium',
    motionBaseline: 'static',
    intent: 'static',
  })

  return {
    id,
    keyframes: [
      createKeyframe(`${keyframePrefix}-start`, 0),
      createKeyframe(`${keyframePrefix}-mid`, durationSec / 2),
      createKeyframe(`${keyframePrefix}-end`, durationSec),
    ],
  }
}

export function addDefaultActorTrack(state: SpatialPrevisState): SpatialPrevisState {
  const actorNumber = state.masterTake.actorTracks.length + 1

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: [
        ...state.masterTake.actorTracks,
        {
          id: `actor-track-${actorNumber}`,
          anchorId: `actor-${actorNumber}`,
          keyframes: [
            { id: `actor-${actorNumber}-start`, timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'idle' },
          ],
        },
      ],
    },
  }
}

export function normalizeSpatialPrevis(input: SpatialPrevisInput): SpatialPrevisState {
  const durationSec = normalizeDuration(input.durationSec)
  const sourceMode = input.sourceMode ?? 'manual'

  return {
    version: 4,
    projectId: input.projectId,
    scene: {
      sourceMode,
      coverage: coverageFor(sourceMode),
      references: [],
      assetSets: [],
      whitebox: { entities: [] },
    },
    masterTake: {
      id: 'master-take',
      durationSec,
      aspectRatio: input.aspectRatio ?? '16:9',
      actorTracks: [],
      cameraTrack: createCameraTrack('camera-track', 'camera', durationSec, DEFAULT_POSITION),
      aerialCameraTrack: createCameraTrack('aerial-camera-track', 'aerial-camera', durationSec, DEFAULT_AERIAL_POSITION),
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
  if (matchingKeyframes.length > 1) throw new Error(`Ambiguous camera keyframes at midpoint for beat: ${beatId}`)

  const ensured = matchingKeyframes.length === 1
    ? { state, keyframe: matchingKeyframes[0]! }
    : ensureCameraKeyframeAt(state, 'director', midpoint)
  if (!ensured) return state
  const keyframes = ensured.state.masterTake.cameraTrack.keyframes.map((keyframe) => {
    if (keyframe !== ensured.keyframe) return keyframe
    return {
      ...keyframe,
      position: { ...patch.position },
      target: { ...patch.target },
      rotation: { ...rotationFromTarget(patch.position, patch.target), roll: keyframe.rotation.roll },
    }
  })

  return {
    ...ensured.state,
    masterTake: {
      ...ensured.state.masterTake,
      cameraTrack: {
        ...ensured.state.masterTake.cameraTrack,
        keyframes,
      },
    },
  }
}

export function setMasterTakeDuration(state: SpatialPrevisState, durationSec: number): SpatialPrevisState {
  if (!Number.isFinite(durationSec)) {
    throw new Error(`Invalid master take duration: ${durationSec}`)
  }
  const nextDurationSec = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, durationSec))

  const previousDurationSec = state.masterTake.durationSec
  if (!Number.isFinite(previousDurationSec) || previousDurationSec <= 0) {
    throw new Error(`Invalid master take duration: ${previousDurationSec}`)
  }
  const scale = nextDurationSec / previousDurationSec
  const remapTime = (timeSec: number) => timeSec * scale
  const remapCameraTrack = (track: CameraTrack): CameraTrack => ({
    ...track,
    keyframes: track.keyframes.map((keyframe) => ({
      ...keyframe,
      timeSec: remapTime(keyframe.timeSec),
      position: { ...keyframe.position },
      target: { ...keyframe.target },
      rotation: { ...keyframe.rotation },
    })),
  })

  return {
    ...state,
    ...(state.studio ? { studio: retimeStudio(state.studio, scale) } : {}),
    masterTake: {
      ...state.masterTake,
      durationSec: nextDurationSec,
      actorTracks: state.masterTake.actorTracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((keyframe) => ({
          ...keyframe,
          timeSec: remapTime(keyframe.timeSec),
          position: { ...keyframe.position },
        })),
      })),
      cameraTrack: remapCameraTrack(state.masterTake.cameraTrack),
      aerialCameraTrack: remapCameraTrack(state.masterTake.aerialCameraTrack),
      beats: state.masterTake.beats.map((beat) => ({
        ...beat,
        startSec: remapTime(beat.startSec),
        endSec: remapTime(beat.endSec),
      })),
    },
  }
}
