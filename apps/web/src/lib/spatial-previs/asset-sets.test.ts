import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSpatialPrevis } from './normalize'
import type { SpatialAssetSet, SpatialSceneReference } from './types'
import { replaceWhiteboxDraft } from './whitebox'
import { createManualWhiteboxEntity } from './whitebox-edit'
import {
  addSpatialSceneAssetSet,
  replaceSpatialSceneInputs,
} from './asset-sets'

const libraryStreet: SpatialSceneReference = {
  id: 'scene-library-street',
  assetId: 'asset-library-street',
  title: 'Library street',
  mediaType: 'image',
  url: '/api/assets/asset-library-street/file',
  source: 'library',
}

const projectStreet: SpatialSceneReference = {
  id: 'scene-project-street',
  assetId: 'asset-project-street',
  title: 'Project street',
  mediaType: 'video',
  url: '/api/assets/asset-project-street/file',
  source: 'project',
}

describe('spatial previs asset sets', () => {
  test('adds selected references as one deterministic role set without mutating state', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const source = structuredClone(state)

    const next = addSpatialSceneAssetSet(state, [libraryStreet, libraryStreet], 'scene')

    assert.deepEqual(next.scene.references, [libraryStreet])
    assert.deepEqual(next.scene.assetSets, [{
      id: 'asset-set-scene-1',
      role: 'scene',
      referenceIds: [libraryStreet.id],
    }])
    assert.equal(next.scene.whitebox.entities.length > 0, true)
    assert.deepEqual(state, source)
  })

  test('preserves existing sources and rebuilds a new multi-reference role set', () => {
    const empty = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const existing = addSpatialSceneAssetSet(empty, [libraryStreet], 'scene')

    const next = addSpatialSceneAssetSet(existing, [libraryStreet, projectStreet], 'prop')

    assert.deepEqual(next.scene.references.map((reference) => reference.source), ['library', 'project'])
    assert.deepEqual(next.scene.assetSets[1], {
      id: 'asset-set-prop-2',
      role: 'prop',
      referenceIds: [libraryStreet.id, projectStreet.id],
    })
    assert.equal(next.scene.whitebox.entities.some((entity) => entity.id === 'prop-asset-set-prop-2'), true)
  })

  test('advances a deterministic role set id past an occupied suffix', () => {
    const empty = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const state = replaceSpatialSceneInputs(empty, [libraryStreet], [{
      id: 'asset-set-prop-2',
      role: 'prop',
      referenceIds: [libraryStreet.id],
    }])

    const next = addSpatialSceneAssetSet(state, [projectStreet], 'prop')

    assert.equal(next.scene.assetSets[1]?.id, 'asset-set-prop-3')
  })

  test('copies valid scene inputs before rebuilding the whitebox', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const references = [structuredClone(libraryStreet)]
    const assetSets: SpatialAssetSet[] = [{
      id: 'asset-set-reference-1',
      role: 'reference',
      referenceIds: [libraryStreet.id],
    }]

    const next = replaceSpatialSceneInputs(state, references, assetSets)
    references[0]!.title = 'mutated later'
    assetSets[0]!.referenceIds[0] = 'mutated-later'

    assert.equal(next.scene.references[0]?.title, 'Library street')
    assert.deepEqual(next.scene.assetSets[0]?.referenceIds, [libraryStreet.id])
    assert.deepEqual(next.scene.whitebox.entities.map((entity) => entity.kind), ['referencePlane'])
  })

  test('retains a manual prop through asset-set additions and reference removal without retaining generated entities', () => {
    const empty = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const manual = {
      ...createManualWhiteboxEntity('prop', 1),
      label: '手动吧台',
      confidence: 0.8,
      position: { x: 4, y: 0.75, z: -2 },
      rotationY: 0.4,
      size: { x: 3, y: 1.5, z: 0.8 },
    }
    const state = {
      ...empty,
      scene: {
        ...empty.scene,
        whitebox: { entities: [manual] },
      },
    }
    const source = structuredClone(state)

    const withGroup = addSpatialSceneAssetSet(state, [libraryStreet], 'scene')
    const afterRemoval = replaceWhiteboxDraft(withGroup, [])

    assert.deepEqual(withGroup.scene.whitebox.entities.find((entity) => entity.id === manual.id), manual)
    assert.deepEqual(afterRemoval.scene.whitebox.entities, [manual])
    assert.deepEqual(state, source)
  })

  test('rejects duplicate references and invalid asset set groups', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-previs-01' })
    const validSet: SpatialAssetSet = {
      id: 'asset-set-scene-1',
      role: 'scene',
      referenceIds: [libraryStreet.id],
    }

    assert.throws(
      () => replaceSpatialSceneInputs(state, [libraryStreet, libraryStreet], [validSet]),
      new TypeError(`Duplicate spatial scene reference id: ${libraryStreet.id}`),
    )
    assert.throws(
      () => replaceSpatialSceneInputs(state, [libraryStreet], [{ ...validSet, referenceIds: [] }]),
      new TypeError('Missing spatial asset set reference ids: asset-set-scene-1'),
    )
    assert.throws(
      () => replaceSpatialSceneInputs(state, [libraryStreet], [{ ...validSet, referenceIds: ['missing'] }]),
      new TypeError('Unknown spatial asset set reference id: asset-set-scene-1/missing'),
    )
    assert.throws(
      () => replaceSpatialSceneInputs(state, [libraryStreet], [{ ...validSet, id: '' }]),
      new TypeError('Missing spatial asset set id'),
    )
    assert.throws(
      () => replaceSpatialSceneInputs(state, [libraryStreet], [{
        ...validSet,
        role: 'environment' as SpatialAssetSet['role'],
      }]),
      new TypeError('Invalid spatial asset set role: environment'),
    )
  })
})
