/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sampleCamera } from '@/lib/spatial-previs/sampler'
import { rotationFromTarget } from '@/lib/spatial-previs/camera'
import type { CameraKeyframe, SpatialPrevisCameraMode, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import {
  applySpatialCameraAction,
  SPATIAL_CAMERA_ACTIONS,
  SpatialCameraControlStrip,
  type SpatialCameraAction,
} from './SpatialCameraControlStrip'

const state: SpatialPrevisState = {
  version: 4,
  projectId: 'project-camera-actions',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'take-camera-actions',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-lead',
      anchorId: 'lead',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: -3, y: 0, z: 1 }, action: 'enter' },
        { id: 'actor-beat', timeSec: 6, position: { x: 2, y: 0, z: -2 }, action: 'turn' },
        { id: 'actor-end', timeSec: 12, position: { x: 4, y: 0, z: -4 }, action: 'exit' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 35, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'camera-beat', timeSec: 6, position: { x: 0, y: 2, z: 5 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 2, z: 5 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 50, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2, z: 4 }, target: { x: 2, y: 1, z: -2 }, rotation: rotationFromTarget({ x: 2, y: 2, z: 4 }, { x: 2, y: 1, z: -2 }), focalLengthMm: 65, shotScale: 'wide', motionBaseline: 'follow', intent: 'follow' },
      ],
    },
    aerialCameraTrack: {
      id: 'aerial-camera-track',
      keyframes: [{ id: 'aerial-start', timeSec: 0, position: { x: 0, y: 9, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 9, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' }],
    },
    beats: [],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-11T00:00:00.000Z',
}

function distance(left: Vec3, right: Vec3) {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)
}

function changedFrame(action: SpatialCameraAction) {
  const next = applySpatialCameraAction(state, 6, action, 'actor-lead')
  const frame = next.masterTake.cameraTrack.keyframes[1]
  assert.ok(frame)
  assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.cameraTrack.keyframes[0], state.masterTake.cameraTrack.keyframes[0])
  assert.equal(next.masterTake.cameraTrack.keyframes[2], state.masterTake.cameraTrack.keyframes[2])
  assert.equal(frame.focalLengthMm, 50)
  assert.deepEqual(sampleCamera(next.masterTake.cameraTrack.keyframes, 6), frame)
  return frame
}

test('renders seven separate compact camera actions', () => {
  assert.deepEqual(SPATIAL_CAMERA_ACTIONS, ['推', '拉', '摇', '移', '跟', '升', '降'])

  const markup = renderToStaticMarkup(createElement(SpatialCameraControlStrip, {
    state,
    currentTimeSec: 6,
    actorTrackId: 'actor-lead',
    onChange: () => undefined,
  }))

  assert.equal((markup.match(/<button/g) ?? []).length, 7)
  for (const action of SPATIAL_CAMERA_ACTIONS) {
    assert.match(markup, new RegExp(`aria-label="${action}"`))
  }
  assert.doesNotMatch(markup, /推\/拉|摇\/俯仰|跟拍|升\/降/)
})

test('applies each camera action to the current keyframe without changing actor routes', () => {
  const original = state.masterTake.cameraTrack.keyframes[1] as CameraKeyframe
  const forward = {
    x: original.target.x - original.position.x,
    y: original.target.y - original.position.y,
    z: original.target.z - original.position.z,
  }

  const push = changedFrame('推')
  const pull = changedFrame('拉')
  assert.ok(distance(push.position, original.target) < distance(original.position, original.target))
  assert.ok(distance(pull.position, original.target) > distance(original.position, original.target))
  assert.deepEqual(push.target, original.target)
  assert.deepEqual(pull.target, original.target)
  assert.equal(push.intent, 'push')
  assert.equal(pull.intent, 'pull')
  assert.ok((push.position.x - original.position.x) * forward.x
    + (push.position.y - original.position.y) * forward.y
    + (push.position.z - original.position.z) * forward.z > 0)

  const pan = changedFrame('摇')
  assert.deepEqual(pan.position, original.position)
  assert.notDeepEqual(pan.target, original.target)
  assert.equal(pan.intent, 'pan-tilt')

  const lateral = changedFrame('移')
  assert.deepEqual({
    x: lateral.position.x - original.position.x,
    y: lateral.position.y - original.position.y,
    z: lateral.position.z - original.position.z,
  }, {
    x: lateral.target.x - original.target.x,
    y: lateral.target.y - original.target.y,
    z: lateral.target.z - original.target.z,
  })
  assert.equal(lateral.intent, 'dolly')

  const actorFocus = { x: 2, y: 1, z: -2 }
  const follow = changedFrame('跟')
  assert.ok(distance(follow.target, actorFocus) < distance(original.target, actorFocus))
  assert.equal(follow.intent, 'follow')

  const rise = changedFrame('升')
  const descend = changedFrame('降')
  assert.equal(rise.position.y, original.position.y + 0.35)
  assert.equal(rise.target.y, original.target.y + 0.35)
  assert.equal(descend.position.y, original.position.y - 0.35)
  assert.equal(descend.target.y, original.target.y - 0.35)
  assert.equal(rise.intent, 'crane')
  assert.equal(descend.intent, 'crane')
})

test('does not dispatch an action between camera keyframes', () => {
  const next = applySpatialCameraAction(state, 5, '推', 'actor-lead')
  assert.equal(next.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 5)?.motionBaseline, 'push')
})

test('does not create a keyframe when follow cannot resolve the requested actor', () => {
  const noFallbackState: SpatialPrevisState = {
    ...state,
    masterTake: { ...state.masterTake, actorTracks: [] },
  }

  const next = applySpatialCameraAction(noFallbackState, 5, '跟', 'actor-missing')

  assert.equal(next, noFallbackState)
  assert.equal(next.masterTake.cameraTrack.keyframes.length, noFallbackState.masterTake.cameraTrack.keyframes.length)
  assert.equal(next.masterTake.cameraTrack.keyframes.some((keyframe) => keyframe.timeSec === 5), false)
})

test('does not fall back to another actor when follow has no selected actor', () => {
  const next = applySpatialCameraAction(state, 5, '跟')

  assert.equal(next, state)
  assert.equal(next.masterTake.cameraTrack.keyframes.some((keyframe) => keyframe.timeSec === 5), false)
})

test('does not create a keyframe for an invalid runtime camera action', () => {
  const next = applySpatialCameraAction(state, 5, 'bogus' as SpatialCameraAction, 'actor-lead')

  assert.equal(next, state)
  assert.equal(next.masterTake.cameraTrack.keyframes.some((keyframe) => keyframe.timeSec === 5), false)
})

test('does not mutate either camera plan for an invalid runtime camera mode', () => {
  const next = applySpatialCameraAction(state, 5, '推', 'actor-lead', 'bogus' as SpatialPrevisCameraMode)

  assert.equal(next, state)
  assert.equal(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
  assert.equal(next.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)
})

test('does not create a camera keyframe for an invalid current time', () => {
  for (const currentTimeSec of [-0.1, state.masterTake.durationSec + 0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(applySpatialCameraAction(state, currentTimeSec, '推', 'actor-lead'), state)
  }
})

test('preserves camera roll when a baseline action rederives rotation from its target', () => {
  const rolledState: SpatialPrevisState = {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === 6
          ? { ...keyframe, rotation: { ...keyframe.rotation, roll: 0.4 } }
          : keyframe),
      },
    },
  }

  const frame = applySpatialCameraAction(rolledState, 6, '移', 'actor-lead').masterTake.cameraTrack.keyframes[1]

  assert.equal(frame?.rotation.roll, 0.4)
})

test('does not mutate an empty selected camera track', () => {
  for (const mode of ['director', 'aerial'] as const) {
    const emptyState: SpatialPrevisState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        ...(mode === 'aerial'
          ? { aerialCameraTrack: { ...state.masterTake.aerialCameraTrack, keyframes: [] } }
          : { cameraTrack: { ...state.masterTake.cameraTrack, keyframes: [] } }),
      },
    }

    assert.equal(applySpatialCameraAction(emptyState, 5, '推', 'actor-lead', mode), emptyState)
  }
})

test('follows the selected actor route sample between actor keyframes', () => {
  const routeState: SpatialPrevisState = {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: [{
        id: 'actor-other',
        anchorId: 'other',
        keyframes: [{ id: 'other-beat', timeSec: 6, position: { x: -8, y: 0, z: 4 }, action: 'wait' }],
      }, {
        ...state.masterTake.actorTracks[0]!,
        keyframes: [
          state.masterTake.actorTracks[0]!.keyframes[0]!,
          state.masterTake.actorTracks[0]!.keyframes[2]!,
        ],
      }],
    },
  }

  const frame = applySpatialCameraAction(routeState, 6, '跟', 'actor-lead')
    .masterTake.cameraTrack.keyframes[1]

  assert.ok(frame)
  assert.ok(frame.target.x > 0)
  assert.equal(frame.intent, 'follow')
  assert.equal(routeState.masterTake.actorTracks[1]?.keyframes.length, 2)
})

test('creates or updates an exact aerial keyframe while preserving the director plan and action baselines', () => {
  const baselineByAction = {
    '推': 'push',
    '拉': 'pull',
    '摇': 'pan',
    '移': 'move',
    '跟': 'follow',
    '升': 'rise',
    '降': 'fall',
  } as const

  for (const action of SPATIAL_CAMERA_ACTIONS) {
    const next = applySpatialCameraAction(state, 6, action, 'actor-lead', 'aerial')
    const frame = next.masterTake.aerialCameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 6)
    assert.equal(frame?.motionBaseline, baselineByAction[action])
    assert.equal(frame?.focalLengthMm, 24)
    assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
  }
})
