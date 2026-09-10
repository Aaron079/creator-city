import { sampleCamera } from './sampler'
import type { ActorKeyframe, ActorTrack, CameraKeyframe, SpatialPrevisState, Vec3 } from './types'

const KEYFRAME_EPSILON = 1e-6
const FACING_METADATA = /\s*\|\s*facing:\{.*\}$/

type StateKeyframe<T> = {
  state: SpatialPrevisState
  keyframe: T
}

function exactKeyframe<T extends { timeSec: number }>(keyframes: T[], timeSec: number) {
  let match: T | null = null

  for (const keyframe of keyframes) {
    if (Math.abs(keyframe.timeSec - timeSec) <= KEYFRAME_EPSILON) match = keyframe
  }

  return match
}

function cloneActorKeyframe(keyframe: ActorKeyframe): ActorKeyframe {
  return {
    ...keyframe,
    position: { ...keyframe.position },
  }
}

function sampleActor(track: ActorTrack, timeSec: number): ActorKeyframe {
  const keyframes = track.keyframes
    .map((keyframe, index) => ({ keyframe, index }))
    .sort((left, right) => left.keyframe.timeSec - right.keyframe.timeSec || left.index - right.index)
    .map(({ keyframe }) => keyframe)
  const first = keyframes[0]
  const last = keyframes.at(-1)
  if (!first || !last) throw new Error(`Cannot sample an empty actor track: ${track.id}`)
  if (timeSec < first.timeSec) return cloneActorKeyframe(first)
  if (timeSec >= last.timeSec) return cloneActorKeyframe(last)

  let startIndex = keyframes.length - 1
  while (keyframes[startIndex]!.timeSec > timeSec) startIndex -= 1

  const start = keyframes[startIndex]
  const end = keyframes[startIndex + 1]
  if (!start || !end) throw new Error(`Cannot sample actor track segment: ${track.id}`)
  if (start.timeSec === timeSec) return cloneActorKeyframe(start)

  const progress = (timeSec - start.timeSec) / (end.timeSec - start.timeSec)
  return {
    ...cloneActorKeyframe(start),
    timeSec,
    position: {
      x: start.position.x + (end.position.x - start.position.x) * progress,
      y: start.position.y + (end.position.y - start.position.y) * progress,
      z: start.position.z + (end.position.z - start.position.z) * progress,
    },
  }
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

function distanceBetween(left: Vec3, right: Vec3) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function isSamePosition(left: Vec3, right: Vec3) {
  return left.x === right.x && left.y === right.y && left.z === right.z
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
    intent: 'crane',
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
  return updateCameraKeyframe(state, timeSec, (keyframe) => {
    if (isSamePosition(position, keyframe.position)) return keyframe

    const currentDistance = distanceBetween(keyframe.position, keyframe.target)
    const nextDistance = distanceBetween(position, keyframe.target)

    return {
      ...keyframe,
      position: { ...position },
      intent: nextDistance < currentDistance ? 'push' : nextDistance > currentDistance ? 'pull' : 'dolly',
    }
  })
}
