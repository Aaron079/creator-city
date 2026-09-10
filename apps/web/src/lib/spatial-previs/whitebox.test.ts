import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeSpatialPrevis } from './normalize'
import { buildWhiteboxDraft, replaceWhiteboxDraft } from './whitebox'
import type { SpatialSceneReference } from './types'

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

describe('spatial previs whitebox drafts', () => {
  test('builds a deterministic, attributable fixed proxy layout', () => {
    const singleReference = [references[0]!]
    const source = structuredClone(singleReference)

    const draft = buildWhiteboxDraft(singleReference)

    assert.deepEqual(draft, {
      entities: [
        {
          id: 'floor-reference-street-0',
          kind: 'floor',
          position: { x: 0, y: -0.05, z: 0 },
          rotationY: 0,
          size: { x: 24, y: 0.1, z: 16 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'reference-plane-reference-street-0',
          kind: 'referencePlane',
          position: { x: 0, y: 2, z: -4 },
          rotationY: 0,
          size: { x: 6, y: 4, z: 0.1 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'volume-reference-street-0',
          kind: 'volume',
          position: { x: 0, y: 1.5, z: 1 },
          rotationY: 0,
          size: { x: 4, y: 3, z: 4 },
          sourceAssetIds: ['asset-street'],
        },
        {
          id: 'wall-reference-street-0',
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
})
