import { sampleCamera } from '../spatial-previs/sampler'
import type { ActorKeyframe, CameraKeyframe, SpatialPrevisState, Vec3 } from '../spatial-previs/types'

type SampledCameraState = {
  position: Vec3
  target: Vec3
  focalLengthMm: number
  intent: CameraKeyframe['intent']
  velocity: Vec3
}

type SampledActorState = {
  anchorId: string
  position: Vec3
  action: string
  velocity: Vec3
}

type BoundaryComposition = {
  timeSec: number
  camera: SampledCameraState
  actors: SampledActorState[]
  requiredAnchors: string[]
}

export type ContinuityHandoff = BoundaryComposition & {
  previousLastFrameRef: {
    segmentId: string
    timeSec: number
  }
  nextFirstComposition: BoundaryComposition
}

export type MasterTakeSegment = {
  id: string
  index: number
  startSec: number
  endSec: number
  handoff?: ContinuityHandoff
}

export type MasterTakeChain = {
  readonly segments: readonly MasterTakeSegment[]
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

function zeroVelocity(): Vec3 {
  return { x: 0, y: 0, z: 0 }
}

function velocityAt(keyframes: { timeSec: number; position: Vec3 }[], timeSec: number): Vec3 {
  const sorted = keyframes
    .map((keyframe, index) => ({ keyframe, index }))
    .sort((left, right) => left.keyframe.timeSec - right.keyframe.timeSec || left.index - right.index)
    .map(({ keyframe }) => keyframe)
  const start = sorted.filter((keyframe) => keyframe.timeSec <= timeSec).at(-1)
  const end = sorted.find((keyframe) => keyframe.timeSec > timeSec)
  if (!start || !end || end.timeSec === start.timeSec) return zeroVelocity()

  const duration = end.timeSec - start.timeSec
  return {
    x: (end.position.x - start.position.x) / duration,
    y: (end.position.y - start.position.y) / duration,
    z: (end.position.z - start.position.z) / duration,
  }
}

function sampleActor(keyframes: ActorKeyframe[], timeSec: number): ActorKeyframe {
  if (keyframes.length === 0) throw new Error('Cannot sample an empty actor track')
  const sorted = keyframes
    .map((keyframe, index) => ({ keyframe, index }))
    .sort((left, right) => left.keyframe.timeSec - right.keyframe.timeSec || left.index - right.index)
    .map(({ keyframe }) => keyframe)
  const first = sorted[0]
  const last = sorted.at(-1)
  if (!first || !last) throw new Error('Cannot sample an empty actor track')
  if (timeSec < first.timeSec) return { ...first, position: { ...first.position } }
  if (timeSec >= last.timeSec) return { ...last, position: { ...last.position } }

  let startIndex = sorted.length - 1
  while (sorted[startIndex]!.timeSec > timeSec) startIndex -= 1
  const start = sorted[startIndex]
  const end = sorted[startIndex + 1]
  if (!start || !end) throw new Error('Cannot sample actor track segment')
  if (start.timeSec === timeSec) return { ...start, position: { ...start.position } }

  const progress = (timeSec - start.timeSec) / (end.timeSec - start.timeSec)
  return {
    ...end,
    timeSec,
    position: {
      x: start.position.x + (end.position.x - start.position.x) * progress,
      y: start.position.y + (end.position.y - start.position.y) * progress,
      z: start.position.z + (end.position.z - start.position.z) * progress,
    },
  }
}

function boundaryComposition(previs: SpatialPrevisState, timeSec: number): BoundaryComposition {
  const camera = sampleCamera(previs.masterTake.cameraTrack.keyframes, timeSec)
  const actors = previs.masterTake.actorTracks.map((track) => {
    const actor = sampleActor(track.keyframes, timeSec)
    return {
      anchorId: track.anchorId,
      position: actor.position,
      action: actor.action,
      velocity: velocityAt(track.keyframes, timeSec),
    }
  })

  return {
    timeSec,
    camera: {
      position: camera.position,
      target: camera.target,
      focalLengthMm: camera.focalLengthMm,
      intent: camera.intent,
      velocity: velocityAt(previs.masterTake.cameraTrack.keyframes, timeSec),
    },
    actors,
    requiredAnchors: [...new Set(previs.masterTake.actorTracks.map((track) => track.anchorId))],
  }
}

export function partitionMasterTake(
  previs: SpatialPrevisState,
  input: { maxSegmentSec: number; userConfirmed: boolean },
): MasterTakeChain {
  if (input.userConfirmed !== true) throw new Error('CHAIN_CONFIRMATION_REQUIRED')
  if (!Number.isFinite(input.maxSegmentSec) || input.maxSegmentSec < 1) {
    throw new Error('INVALID_MAX_SEGMENT_DURATION')
  }
  if (input.maxSegmentSec > 30) throw new Error('MAX_SEGMENT_DURATION_EXCEEDED')

  const { durationSec, id: masterTakeId } = previs.masterTake
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 180) {
    throw new Error('INVALID_MASTER_TAKE_DURATION')
  }
  const segmentCount = Math.ceil(durationSec / input.maxSegmentSec)
  const segments: MasterTakeSegment[] = []
  for (let index = 0; index < segmentCount; index += 1) {
    const startSec = index * input.maxSegmentSec
    const endSec = Math.min(durationSec, startSec + input.maxSegmentSec)
    const id = `${masterTakeId}:segment-${index + 1}`
    if (index === 0) {
      segments.push({ id, index, startSec, endSec })
      continue
    }

    const composition = boundaryComposition(previs, startSec)
    const previousSegment = segments[index - 1]
    if (!previousSegment) throw new Error('Missing previous master take segment')
    segments.push({
      id,
      index,
      startSec,
      endSec,
      handoff: {
        ...composition,
        previousLastFrameRef: { segmentId: previousSegment.id, timeSec: startSec },
        nextFirstComposition: composition,
      },
    })
  }

  return deepFreeze({ segments })
}
