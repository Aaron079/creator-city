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

  const sortedKeyframes = keyframes
    .map((keyframe, index) => ({ keyframe, index }))
    .sort((left, right) => left.keyframe.timeSec - right.keyframe.timeSec || left.index - right.index)
    .map(({ keyframe }) => keyframe)
  const first = sortedKeyframes[0]
  const last = sortedKeyframes.at(-1)
  if (!first || !last) throw new Error('Cannot sample an empty camera track')
  if (timeSec < first.timeSec) return first
  if (timeSec >= last.timeSec) return last

  let startIndex = sortedKeyframes.length - 1
  while (sortedKeyframes[startIndex]!.timeSec > timeSec) startIndex -= 1

  const start = sortedKeyframes[startIndex]
  const end = sortedKeyframes[startIndex + 1]
  if (!start || !end) throw new Error('Cannot sample camera track segment')
  if (start.timeSec === timeSec) return start

  const progress = (timeSec - start.timeSec) / (end.timeSec - start.timeSec)
  return {
    ...end,
    timeSec,
    position: interpolateVec3(start.position, end.position, progress),
    target: interpolateVec3(start.target, end.target, progress),
    focalLengthMm: start.focalLengthMm + (end.focalLengthMm - start.focalLengthMm) * progress,
  }
}
