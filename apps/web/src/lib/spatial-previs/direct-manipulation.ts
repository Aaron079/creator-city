import { cameraTargetFromPose, isValidFocalLength, rotationFromTarget } from './camera'
import { sampleActor, sampleCamera } from './sampler'
import type {
  ActorKeyframe,
  CameraKeyframe,
  CameraRotation,
  CameraTrack,
  ShotScale,
  SpatialPrevisCameraMode,
  SpatialPrevisState,
  Vec3,
} from './types'

const FACING_METADATA = /\s*\|\s*facing:\{.*\}$/
const SHOT_SCALES: readonly ShotScale[] = [
  'extreme-close-up', 'close-up', 'near', 'medium-close', 'medium',
  'medium-wide', 'wide', 'long', 'extreme-long', 'establishing',
]

export type StateKeyframe<T> = { state: SpatialPrevisState; keyframe: T }

export function isValidCameraOperationTime(state: SpatialPrevisState, timeSec: unknown): timeSec is number {
  const durationSec = state.masterTake.durationSec
  return typeof timeSec === 'number'
    && Number.isFinite(timeSec)
    && Number.isFinite(durationSec)
    && timeSec >= 0
    && timeSec <= durationSec
}

function isFiniteVec3(vector: Vec3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
}

function isFiniteCameraRotation(rotation: CameraRotation): boolean {
  return Number.isFinite(rotation.pitch) && Number.isFinite(rotation.yaw) && Number.isFinite(rotation.roll)
}

function exactKeyframe<T extends { timeSec: number }>(keyframes: T[], timeSec: number) {
  let match: T | null = null
  for (const keyframe of keyframes) if (keyframe.timeSec === timeSec) match = keyframe
  return match
}

function isValidCameraMode(mode: unknown): mode is SpatialPrevisCameraMode {
  return mode === 'director' || mode === 'aerial'
}

function cameraTrack(state: SpatialPrevisState, mode: unknown): CameraTrack | null {
  if (!isValidCameraMode(mode)) return null
  return mode === 'aerial' ? state.masterTake.aerialCameraTrack : state.masterTake.cameraTrack
}

function replaceCameraTrack(state: SpatialPrevisState, mode: unknown, nextTrack: CameraTrack): SpatialPrevisState {
  if (!isValidCameraMode(mode)) return state
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      ...(mode === 'aerial' ? { aerialCameraTrack: nextTrack } : { cameraTrack: nextTrack }),
    },
  }
}

function ensureActorKeyframeAt(state: SpatialPrevisState, actorTrackId: string, timeSec: number): StateKeyframe<ActorKeyframe> | null {
  const track = state.masterTake.actorTracks.find((item) => item.id === actorTrackId)
  if (!track || track.keyframes.length === 0) return null
  const existing = exactKeyframe(track.keyframes, timeSec)
  if (existing) return { state, keyframe: existing }

  const sampled = sampleActor(track, timeSec)
  const keyframe: ActorKeyframe = { ...sampled, id: `${track.id}@${timeSec}`, timeSec }
  return {
    state: {
      ...state,
      masterTake: {
        ...state.masterTake,
        actorTracks: state.masterTake.actorTracks.map((item) => item.id === actorTrackId
          ? { ...item, keyframes: [...item.keyframes, keyframe] }
          : item),
      },
    },
    keyframe,
  }
}

function updateActorKeyframe(
  state: SpatialPrevisState,
  actorTrackId: string,
  timeSec: number,
  patch: (keyframe: ActorKeyframe) => ActorKeyframe,
): SpatialPrevisState {
  const ensured = ensureActorKeyframeAt(state, actorTrackId, timeSec)
  if (!ensured) return state
  return {
    ...ensured.state,
    masterTake: {
      ...ensured.state.masterTake,
      actorTracks: ensured.state.masterTake.actorTracks.map((track) => track.id !== actorTrackId
        ? track
        : { ...track, keyframes: track.keyframes.map((keyframe) => keyframe === ensured.keyframe ? patch(keyframe) : keyframe) }),
    },
  }
}

function updateCameraKeyframe(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
  patch: (keyframe: CameraKeyframe) => CameraKeyframe,
): SpatialPrevisState {
  const ensured = ensureCameraKeyframeAt(state, mode, timeSec)
  if (!ensured) return state
  const track = cameraTrack(ensured.state, mode)
  if (!track) return state
  return replaceCameraTrack(ensured.state, mode, {
    ...track,
    keyframes: track.keyframes.map((keyframe) => keyframe === ensured.keyframe ? patch(keyframe) : keyframe),
  })
}

function actionWithFacingTarget(action: string, target: Vec3) {
  return `${action.replace(FACING_METADATA, '')} | facing:${JSON.stringify(target)}`
}

export function ensureCameraKeyframeAt(state: SpatialPrevisState, timeSec: number): StateKeyframe<CameraKeyframe> | null
export function ensureCameraKeyframeAt(state: SpatialPrevisState, mode: SpatialPrevisCameraMode, timeSec: number): StateKeyframe<CameraKeyframe> | null
export function ensureCameraKeyframeAt(
  state: SpatialPrevisState,
  modeOrTimeSec: SpatialPrevisCameraMode | number,
  optionalTimeSec?: number,
): StateKeyframe<CameraKeyframe> | null {
  const mode: SpatialPrevisCameraMode = typeof modeOrTimeSec === 'number' ? 'director' : modeOrTimeSec
  const timeSec = typeof modeOrTimeSec === 'number' ? modeOrTimeSec : optionalTimeSec
  if (!isValidCameraMode(mode) || !isValidCameraOperationTime(state, timeSec)) return null

  const track = cameraTrack(state, mode)
  if (!track || track.keyframes.length === 0) return null
  const existing = exactKeyframe(track.keyframes, timeSec)
  if (existing) return { state, keyframe: existing }

  const sampled = sampleCamera(track.keyframes, timeSec)
  const keyframe: CameraKeyframe = {
    ...sampled,
    id: `${track.id}@${timeSec}`,
    timeSec,
    position: { ...sampled.position },
    target: { ...sampled.target },
    rotation: { ...sampled.rotation },
  }
  return { state: replaceCameraTrack(state, mode, { ...track, keyframes: [...track.keyframes, keyframe] }), keyframe }
}

export function applyActorGroundDrag(
  state: SpatialPrevisState,
  actorTrackId: string,
  timeSec: number,
  ground: Pick<Vec3, 'x' | 'z'>,
): SpatialPrevisState {
  return updateActorKeyframe(state, actorTrackId, timeSec, (keyframe) => ({
    ...keyframe,
    position: { x: ground.x, y: keyframe.position.y, z: ground.z },
  }))
}

export function applyObjectHeightDrag(
  state: SpatialPrevisState,
  object: 'actor' | 'camera',
  timeSec: number,
  y: number,
  actorTrackId?: string,
  mode: SpatialPrevisCameraMode = 'director',
): SpatialPrevisState {
  if (object === 'actor') {
    if (!actorTrackId) return state
    return updateActorKeyframe(state, actorTrackId, timeSec, (keyframe) => ({ ...keyframe, position: { ...keyframe.position, y } }))
  }
  if (!Number.isFinite(y)) return state

  return updateCameraKeyframe(state, mode, timeSec, (keyframe) => {
    const position = { ...keyframe.position, y }
    return { ...keyframe, position, rotation: { ...rotationFromTarget(position, keyframe.target), roll: keyframe.rotation.roll } }
  })
}

export function applyActorFacingDrag(state: SpatialPrevisState, actorTrackId: string, timeSec: number, target: Vec3): SpatialPrevisState {
  return updateActorKeyframe(state, actorTrackId, timeSec, (keyframe) => ({
    ...keyframe,
    action: actionWithFacingTarget(keyframe.action, target),
  }))
}

export function applyCameraTargetDrag(
  state: SpatialPrevisState,
  timeSec: number,
  target: Vec3,
  mode: SpatialPrevisCameraMode = 'director',
): SpatialPrevisState {
  if (!isFiniteVec3(target)) return state
  return updateCameraKeyframe(state, mode, timeSec, (keyframe) => ({
    ...keyframe,
    target: { ...target },
    rotation: { ...rotationFromTarget(keyframe.position, target), roll: keyframe.rotation.roll },
    intent: 'pan-tilt',
  }))
}

export function applyCameraDollyDrag(
  state: SpatialPrevisState,
  timeSec: number,
  position: Vec3,
  mode: SpatialPrevisCameraMode = 'director',
): SpatialPrevisState {
  if (!isFiniteVec3(position)) return state
  return updateCameraKeyframe(state, mode, timeSec, (keyframe) => ({
    ...keyframe,
    position: { ...position },
    rotation: { ...rotationFromTarget(position, keyframe.target), roll: keyframe.rotation.roll },
  }))
}

export function applyCameraTransform(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
  patch: { position: Vec3; rotation: CameraRotation },
): SpatialPrevisState {
  if (!isFiniteVec3(patch.position) || !isFiniteCameraRotation(patch.rotation)) return state
  return updateCameraKeyframe(state, mode, timeSec, (keyframe) => {
    const distance = Math.hypot(
      keyframe.target.x - keyframe.position.x,
      keyframe.target.y - keyframe.position.y,
      keyframe.target.z - keyframe.position.z,
    )
    return {
      ...keyframe,
      position: { ...patch.position },
      rotation: { ...patch.rotation },
      target: cameraTargetFromPose(patch.position, patch.rotation, distance),
    }
  })
}

export function applyCameraRoutePointDrag(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  keyframeTimeSec: number,
  position: Vec3,
): SpatialPrevisState {
  if (!isFiniteVec3(position)) return state
  return updateCameraKeyframe(state, mode, keyframeTimeSec, (keyframe) => ({
    ...keyframe,
    position: { ...position },
    rotation: { ...rotationFromTarget(position, keyframe.target), roll: keyframe.rotation.roll },
  }))
}

export function applyCameraLens(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  timeSec: number,
  patch: { focalLengthMm?: number; shotScale?: ShotScale },
): SpatialPrevisState {
  if ((patch.focalLengthMm !== undefined && !isValidFocalLength(patch.focalLengthMm))
    || (patch.shotScale !== undefined && !SHOT_SCALES.includes(patch.shotScale))
    || (patch.focalLengthMm === undefined && patch.shotScale === undefined)) return state
  return updateCameraKeyframe(state, mode, timeSec, (keyframe) => ({ ...keyframe, ...patch }))
}
