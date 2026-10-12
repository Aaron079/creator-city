import assert from 'node:assert/strict'
import test from 'node:test'
import { mapCanvasNode, serializeAsset } from '../projects/canvas-mappers'
import { buildPrevisDeliveryPackage, type PrevisDeliveryPackage } from './delivery'
import { addDefaultActorTrack, normalizeSpatialPrevis } from './normalize'
import { emptyStudio, selectProgramCameraTrack } from './studio'

function fixture() {
  const state = addDefaultActorTrack(normalizeSpatialPrevis({ projectId: 'provenance-test', durationSec: 10 }))
  state.scene.references = [{ id: 'ref-room', assetId: 'asset-room', title: 'Room', source: 'project', mediaType: 'image', url: 'https://example.test/room?token=private' }]
  state.scene.assetSets = [{ id: 'set-room', role: 'scene', referenceIds: ['ref-room'] }]
  state.studio = emptyStudio()
  state.studio.cameras = [
    { name: 'A', track: { ...structuredClone(state.masterTake.cameraTrack), id: 'camera-a' } },
    { name: 'B', track: { ...structuredClone(state.masterTake.aerialCameraTrack), id: 'camera-b' } },
  ]
  return state
}

test('delivery records scene-level references without inventing content versions or actor identities', () => {
  const state = fixture()
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p, 'delivery must include provenance')
  assert.equal(p.version, 1)
  assert.deepEqual(p.references, [{ referenceId: 'ref-room', assetId: 'asset-room', source: 'project', mediaType: 'image', contentVersion: null, status: 'unverified' }])
  assert.deepEqual(p.assetSets, [{ assetSetId: 'set-room', role: 'scene', scope: 'scene', referenceIds: ['ref-room'], unresolvedReferenceIds: [] }])
  assert.deepEqual(p.actors, state.masterTake.actorTracks.map(track => ({ trackId: track.id, anchorId: track.anchorId, assetBinding: 'unresolved' })))
  assert.equal(JSON.stringify(p).includes('private'), false)
  assert.equal(JSON.stringify(p).includes('https:'), false)
})

test('continuous delivery keeps both authored camera plans and does not turn beats or keyframes into cuts', () => {
  const state = fixture()
  state.masterTake.beats = [{ id: 'beat-a', label: 'A', startSec: 0, endSec: 4 }, { id: 'beat-b', label: 'B', startSec: 4, endSec: 10 }]
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p)
  assert.deepEqual(p.shots, [{
    id: `${state.masterTake.id}:start`, startSec: 0, endSec: 10, sourceCutId: null,
    camera: { kind: 'master-plans', trackIds: [state.masterTake.cameraTrack.id, state.masterTake.aerialCameraTrack.id] },
    assetSetIds: ['set-room'], referenceIds: ['ref-room'],
  }])
})

test('program camera intervals follow the existing sampler before and at cuts without editing the state', () => {
  const state = fixture()
  state.studio!.programEnabled = true
  state.studio!.cuts = [{ id: 'cut-b', cameraId: 'camera-b', timeSec: 6 }, { id: 'cut-a', cameraId: 'camera-a', timeSec: 2 }]
  const before = JSON.stringify(state)
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p)
  assert.deepEqual(p.shots.map(s => [s.startSec, s.endSec, s.sourceCutId]), [[0, 2, null], [2, 6, 'cut-a'], [6, 10, 'cut-b']])
  for (const shot of p.shots) {
    assert.equal(shot.camera.kind, 'program')
    if (shot.camera.kind === 'program') {
      assert.equal(shot.camera.trackId, selectProgramCameraTrack(state, shot.startSec)?.id)
      assert.equal(shot.camera.status, 'resolved')
    }
  }
  assert.equal(JSON.stringify(state), before)
})

test('disabled program cuts do not split a continuous take', () => {
  const state = fixture()
  state.studio!.programEnabled = false
  state.studio!.cuts = [{ id: 'cut-b', cameraId: 'camera-b', timeSec: 4 }]
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p)
  assert.equal(p.shots.length, 1)
  assert.equal(p.shots[0]!.camera.kind, 'master-plans')
})

test('program boundaries at zero, duplicate time and duration never produce empty intervals', () => {
  const state = fixture()
  state.studio!.programEnabled = true
  state.studio!.cuts = [
    { id: 'zero', cameraId: 'camera-b', timeSec: 0 },
    { id: 'first', cameraId: 'camera-a', timeSec: 5 },
    { id: 'last', cameraId: 'camera-b', timeSec: 5 },
    { id: 'end', cameraId: 'camera-a', timeSec: 10 },
  ]
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p)
  assert.deepEqual(p.shots.map(s => [s.startSec, s.endSec, s.sourceCutId]), [[0, 5, 'zero'], [5, 10, 'last']])
  assert.ok(p.shots.every(s => s.camera.kind === 'program' && s.camera.trackId === 'camera-b'))
})

test('missing references and requested cameras remain explicitly unresolved', () => {
  const state = fixture()
  state.scene.assetSets[0]!.referenceIds.push('ref-missing')
  state.studio!.programEnabled = true
  state.studio!.cuts = [{ id: 'missing', cameraId: 'camera-missing', timeSec: 0 }]
  const p = buildPrevisDeliveryPackage(state).provenance
  assert.ok(p)
  assert.deepEqual(p.assetSets[0]!.unresolvedReferenceIds, ['ref-missing'])
  assert.deepEqual(p.shots[0]!.camera, { kind: 'program', requestedTrackId: 'camera-missing', trackId: null, status: 'unresolved' })
  state.studio!.cameras = []
  state.studio!.cuts = []
  assert.deepEqual(buildPrevisDeliveryPackage(state).provenance?.shots[0]!.camera, { kind: 'program', requestedTrackId: null, trackId: null, status: 'unresolved' })
})

test('known geometry digests, light versions and scene confirmation are retained and deeply isolated', () => {
  const state = fixture()
  const confirmedAt = '2026-10-12T08:00:00.000Z'
  const geometry = {
    kind: 'reconstruction-mesh', baseFitVersion: 1,
    result: { service: 'local-reconstruction-v1', resultId: '11111111-1111-4111-8111-111111111111', artifactId: 'model.glb', sha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64) },
    angles: { x: 0, y: 0, z: 0 }, calibration: {}, reviewedAt: '2026-10-12T08:00:00.000Z',
    sourceToDisplayMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  }
  Object.assign(state.scene, { confirmedAt, geometry })
  const light = { id: 'key', name: 'Key', kind: 'spot' as const, enabled: true, position: { x: 0, y: 3, z: 0 }, target: { x: 0, y: 0, z: 0 }, intensity: 1, temperature: 5600, angle: 30, softness: 0.5, rig: { id: 'rig-a', assetId: 'lighting-a', assetVersion: 3 } }
  state.studio!.lighting.lights = [light, { ...structuredClone(light), id: 'fill' }]
  const delivery = buildPrevisDeliveryPackage(state)
  const p = delivery.provenance
  assert.ok(p)
  assert.equal(p.sceneConfirmedAt, confirmedAt)
  assert.deepEqual(p.geometry, geometry.result)
  assert.deepEqual(p.lightingRigs, [{ id: 'rig-a', assetId: 'lighting-a', assetVersion: 3, lightIds: ['key', 'fill'] }])
  const previous = JSON.stringify(delivery)
  state.scene.references[0]!.assetId = 'replacement'
  state.scene.assetSets[0]!.referenceIds.push('later-reference')
  geometry.result.sha256 = 'c'.repeat(64)
  light.rig.assetVersion = 4
  assert.equal(JSON.stringify(delivery), previous)
  assert.ok(Object.isFrozen(p.assetSets[0]!.referenceIds))
  assert.ok(Object.isFrozen(p.lightingRigs[0]!.lightIds))
  assert.ok(Object.isFrozen(p.geometry))
  assert.equal(Object.isFrozen(light.rig), false)
})

test('new metadata survives JSON, canvas mapping and asset serialization; legacy v1 stays valid', () => {
  const state = fixture()
  const delivery = buildPrevisDeliveryPackage(state)
  assert.ok(delivery.provenance)
  const downloaded = JSON.parse(JSON.stringify(delivery))
  assert.deepEqual(downloaded.provenance, delivery.provenance)
  assert.equal(JSON.stringify(downloaded), JSON.stringify(delivery))
  const restored = mapCanvasNode({
    id: 'db-node', nodeId: 'node', kind: 'text', title: 'Delivery', providerId: null, status: 'done',
    x: 0, y: 0, width: 320, height: 200, prompt: '', resultText: null, resultImageUrl: null,
    resultVideoUrl: null, resultAudioUrl: null, resultPreview: null, errorMessage: null, paramsJson: {},
    metadataJson: JSON.parse(JSON.stringify({ previsDelivery: delivery })), createdAt: new Date(), updatedAt: new Date(),
  })
  assert.deepEqual(restored.metadataJson.previsDelivery, downloaded)
  const asset = serializeAsset({ metadataJson: { previsDelivery: downloaded }, dataUrl: JSON.stringify(delivery), sizeBytes: BigInt(0) })
  assert.deepEqual(asset.metadataJson.previsDelivery, downloaded)
  assert.deepEqual(JSON.parse(asset.dataUrl), downloaded)
  const { provenance: omitted, ...legacy } = delivery
  assert.equal(omitted.version, 1)
  const oldPackage: PrevisDeliveryPackage = legacy
  assert.equal(oldPackage.version, 1)
  assert.equal('provenance' in oldPackage, false)
  assert.deepEqual(oldPackage.masterTake, delivery.masterTake)
})
