import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rotationFromTarget } from './camera'
import { clampSpatialKeyframeTime, retimeActorKeyframe, retimeCameraKeyframe } from './timeline'
import type { SpatialPrevisState } from './types'

const state: SpatialPrevisState = {
  version: 4,
  projectId: 'project-timeline',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'take-timeline',
    durationSec: 30,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-lead',
      anchorId: 'lead',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: 0, y: 0, z: 0 }, action: 'enter' },
        { id: 'actor-mid', timeSec: 15, position: { x: 2, y: 0, z: -1 }, action: 'turn' },
      ],
    }],
    cameraTrack: {
      id: 'camera-director',
      keyframes: [
        { id: 'director-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 1.6, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 35, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'director-mid', timeSec: 15, position: { x: 1, y: 2, z: 5 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 1, y: 2, z: 5 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 50, shotScale: 'medium', motionBaseline: 'push', intent: 'push' },
      ],
    },
    aerialCameraTrack: {
      id: 'camera-aerial',
      keyframes: [
        { id: 'aerial-start', timeSec: 0, position: { x: 0, y: 9, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 9, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
        { id: 'aerial-mid', timeSec: 15, position: { x: 2, y: 10, z: 5 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 2, y: 10, z: 5 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'rise', intent: 'crane' },
      ],
    },
    beats: [],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-12T00:00:00.000Z',
}

test('clamps a dragged keyframe time without deleting its route point', () => {
  assert.equal(clampSpatialKeyframeTime(-1, 30), 0)
  assert.equal(clampSpatialKeyframeTime(31, 30), 30)
  assert.equal(clampSpatialKeyframeTime(Number.NaN, 30), 0)
})

test('retimes only the selected aerial camera keyframe', () => {
  const next = retimeCameraKeyframe(state, 'aerial', 'aerial-mid', 18)

  assert.equal(next.masterTake.aerialCameraTrack.keyframes[1]?.timeSec, 18)
  assert.equal(next.masterTake.cameraTrack.keyframes[1]?.timeSec, 15)
  assert.deepEqual(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.aerialCameraTrack.keyframes[1]?.motionBaseline, 'rise')
})

test('sorts a retimed camera keyframe across its neighbour and preserves its full pose', () => {
  const source: SpatialPrevisState = {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'director-start'
          ? { ...keyframe, timeSec: 10 }
          : keyframe),
      },
    },
  }
  const original = source.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.id === 'director-mid')
  assert.ok(original)

  const next = retimeCameraKeyframe(source, 'director', 'director-mid', 5)
  const retimed = next.masterTake.cameraTrack.keyframes[0]

  assert.deepEqual(next.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id), ['director-mid', 'director-start'])
  assert.deepEqual(retimed, { ...original, timeSec: 5 })
})

test('retimes only the selected actor keyframe and keeps the route point', () => {
  const next = retimeActorKeyframe(state, 'actor-lead', 'actor-mid', 40)

  assert.equal(next.masterTake.actorTracks[0]?.keyframes[1]?.timeSec, 30)
  assert.deepEqual(next.masterTake.actorTracks[0]?.keyframes[1]?.position, { x: 2, y: 0, z: -1 })
  assert.deepEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
})

test('does not mutate a timeline for unknown identifiers or invalid camera modes', () => {
  assert.equal(retimeCameraKeyframe(state, 'director', 'missing', 10), state)
  assert.equal(retimeActorKeyframe(state, 'missing', 'actor-mid', 10), state)
  assert.equal(retimeCameraKeyframe(state, 'invalid' as never, 'director-mid', 10), state)
})
