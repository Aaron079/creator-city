import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { sampleCamera } from './sampler'
import type { CameraKeyframe } from './types'

function keyframe(
  id: string,
  timeSec: number,
  position: CameraKeyframe['position'],
  target: CameraKeyframe['target'],
  focalLengthMm: number,
  intent: CameraKeyframe['intent'],
): CameraKeyframe {
  return { id, timeSec, position, target, focalLengthMm, intent }
}

describe('camera sampling', () => {
  test('interpolates the midpoint and uses the latest segment intent', () => {
    const sampled = sampleCamera([
      keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push'),
      keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly'),
    ], 5)

    assert.deepEqual(sampled, keyframe(
      'end',
      5,
      { x: 5, y: 3, z: 5 },
      { x: 1, y: 2, z: -2 },
      37,
      'dolly',
    ))
  })

  test('clamps before the first and after the last keyframe', () => {
    const start = keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push')
    const end = keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly')

    assert.deepEqual(sampleCamera([start, end], -1), start)
    assert.deepEqual(sampleCamera([start, end], 11), end)
  })

  test('returns keyframe data at an exact non-duplicate timestamp', () => {
    const exact = keyframe('exact', 5, { x: 4, y: 3, z: 2 }, { x: 1, y: 2, z: 3 }, 35, 'crane')

    assert.deepEqual(sampleCamera([
      keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push'),
      exact,
      keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly'),
    ], 5), exact)
  })

  test('picks the latest duplicate at the start timestamp', () => {
    const first = keyframe('first', 0, { x: 0, y: 1, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'static')
    const latest = keyframe('latest', 0, { x: 2, y: 3, z: 4 }, { x: 1, y: 2, z: 3 }, 40, 'crane')

    assert.deepEqual(sampleCamera([
      keyframe('next', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly'),
      first,
      latest,
    ], 0), latest)
  })

  test('uses the latest interior duplicate before interpolating to the next later keyframe', () => {
    const latest = keyframe('latest', 5, { x: 4, y: 3, z: 2 }, { x: 1, y: 2, z: 3 }, 40, 'crane')
    const next = keyframe('next', 10, { x: 10, y: 5, z: -2 }, { x: 3, y: 4, z: -1 }, 60, 'dolly')
    const keyframes = [
      keyframe('start', 0, { x: 0, y: 1, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'static'),
      keyframe('early', 5, { x: 2, y: 2, z: 4 }, { x: 1, y: 1, z: 2 }, 30, 'push'),
      latest,
      next,
    ]

    assert.deepEqual(sampleCamera(keyframes, 5), latest)
    assert.deepEqual(sampleCamera(keyframes, 7.5), keyframe(
      'next',
      7.5,
      { x: 7, y: 4, z: 0 },
      { x: 2, y: 3, z: 1 },
      50,
      'dolly',
    ))
  })

  test('returns the latest duplicate at the exact end timestamp and clamps afterward', () => {
    const latest = keyframe('latest', 10, { x: 10, y: 5, z: -2 }, { x: 3, y: 4, z: -1 }, 60, 'dolly')
    const keyframes = [
      keyframe('start', 0, { x: 0, y: 1, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'static'),
      keyframe('early', 10, { x: 8, y: 4, z: 0 }, { x: 2, y: 3, z: 1 }, 50, 'push'),
      latest,
    ]

    assert.deepEqual(sampleCamera(keyframes, 10), latest)
    assert.deepEqual(sampleCamera(keyframes, 12), latest)
  })

  test('sorts a copy of the camera track without mutating it', () => {
    const start = keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push')
    const end = keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly')
    const keyframes = [end, start]
    const source = structuredClone(keyframes)

    assert.equal(sampleCamera(keyframes, 5).intent, 'dolly')
    assert.deepEqual(keyframes, source)
  })

  test('keeps duplicate timestamp samples finite without mutating input objects', () => {
    const keyframes = [
      keyframe('first', 0, { x: 0, y: 1, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'static'),
      keyframe('latest', 0, { x: 2, y: 3, z: 4 }, { x: 1, y: 2, z: 3 }, 40, 'crane'),
      keyframe('next', 10, { x: 10, y: 5, z: -2 }, { x: 3, y: 4, z: -1 }, 60, 'dolly'),
    ]
    const source = structuredClone(keyframes)
    const sampled = sampleCamera(keyframes, 5)

    assert.ok(Object.values(sampled.position).every(Number.isFinite))
    assert.ok(Object.values(sampled.target).every(Number.isFinite))
    assert.ok(Number.isFinite(sampled.focalLengthMm))
    assert.deepEqual(keyframes, source)
  })

  test('rejects an empty camera track', () => {
    assert.throws(() => sampleCamera([], 0), /Cannot sample an empty camera track/)
  })
})
