import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSpatialPrevis } from './normalize'
import {
  parseSpatialPrevisMetadata,
  spatialPrevisMetadata,
} from './persistence'

describe('spatial previs persistence', () => {
  test('preserves unrelated workflow metadata while storing spatial previs in its namespace', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'multi-view',
      durationSec: 45,
      updatedAt: '2026-09-09T00:00:00.000Z',
    })

    const existingMetadata = {
      shotSequence: { version: 1 },
      custom: 'preserved',
      spatialPrevis: { version: 0 },
    }
    const source = structuredClone(existingMetadata)

    assert.deepEqual(
      spatialPrevisMetadata(existingMetadata, state),
      {
        shotSequence: { version: 1 },
        custom: 'preserved',
        spatialPrevis: state,
      },
    )
    assert.deepEqual(existingMetadata, source)
  })

  test('restores a normalized version-1 spatial previs state', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'video-scan',
      durationSec: 45,
      aspectRatio: '9:16',
      editorMode: 'beats',
      updatedAt: '2026-09-09T00:00:00.000Z',
    })

    assert.deepEqual(parseSpatialPrevisMetadata({ spatialPrevis: state }), state)
  })

  test('returns null for malformed or unsupported spatial previs metadata', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const malformedMetadata = [
      null,
      [],
      {},
      { spatialPrevis: null },
      { spatialPrevis: { version: 2 } },
      { spatialPrevis: { version: 1, projectId: 42 } },
      { spatialPrevis: { ...state, scene: { ...state.scene, coverage: null } } },
    ]

    for (const metadata of malformedMetadata) {
      assert.equal(parseSpatialPrevisMetadata(metadata), null)
    }
  })

  test('returns null for restored timelines that cannot be sampled or patched', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const midpoint = state.masterTake.durationSec / 2
    const nonExecutableTimelines = [
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: { ...state.masterTake.cameraTrack, keyframes: [] },
        },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'camera-mid'
              ? { ...keyframe, timeSec: midpoint + 1 }
              : keyframe),
          },
        },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: [...state.masterTake.cameraTrack.keyframes, { ...state.masterTake.cameraTrack.keyframes[1]! }],
          },
        },
      },
    ]

    for (const spatialPrevis of nonExecutableTimelines) {
      assert.equal(parseSpatialPrevisMetadata({ spatialPrevis }), null)
    }
  })

  test('returns null for restored timelines outside persisted duration bounds', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1', durationSec: 30 })
    const invalidTimelines = [
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          durationSec: 1,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => {
              if (keyframe.id === 'camera-mid') return { ...keyframe, timeSec: 0.5 }
              if (keyframe.id === 'camera-end') return { ...keyframe, timeSec: 1 }
              return keyframe
            }),
          },
          beats: state.masterTake.beats.map((beat) => ({ ...beat, endSec: 1 })),
        },
      },
      {
        ...state,
        masterTake: { ...state.masterTake, durationSec: 181 },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'camera-start'
              ? { ...keyframe, timeSec: -1 }
              : keyframe.id === 'camera-end'
                ? { ...keyframe, timeSec: 31 }
                : keyframe),
          },
        },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'camera-mid'
              ? { ...keyframe, timeSec: 14.5 }
              : keyframe),
          },
          beats: state.masterTake.beats.map((beat) => ({ ...beat, startSec: -1 })),
        },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          cameraTrack: {
            ...state.masterTake.cameraTrack,
            keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'camera-mid'
              ? { ...keyframe, timeSec: 15.5 }
              : keyframe),
          },
          beats: state.masterTake.beats.map((beat) => ({ ...beat, endSec: 31 })),
        },
      },
    ]

    for (const spatialPrevis of invalidTimelines) {
      assert.equal(parseSpatialPrevisMetadata({ spatialPrevis }), null)
    }
  })
})
