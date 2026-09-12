import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { addDefaultActorTrack, applyBeatPatch, normalizeSpatialPrevis, setMasterTakeDuration } from './normalize'
import { rotationFromTarget } from './camera'
import type { AspectRatio, SpatialPrevisScene } from './types'

// @ts-expect-error verified coverage only permits full camera freedom
const incompatibleCoverage: SpatialPrevisScene['coverage'] = {
  mode: 'verified',
  cameraFreedom: 'corridor-only',
}

void incompatibleCoverage

// @ts-expect-error spatial previs supports only canonical export ratios
const unsupportedAspectRatio: AspectRatio = '4:3'

void unsupportedAspectRatio

describe('spatial previs normalization', () => {
  test('initializes version-4 asset, whitebox, and isolated camera state', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })

    assert.equal(state.version, 4)
    assert.deepEqual(state.scene.references, [])
    assert.deepEqual(state.scene.assetSets, [])
    assert.deepEqual(state.scene.whitebox.entities, [])
    assert.equal(state.masterTake.cameraTrack.id, 'camera-track')
    assert.equal(state.masterTake.aerialCameraTrack.id, 'aerial-camera-track')
    assert.ok(state.masterTake.cameraTrack.keyframes.every((keyframe) => (
      keyframe.position.y === 1.6
      && keyframe.rotation.pitch === 0
      && keyframe.rotation.yaw === 0
      && keyframe.rotation.roll === 0
      && keyframe.focalLengthMm === 35
      && keyframe.shotScale === 'medium'
      && keyframe.motionBaseline === 'static'
    )))
    assert.ok(state.masterTake.aerialCameraTrack.keyframes.every((keyframe) => keyframe.position.y === 9))
  })

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
    const keyframe = patched.masterTake.cameraTrack.keyframes.find((item) => item.timeSec === midpoint)

    assert.equal(patched.masterTake.cameraTrack.id, 'camera-track')
    assert.equal(patched.masterTake.cameraTrack.id, state.masterTake.cameraTrack.id)
    assert.equal(patched.masterTake.cameraTrack.keyframes.length, 3)
    assert.notEqual(patched.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.deepEqual(keyframe?.position, position)
    assert.deepEqual(keyframe?.target, target)
    assert.deepEqual(state.masterTake.cameraTrack.keyframes.find((item) => item.timeSec === midpoint)?.position, { x: 0, y: 1.6, z: 8 })
  })

  test('preserves a beat keyframe roll when recalculating pitch and yaw', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1', durationSec: 30 })
    const beat = state.masterTake.beats[0]
    assert.ok(beat)
    const midpoint = (beat.startSec + beat.endSec) / 2
    const rolledState: typeof state = {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === midpoint
            ? { ...keyframe, rotation: { ...keyframe.rotation, roll: 0.4 } }
            : keyframe),
        },
      },
    }

    const patched = applyBeatPatch(rolledState, beat.id, {
      position: { x: 4, y: 2, z: 8 },
      target: { x: 1, y: 1, z: 0 },
    })

    assert.equal(patched.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === midpoint)?.rotation.roll, 0.4)
  })

  test('maps scene source coverage to its supported camera freedom', () => {
    assert.deepEqual(normalizeSpatialPrevis({
      projectId: 'project-1',
      sourceMode: 'manual',
    }).scene.coverage, {
      mode: 'constrained',
      cameraFreedom: 'corridor-only',
      corridor: {
        min: { x: -12, y: 0, z: -12 },
        max: { x: 12, y: 12, z: 12 },
      },
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
      corridor: {
        min: { x: -12, y: 0, z: -12 },
        max: { x: 12, y: 12, z: 12 },
      },
    })
  })

  test('initializes the default Entry beat label', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })

    assert.equal(state.masterTake.beats[0]?.label, 'Entry')
  })

  test('adds an editable actor route without mutating the current previs state', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1', durationSec: 10 })

    const next = addDefaultActorTrack(state)

    assert.equal(state.masterTake.actorTracks.length, 0)
    assert.equal(next.masterTake.actorTracks.length, 1)
    assert.deepEqual(next.masterTake.actorTracks[0], {
      id: 'actor-track-1',
      anchorId: 'actor-1',
      keyframes: [
        { id: 'actor-1-start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'idle' },
        { id: 'actor-1-mid', timeSec: 5, position: { x: 0, y: 0, z: 0 }, action: 'walk' },
        { id: 'actor-1-end', timeSec: 10, position: { x: 2, y: 0, z: -1 }, action: 'walk' },
      ],
    })
  })

  test('preserves an allowed aspect ratio', () => {
    const state = normalizeSpatialPrevis({
      projectId: 'project-1',
      aspectRatio: '9:16',
    })

    assert.equal(state.masterTake.aspectRatio, '9:16')
  })

  test('patches a camera keyframe at a decimal beat midpoint', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const beat = state.masterTake.beats[0]
    assert.ok(beat)
    const decimalState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        beats: [{ ...beat, startSec: 0.1, endSec: 0.3 }],
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.id === 'camera-mid'
            ? { ...keyframe, timeSec: 0.20000000000000004 }
            : keyframe),
        },
      },
    }

    const patched = applyBeatPatch(decimalState, beat.id, {
      position: { x: 2, y: 3, z: 4 },
      target: { x: 0, y: 1, z: 0 },
    })

    assert.deepEqual(patched.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.id === 'camera-mid')?.position, { x: 2, y: 3, z: 4 })
  })

  test('rejects duplicate camera keyframes at a beat midpoint', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const midpointKeyframe = state.masterTake.cameraTrack.keyframes[1]
    assert.ok(midpointKeyframe)
    const duplicateState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: [...state.masterTake.cameraTrack.keyframes, { ...midpointKeyframe, id: 'camera-mid-duplicate' }],
        },
      },
    }

    assert.throws(
      () => applyBeatPatch(duplicateState, 'beat-entry', {
        position: { x: 2, y: 3, z: 4 },
        target: { x: 0, y: 1, z: 0 },
      }),
      /Ambiguous camera keyframes at midpoint for beat: beat-entry/,
    )
  })

  test('upserts an immutable director midpoint keyframe when a beat patch has no camera keyframe', () => {
    const state = normalizeSpatialPrevis({ projectId: 'project-1' })
    const beat = state.masterTake.beats[0]
    assert.ok(beat)
    const missingMidpointState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe, index) => ({
            ...keyframe,
            timeSec: (index + 1) * 10,
          })),
        },
      },
    }

    const patch = { position: { x: 2, y: 3, z: 4 }, target: { x: 0, y: 1, z: 0 } }
    const patched = applyBeatPatch(missingMidpointState, beat.id, patch)

    assert.equal(patched.masterTake.cameraTrack.keyframes.length, missingMidpointState.masterTake.cameraTrack.keyframes.length + 1)
    assert.deepEqual(patched.masterTake.cameraTrack.keyframes.find((keyframe) => keyframe.timeSec === 15), {
      ...state.masterTake.cameraTrack.keyframes[1],
      id: 'camera-track@15',
      timeSec: 15,
      ...patch,
      rotation: rotationFromTarget(patch.position, patch.target),
    })
    assert.deepEqual(missingMidpointState.masterTake.cameraTrack.keyframes, [
      ...state.masterTake.cameraTrack.keyframes.map((keyframe, index) => ({ ...keyframe, timeSec: (index + 1) * 10 })),
    ])
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

  test('clamps and remaps actor, director, aerial, and beat times when changing duration without mutation', () => {
    const state = addDefaultActorTrack(normalizeSpatialPrevis({ projectId: 'project-1', durationSec: 30 }))
    const source = structuredClone(state)

    const resized = setMasterTakeDuration(state, 60)

    assert.equal(resized.masterTake.durationSec, 60)
    assert.deepEqual(resized.masterTake.actorTracks[0]?.keyframes.map((keyframe) => keyframe.timeSec), [0, 30, 60])
    assert.deepEqual(resized.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 30, 60])
    assert.deepEqual(resized.masterTake.aerialCameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 30, 60])
    assert.deepEqual(resized.masterTake.beats.map((beat) => [beat.startSec, beat.endSec]), [[0, 60]])
    const clampedLow = setMasterTakeDuration(state, -1)
    const clampedHigh = setMasterTakeDuration(state, 999)

    assert.equal(clampedLow.masterTake.durationSec, 5)
    assert.deepEqual(clampedLow.masterTake.actorTracks[0]?.keyframes.map((keyframe) => keyframe.timeSec), [0, 2.5, 5])
    assert.deepEqual(clampedLow.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 2.5, 5])
    assert.deepEqual(clampedLow.masterTake.aerialCameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 2.5, 5])
    assert.deepEqual(clampedLow.masterTake.beats.map((beat) => [beat.startSec, beat.endSec]), [[0, 5]])
    assert.equal(clampedHigh.masterTake.durationSec, 180)
    assert.deepEqual(clampedHigh.masterTake.actorTracks[0]?.keyframes.map((keyframe) => keyframe.timeSec), [0, 90, 180])
    assert.deepEqual(clampedHigh.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 90, 180])
    assert.deepEqual(clampedHigh.masterTake.aerialCameraTrack.keyframes.map((keyframe) => keyframe.timeSec), [0, 90, 180])
    assert.deepEqual(clampedHigh.masterTake.beats.map((beat) => [beat.startSec, beat.endSec]), [[0, 180]])
    assert.deepEqual(state, source)

    const actorKeyframe = resized.masterTake.actorTracks[0]?.keyframes[0]
    const directorKeyframe = resized.masterTake.cameraTrack.keyframes[0]
    const aerialKeyframe = resized.masterTake.aerialCameraTrack.keyframes[0]
    assert.ok(actorKeyframe)
    assert.ok(directorKeyframe)
    assert.ok(aerialKeyframe)
    actorKeyframe.position.x = 999
    directorKeyframe.position.x = 999
    directorKeyframe.target.y = 999
    directorKeyframe.rotation.roll = 999
    aerialKeyframe.position.x = 999
    aerialKeyframe.target.y = 999
    aerialKeyframe.rotation.roll = 999

    assert.deepEqual(state, source)
  })
})
