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

  test('returns null when persisted spatial previs belongs to another project', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const metadata = {
      title: 'Project 2',
      email: 'project-2@example.com',
      spatialPrevis: state,
    }

    assert.deepEqual(parseSpatialPrevisMetadata(metadata, 'project-1'), state)
    assert.equal(parseSpatialPrevisMetadata(metadata, 'project-2'), null)
  })

  test('migrates a persisted version-1 spatial previs state to version 3', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'video-scan',
      durationSec: 45,
      aspectRatio: '9:16',
      editorMode: 'beats',
      updatedAt: '2026-09-09T00:00:00.000Z',
    })
    const { references, assetSets, whitebox, ...legacyScene } = state.scene

    void references
    void assetSets
    void whitebox

    const parsed = parseSpatialPrevisMetadata({
      spatialPrevis: { ...state, version: 1, scene: legacyScene },
    })

    assert.deepEqual(parsed, state)
    assert.equal(parsed?.version, 3)
    assert.deepEqual(parsed?.scene.references, [])
    assert.deepEqual(parsed?.scene.assetSets, [])
    assert.deepEqual(parsed?.scene.whitebox.entities, [])
  })

  test('migrates version-2 references and whitebox geometry to version 3', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const { assetSets, ...legacyScene } = state.scene

    void assetSets

    const references = [{
      id: 'reference-1',
      assetId: 'asset-1',
      title: 'Project exterior',
      mediaType: 'image' as const,
      url: 'https://example.com/project-exterior.jpg?size=original#view',
      source: 'project' as const,
    }, {
      id: 'scene-library-asset-2',
      assetId: 'asset-2',
      title: 'Library exterior',
      mediaType: 'video' as const,
      url: 'https://example.com/library-exterior.mp4?token=exact',
      source: 'library' as const,
    }]
    const entity = {
      id: 'floor-1',
      kind: 'floor' as const,
      position: { x: 0, y: 0, z: 0 },
      rotationY: 0,
      size: { x: 8, y: 0.1, z: 8 },
      sourceAssetIds: ['asset-1'],
    }
    const persisted = {
      ...state,
      version: 2,
      scene: {
        ...legacyScene,
        references,
        whitebox: { entities: [entity] },
      },
    }

    const parsed = parseSpatialPrevisMetadata({ spatialPrevis: persisted })

    assert.equal(parsed?.version, 3)
    assert.deepEqual(parsed?.scene.references, references)
    assert.deepEqual(parsed?.scene.assetSets, [{
      id: 'asset-set-legacy-1',
      role: 'scene',
      referenceIds: ['reference-1'],
    }, {
      id: 'asset-set-legacy-2',
      role: 'scene',
      referenceIds: ['scene-library-asset-2'],
    }])
    assert.deepEqual(parsed?.scene.whitebox.entities, [{ ...entity, label: 'floor-1', confidence: 1 }])
  })

  test('restores a valid version-3 scene with prop whitebox geometry', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const persisted = {
      ...state,
      version: 3 as const,
      scene: {
        ...state.scene,
        references: [{
          id: 'scene-library-asset-1',
          assetId: 'asset-1',
          title: 'Existing library exterior',
          mediaType: 'image' as const,
          url: 'https://example.com/exterior.jpg',
          source: 'library' as const,
        }],
        assetSets: [{
          id: 'asset-set-1',
          role: 'prop' as const,
          referenceIds: ['scene-library-asset-1'],
        }],
        whitebox: {
          entities: [{
            id: 'prop-1',
            label: 'Dining table',
            confidence: 0.75,
            kind: 'prop' as const,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            size: { x: 2, y: 1, z: 1 },
            sourceAssetIds: ['asset-1'],
          }],
        },
      },
    }

    assert.deepEqual(parseSpatialPrevisMetadata({ spatialPrevis: persisted }), persisted)
  })

  test('returns null for duplicate scene reference ids in version 2 and version 3', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const reference = {
      id: 'reference-duplicate',
      assetId: 'asset-1',
      title: 'Exterior reference',
      mediaType: 'image' as const,
      url: 'https://example.com/exterior.jpg',
      source: 'project' as const,
    }

    for (const version of [3, 2]) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: {
          ...state,
          version,
          scene: {
            ...state.scene,
            references: [reference, { ...reference, assetId: 'asset-2' }],
          },
        },
      }), null)
    }
  })

  test('returns null for duplicate scene asset ids across distinct references in version 2 and version 3', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const reference = {
      id: 'reference-one',
      assetId: 'asset-duplicate',
      title: 'Exterior reference',
      mediaType: 'image' as const,
      url: 'https://example.com/exterior.jpg',
      source: 'project' as const,
    }

    for (const version of [3, 2]) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: {
          ...state,
          version,
          scene: {
            ...state.scene,
            references: [reference, { ...reference, id: 'reference-two' }],
          },
        },
      }), null)
    }
  })

  test('returns null for malformed version-3 references and whitebox entities', () => {
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
      label: 'Floor',
      confidence: 1,
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
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, label: '' }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, label: '   ' }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: undefined }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: '1' }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: Number.NaN }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: Number.POSITIVE_INFINITY }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: Number.NEGATIVE_INFINITY }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: -0.01 }] } } },
      { ...state, scene: { ...state.scene, whitebox: { entities: [{ ...entity, confidence: 1.01 }] } } },
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

  test('returns null for duplicate persisted whitebox entity ids', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const entity = {
      id: 'wall-duplicate',
      label: '墙体',
      confidence: 1,
      kind: 'wall' as const,
      position: { x: 0, y: 1.5, z: 0 },
      rotationY: 0,
      size: { x: 4, y: 3, z: 0.2 },
      sourceAssetIds: ['manual'],
    }

    assert.equal(parseSpatialPrevisMetadata({
      spatialPrevis: {
        ...state,
        scene: {
          ...state.scene,
          whitebox: { entities: [entity, { ...entity, label: '重复墙体' }] },
        },
      },
    }), null)
  })

  test('returns null for malformed version-3 asset sets', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const reference = {
      id: 'reference-1',
      assetId: 'asset-1',
      title: 'Exterior reference',
      mediaType: 'image' as const,
      url: 'https://example.com/exterior.jpg',
      source: 'project' as const,
    }
    const assetSet = {
      id: 'asset-set-1',
      role: 'scene',
      referenceIds: ['reference-1'],
    }
    const scene = { ...state.scene, references: [reference], assetSets: [assetSet] }
    const malformedScenes = [
      { ...scene, assetSets: undefined },
      { ...scene, assetSets: [{ ...assetSet, id: '' }] },
      { ...scene, assetSets: [assetSet, { ...assetSet }] },
      { ...scene, assetSets: [{ ...assetSet, role: 'environment' }] },
      { ...scene, assetSets: [{ ...assetSet, referenceIds: ['missing-reference'] }] },
    ]

    for (const malformedScene of malformedScenes) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: { ...state, scene: malformedScene },
      }), null)
    }
  })

  test('returns null for empty or duplicate reference ids within a version-3 asset set', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const reference = {
      id: 'reference-1',
      assetId: 'asset-1',
      title: 'Exterior reference',
      mediaType: 'image' as const,
      url: 'https://example.com/exterior.jpg',
      source: 'project' as const,
    }
    const malformedReferenceIds = [[], ['reference-1', 'reference-1']]

    for (const referenceIds of malformedReferenceIds) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: {
          ...state,
          scene: {
            ...state.scene,
            references: [reference],
            assetSets: [{ id: 'asset-set-1', role: 'scene', referenceIds }],
          },
        },
      }), null)
    }
  })

  test('returns null for unsafe version-2 reference URLs', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })

    for (const url of ['javascript:alert(1)', 'data:text/html,boom', 'not a url']) {
      assert.equal(parseSpatialPrevisMetadata({
        spatialPrevis: {
          ...state,
          version: 2,
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
