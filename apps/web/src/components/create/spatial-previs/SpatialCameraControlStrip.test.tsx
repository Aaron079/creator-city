/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialCameraControlStrip.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sampleCamera } from '@/lib/spatial-previs/sampler'
import type { CameraKeyframe, SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'
import {
  applySpatialCameraAction,
  SPATIAL_CAMERA_ACTIONS,
  SpatialCameraControlStrip,
  type SpatialCameraAction,
} from './SpatialCameraControlStrip'

const state: SpatialPrevisState = {
  version: 3,
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
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 }, focalLengthMm: 35, intent: 'static' },
        { id: 'camera-beat', timeSec: 6, position: { x: 0, y: 2, z: 5 }, target: { x: 0, y: 1, z: 0 }, focalLengthMm: 50, intent: 'static' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2, z: 4 }, target: { x: 2, y: 1, z: -2 }, focalLengthMm: 65, intent: 'follow' },
      ],
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
  assert.equal(applySpatialCameraAction(state, 5, '推', 'actor-lead'), state)
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
