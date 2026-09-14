import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDefaultActorTrack, normalizeSpatialPrevis } from './normalize'
import { groundedActorPose, groundedActorPosition, sampleActorPlacement } from './actor-placement'
import { posePreset, samplePose, setPose } from './studio'
import type { WhiteboxEntity } from './types'

function fixture(kind: WhiteboxEntity['kind'] = 'wall') {
  const state = addDefaultActorTrack(normalizeSpatialPrevis({ projectId: 'collision-test', durationSec: 5 }))
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [0, 2.5, 5].map((timeSec, i) => ({ id: `point-${i}`, timeSec, position: { x: -2 + i * 2, y: 0, z: 1 - i }, action: 'walk' }))
  state.scene.whitebox.entities = [
    { id: 'floor', kind: 'floor', label: 'floor', position: { x: 0.28, y: -0.05, z: 4.5 }, size: { x: 8, y: 0.1, z: 8 }, rotationY: 0, confidence: 1, sourceAssetIds: [] },
    { id: 'solid', kind, label: 'wall', position: { x: 0.5, y: 1.5, z: 0.5 }, size: { x: 7, y: 3, z: 0.02 }, rotationY: 0, confidence: 1, sourceAssetIds: [] },
  ]
  return state
}

test('sweeps old routes against thin solids without tunnelling, independent of frame rate and camera', () => {
  for (const kind of ['wall', 'volume', 'prop', 'furniture'] as const) {
    const state = fixture(kind)
    const original = structuredClone(state)
    const track = state.masterTake.actorTracks[0]!
    const end = sampleActorPlacement(state, track, 5)
    assert.equal(end.collision?.entityId, 'solid')
    assert.ok(end.position.z > 0.83 && end.position.z < 0.84)
    assert.equal(end.position.y, 0.72, 'the contact point must still stand on the floor near its edge')
    for (const time of [0.5, 1, 2.5, 4.9, 180]) assert.deepEqual(sampleActorPlacement(state, track, time), end)
    state.masterTake.cameraTrack.keyframes[0]!.position.x = 100
    assert.deepEqual(sampleActorPlacement(state, track, 5), end)
    assert.deepEqual(state.masterTake.actorTracks, original.masterTake.actorTracks)
    assert.deepEqual(state.scene, original.scene)
  }
})

test('rotated walls use their own coordinates and a genuinely clear route stays editable', () => {
  const state = fixture()
  const track = state.masterTake.actorTracks[0]!
  const wall = state.scene.whitebox.entities[1]!
  wall.rotationY = Math.PI / 2
  wall.position = { x: 0, y: 1.5, z: 0 }
  const end = sampleActorPlacement(state, track, 5)
  assert.ok(end.position.x < -0.33)
  wall.position.z = -10
  assert.equal(sampleActorPlacement(state, track, 5).collision, undefined)
  assert.deepEqual(sampleActorPlacement(state, track, 5).position, track.keyframes[2]!.position)
})

test('reference guides and opening markers are not solid blockers', () => {
  for (const kind of ['referencePlane', 'opening'] as const) {
    const state = fixture(kind)
    assert.equal(sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 5).collision, undefined)
  }
})

test('grounding preserves authored height, works with rotated floors and aligns posed feet too', () => {
  let state = fixture()
  state.scene.whitebox.entities = [state.scene.whitebox.entities[0]!]
  state.scene.whitebox.entities[0]!.rotationY = Math.PI / 6
  assert.equal(groundedActorPosition(state, { x: 0, y: 3, z: 4 }).y, 3)
  assert.equal(groundedActorPosition(state, { x: 0, y: 0, z: 4 }).y, 0.72)
  state = setPose(state, state.masterTake.actorTracks[0]!.id, 0, posePreset('rest'))
  state.masterTake.actorTracks[0]!.keyframes = [{ id: 'hold', timeSec: 0, position: { x: 0, y: 0, z: 4 }, action: 'idle' }]
  assert.equal(sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 5).position.y, 0.65)
})

test('checks floor entry inside a segment rather than only grounding its endpoints', () => {
  const state = fixture()
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [0, 4].map((timeSec, i) => ({ id: `k${i}`, timeSec, position: { x: -2 + 4 * i, y: 0, z: 0 }, action: 'walk' }))
  state.scene.whitebox.entities[0]!.position = { x: 0, y: -0.05, z: 0 }
  state.scene.whitebox.entities[0]!.size = { x: 3, y: 0.1, z: 6 }
  state.scene.whitebox.entities[1]!.position = { x: 0, y: 2, z: 0 }
  state.scene.whitebox.entities[1]!.size = { x: 0.2, y: 0.4, z: 6 }
  const placement = sampleActorPlacement(state, track, 2)
  assert.ok(placement.collision)
  assert.ok(placement.position.x < -0.42)
})

test('later pose changes cannot erase an earlier collision and teleport the actor beyond it', () => {
  let state = fixture()
  const id = state.masterTake.actorTracks[0]!.id
  state.masterTake.actorTracks[0]!.keyframes = [0, 4].map((timeSec, i) => ({ id: `k${i}`, timeSec, position: { x: -2 + 4 * i, y: 0, z: 0 }, action: 'walk' }))
  const beam = state.scene.whitebox.entities[1]!
  beam.position = { x: 0, y: 2, z: 0 }; beam.size = { x: 0.2, y: 0.4, z: 6 }
  state.scene.whitebox.entities = [beam]
  const tall = { ...posePreset('rest'), head: { x: 0, y: 2, z: 0 } }
  state = setPose(setPose(setPose(state, id, 0, tall), id, 2, tall), id, 3, posePreset('rest'))
  const track = state.masterTake.actorTracks[0]!
  assert.deepEqual(sampleActorPlacement(state, track, 3), sampleActorPlacement(state, track, 2))
})

test('overlapping upstairs floors cannot lift a downstairs actor through the ceiling', () => {
  const state = fixture()
  const floor = state.scene.whitebox.entities[0]!
  floor.position = { x: 0, y: -0.05, z: 0 }
  state.scene.whitebox.entities = [floor, { ...floor, id: 'upstairs', position: { x: 0, y: 2.95, z: 0 } }]
  assert.equal(groundedActorPosition(state, { x: 0, y: 0, z: 0 }).y, 0.72)
})

test('superseded duplicate-time keys cannot add phantom collision segments', () => {
  const state = fixture()
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [[0, 0], [0, -2], [4, -3]].map(([timeSec, x], i) => ({ id: `k${i}`, timeSec: timeSec!, position: { x: x!, y: 0, z: 0 }, action: 'walk' }))
  const wall = state.scene.whitebox.entities[1]!
  wall.position = { x: 0, y: 1, z: 0 }; wall.size = { x: 0.2, y: 4, z: 6 }
  state.scene.whitebox.entities = [wall]
  assert.deepEqual(sampleActorPlacement(state, track, 1), { position: { x: -2.25, y: 0, z: 0 } })
})

test('descending to a grounded height cannot pass through a low prop between keys', () => {
  const state = fixture()
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [0, 4].map((timeSec, i) => ({ id: `k${i}`, timeSec, position: { x: -2 + 4 * i, y: 1 - i, z: 0 }, action: 'walk' }))
  state.scene.whitebox.entities[0]!.position = { x: 0, y: -0.05, z: 0 }
  state.scene.whitebox.entities[1]!.position = { x: 0, y: 0.05, z: 0 }
  state.scene.whitebox.entities[1]!.size = { x: 0.2, y: 0.1, z: 6 }
  assert.ok(sampleActorPlacement(state, track, 2).collision)
})

test('interior duplicate keys preserve the incoming path as well as the exact-time replacement', () => {
  const state = fixture()
  state.scene.whitebox.entities = []
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [[0, -2], [2, 0], [2, -2], [4, -3]].map(([timeSec, x], i) => ({ id: `k${i}`, timeSec: timeSec!, position: { x: x!, y: 0, z: 0 }, action: 'walk' }))
  assert.equal(sampleActorPlacement(state, track, 1).position.x, -1)
  assert.equal(sampleActorPlacement(state, track, 2).position.x, -2)
  assert.equal(sampleActorPlacement(state, track, 3).position.x, -2.5)
})

test('a stopped actor keeps current pose feet above the floor without resuming the blocked path', () => {
  let state = fixture()
  const id = state.masterTake.actorTracks[0]!.id
  state.scene.whitebox.entities[0]!.position = { x: 0, y: -0.05, z: 0 }
  state = setPose(setPose(state, id, 0, posePreset('rest')), id, 2, posePreset('rest'))
  state = setPose(state, id, 4, { ...posePreset('rest'), hipHeight: -0.2, leftFoot: { x: -0.13, y: -1, z: 0 } })
  const before = sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 2)
  const after = sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 4)
  assert.equal(before.position.x, after.position.x)
  assert.equal(before.position.z, after.position.z)
  const pose = groundedActorPose(state, after.position, samplePose(state, id, 4)!)
  assert.ok(after.position.y + pose.leftFoot.y >= 0)
  assert.equal(before.collision?.timeSec, after.collision?.timeSec)
})

test('grounding a stopped pose cannot push its head through an overhead prop', () => {
  let state = fixture()
  const track = state.masterTake.actorTracks[0]!
  track.keyframes = [0, 4].map((timeSec, i) => ({ id: `k${i}`, timeSec, position: { x: -2 + 4 * i, y: 0, z: 0 }, action: 'walk' }))
  state.scene.whitebox.entities[0]!.position = { x: 0, y: -0.05, z: 0 }
  state.scene.whitebox.entities[1]!.position = { x: 0, y: 1.5, z: 0 }
  state.scene.whitebox.entities[1]!.size = { x: 0.2, y: 3, z: 6 }
  state.scene.whitebox.entities.push({ ...state.scene.whitebox.entities[1]!, id: 'beam', kind: 'prop', position: { x: -0.5, y: 2.4, z: 0 }, size: { x: 1, y: 0.2, z: 6 } })
  state = setPose(setPose(state, track.id, 0, posePreset('rest')), track.id, 2, posePreset('rest'))
  state = setPose(state, track.id, 4, { ...posePreset('rest'), hipHeight: -0.2, leftFoot: { x: -0.13, y: -1, z: 0 } })
  const before = sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 2)
  const after = sampleActorPlacement(state, state.masterTake.actorTracks[0]!, 4)
  assert.deepEqual(after.position, before.position)
  const pose = groundedActorPose(state, after.position, samplePose(state, track.id, 4)!)
  assert.ok(after.position.y + pose.head.y + 0.19 < 2.3)
  assert.ok(after.position.y + pose.leftFoot.y >= 0)
  assert.equal(samplePose(state, track.id, 4)!.leftFoot.y, -1, 'authored pose remains editable and is not overwritten')
})
