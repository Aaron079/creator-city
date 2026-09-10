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

  test('migrates a persisted version-1 spatial previs state to version 2', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'video-scan',
      durationSec: 45,
      aspectRatio: '9:16',
      editorMode: 'beats',
      updatedAt: '2026-09-09T00:00:00.000Z',
    })
    const { references, whitebox, ...legacyScene } = state.scene

    void references
    void whitebox

    const parsed = parseSpatialPrevisMetadata({
      spatialPrevis: { ...state, version: 1, scene: legacyScene },
    })

    assert.deepEqual(parsed, state)
    assert.deepEqual(parsed?.scene.references, [])
    assert.deepEqual(parsed?.scene.whitebox.entities, [])
  })

  test('restores a valid version-2 spatial previs state', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const persisted = {
      ...state,
      scene: {
        ...state.scene,
        references: [{
          id: 'reference-1',
          assetId: 'asset-1',
          title: 'Exterior reference',
          mediaType: 'image' as const,
          url: 'https://example.com/exterior.jpg',
          source: 'project' as const,
        }],
        whitebox: {
          entities: [{
            id: 'floor-1',
            kind: 'floor' as const,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            size: { x: 8, y: 0.1, z: 8 },
            sourceAssetIds: ['asset-1'],
          }],
        },
      },
    }

    assert.deepEqual(parseSpatialPrevisMetadata({ spatialPrevis: persisted }), persisted)
  })

  test('returns null for malformed version-2 references and whitebox entities', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const reference = {
      id: 'reference-1',
      assetId: 'asset-1',
      title: 'Exterior reference',
      mediaType: 'image',
      url: 'https://example.com/exterior.jpg',
      source: 'project',
    }
    const entity = {
      id: 'floor-1',
      kind: 'floor',
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      size: { x: 8, y: 0.1, z: 8 },
      sourceAssetIds: ['asset-1'],
    }
    const malformedStates = [
      { ...state, scene: { ...state.scene, references: [{ ...reference, id: '' }] } },
      { ...state, scene: { ...state.scene, references: [{ ...reference, assetId: '' }] } },
      { ...state, scene: { ...state.scene, references: [{ ...reference, title: '' }] } },
      { ...state, scene: { ...state.scene, references: [{ ...reference, mediaType: 'audio' }] } },
      { ...state, scene: { ...state.scene, references: [{ ...reference, url: '' }] } },
      { ...state, scene: { ...state.scene, references: [{ ...reference, source: 'external' }] } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, id: '' }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, kind: 'light' }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, position: { x: 0, y: 0 } }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, rotationY: Number.POSITIVE_INFINITY }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, size: { x: 8, y: 0.1 } }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, sourceAssetIds: [] }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, sourceAssetIds: [''] }] } } },
    ]

    for (const spatialPrevis of malformedStates) {
      assert.equal(parseSpatialPrevisMetadata({ spatialPrevis }), null)
    }
  })

  test('returns null for unsafe version-2 reference URLs', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })

    for (const url of ['javascript:alert(1)', 'data:text/html,boom', 'not a url']) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: {
          ...state,
          scene: {
            ...state.scene,
            references: [{
              id: 'reference-1',
              assetId: 'asset-1',
              title: 'Exterior reference',
              mediaType: 'image',
              url,
              source: 'project',
            }],
          },
        },
      }), null)
    }
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

  test('returns null for reversed beats and actor keyframes outside persisted duration', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1', durationSec: 30 })
    const invalidTimelines = [
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          beats: state.masterTake.beats.map((beat) => ({ ...beat, startSec: 20, endSec: 10 })),
        },
      },
      {
        ...state,
        masterTake: {
          ...state.masterTake,
          actorTracks: [{
            id: 'actor-track',
            anchorId: 'actor-anchor',
            keyframes: [{
              id: 'actor-frame',
              timeSec: 31,
              position: { x: 0, y: 0, z: 0 },
              action: 'walk',
            }],
          }],
        },
      },
    ]

    for (const spatialPrevis of invalidTimelines) {
      assert.equal(parseSpatialPrevisMetadata({ spatialPrevis }), null)
    }
  })
})
