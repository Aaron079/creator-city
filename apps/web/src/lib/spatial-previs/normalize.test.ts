import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { applyBeatPatch, normalizeSpatialPrevis } from './normalize'
import type { SpatialPrevisScene } from './types'

// @ts-expect-error verified coverage only permits full camera freedom
const incompatibleCoverage: SpatialPrevisScene['coverage'] = {
  mode: 'verified',
  cameraFreedom: 'corridor-only',
}

void incompatibleCoverage

describe('spatial previs normalization', () => {
  test('applies a beat patch to the existing shared camera track', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      durationSec: 30,
      sourceMode: 'multi-view',
    })
    const beat = state.masterTake.beats[0]
    assert.ok(beat)
    const position = { x: 4, y: 2, z: 8 }
    const target = { x: 1, y: 1, z: 0 }

    const patched = applyBeatPatch(state, beat.id, { position, target })
    const midpoint = (beat.startSec + beat.endSec) / 2
    const keyframe = patched.masterTake.cameraTrack.find((item) => item.timeSec === midpoint)

    assert.equal(patched.masterTake.cameraTrack.length, 3)
    assert.notEqual(patched.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.deepEqual(keyframe?.position, position)
    assert.deepEqual(keyframe?.target, target)
    assert.deepEqual(state.masterTake.cameraTrack.find((item) => item.timeSec === midpoint)?.position, { x: 0, y: 1.6, z: 8 })
  })

  test('maps scene source coverage to its supported camera freedom', () => {
    assert.deepEqual(normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'manual',
    }).scene.coverage, {
      mode: 'constrained',
      cameraFreedom: 'corridor-only',
    })
    assert.deepEqual(normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'multi-view',
    }).scene.coverage, {
      mode: 'verified',
      cameraFreedom: 'full',
    })
    assert.deepEqual(normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'video-scan',
    }).scene.coverage, {
      mode: 'verified',
      cameraFreedom: 'full',
    })
    assert.deepEqual(normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'single-image-exterior',
    }).scene.coverage, {
      mode: 'constrained',
      cameraFreedom: 'corridor-only',
    })
  })

  test('defaults and clamps duration without mutating the source input', () => {
    const input = {
      projectId: 'project-1',
      durationSec: 999,
      sourceMode: 'manual' as const,
    }
    const source = structuredClone(input)

    assert.equal(normalizeSpatialPrevis({ projectId: 'project-1', sourceMode: 'manual' }).masterTake.durationSec, 30)
    assert.equal(normalizeSpatialPrevis({ ...input, durationSec: -1 }).masterTake.durationSec, 5)
    assert.equal(normalizeSpatialPrevis(input).masterTake.durationSec, 180)
    assert.deepEqual(input, source)
  })
})
