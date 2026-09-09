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

    assert.deepEqual(
      spatialPrevisMetadata({ shotSequence: { version: 1 }, custom: 'preserved' }, state),
      {
        shotSequence: { version: 1 },
        custom: 'preserved',
        spatialPrevis: state,
      },
    )
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
})
