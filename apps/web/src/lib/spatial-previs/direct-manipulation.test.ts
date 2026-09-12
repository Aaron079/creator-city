import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  applyActorFacingDrag,
  applyActorGroundDrag,
  applyCameraDollyDrag,
  applyCameraLens,
  applyCameraRoutePointDrag,
  applyCameraTargetDrag,
  applyCameraTransform,
  applyObjectHeightDrag,
  ensureCameraKeyframeAt,
  ensureActorKeyframeAt,
  clearActorRoute,
  deleteActorRoutePoint,
} from './direct-manipulation'
import { normalizeSpatialPrevis } from './normalize'
import { cameraTargetFromPose, rotationFromTarget } from './camera'
import { sampleActor, sampleCamera } from './sampler'
import type { ActorKeyframe, CameraKeyframe, SpatialPrevisCameraMode, SpatialPrevisState, Vec3 } from './types'

const CURRENT_TIME_SEC = 4.2

test('records and removes only the selected actor route point and preserves the last anchor', () => {
  const source = fixture()
  const id = source.masterTake.actorTracks[0]!.id
  const next = ensureActorKeyframeAt(source, id, 5)!.state
  assert.deepEqual(next.masterTake.actorTracks[0]!.keyframes.map(k => k.timeSec), [0, 5, 10])
  assert.deepEqual(sampleActor(next.masterTake.actorTracks[0]!, 5).position, sampleActor(source.masterTake.actorTracks[0]!, 5).position)
  assert.equal(ensureActorKeyframeAt(next, id, 5)!.state, next)
  assert.equal(ensureActorKeyframeAt(source, id, -1), null)
  assert.deepEqual(deleteActorRoutePoint(next, id, 5), source)
  const cleared = clearActorRoute(next, id, 5)
  for (const t of [0, 2, 5, 10]) assert.deepEqual(sampleActor(cleared.masterTake.actorTracks[0]!, t).position, { x: 5, y: 0, z: 0 })
  assert.equal(deleteActorRoutePoint(cleared, id, 0), cleared)
  assert.deepEqual(cleared.masterTake.actorTracks[1], source.masterTake.actorTracks[1])
  assert.deepEqual(cleared.masterTake.cameraTrack, source.masterTake.cameraTrack)
  assert.deepEqual(cleared.studio, source.studio)
  assert.equal(source.masterTake.actorTracks[0]!.keyframes.length, 2)
})

test('inserting camera points preserves continuous lens and pose samples without adding cuts', () => {
  const source = fixture()
  const next = ensureCameraKeyframeAt(ensureCameraKeyframeAt(source, 7)!.state, 3)!.state
  assert.deepEqual(next.masterTake.cameraTrack.keyframes.map(k => k.timeSec), [0, 3, 7, 10])
  for (const time of [0, 2.9, 3, 3.1, 6.9, 7, 7.1, 10]) {
    const before = sampleCamera(source.masterTake.cameraTrack.keyframes, time)
    const after = sampleCamera(next.masterTake.cameraTrack.keyframes, time)
    assert.ok(Math.abs(before.focalLengthMm - after.focalLengthMm) < 1e-8)
    for (const axis of ['x', 'y', 'z'] as const) assert.ok(Math.abs(before.position[axis] - after.position[axis]) < 1e-8)
  }
  assert.deepEqual(next.studio, source.studio)
  assert.deepEqual(next.masterTake.actorTracks, source.masterTake.actorTracks)
})

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
            rotation: rotationFromTarget({ x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }),
            shotScale: 'medium',
            motionBaseline: 'static',
            intent: 'static',
          },
          {
            id: 'camera-end',
            timeSec: 10,
            position: { x: 10, y: 4, z: 2 },
            target: { x: 2, y: 2, z: -2 },
            focalLengthMm: 50,
            rotation: rotationFromTarget({ x: 10, y: 4, z: 2 }, { x: 2, y: 2, z: -2 }),
            shotScale: 'wide',
            motionBaseline: 'move',
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

function cameraFrameAt(state: SpatialPrevisState, mode: SpatialPrevisCameraMode = 'director', timeSec = CURRENT_TIME_SEC) {
  const track = mode === 'director' ? state.masterTake.cameraTrack : state.masterTake.aerialCameraTrack
  return track.keyframes.find((keyframe) => keyframe.timeSec === timeSec)
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
      rotation: {
        pitch: Number(frame.rotation.pitch.toFixed(6)),
        yaw: Number(frame.rotation.yaw.toFixed(6)),
        roll: Number(frame.rotation.roll.toFixed(6)),
      },
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
    assert.ok(first)
    const second = ensureCameraKeyframeAt(first.state, CURRENT_TIME_SEC)
    assert.ok(second)

    assert.deepEqual(roundedFrame(first.keyframe), {
      id: 'camera-main@4.2',
      timeSec: CURRENT_TIME_SEC,
      position: { x: 4.2, y: 2.84, z: 5.48 },
      target: { x: 0.84, y: 1.42, z: -0.84 },
      focalLengthMm: 34.92,
      rotation: { pitch: -0.164521, yaw: 0.465002, roll: 0 },
      shotScale: 'medium',
      motionBaseline: 'static',
      intent: 'static',
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
      rotation: { pitch: 0.01599, yaw: 0.325543, roll: 0 },
      shotScale: 'medium',
      motionBaseline: 'static',
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

    assert.equal(cameraFrameAt(raised)?.intent, 'static')
    assert.equal(cameraFrameAt(raised)?.focalLengthMm, 34.92)
    assert.equal(cameraFrameAt(pushed)?.intent, 'static')
    assert.equal(cameraFrameAt(pulled)?.intent, 'static')
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
      rotation: rotationFromTarget({ x: 3, y: 4, z: 5 }, { x: 1, y: 2, z: 3 }),
      shotScale: 'medium',
      motionBaseline: 'follow',
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
      rotation: { pitch: -0.127344, yaw: -0.694738, roll: 0 },
      shotScale: 'medium',
      motionBaseline: 'static',
      intent: 'pan-tilt',
    })
    assert.deepEqual(next.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.id === nearbyCameraFrame.id), nearbyCameraFrame)
  })

  test('writes an aerial pose at the requested time without changing the director plan', () => {
    const state = fixture()
    const source = structuredClone(state)
    const pose = {
      position: { x: 3, y: 12, z: -4 },
      rotation: { pitch: -0.2, yaw: 0.7, roll: 0.1 },
    }

    const next = applyCameraTransform(state, 'aerial', CURRENT_TIME_SEC, pose)
    const frame = cameraFrameAt(next, 'aerial')

    assert.deepEqual(frame?.position, pose.position)
    assert.deepEqual(frame?.rotation, pose.rotation)
    assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.deepEqual(state, source)
  })

  test('preserves target distance when transforming a camera pose', () => {
    const state = fixture()
    const ensured = ensureCameraKeyframeAt(state, 'director', CURRENT_TIME_SEC)
    assert.ok(ensured)
    const previous = ensured.keyframe
    const previousDistance = Math.hypot(
      previous.position.x - previous.target.x,
      previous.position.y - previous.target.y,
      previous.position.z - previous.target.z,
    )
    const pose = {
      position: { x: 3, y: 5, z: 7 },
      rotation: { pitch: -0.3, yaw: 0.4, roll: 0.2 },
    }
    const next = applyCameraTransform(state, 'director', CURRENT_TIME_SEC, pose)
    const frame = cameraFrameAt(next)

    assert.ok(frame)
    assert.deepEqual(frame.target, cameraTargetFromPose(pose.position, pose.rotation, previousDistance))
    assert.ok(Math.abs(
      Math.hypot(frame.position.x - frame.target.x, frame.position.y - frame.target.y, frame.position.z - frame.target.z)
      - previousDistance,
    ) < 1e-9)
    assert.deepEqual(frame.rotation, { pitch: -0.3, yaw: 0.4, roll: 0.2 })
    assert.deepEqual(next.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)
  })

  test('moves only the selected camera route point rather than the current playhead', () => {
    const state = fixture()
    const routeTimeSec = 10
    const next = applyCameraRoutePointDrag(state, 'aerial', routeTimeSec, { x: 5, y: 3, z: 1 })

    assert.deepEqual(cameraFrameAt(next, 'aerial', routeTimeSec)?.position, { x: 5, y: 3, z: 1 })
    assert.equal(cameraFrameAt(next, 'aerial', CURRENT_TIME_SEC), undefined)
    assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
  })

  test('updates one selected camera lens and rejects invalid lens patches without mutation', () => {
    const state = fixture()
    const changed = applyCameraLens(state, 'aerial', CURRENT_TIME_SEC, {
      focalLengthMm: 135,
      shotScale: 'establishing',
    })

    assert.equal(cameraFrameAt(changed, 'aerial')?.focalLengthMm, 135)
    assert.equal(cameraFrameAt(changed, 'aerial')?.shotScale, 'establishing')
    assert.deepEqual(changed.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.equal(applyCameraLens(state, 'director', CURRENT_TIME_SEC, { focalLengthMm: 7 }), state)
    assert.equal(applyCameraLens(state, 'director', CURRENT_TIME_SEC, { shotScale: 'invalid' as never }), state)
  })

  test('returns the original state for camera times outside the master take or not finite', () => {
    const state = fixture()
    const source = structuredClone(state)
    const pose = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { pitch: 0.1, yaw: 0.2, roll: 0.3 },
    }

    for (const mode of ['director', 'aerial'] as const) {
      for (const timeSec of [-0.1, state.masterTake.durationSec + 0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(ensureCameraKeyframeAt(state, mode, timeSec), null)
        assert.equal(applyObjectHeightDrag(state, 'camera', timeSec, 4, undefined, mode), state)
        assert.equal(applyCameraTargetDrag(state, timeSec, { x: 1, y: 2, z: 3 }, mode), state)
        assert.equal(applyCameraDollyDrag(state, timeSec, { x: 1, y: 2, z: 3 }, mode), state)
        assert.equal(applyCameraTransform(state, mode, timeSec, pose), state)
        assert.equal(applyCameraRoutePointDrag(state, mode, timeSec, { x: 1, y: 2, z: 3 }), state)
        assert.equal(applyCameraLens(state, mode, timeSec, { focalLengthMm: 50 }), state)
      }
    }

    assert.deepEqual(state, source)
  })

  test('rejects an invalid as-cast camera mode without touching either camera track', () => {
    const state = fixture()
    const source = structuredClone(state)
    const invalidMode = 'invalid' as SpatialPrevisCameraMode
    const pose = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { pitch: 0.1, yaw: 0.2, roll: 0.3 },
    }

    assert.equal(ensureCameraKeyframeAt(state, invalidMode, CURRENT_TIME_SEC), null)
    assert.equal(applyObjectHeightDrag(state, 'camera', CURRENT_TIME_SEC, 4, undefined, invalidMode), state)
    assert.equal(applyCameraTargetDrag(state, CURRENT_TIME_SEC, { x: 1, y: 2, z: 3 }, invalidMode), state)
    assert.equal(applyCameraDollyDrag(state, CURRENT_TIME_SEC, { x: 1, y: 2, z: 3 }, invalidMode), state)
    assert.equal(applyCameraTransform(state, invalidMode, CURRENT_TIME_SEC, pose), state)
    assert.equal(applyCameraRoutePointDrag(state, invalidMode, CURRENT_TIME_SEC, { x: 1, y: 2, z: 3 }), state)
    assert.equal(applyCameraLens(state, invalidMode, CURRENT_TIME_SEC, { focalLengthMm: 50 }), state)
    assert.deepEqual(state.masterTake.cameraTrack, source.masterTake.cameraTrack)
    assert.deepEqual(state.masterTake.aerialCameraTrack, source.masterTake.aerialCameraTrack)
  })

  test('returns the original state for non-finite camera transform values', () => {
    const state = fixture()
    const source = structuredClone(state)
    const validRotation = { pitch: 0.1, yaw: 0.2, roll: 0.3 }

    for (const vector of [
      { x: Number.NaN, y: 2, z: 3 },
      { x: 1, y: Number.POSITIVE_INFINITY, z: 3 },
    ]) {
      assert.equal(applyCameraTargetDrag(state, CURRENT_TIME_SEC, vector), state)
      assert.equal(applyCameraDollyDrag(state, CURRENT_TIME_SEC, vector), state)
      assert.equal(applyCameraRoutePointDrag(state, 'director', CURRENT_TIME_SEC, vector), state)
      assert.equal(applyCameraTransform(state, 'director', CURRENT_TIME_SEC, { position: vector, rotation: validRotation }), state)
    }
    for (const rotation of [
      { pitch: Number.NaN, yaw: 0.2, roll: 0.3 },
      { pitch: 0.1, yaw: Number.POSITIVE_INFINITY, roll: 0.3 },
    ]) {
      assert.equal(applyCameraTransform(state, 'director', CURRENT_TIME_SEC, {
        position: { x: 1, y: 2, z: 3 },
        rotation,
      }), state)
    }
    assert.equal(applyObjectHeightDrag(state, 'camera', CURRENT_TIME_SEC, Number.NaN), state)
    assert.equal(applyObjectHeightDrag(state, 'camera', CURRENT_TIME_SEC, Number.POSITIVE_INFINITY), state)
    assert.deepEqual(state, source)
  })

  test('preserves a 0.4 roll across direct rotations derived from camera targets', () => {
    const state = fixture()
    const rolledState: SpatialPrevisState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === 0
            ? { ...keyframe, rotation: { ...keyframe.rotation, roll: 0.4 } }
            : keyframe),
        },
      },
    }

    const changes = [
      applyCameraTargetDrag(rolledState, 0, { x: 1, y: 2, z: 3 }),
      applyCameraDollyDrag(rolledState, 0, { x: 1, y: 2, z: 3 }),
      applyObjectHeightDrag(rolledState, 'camera', 0, 4),
      applyCameraRoutePointDrag(rolledState, 'director', 0, { x: 1, y: 2, z: 3 }),
    ]

    for (const changed of changes) {
      assert.equal(cameraFrameAt(changed, 'director', 0)?.rotation.roll, 0.4)
    }
  })

  test('keeps director and aerial target, dolly, and height edits isolated and writes derived rotations', () => {
    const state = fixture()
    const directorTargeted = applyCameraTargetDrag(state, CURRENT_TIME_SEC, { x: -2, y: 1, z: -3 })
    const targeted = applyCameraTargetDrag(state, CURRENT_TIME_SEC, { x: 1, y: 3, z: -4 }, 'aerial')
    const raised = applyObjectHeightDrag(targeted, 'camera', CURRENT_TIME_SEC, 12, undefined, 'aerial')
    const moved = applyCameraDollyDrag(raised, CURRENT_TIME_SEC, { x: 2, y: 12, z: -3 }, 'aerial')
    const frame = cameraFrameAt(moved, 'aerial')

    assert.ok(frame)
    assert.deepEqual(frame.rotation, rotationFromTarget(frame.position, frame.target))
    assert.deepEqual(directorTargeted.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)
    assert.deepEqual(moved.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.deepEqual(moved.masterTake.actorTracks, state.masterTake.actorTracks)
    assert.deepEqual(moved.masterTake.beats, state.masterTake.beats)
  })

  test('does not sample or mutate an empty selected camera track', () => {
    for (const mode of ['director', 'aerial'] as const) {
      const state = fixture()
      const emptyState: SpatialPrevisState = {
        ...state,
        masterTake: {
          ...state.masterTake,
          ...(mode === 'aerial'
            ? { aerialCameraTrack: { ...state.masterTake.aerialCameraTrack, keyframes: [] } }
            : { cameraTrack: { ...state.masterTake.cameraTrack, keyframes: [] } }),
        },
      }

      assert.equal(ensureCameraKeyframeAt(emptyState, mode, CURRENT_TIME_SEC), null)
      assert.equal(applyCameraTransform(emptyState, mode, CURRENT_TIME_SEC, {
        position: { x: 1, y: 2, z: 3 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
      }), emptyState)
      assert.equal(applyCameraRoutePointDrag(emptyState, mode, CURRENT_TIME_SEC, { x: 1, y: 2, z: 3 }), emptyState)
      assert.equal(applyCameraLens(emptyState, mode, CURRENT_TIME_SEC, { focalLengthMm: 50 }), emptyState)
    }
  })
})
