import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SpatialPrevisState } from './types'
import {
  buildSpatialPrevisTestRequest,
  createSpatialPrevisTestTake,
} from './test-delivery'

const state: SpatialPrevisState = {
  version: 3,
  projectId: 'project-test-delivery',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [{
      id: 'street-image',
      assetId: 'asset-street-image',
      title: 'Street',
      mediaType: 'image',
      url: 'https://cdn.example/street.jpg',
      source: 'project',
    }, {
      id: 'street-video',
      assetId: 'asset-street-video',
      title: 'Walkthrough',
      mediaType: 'video',
      url: 'https://cdn.example/walkthrough.mp4',
      source: 'library',
    }],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'master-take-1',
    durationSec: 20,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-1',
      anchorId: 'actor-1',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: 0, y: 0, z: 0 }, action: 'walk' },
        { id: 'actor-end', timeSec: 20, position: { x: 20, y: 0, z: 0 }, action: 'stop' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track-1',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 }, focalLengthMm: 35, intent: 'static' },
        { id: 'camera-end', timeSec: 20, position: { x: 20, y: 2, z: 8 }, target: { x: 20, y: 1, z: 0 }, focalLengthMm: 55, intent: 'follow' },
      ],
    },
    beats: [{ id: 'master-beat', label: 'Master beat', startSec: 0, endSec: 20 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-11T00:00:00.000Z',
}

test('builds a sampled 10 second internal test and derives its asset references', () => {
  const testTake = createSpatialPrevisTestTake(state, 10)
  const request = buildSpatialPrevisTestRequest(testTake, 'canvas-test-1', 10)

  assert.equal(testTake.masterTake.durationSec, 10)
  assert.equal(testTake.masterTake.id, 'master-take-1@test-10')
  assert.deepEqual(testTake.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 5, 10])
  assert.deepEqual(testTake.masterTake.actorTracks[0]?.keyframes.map((keyframe) => keyframe.timeSec), [0, 5, 10])
  assert.deepEqual(testTake.masterTake.actorTracks[0]?.keyframes[2]?.position, { x: 10, y: 0, z: 0 })
  assert.equal(request.nodeId, 'canvas-test-1')
  assert.equal(request.testDurationSec, 10)
  assert.equal(request.imageUrl, 'https://cdn.example/street.jpg')
  assert.deepEqual(request.referenceImages, ['https://cdn.example/street.jpg'])
  assert.deepEqual(request.referenceVideos, ['https://cdn.example/walkthrough.mp4'])
})

test('does not mutate the full master take while deriving an internal test', () => {
  const masterSnapshot = structuredClone(state.masterTake)

  const testTake = createSpatialPrevisTestTake(state, 5)

  assert.deepEqual(state.masterTake, masterSnapshot)
  assert.notEqual(testTake, state)
  assert.notEqual(testTake.masterTake, state.masterTake)
  assert.equal(state.masterTake.durationSec, 20)
})

test('rejects a duration outside the 5 or 10 second test choices', () => {
  assert.throws(
    () => buildSpatialPrevisTestRequest(state, 'canvas-test-1', 15 as 5),
    /INVALID_SPATIAL_PREVIS_TEST_DURATION/,
  )
})

test('rejects a test longer than the full master take', () => {
  const shortState = {
    ...state,
    masterTake: { ...state.masterTake, durationSec: 5 },
  }

  assert.throws(() => createSpatialPrevisTestTake(shortState, 10), /SPATIAL_PREVIS_TEST_EXCEEDS_MASTER_TAKE/)
})
