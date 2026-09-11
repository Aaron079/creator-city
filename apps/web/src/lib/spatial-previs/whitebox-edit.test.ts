import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSpatialPrevis } from './normalize'
import { parseSpatialPrevisMetadata } from './persistence'
import {
  applyWhiteboxGroundDrag,
  createManualWhiteboxEntity,
  updateWhiteboxEntity,
} from './whitebox-edit'
import type { SpatialPrevisState, WhiteboxEntity } from './types'

function fixture(): SpatialPrevisState {
  const state = normalizeSpatialPrevis({ projectId: 'project-1' })
  return {
    ...state,
    scene: {
      ...state.scene,
      whitebox: {
        entities: [{
          id: 'wall-asset-set-1-east',
          label: '东侧墙体',
          confidence: 0.45,
          kind: 'wall',
          position: { x: 3, y: 1.5, z: 0 },
          rotationY: 0,
          size: { x: 0.2, y: 3, z: 8 },
          sourceAssetIds: ['asset-street'],
        }],
      },
    },
  }
}

describe('spatial previs whitebox edits', () => {
  test('updates only editable transforms with cloned vectors and no state mutation', () => {
    const state = fixture()
    const source = structuredClone(state)
    const patch = {
      position: { x: 6, y: 2, z: -1 },
      rotationY: 0.5,
      size: { x: 0.4, y: 4, z: 9 },
      label: 'must not replace the label',
      confidence: 1,
    }

    const next = updateWhiteboxEntity(state, 'wall-asset-set-1-east', patch)
    patch.position.x = 99
    patch.size.x = 99

    const entity = next.scene.whitebox.entities[0]!
    assert.deepEqual(entity.position, { x: 6, y: 2, z: -1 })
    assert.equal(entity.rotationY, 0.5)
    assert.deepEqual(entity.size, { x: 0.4, y: 4, z: 9 })
    assert.equal(entity.label, '东侧墙体')
    assert.equal(entity.confidence, 0.45)
    assert.equal(next.masterTake, state.masterTake)
    assert.equal(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
    assert.deepEqual(state, source)
  })

  test('ground drag changes only x and z', () => {
    const state = fixture()
    const source = structuredClone(state)

    const next = applyWhiteboxGroundDrag(state, 'wall-asset-set-1-east', { x: -4, z: 7 })
    const entity = next.scene.whitebox.entities[0]!

    assert.deepEqual(entity.position, { x: -4, y: 1.5, z: 7 })
    assert.equal(entity.rotationY, 0)
    assert.deepEqual(entity.size, { x: 0.2, y: 3, z: 8 })
    assert.deepEqual(state, source)
  })

  test('creates deterministic persistence-valid manual entities with clear Chinese labels', () => {
    const kinds: WhiteboxEntity['kind'][] = [
      'floor', 'wall', 'opening', 'volume', 'furniture', 'referencePlane', 'prop',
    ]

    const entities = kinds.map((kind, index) => createManualWhiteboxEntity(kind, index + 1))

    assert.deepEqual(entities.map((entity) => entity.id), [
      'manual-floor-1',
      'manual-wall-2',
      'manual-opening-3',
      'manual-volume-4',
      'manual-furniture-5',
      'manual-referencePlane-6',
      'manual-prop-7',
    ])
    assert.deepEqual(entities.map((entity) => entity.label), [
      '手动地面 1',
      '手动墙体 2',
      '手动开口 3',
      '手动体块 4',
      '手动家具 5',
      '手动参考面 6',
      '手动道具 7',
    ])
    assert.equal(entities.every((entity) => entity.confidence === 1), true)
    assert.equal(entities.every((entity) => entity.sourceAssetIds.length === 1), true)
    assert.equal(entities.every((entity) => entity.sourceAssetIds[0] === 'manual'), true)
    assert.deepEqual(createManualWhiteboxEntity('wall', 2), entities[1])

    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const persisted = {
      ...state,
      scene: { ...state.scene, whitebox: { entities } },
    }
    assert.deepEqual(parseSpatialPrevisMetadata({ spatialPrevis: persisted }), persisted)
  })
})
