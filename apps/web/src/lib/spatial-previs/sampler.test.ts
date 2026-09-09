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

  test('sorts a copy of the camera track without mutating it', () => {
    const start = keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push')
    const end = keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly')
    const keyframes = [end, start]
    const source = structuredClone(keyframes)

    assert.equal(sampleCamera(keyframes, 5).intent, 'dolly')
    assert.deepEqual(keyframes, source)
  })

  test('rejects an empty camera track', () => {
    assert.throws(() => sampleCamera([], 0), /Cannot sample an empty camera track/)
  })
})
