import { sampleActor, sampleCamera } from './sampler'
import type { ActorKeyframe, CameraKeyframe, SpatialPrevisState, Vec3 } from './types'

const FACING_METADATA = /\s*\|\s*facing:\{.*\}$/

type StateKeyframe<T> = {
  state: SpatialPrevisState
  keyframe: T
}

function exactKeyframe<T extends { timeSec: number }>(keyframes: T[], timeSec: number) {
  let match: T | null = null

  for (const keyframe of keyframes) {
    if (keyframe.timeSec === timeSec) match = keyframe
  }

  return match
}

function ensureActorKeyframeAt(
  state: SpatialPrevisState,
  actorTrackId: string,
  timeSec: number,
): StateKeyframe<ActorKeyframe> | null {
  const track = state.masterTake.actorTracks.find((item) => item.id === actorTrackId)
  if (!track || track.keyframes.length === 0) return null

  const existing = exactKeyframe(track.keyframes, timeSec)
  if (existing) return { state, keyframe: existing }

  const sampled = sampleActor(track, timeSec)
  const keyframe: ActorKeyframe = {
    ...sampled,
    id: `${track.id}@${timeSec}`,
    timeSec,
  }

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
        : {
          ...track,
          keyframes: track.keyframes.map((keyframe) => keyframe === ensured.keyframe ? patch(keyframe) : keyframe),
        }),
    },
  }
}

function updateCameraKeyframe(
  state: SpatialPrevisState,
  timeSec: number,
  patch: (keyframe: CameraKeyframe) => CameraKeyframe,
): SpatialPrevisState {
  const ensured = ensureCameraKeyframeAt(state, timeSec)

  return {
    ...ensured.state,
    masterTake: {
      ...ensured.state.masterTake,
      cameraTrack: {
        ...ensured.state.masterTake.cameraTrack,
        keyframes: ensured.state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe === ensured.keyframe
          ? patch(keyframe)
          : keyframe),
      },
    },
  }
}

function actionWithFacingTarget(action: string, target: Vec3) {
  return `${action.replace(FACING_METADATA, '')} | facing:${JSON.stringify(target)}`
}

export function ensureCameraKeyframeAt(
  state: SpatialPrevisState,
  timeSec: number,
): StateKeyframe<CameraKeyframe> {
  const track = state.masterTake.cameraTrack
  const existing = exactKeyframe(track.keyframes, timeSec)
  if (existing) return { state, keyframe: existing }

  const sampled = sampleCamera(track.keyframes, timeSec)
  const keyframe: CameraKeyframe = {
    ...sampled,
    id: `${track.id}@${timeSec}`,
    timeSec,
    position: { ...sampled.position },
    target: { ...sampled.target },
  }

  return {
    state: {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...track,
          keyframes: [...track.keyframes, keyframe],
        },
      },
    },
    keyframe,
  }
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
): SpatialPrevisState {
  if (object === 'actor') {
    if (!actorTrackId) return state
    return updateActorKeyframe(state, actorTrackId, timeSec, (keyframe) => ({
      ...keyframe,
      position: { ...keyframe.position, y },
    }))
  }

  return updateCameraKeyframe(state, timeSec, (keyframe) => ({
    ...keyframe,
    position: { ...keyframe.position, y },
  }))
}

export function applyActorFacingDrag(
  state: SpatialPrevisState,
  actorTrackId: string,
  timeSec: number,
  target: Vec3,
): SpatialPrevisState {
  return updateActorKeyframe(state, actorTrackId, timeSec, (keyframe) => ({
    ...keyframe,
    action: actionWithFacingTarget(keyframe.action, target),
  }))
}

export function applyCameraTargetDrag(
  state: SpatialPrevisState,
  timeSec: number,
  target: Vec3,
): SpatialPrevisState {
  return updateCameraKeyframe(state, timeSec, (keyframe) => ({
    ...keyframe,
    target: { ...target },
    intent: 'pan-tilt',
  }))
}

export function applyCameraDollyDrag(
  state: SpatialPrevisState,
  timeSec: number,
  position: Vec3,
): SpatialPrevisState {
  return updateCameraKeyframe(state, timeSec, (keyframe) => ({
    ...keyframe,
    position: { ...position },
  }))
}
