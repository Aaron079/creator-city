import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSpatialPrevis } from './normalize'
import { buildWhiteboxDraft, replaceWhiteboxDraft } from './whitebox'
import type { SpatialAssetSet, SpatialSceneReference } from './types'

const references: SpatialSceneReference[] = [
  {
    id: 'reference-street',
    assetId: 'asset-street',
    title: 'Street reference',
    mediaType: 'image',
    url: 'https://example.com/street.jpg',
    source: 'project',
  },
  {
    id: 'reference-interior',
    assetId: 'asset-interior',
    title: 'Interior reference',
    mediaType: 'video',
    url: 'https://example.com/interior.mp4',
    source: 'upload',
  },
]

const sceneSet: SpatialAssetSet = {
  id: 'asset-set-scene-1',
  role: 'scene',
  referenceIds: ['reference-street'],
}

describe('spatial previs whitebox drafts', () => {
  test('reconstructs a deterministic complete scene set with source provenance', () => {
    const sourceReferences = structuredClone(references)
    const sourceSets = structuredClone([sceneSet])

    const draft = buildWhiteboxDraft(references, [sceneSet])

    assert.deepEqual(draft.entities.map((entity) => entity.kind), [
      'floor', 'wall', 'wall', 'wall', 'opening', 'furniture', 'referencePlane',
    ])
    assert.deepEqual(draft.entities.map((entity) => entity.id), [
      'floor-asset-set-scene-1',
      'wall-asset-set-scene-1-north',
      'wall-asset-set-scene-1-west',
      'wall-asset-set-scene-1-east',
      'opening-asset-set-scene-1',
      'furniture-asset-set-scene-1',
      'reference-plane-asset-set-scene-1-reference-street',
    ])
    assert.equal(draft.entities.every((entity) => entity.sourceAssetIds[0] === 'asset-street'), true)
    assert.deepEqual(buildWhiteboxDraft(references, [sceneSet]), draft)
    assert.deepEqual(references, sourceReferences)
    assert.deepEqual([sceneSet], sourceSets)
  })

  test('keeps prop, character, and reference asset sets out of scene reconstruction', () => {
    const roleSets: SpatialAssetSet[] = [{
      id: 'asset-set-prop-1',
      role: 'prop',
      referenceIds: ['reference-street'],
    }, {
      id: 'asset-set-character-1',
      role: 'character',
      referenceIds: ['reference-street'],
    }, {
      id: 'asset-set-reference-1',
      role: 'reference',
      referenceIds: ['reference-interior'],
    }]

    const draft = buildWhiteboxDraft(references, roleSets)

    assert.deepEqual(draft.entities.map((entity) => entity.kind), ['prop', 'referencePlane'])
    assert.deepEqual(draft.entities.map((entity) => entity.sourceAssetIds), [
      ['asset-street'],
      ['asset-interior'],
    ])
  })

  test('uses advisory confidence from source coverage without inferring identity from titles', () => {
    const titledReferences: SpatialSceneReference[] = [{
      ...references[0]!,
      title: 'aaron@example.com private apartment',
    }, references[1]!]
    const singleImage = buildWhiteboxDraft(titledReferences, [sceneSet])
    const multiView = buildWhiteboxDraft(titledReferences, [{
      ...sceneSet,
      id: 'asset-set-multi-view',
      referenceIds: ['reference-street', 'reference-interior'],
    }])
    const video = buildWhiteboxDraft(titledReferences, [{
      ...sceneSet,
      id: 'asset-set-video',
      referenceIds: ['reference-interior'],
    }])

    assert.equal(singleImage.entities.every((entity) => entity.confidence === 0.45), true)
    assert.equal(multiView.entities.every((entity) => entity.confidence === 0.75), true)
    assert.equal(video.entities.every((entity) => entity.confidence === 0.75), true)
    assert.equal(singleImage.entities.some((entity) => entity.label.includes('aaron@example.com')), false)
    assert.equal(singleImage.entities.some((entity) => entity.label.includes('apartment')), false)
  })

  test('expands each scene floor across its reconstructed solids', () => {
    const draft = buildWhiteboxDraft(references, [{
      ...sceneSet,
      referenceIds: ['reference-street', 'reference-interior'],
    }])
    const floor = draft.entities.find((entity) => entity.kind === 'floor')!
    const solids = draft.entities.filter((entity) => entity.kind !== 'floor')
    const floorMinX = floor.position.x - floor.size.x / 2
    const floorMaxX = floor.position.x + floor.size.x / 2
    const floorMinZ = floor.position.z - floor.size.z / 2
    const floorMaxZ = floor.position.z + floor.size.z / 2

    assert.ok(solids.every((entity) => floorMinX <= entity.position.x - entity.size.x / 2))
    assert.ok(solids.every((entity) => floorMaxX >= entity.position.x + entity.size.x / 2))
    assert.ok(solids.every((entity) => floorMinZ <= entity.position.z - entity.size.z / 2))
    assert.ok(solids.every((entity) => floorMaxZ >= entity.position.z + entity.size.z / 2))
  })

  test('builds a deterministic, attributable fixed proxy layout', () => {
    const singleReference = [references[0]!]
    const source = structuredClone(singleReference)

    const draft = buildWhiteboxDraft(singleReference)

    assert.deepEqual(draft, {
      entities: [
        {
          id: 'floor-reference-street-0',
          label: 'floor-reference-street-0',
          confidence: 0.45,
          kind: 'floor',
          position: { x: 0, y: -0.05, z: 0 },
          rotationY: 0,
          size: { x: 24, y: 0.1, z: 16 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'reference-plane-reference-street-0',
          label: 'reference-plane-reference-street-0',
          confidence: 0.45,
          kind: 'referencePlane',
          position: { x: 0, y: 2, z: -4 },
          rotationY: 0,
          size: { x: 6, y: 4, z: 0.1 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'volume-reference-street-0',
          label: 'volume-reference-street-0',
          confidence: 0.45,
          kind: 'volume',
          position: { x: 0, y: 1.5, z: 1 },
          rotationY: 0,
          size: { x: 4, y: 3, z: 4 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'wall-reference-street-0',
          label: 'wall-reference-street-0',
          confidence: 0.45,
          kind: 'wall',
          position: { x: 3, y: 1.5, z: 1 },
          rotationY: 0,
          size: { x: 0.2, y: 3, z: 8 },
          sourceAssetIds: ['asset-street'],
        },
      ],
    })
    assert.deepEqual(buildWhiteboxDraft(singleReference), draft)
    assert.deepEqual(singleReference, source)
    assert.equal(draft.entities.every((entity) => entity.sourceAssetIds.length > 0), true)
  })

  test('keeps source attribution with each reference while appending its proxies', () => {
    const draft = buildWhiteboxDraft(references)

    assert.deepEqual(draft.entities.map((entity) => entity.kind), [
      'floor', 'referencePlane', 'volume', 'wall', 'referencePlane', 'volume', 'wall',
    ])
    assert.deepEqual(
      draft.entities.map((entity) => entity.sourceAssetIds),
      [
        ['asset-street'],
        ['asset-street'],
        ['asset-street'],
        ['asset-street'],
        ['asset-interior'],
        ['asset-interior'],
        ['asset-interior'],
      ],
    )
    assert.deepEqual(draft.entities.slice(4).map((entity) => entity.position.x), [8, 8, 11])
  })

  test('builds unique indexed entity ids for duplicate reference ids', () => {
    const duplicateReferences = references.map((reference) => ({ ...reference, id: 'reference-duplicate' }))

    const entityIds = buildWhiteboxDraft(duplicateReferences).entities.map((entity) => entity.id)

    assert.deepEqual(entityIds, [
      'floor-reference-duplicate-0',
      'reference-plane-reference-duplicate-0',
      'volume-reference-duplicate-0',
      'wall-reference-duplicate-0',
      'reference-plane-reference-duplicate-1',
      'volume-reference-duplicate-1',
      'wall-reference-duplicate-1',
    ])
    assert.equal(new Set(entityIds).size, entityIds.length)
  })

  test('rejects duplicate asset set ids before emitting ambiguous entity ids', () => {
    const duplicateSets: SpatialAssetSet[] = [{
      ...sceneSet,
      id: 'asset-set-duplicate',
    }, {
      ...sceneSet,
      id: 'asset-set-duplicate',
    }]

    assert.throws(
      () => buildWhiteboxDraft(references, duplicateSets),
      new TypeError('Duplicate spatial asset set id: asset-set-duplicate'),
    )
  })

  test('rejects an asset set without reference ids', () => {
    assert.throws(
      () => buildWhiteboxDraft(references, [{
        ...sceneSet,
        id: 'asset-set-empty',
        referenceIds: [],
      }]),
      new TypeError('Missing spatial asset set reference ids: asset-set-empty'),
    )
  })

  test('rejects duplicate reference ids within an asset set', () => {
    assert.throws(
      () => buildWhiteboxDraft(references, [{
        ...sceneSet,
        id: 'asset-set-duplicate-reference',
        referenceIds: ['reference-street', 'reference-street'],
      }]),
      new TypeError('Duplicate spatial asset set reference id: asset-set-duplicate-reference/reference-street'),
    )
  })

  test('rejects an asset set reference id absent from supplied references', () => {
    assert.throws(
      () => buildWhiteboxDraft(references, [{
        ...sceneSet,
        id: 'asset-set-unknown-reference',
        referenceIds: ['reference-missing'],
      }]),
      new TypeError('Unknown spatial asset set reference id: asset-set-unknown-reference/reference-missing'),
    )
  })

  test('isolates a draft from post-call reference mutations', () => {
    const inputReferences = structuredClone([references[1]!])
    const expectedReferences = structuredClone(inputReferences)
    const next = replaceWhiteboxDraft(normalizeSpatialPrevis({ projectId: 'project-1' }), inputReferences)

    inputReferences[0]!.assetId = 'asset-mutated'
    inputReferences.push(references[0]!)

    assert.notEqual(next.scene.references, inputReferences)
    assert.deepEqual(next.scene.references, expectedReferences)
    assert.deepEqual(next.scene.whitebox, buildWhiteboxDraft(expectedReferences))
  })

  test('expands floor bounds to cover every proxy for three references', () => {
    const draft = buildWhiteboxDraft([
      ...references,
      { ...references[0]!, id: 'reference-third', assetId: 'asset-third' },
    ])
    const floor = draft.entities.find((entity) => entity.kind === 'floor')!
    const proxies = draft.entities.filter((entity) => entity.kind !== 'floor')
    const floorMinX = floor.position.x - floor.size.x / 2
    const floorMaxX = floor.position.x + floor.size.x / 2
    const floorMinZ = floor.position.z - floor.size.z / 2
    const floorMaxZ = floor.position.z + floor.size.z / 2
    const proxyMinX = Math.min(...proxies.map((entity) => entity.position.x - entity.size.x / 2))
    const proxyMaxX = Math.max(...proxies.map((entity) => entity.position.x + entity.size.x / 2))
    const proxyMinZ = Math.min(...proxies.map((entity) => entity.position.z - entity.size.z / 2))
    const proxyMaxZ = Math.max(...proxies.map((entity) => entity.position.z + entity.size.z / 2))

    assert.ok(floorMinX <= proxyMinX)
    assert.ok(floorMaxX >= proxyMaxX)
    assert.ok(floorMinZ <= proxyMinZ)
    assert.ok(floorMaxZ >= proxyMaxZ)
  })

  test('replaces only scene references and whitebox data without mutating state', () => {
    const initial = normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'multi-view',
      editorMode: 'beats',
      updatedAt: '2026-09-10T00:00:00.000Z',
    })
    const state = {
      ...initial,
      scene: {
        ...initial.scene,
        references: [references[0]!],
        whitebox: {
          entities: [{
            id: 'existing-floor',
            label: 'existing-floor',
            confidence: 1,
            kind: 'floor' as const,
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            size: { x: 1, y: 1, z: 1 },
            sourceAssetIds: ['asset-street'],
          }],
        },
      },
    }
    const source = structuredClone(state)

    const next = replaceWhiteboxDraft(state, [references[1]!])

    assert.notEqual(next, state)
    assert.notEqual(next.scene, state.scene)
    assert.equal(next.masterTake, state.masterTake)
    assert.equal(next.editorMode, state.editorMode)
    assert.equal(next.updatedAt, state.updatedAt)
    assert.equal(next.scene.sourceMode, state.scene.sourceMode)
    assert.equal(next.scene.coverage, state.scene.coverage)
    assert.deepEqual(next.scene.references, [references[1]!])
    assert.deepEqual(next.scene.whitebox, buildWhiteboxDraft([references[1]!]))
    assert.deepEqual(state, source)
  })

  test('preserves valid asset set roles while pruning removed references during replacement', () => {
    const initial = normalizeSpatialPrevis({ projectId: 'project-1' })
    const state = {
      ...initial,
      scene: {
        ...initial.scene,
        references,
        assetSets: [{
          id: 'asset-set-scene-1',
          role: 'scene' as const,
          referenceIds: ['reference-street', 'reference-interior'],
        }, {
          id: 'asset-set-character-1',
          role: 'character' as const,
          referenceIds: ['reference-interior'],
        }, {
          id: 'asset-set-prop-removed',
          role: 'prop' as const,
          referenceIds: ['reference-street'],
        }],
      },
    }
    const source = structuredClone(state)

    const next = replaceWhiteboxDraft(state, [references[1]!])

    assert.deepEqual(next.scene.references, [references[1]!])
    assert.deepEqual(next.scene.assetSets, [{
      id: 'asset-set-scene-1',
      role: 'scene',
      referenceIds: ['reference-interior'],
    }, {
      id: 'asset-set-character-1',
      role: 'character',
      referenceIds: ['reference-interior'],
    }])
    assert.deepEqual(next.scene.whitebox.entities.map((entity) => entity.kind), [
      'floor', 'wall', 'wall', 'wall', 'opening', 'furniture', 'referencePlane',
    ])
    assert.equal(next.scene.whitebox.entities.every((entity) => entity.sourceAssetIds[0] === 'asset-interior'), true)
    assert.deepEqual(state, source)
  })
})
