import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDefaultActorTrack, normalizeSpatialPrevis, setMasterTakeDuration } from './normalize'
import { addStudioCamera, emptyStudio, posePreset, putCut, restoreStudioTool, retimePose, samplePose, sampleProgramCamera, setPose, solveLimb, updateStudio } from './studio'
import { retainManualWhiteboxEntities } from './whitebox'
import { parseSpatialPrevisMetadata } from './persistence'
import { buildPrevisDeliveryPackage } from './delivery'

const initial = () => addDefaultActorTrack(normalizeSpatialPrevis({ projectId: 'studio-test', durationSec: 10 }))
test('pose keys interpolate without modifying the actor route', () => {
  const source = initial()
  let next = setPose(source, 'actor-track-1', 0, posePreset('rest'))
  next = setPose(next, 'actor-track-1', 10, posePreset('reach'))
  assert.equal(samplePose(next, 'actor-track-1', 5)?.rightHand.z, 0.325)
  assert.equal(samplePose(next, 'actor-track-1', 10)?.rightHand.z, 0.65)
  assert.deepEqual(next.masterTake.actorTracks, source.masterTake.actorTracks)
})
test('IK preserves bone lengths for reachable and unreachable targets', () => {
  for (const target of [{ x: 0.2, y: -0.5, z: 0.2 }, { x: 50, y: 40, z: 0 }, { x: 0, y: 0, z: 0 }]) {
    const { joint, tip } = solveLimb({ x: 0, y: 0, z: 0 }, target, { x: 0, y: 0, z: 1 })
    assert.ok(Math.abs(joint.length() - 0.4) < 1e-6)
    assert.ok(Math.abs(joint.distanceTo(tip) - 0.4) < 1e-6)
  }
})
test('program cuts select the right camera at exact boundaries and remain isolated', () => {
  const source = initial()
  let state = addStudioCamera(addStudioCamera(source, 'director', 'a'), 'aerial', 'b')
  state = putCut(putCut(state, 'a', 0, 'cut-a'), 'b', 5, 'cut-b')
  assert.equal(sampleProgramCamera(state, 4.9)?.position.y, 1.6)
  assert.equal(sampleProgramCamera(state, 5)?.position.y, 9)
  assert.deepEqual(state.masterTake, source.masterTake)
  state = putCut(state, 'b', 7, 'cut-b')
  assert.equal(state.studio?.cuts.length, 2)
  assert.equal(sampleProgramCamera(state, 6)?.position.y, 1.6)
})
test('studio metadata survives save/read and delivery without freezing editable state', () => {
  let state = addStudioCamera(initial(), 'director', 'cam-1')
  state = setPose(state, 'actor-track-1', 5, posePreset('sit'))
  const parsed = parseSpatialPrevisMetadata({ spatialPrevis: state }, state.projectId)
  assert.deepEqual(parsed?.studio, state.studio)
  const delivery = buildPrevisDeliveryPackage(state)
  assert.deepEqual(delivery.studio, state.studio)
  assert.equal(Object.isFrozen(state.studio), false)
})
test('duration changes retime performances, cuts and review notes', () => {
  let state = addStudioCamera(initial(), 'director', 'cam-1')
  state = setPose(putCut(state, 'cam-1', 5, 'cut-1'), 'actor-track-1', 5, posePreset('rest'))
  const next = setMasterTakeDuration(state, 20)
  assert.equal(next.studio?.cuts[0]?.timeSec, 10)
  assert.equal(next.studio?.performances[0]?.keys[0]?.timeSec, 10)
  assert.equal(next.studio?.cameras[0]?.track.keyframes.at(-1)?.timeSec, 20)
})
test('invalid studio metadata is rejected instead of silently lost', () => {
  const state = updateStudio(initial(), emptyStudio())
  const candidate = structuredClone(state)
  candidate.studio!.lighting.ambient = Number.NaN
  assert.equal(parseSpatialPrevisMetadata({ spatialPrevis: candidate }), null)
  candidate.studio = { ...emptyStudio(), cuts: [{ id: 'bad', cameraId: 'missing', timeSec: 2 }] }
  assert.equal(parseSpatialPrevisMetadata({ spatialPrevis: candidate }), null)
})

test('retimed pose keys remain unique when recording again at their original time', () => {
  let state = setPose(initial(), 'actor-track-1', 0, posePreset('rest'))
  const id = state.studio!.performances[0]!.keys[0]!.id
  state = retimePose(state, 'actor-track-1', id, 5)
  state = setPose(state, 'actor-track-1', 0, posePreset('reach'))
  assert.equal(new Set(state.studio!.performances[0]!.keys.map(k => k.id)).size, 2)
  assert.ok(parseSpatialPrevisMetadata({ spatialPrevis: state }))
  const before = state.studio!.performances
  assert.deepEqual(retimePose(state, 'actor-track-1', id, 0).studio!.performances, before)
})

test('refreshing reference geometry retains calibrated transforms but not removed references', () => {
  let state = initial()
  const wall = { id: 'wall', label: 'Wall', kind: 'wall' as const, confidence: 1, sourceAssetIds: ['image-1'], position: { x: 1, y: 2, z: 3 }, size: { x: 7, y: 4, z: 0.3 }, rotationY: 0.5 }
  state.scene.whitebox.entities = [wall]
  state = updateStudio(state, { calibration: { ...emptyStudio().calibration, editedEntityIds: ['wall'] } })
  const generated = { ...wall, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotationY: 0 }
  assert.deepEqual(retainManualWhiteboxEntities(state, { entities: [generated] }).entities[0], wall)
  assert.deepEqual(retainManualWhiteboxEntities(state, { entities: [] }).entities, [])
})

test('undo only restores the active tool and respects the current duration', () => {
  const snapshot = setPose(initial(), 'actor-track-1', 5, posePreset('rest'))
  let current = setMasterTakeDuration(snapshot, 20)
  current = setPose(current, 'actor-track-1', 15, posePreset('sit'))
  current = updateStudio(current, { lighting: { enabled: true, ambient: 0.8, lights: [] } })
  const restored = restoreStudioTool(current, snapshot, 'performance')
  assert.deepEqual(restored.masterTake, current.masterTake)
  assert.deepEqual(restored.studio?.lighting, current.studio?.lighting)
  assert.deepEqual(restored.studio?.performances[0]?.keys.map(k => k.timeSec), [10])
})

test('adding a camera clones the selected additional camera without aliasing its track', () => {
  const state = addStudioCamera(initial(), 'director', 'first')
  state.studio!.cameras[0]!.track.keyframes[0]!.focalLengthMm = 85
  const next = addStudioCamera(state, 'director', 'second', 'first')
  assert.equal(next.studio!.cameras[1]!.track.keyframes[0]!.focalLengthMm, 85)
  assert.notEqual(next.studio!.cameras[1]!.track.keyframes, state.studio!.cameras[0]!.track.keyframes)
})
