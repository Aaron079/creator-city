import type { ActorKeyframe, ActorTrack, CameraKeyframe, Vec3 } from './types'
import { interpolateShortestAngle } from './camera'

function interpolateVec3(start: Vec3, end: Vec3, progress: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    z: start.z + (end.z - start.z) * progress,
  }
}

function cloneKeyframe(keyframe: CameraKeyframe): CameraKeyframe {
  return {
    ...keyframe,
    position: { ...keyframe.position },
    target: { ...keyframe.target },
    rotation: { ...keyframe.rotation },
  }
}

function cloneActorKeyframe(keyframe: ActorKeyframe): ActorKeyframe {
  return {
    ...keyframe,
    position: { ...keyframe.position },
  }
}

export function sampleActor(track: ActorTrack, timeSec: number): ActorKeyframe {
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
    position: interpolateVec3(start.position, end.position, progress),
  }
}

export function sampleCamera(keyframes: CameraKeyframe[], timeSec: number): CameraKeyframe {
  if (keyframes.length === 0) throw new Error('Cannot sample an empty camera track')

  const sortedKeyframes = keyframes
    .map((keyframe, index) => ({ keyframe, index }))
    .sort((left, right) => left.keyframe.timeSec - right.keyframe.timeSec || left.index - right.index)
    .map(({ keyframe }) => keyframe)
  const first = sortedKeyframes[0]
  const last = sortedKeyframes.at(-1)
  if (!first || !last) throw new Error('Cannot sample an empty camera track')
  if (timeSec < first.timeSec) return cloneKeyframe(first)
  if (timeSec >= last.timeSec) return cloneKeyframe(last)

  let startIndex = sortedKeyframes.length - 1
  while (sortedKeyframes[startIndex]!.timeSec > timeSec) startIndex -= 1

  const start = sortedKeyframes[startIndex]
  const end = sortedKeyframes[startIndex + 1]
  if (!start || !end) throw new Error('Cannot sample camera track segment')
  if (start.timeSec === timeSec) return cloneKeyframe(start)

  const progress = (timeSec - start.timeSec) / (end.timeSec - start.timeSec)
  return {
    ...cloneKeyframe(start),
    timeSec,
    position: interpolateVec3(start.position, end.position, progress),
    target: interpolateVec3(start.target, end.target, progress),
    rotation: {
      pitch: interpolateShortestAngle(start.rotation.pitch, end.rotation.pitch, progress),
      yaw: interpolateShortestAngle(start.rotation.yaw, end.rotation.yaw, progress),
      roll: interpolateShortestAngle(start.rotation.roll, end.rotation.roll, progress),
    },
    focalLengthMm: start.focalLengthMm + (end.focalLengthMm - start.focalLengthMm) * progress,
  }
}
