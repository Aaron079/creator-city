import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  applyActorFacingDrag,
  applyActorGroundDrag,
  applyCameraDollyDrag,
  applyCameraTargetDrag,
  applyObjectHeightDrag,
  ensureCameraKeyframeAt,
} from './direct-manipulation'
import { normalizeSpatialPrevis } from './normalize'
import type { ActorKeyframe, CameraKeyframe, SpatialPrevisState, Vec3 } from './types'

const CURRENT_TIME_SEC = 4.2

function fixture(): SpatialPrevisState {
  const normalized = normalizeSpatialPrevis({
    projectId: 'project-1',
    durationSec: 10,
    updatedAt: '2026-09-10T00:00:00.000Z',
  })

  return {
    ...normalized,
    scene: {
      ...normalized.scene,
      whitebox: {
        entities: [{
          id: 'whitebox-volume',
          label: 'whitebox-volume',
          confidence: 1,
          kind: 'volume',
          position: { x: 1, y: 2, z: 3 },
          rotationY: 0.5,
          size: { x: 6, y: 4, z: 2 },
          sourceAssetIds: ['asset-1'],
        }],
      },
    },
    masterTake: {
      ...normalized.masterTake,
      actorTracks: [
        {
          id: 'actor-lead',
          anchorId: 'lead',
          keyframes: [
            { id: 'lead-start', timeSec: 0, position: { x: 0, y: 0, z: 2 }, action: 'walk' },
            { id: 'lead-end', timeSec: 10, position: { x: 10, y: 0, z: -2 }, action: 'turn' },
          ],
        },
        {
          id: 'actor-support',
          anchorId: 'support',
          keyframes: [
            { id: 'support-start', timeSec: 0, position: { x: -3, y: 0, z: 0 }, action: 'wait' },
            { id: 'support-end', timeSec: 10, position: { x: -3, y: 0, z: 2 }, action: 'leave' },
          ],
        },
      ],
      cameraTrack: {
        id: 'camera-main',
        keyframes: [
          {
            id: 'camera-start',
            timeSec: 0,
            position: { x: 0, y: 2, z: 8 },
            target: { x: 0, y: 1, z: 0 },
            focalLengthMm: 24,
            intent: 'static',
          },
          {
            id: 'camera-end',
            timeSec: 10,
            position: { x: 10, y: 4, z: 2 },
            target: { x: 2, y: 2, z: -2 },
            focalLengthMm: 50,
            intent: 'dolly',
          },
        ],
      },
    },
  }
}

function actorFrameAt(state: SpatialPrevisState, trackId: string, timeSec = CURRENT_TIME_SEC) {
  return state.masterTake.actorTracks
    .find((track) => track.id === trackId)
    ?.keyframes.find((keyframe) => keyframe.timeSec === timeSec)
}

function cameraFrameAt(state: SpatialPrevisState, timeSec = CURRENT_TIME_SEC) {
  return state.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === timeSec)
}

function roundedVector(vector: Vec3): Vec3 {
  return {
    x: Number(vector.x.toFixed(6)),
    y: Number(vector.y.toFixed(6)),
    z: Number(vector.z.toFixed(6)),
  }
}

function roundedFrame(frame: ActorKeyframe | CameraKeyframe | undefined) {
  if (!frame) return frame
  if ('target' in frame) {
    return {
      ...frame,
      position: roundedVector(frame.position),
      target: roundedVector(frame.target),
      focalLengthMm: Number(frame.focalLengthMm.toFixed(5)),
    }
  }
  return { ...frame, position: roundedVector(frame.position) }
}

describe('direct spatial keyframe manipulation', () => {
  test('upserts one sampled camera frame at the current time without changing focal length', () => {
    const state = fixture()
    const source = structuredClone(state)

    const first = ensureCameraKeyframeAt(state, CURRENT_TIME_SEC)
    const second = ensureCameraKeyframeAt(first.state, CURRENT_TIME_SEC)

    assert.deepEqual(roundedFrame(first.keyframe), {
      id: 'camera-main@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 4.2, y: 2.84, z: 5.48 },
      target: { x: 0.84, y: 1.42, z: -0.84 },
      focalLengthMm: 34.92,
      intent: 'dolly',
    })
    assert.equal(first.state.masterTake.cameraTrack.keyframes.length, 3)
    assert.equal(second.state.masterTake.cameraTrack.keyframes.length, 3)
    assert.deepEqual(second.state, first.state)
    assert.deepEqual(state, source)
  })

  test('upserts a ground-dragged actor frame while preserving other tracks, beats, and whitebox scale', () => {
    const state = fixture()
    const source = structuredClone(state)

    const first = applyActorGroundDrag(state, 'actor-lead', CURRENT_TIME_SEC, { x: 3, z: -2 })
    const second = applyActorGroundDrag(first, 'actor-lead', CURRENT_TIME_SEC, { x: 3, z: -2 })

    assert.deepEqual(actorFrameAt(first, 'actor-lead'), {
      id: 'actor-lead@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 3, y: 0, z: -2 },
      action: 'walk',
    })
    assert.equal(first.masterTake.actorTracks.find((track) => track.id === 'actor-lead')?.keyframes.length, 3)
    assert.deepEqual(second, first)
    assert.deepEqual(
      first.masterTake.actorTracks.find((track) => track.id === 'actor-lead')?.keyframes.filter((keyframe) => keyframe.timeSec !== CURRENT_TIME_SEC),
      state.masterTake.actorTracks[0]?.keyframes,
    )
    assert.deepEqual(first.masterTake.actorTracks.find((track) => track.id === 'actor-support'), state.masterTake.actorTracks[1])
    assert.deepEqual(first.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.deepEqual(first.masterTake.beats, state.masterTake.beats)
    assert.deepEqual(first.scene.whitebox, state.scene.whitebox)
    assert.deepEqual(state, source)
  })

  test('updates only the selected actor height at the current time', () => {
    const state = fixture()

    const next = applyObjectHeightDrag(state, 'actor', CURRENT_TIME_SEC, 1.75, 'actor-lead')

    assert.deepEqual(roundedFrame(actorFrameAt(next, 'actor-lead')), {
      id: 'actor-lead@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 4.2, y: 1.75, z: 0.32 },
      action: 'walk',
    })
    assert.deepEqual(next.masterTake.actorTracks[1], state.masterTake.actorTracks[1])
    assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
  })

  test('persists an actor facing target without replacing its action or position', () => {
    const state = fixture()

    const next = applyActorFacingDrag(state, 'actor-lead', CURRENT_TIME_SEC, { x: 8, y: 1, z: -4 })

    assert.deepEqual(roundedFrame(actorFrameAt(next, 'actor-lead')), {
      id: 'actor-lead@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 4.2, y: 0, z: 0.32 },
      action: 'walk | facing:{"x":8,"y":1,"z":-4}',
    })
    assert.deepEqual(next.masterTake.actorTracks[1], state.masterTake.actorTracks[1])
  })

  test('sets camera target drags to pan-tilt without changing focal length or position', () => {
    const state = fixture()

    const next = applyCameraTargetDrag(state, CURRENT_TIME_SEC, { x: 1, y: 3, z: -4 })

    assert.deepEqual(roundedFrame(cameraFrameAt(next)), {
      id: 'camera-main@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 4.2, y: 2.84, z: 5.48 },
      target: { x: 1, y: 3, z: -4 },
      focalLengthMm: 34.92,
      intent: 'pan-tilt',
    })
    assert.deepEqual(next.masterTake.actorTracks, state.masterTake.actorTracks)
  })

  test('writes camera vertical and dolly positions without rewriting the existing motion intent', () => {
    const state = fixture()

    const raised = applyObjectHeightDrag(state, 'camera', CURRENT_TIME_SEC, 5)
    const pushed = applyCameraDollyDrag(raised, CURRENT_TIME_SEC, { x: 1, y: 5, z: 1 })
    const pulled = applyCameraDollyDrag(pushed, CURRENT_TIME_SEC, { x: 12, y: 5, z: 12 })
    const repeated = applyCameraDollyDrag(pulled, CURRENT_TIME_SEC, { x: 12, y: 5, z: 12 })

    assert.equal(cameraFrameAt(raised)?.intent, 'dolly')
    assert.equal(cameraFrameAt(raised)?.focalLengthMm, 34.92)
    assert.equal(cameraFrameAt(pushed)?.intent, 'dolly')
    assert.equal(cameraFrameAt(pulled)?.intent, 'dolly')
    assert.equal(pulled.masterTake.cameraTrack.keyframes.length, 3)
    assert.deepEqual(repeated, pulled)
    assert.deepEqual(
      pulled.masterTake.cameraTrack.keyframes.filter((keyframe) => keyframe.timeSec !== CURRENT_TIME_SEC),
      state.masterTake.cameraTrack.keyframes,
    )
    assert.deepEqual(pulled.masterTake.actorTracks, state.masterTake.actorTracks)
    assert.deepEqual(pulled.masterTake.beats, state.masterTake.beats)
    assert.deepEqual(pulled.scene.whitebox, state.scene.whitebox)
  })

  test('creates an exact current-time frame instead of mutating a nearby floating-point timestamp', () => {
    const state = fixture()
    const nearbyCameraFrame: CameraKeyframe = {
      id: 'camera-nearby',
      timeSec: CURRENT_TIME_SEC + 0.0000005,
      position: { x: 3, y: 4, z: 5 },
      target: { x: 1, y: 2, z: 3 },
      focalLengthMm: 42,
      intent: 'follow',
    }
    const withNearbyFrame: SpatialPrevisState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: [...state.masterTake.cameraTrack.keyframes, nearbyCameraFrame],
        },
      },
    }

    const next = applyCameraTargetDrag(withNearbyFrame, CURRENT_TIME_SEC, { x: 8, y: 3, z: -1 })

    assert.deepEqual(roundedFrame(cameraFrameAt(next)), {
      id: 'camera-main@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 3, y: 4, z: 5 },
      target: { x: 8, y: 3, z: -1 },
      focalLengthMm: 42,
      intent: 'pan-tilt',
    })
    assert.deepEqual(next.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.id === nearbyCameraFrame.id), nearbyCameraFrame)
  })
})
