import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { sampleActor, sampleCamera } from './sampler'
import type { ActorTrack, CameraKeyframe } from './types'

function keyframe(
  id: string,
  timeSec: number,
  position: CameraKeyframe['position'],
  target: CameraKeyframe['target'],
  focalLengthMm: number,
  intent: CameraKeyframe['intent'],
  options: Partial<Pick<CameraKeyframe, 'rotation' | 'shotScale' | 'motionBaseline'>> = {},
): CameraKeyframe {
  return {
    id,
    timeSec,
    position,
    target,
    rotation: options.rotation ?? { pitch: 0, yaw: 0, roll: 0 },
    focalLengthMm,
    shotScale: options.shotScale ?? 'medium',
    motionBaseline: options.motionBaseline ?? 'static',
    intent,
  }
}

describe('camera sampling', () => {
  test('interpolates the midpoint and uses the segment-start camera metadata', () => {
    const sampled = sampleCamera([
      keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push'),
      keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly'),
    ], 5)

    assert.deepEqual(sampled, keyframe(
      'start',
      5,
      { x: 5, y: 3, z: 5 },
      { x: 1, y: 2, z: -2 },
      37,
      'push',
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
      'latest',
      7.5,
      { x: 7, y: 4, z: 0 },
      { x: 2, y: 3, z: 1 },
      50,
      'crane',
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

    assert.equal(sampleCamera(keyframes, 5).intent, 'push')
    assert.deepEqual(keyframes, source)
  })

  test('returns detached frames and vectors for every sample path', () => {
    const source = [
      keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push'),
      keyframe('exact', 5, { x: 4, y: 3, z: 2 }, { x: 1, y: 2, z: 3 }, 35, 'crane'),
      keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly'),
    ]

    for (const timeSec of [-1, 2.5, 5, 10, 11]) {
      const keyframes = structuredClone(source)
      const sampled = sampleCamera(keyframes, timeSec)

      sampled.id = `mutated-${timeSec}`
      sampled.position.x = 999
      sampled.target.z = -999
      sampled.rotation.yaw = 999

      assert.deepEqual(keyframes, source)
    }
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
    assert.ok(Object.values(sampled.rotation).every(Number.isFinite))
    assert.ok(Number.isFinite(sampled.focalLengthMm))
    assert.deepEqual(keyframes, source)
  })

  test('interpolates camera rotation via the shortest angle without mutating keyframes', () => {
    const keyframes = [
      keyframe('start', 0, { x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }, 24, 'push', {
        rotation: { pitch: -0.2, yaw: (350 * Math.PI) / 180, roll: -0.1 },
        shotScale: 'wide',
        motionBaseline: 'move',
      }),
      keyframe('end', 10, { x: 10, y: 4, z: 2 }, { x: 2, y: 3, z: -4 }, 50, 'dolly', {
        rotation: { pitch: 0.2, yaw: (10 * Math.PI) / 180, roll: 0.1 },
        shotScale: 'close-up',
        motionBaseline: 'pull',
      }),
    ]
    const source = structuredClone(keyframes)

    const sampled = sampleCamera(keyframes, 5)

    assert.equal(sampled.id, 'start')
    assert.equal(sampled.shotScale, 'wide')
    assert.equal(sampled.motionBaseline, 'move')
    assert.equal(sampled.intent, 'push')
    assert.ok(Math.abs(sampled.rotation.pitch) < 1e-12)
    assert.ok(Math.abs(sampled.rotation.yaw - (2 * Math.PI)) < 1e-12)
    assert.ok(Math.abs(sampled.rotation.roll) < 1e-12)
    assert.deepEqual(keyframes, source)
  })

  test('rejects an empty camera track', () => {
    assert.throws(() => sampleCamera([], 0), /Cannot sample an empty camera track/)
  })
})

describe('actor sampling', () => {
  test('interpolates between blocking keyframes without mutating the track', () => {
    const track: ActorTrack = {
      id: 'actor-1',
      anchorId: 'performer-1',
      keyframes: [
        { id: 'start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'enter' },
        { id: 'end', timeSec: 6, position: { x: 0, y: 1, z: -1 }, action: 'turn' },
      ],
    }
    const source = structuredClone(track)

    assert.deepEqual(sampleActor(track, 3), {
      id: 'start',
      timeSec: 3,
      position: { x: -1, y: 0.5, z: 0 },
      action: 'enter',
    })
    assert.deepEqual(track, source)
  })
})
