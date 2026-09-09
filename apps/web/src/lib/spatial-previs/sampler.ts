import type { CameraKeyframe, Vec3 } from './types'

function interpolateVec3(start: Vec3, end: Vec3, progress: number): Vec3 {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    z: start.z + (end.z - start.z) * progress,
  }
}

export function sampleCamera(keyframes: CameraKeyframe[], timeSec: number): CameraKeyframe {
  if (keyframes.length === 0) throw new Error('Cannot sample an empty camera track')

  const sortedKeyframes = [...keyframes].sort((left, right) => left.timeSec - right.timeSec)
  const first = sortedKeyframes[0]
  const last = sortedKeyframes.at(-1)
  if (!first || !last) throw new Error('Cannot sample an empty camera track')
  if (timeSec <= first.timeSec) return first
  if (timeSec >= last.timeSec) return last

  const endIndex = sortedKeyframes.findIndex((keyframe) => keyframe.timeSec >= timeSec)
  const end = sortedKeyframes[endIndex]
  const start = sortedKeyframes[endIndex - 1]
  if (!start || !end) throw new Error('Cannot sample camera track segment')

  const progress = (timeSec - start.timeSec) / (end.timeSec - start.timeSec)
  return {
    ...end,
    timeSec,
    position: interpolateVec3(start.position, end.position, progress),
    target: interpolateVec3(start.target, end.target, progress),
    focalLengthMm: start.focalLengthMm + (end.focalLengthMm - start.focalLengthMm) * progress,
  }
}
