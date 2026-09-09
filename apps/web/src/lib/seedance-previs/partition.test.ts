import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partitionMasterTake } from './partition'
import { normalizeSpatialPrevis } from '../spatial-previs/normalize'
import { sampleCamera } from '../spatial-previs/sampler'

function fixture180() {
  const previs = normalizeSpatialPrevis({
    projectId: 'project-180',
    durationSec: 180,
    sourceMode: 'multi-view',
    updatedAt: '2026-09-09T00:00:00.000Z',
  })

  return {
    ...previs,
    masterTake: {
      ...previs.masterTake,
      cameraTrack: {
        ...previs.masterTake.cameraTrack,
        keyframes: [
          {
            ...previs.masterTake.cameraTrack.keyframes[0]!,
            position: { x: 0, y: 2, z: 8 },
            target: { x: 0, y: 1, z: 0 },
            focalLengthMm: 24,
            intent: 'push' as const,
          },
          {
            ...previs.masterTake.cameraTrack.keyframes[2]!,
            position: { x: 18, y: 5, z: -1 },
            target: { x: 9, y: 2, z: -4 },
            focalLengthMm: 60,
            intent: 'dolly' as const,
          },
        ],
      },
      actorTracks: [{
        id: 'lead-track',
        anchorId: 'lead-actor',
        keyframes: [
          { id: 'lead-start', timeSec: 0, position: { x: 0, y: 0, z: 0 }, action: 'enter' },
          { id: 'lead-end', timeSec: 180, position: { x: 18, y: 0, z: 9 }, action: 'walk' },
        ],
      }],
    },
  }
}

test('does not create a chain without explicit confirmation', () => {
  assert.throws(
    () => partitionMasterTake(fixture180(), { maxSegmentSec: 30, userConfirmed: false }),
    /CHAIN_CONFIRMATION_REQUIRED/,
  )
})

test('accepts only finite 30-second continuity segments from a valid master take', () => {
  const previs = fixture180()

  assert.throws(
    () => partitionMasterTake(previs, { maxSegmentSec: 45, userConfirmed: true }),
    /MAX_SEGMENT_DURATION_EXCEEDED/,
  )
  assert.throws(
    () => partitionMasterTake(previs, { maxSegmentSec: 0.5, userConfirmed: true }),
    /INVALID_MAX_SEGMENT_DURATION/,
  )
  for (const durationSec of [0, Number.NaN, Infinity, -Infinity, 181]) {
    assert.throws(
      () => partitionMasterTake({
      ...previs,
        masterTake: { ...previs.masterTake, durationSec },
      }, { maxSegmentSec: 30, userConfirmed: true }),
      /INVALID_MASTER_TAKE_DURATION/,
    )
  }
})

test('includes exact sampled camera and actor states at every confirmed handoff', () => {
  const previs = fixture180()
  const source = structuredClone(previs)

  const chain = partitionMasterTake(previs, { maxSegmentSec: 30, userConfirmed: true })

  assert.equal(chain.segments.length, 6)
  assert.ok(Object.isFrozen(chain))
  for (const segment of chain.segments.slice(1)) {
    assert.ok(segment.handoff)
    const boundary = segment.startSec
    const expectedCamera = sampleCamera(previs.masterTake.cameraTrack.keyframes, boundary)

    assert.deepEqual(segment.handoff.camera.position, expectedCamera.position)
    assert.deepEqual(segment.handoff.camera.target, expectedCamera.target)
    assert.equal(segment.handoff.camera.focalLengthMm, expectedCamera.focalLengthMm)
    assert.deepEqual(segment.handoff.actors, [{
      anchorId: 'lead-actor',
      position: { x: boundary / 10, y: 0, z: boundary / 20 },
      action: 'walk',
      velocity: { x: 0.1, y: 0, z: 0.05 },
    }])
    assert.deepEqual(segment.handoff.requiredAnchors, ['lead-actor'])
    assert.equal(segment.handoff.previousLastFrameRef.segmentId, chain.segments[segment.index - 1]?.id)
    assert.equal(segment.handoff.previousLastFrameRef.timeSec, boundary)
    assert.deepEqual(segment.handoff.nextFirstComposition.camera, segment.handoff.camera)
    assert.deepEqual(segment.handoff.nextFirstComposition.actors, segment.handoff.actors)
  }
  assert.deepEqual(previs, source)
})
