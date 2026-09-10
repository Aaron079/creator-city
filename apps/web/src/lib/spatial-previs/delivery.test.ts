/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/lib/spatial-previs/delivery.test.ts
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPrevisDeliveryPackage } from './delivery'
import type { SpatialPrevisState } from './types'

const state: SpatialPrevisState = {
  version: 2,
  projectId: 'project-previs-delivery',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [{
      id: 'scene-reference-1',
      assetId: 'asset-scene-1',
      title: 'Rainy lobby',
      mediaType: 'image',
      url: '/api/assets/asset-scene-1/file',
      source: 'project',
    }],
    whitebox: {
      entities: [{
        id: 'whitebox-wall-1',
        kind: 'wall',
        position: { x: 0, y: 2, z: -4 },
        rotationY: 0,
        size: { x: 8, y: 4, z: 0.2 },
        sourceAssetIds: ['asset-scene-1'],
      }],
    },
  },
  masterTake: {
    id: 'master-take-1',
    durationSec: 10,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-1',
      anchorId: 'actor-lead',
      keyframes: [{
        id: 'actor-keyframe-1',
        timeSec: 0,
        position: { x: 0, y: 0, z: 0 },
        action: 'walk',
      }],
    }],
    cameraTrack: {
      id: 'camera-track-1',
      keyframes: [{
        id: 'camera-keyframe-1',
        timeSec: 0,
        position: { x: 0, y: 1.6, z: 6 },
        target: { x: 0, y: 1.2, z: 0 },
        focalLengthMm: 35,
        intent: 'follow',
      }],
    },
    beats: [{ id: 'beat-1', label: 'Arrival', startSec: 0, endSec: 10 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-10T00:00:00.000Z',
}

test('serializes whitebox, references, and tracks without provider capability', () => {
  const delivery = buildPrevisDeliveryPackage(state)

  assert.equal(delivery.kind, 'spatial-previs-delivery')
  assert.equal(delivery.version, 1)
  assert.equal(delivery.projectId, state.projectId)
  assert.equal('capability' in delivery, false)
  assert.deepEqual(delivery.scene.whitebox.entities, state.scene.whitebox.entities)
  assert.deepEqual(delivery.scene.references, state.scene.references)
  assert.deepEqual(delivery.masterTake, state.masterTake)
  assert.notEqual(delivery.scene, state.scene)
  assert.notEqual(delivery.masterTake, state.masterTake)
  assert.equal(Object.isFrozen(delivery), true)
  assert.equal(Object.isFrozen(delivery.scene.whitebox.entities), true)

  state.scene.whitebox.entities[0]!.position.x = 99
  state.masterTake.cameraTrack.keyframes[0]!.target.z = 99

  assert.equal(delivery.scene.whitebox.entities[0]!.position.x, 0)
  assert.equal(delivery.masterTake.cameraTrack.keyframes[0]!.target.z, 0)
})
