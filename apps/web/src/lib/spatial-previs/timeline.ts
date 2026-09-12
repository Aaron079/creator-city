import type { ActorKeyframe, CameraKeyframe, SpatialPrevisCameraMode, SpatialPrevisState } from './types'

export function clampSpatialKeyframeTime(timeSec: number, durationSec: number) {
  const duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0
  return Number.isFinite(timeSec) ? Math.min(duration, Math.max(0, timeSec)) : 0
}

function retimeKeyframe<T extends ActorKeyframe | CameraKeyframe>(keyframes: readonly T[], keyframeId: string, timeSec: number, durationSec: number) {
  if (!Number.isFinite(timeSec)) return null
  const keyframeIndex = keyframes.findIndex((keyframe) => keyframe.id === keyframeId)
  if (keyframeIndex < 0) return null

  return keyframes
    .map((keyframe, index) => index === keyframeIndex
      ? { ...keyframe, timeSec: clampSpatialKeyframeTime(timeSec, durationSec) }
      : keyframe)
    .sort((left, right) => left.timeSec - right.timeSec)
}

export function retimeCameraKeyframe(
  state: SpatialPrevisState,
  mode: SpatialPrevisCameraMode,
  keyframeId: string,
  timeSec: number,
): SpatialPrevisState {
  const track = mode === 'director'
    ? state.masterTake.cameraTrack
    : mode === 'aerial'
      ? state.masterTake.aerialCameraTrack
      : null
  if (!track) return state

  const keyframes = retimeKeyframe(track.keyframes, keyframeId, timeSec, state.masterTake.durationSec)
  if (!keyframes) return state

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      ...(mode === 'director'
        ? { cameraTrack: { ...track, keyframes } }
        : { aerialCameraTrack: { ...track, keyframes } }),
    },
  }
}

export function retimeActorKeyframe(
  state: SpatialPrevisState,
  actorTrackId: string,
  keyframeId: string,
  timeSec: number,
): SpatialPrevisState {
  const trackIndex = state.masterTake.actorTracks.findIndex((track) => track.id === actorTrackId)
  if (trackIndex < 0) return state
  const track = state.masterTake.actorTracks[trackIndex]!
  const keyframes = retimeKeyframe(track.keyframes, keyframeId, timeSec, state.masterTake.durationSec)
  if (!keyframes) return state

  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: state.masterTake.actorTracks.map((currentTrack, index) => index === trackIndex
        ? { ...currentTrack, keyframes }
        : currentTrack),
    },
  }
}
