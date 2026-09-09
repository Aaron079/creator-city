/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { applySpatialCameraAction } from './SpatialCameraControlStrip'
import { SpatialPrevisViewport } from './SpatialPrevisViewport'
import type { SpatialPrevisState, Vec3 } from '@/lib/spatial-previs/types'

const viewportSource = readFileSync(new URL('./SpatialPrevisViewport.tsx', import.meta.url), 'utf8')

const state: SpatialPrevisState = {
  version: 1,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
  },
  masterTake: {
    id: 'master-take-01',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-lead',
      anchorId: 'lead-performer',
      keyframes: [
        { id: 'actor-lead-start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'enter' },
        { id: 'actor-lead-beat', timeSec: 6, position: { x: 0, y: 0, z: -1 }, action: 'turn' },
        { id: 'actor-lead-end', timeSec: 12, position: { x: 2, y: 0, z: -2 }, action: 'exit' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: -2, y: 1, z: 1 }, focalLengthMm: 35, intent: 'static' },
        { id: 'camera-beat', timeSec: 6, position: { x: 0, y: 1.8, z: 5 }, target: { x: 0, y: 1, z: -1 }, focalLengthMm: 50, intent: 'push' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2.4, z: 4 }, target: { x: 2, y: 1, z: -2 }, focalLengthMm: 65, intent: 'follow' },
      ],
    },
    beats: [{ id: 'beat-01', label: 'Arrival', startSec: 0, endSec: 12 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-09T00:00:00.000Z',
}

function stateWithTwoActors(): SpatialPrevisState {
  return {
    ...state,
    masterTake: {
      ...state.masterTake,
      actorTracks: [
        state.masterTake.actorTracks[0]!,
        {
          id: 'actor-track-support',
          anchorId: 'support-performer',
          keyframes: [
            { id: 'actor-support-start', timeSec: 0, position: { x: 3, y: 0, z: 2 }, action: 'wait' },
            { id: 'actor-support-beat', timeSec: 6, position: { x: 2, y: 0, z: 0 }, action: 'react' },
            { id: 'actor-support-end', timeSec: 12, position: { x: 1, y: 0, z: -2 }, action: 'leave' },
          ],
        },
      ],
    },
  }
}

function assertOtherCameraFramesUnchanged(next: SpatialPrevisState, source: SpatialPrevisState) {
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[0], source.masterTake.cameraTrack.keyframes[0])
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[2], source.masterTake.cameraTrack.keyframes[2])
}

describe('SpatialPrevisViewport', () => {
  test('renders the spatial viewport contract and familiar local camera actions', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.equal(markup.match(/data-spatial-previs-viewport="([^"]+)"/)?.[1], 'true')
    assert.equal(markup.match(/data-spatial-camera-preview="([^"]+)"/)?.[1], 'true')
    assert.match(markup, /aria-label="推\/拉"/)
    assert.match(markup, /aria-label="跟拍"/)
  })

  test('declares literal true data-attribute values rather than boolean JSX attributes', () => {
    assert.match(viewportSource, /data-spatial-previs-viewport="true"/)
    assert.match(viewportSource, /data-spatial-camera-preview="true"/)
  })

  test('declares named world anchors for the real spatial scene', () => {
    assert.match(viewportSource, /场景原点/)
    assert.match(viewportSource, /相机覆盖参考/)
    assert.match(viewportSource, /label: track\.anchorId/)
    assert.match(viewportSource, /WorldAnchorMarker/)
  })

  test('renders a compact selector for every actor track', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state: stateWithTwoActors(), currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.match(markup, /aria-label="选择演员轨道"/)
    assert.match(markup, /value="actor-track-lead"/)
    assert.match(markup, /value="actor-track-support"/)
  })

  test('renders the sampled shared camera frame in the live preview', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 3, onChange: () => undefined }),
    )

    assert.match(markup, /42\.5 mm/)
    assert.match(markup, /3 s/)
  })

  test('keeps physical camera and lens semantics separate for every local action', () => {
    const actionState: SpatialPrevisState = {
      ...state,
      masterTake: {
        ...state.masterTake,
        actorTracks: state.masterTake.actorTracks.map((track) => ({
          ...track,
          keyframes: track.keyframes.map((keyframe) => keyframe.timeSec === 6
            ? { ...keyframe, position: { x: 1, y: 0, z: -2 } }
            : keyframe),
        })),
        cameraTrack: {
          ...state.masterTake.cameraTrack,
          keyframes: state.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.timeSec === 6
            ? { ...keyframe, intent: 'static' }
            : keyframe),
        },
      },
    }
    const original = actionState.masterTake.cameraTrack.keyframes[1]!

    const pushPull = applySpatialCameraAction(actionState, 6, '推/拉')
    const pushPullFrame = pushPull.masterTake.cameraTrack.keyframes[1]!
    assert.notDeepEqual(pushPullFrame.position, original.position)
    assert.deepEqual(pushPullFrame.target, original.target)
    assert.equal(pushPullFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(pushPullFrame.intent, 'push')
    assertOtherCameraFramesUnchanged(pushPull, actionState)

    const panTilt = applySpatialCameraAction(actionState, 6, '摇/俯仰')
    const panTiltFrame = panTilt.masterTake.cameraTrack.keyframes[1]!
    assert.deepEqual(panTiltFrame.position, original.position)
    assert.notDeepEqual(panTiltFrame.target, original.target)
    assert.equal(panTiltFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(panTiltFrame.intent, 'pan-tilt')
    assertOtherCameraFramesUnchanged(panTilt, actionState)

    const dolly = applySpatialCameraAction(actionState, 6, '移')
    const dollyFrame = dolly.masterTake.cameraTrack.keyframes[1]!
    const cameraDelta = {
      x: dollyFrame.position.x - original.position.x,
      y: dollyFrame.position.y - original.position.y,
      z: dollyFrame.position.z - original.position.z,
    }
    const targetDelta = {
      x: dollyFrame.target.x - original.target.x,
      y: dollyFrame.target.y - original.target.y,
      z: dollyFrame.target.z - original.target.z,
    }
    assert.notDeepEqual(dollyFrame.position, original.position)
    assert.deepEqual(targetDelta, cameraDelta)
    assert.equal(dollyFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(dollyFrame.intent, 'dolly')
    assertOtherCameraFramesUnchanged(dolly, actionState)

    const follow = applySpatialCameraAction(actionState, 6, '跟拍')
    const followFrame = follow.masterTake.cameraTrack.keyframes[1]!
    assert.notDeepEqual(followFrame.position, original.position)
    assert.notDeepEqual(followFrame.target, original.target)
    assert.equal(followFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(followFrame.intent, 'follow')
    assertOtherCameraFramesUnchanged(follow, actionState)

    const crane = applySpatialCameraAction(actionState, 6, '升/降')
    const craneFrame = crane.masterTake.cameraTrack.keyframes[1]!
    assert.equal(craneFrame.position.x, original.position.x)
    assert.equal(craneFrame.position.z, original.position.z)
    assert.equal(craneFrame.target.x, original.target.x)
    assert.equal(craneFrame.target.z, original.target.z)
    assert.ok(Math.abs(
      (craneFrame.position.y - original.position.y) - (craneFrame.target.y - original.target.y),
    ) < 1e-9)
    assert.equal(craneFrame.focalLengthMm, original.focalLengthMm)
    assert.equal(craneFrame.intent, 'crane')
    assertOtherCameraFramesUnchanged(crane, actionState)
  })

  test('updates only the selected actor track at an existing exact keyframe', async () => {
    const spatialViewportModule = await import('./SpatialPrevisViewport') as {
      updateSpatialActorPosition?: (
        state: SpatialPrevisState,
        actorTrackId: string,
        currentTimeSec: number,
        position: Vec3,
      ) => SpatialPrevisState
    }
    assert.equal(typeof spatialViewportModule.updateSpatialActorPosition, 'function')

    const source = stateWithTwoActors()
    const next = spatialViewportModule.updateSpatialActorPosition!(source, 'actor-track-support', 6, { x: 4, y: 0, z: -1 })

    assert.notEqual(next, source)
    assert.deepEqual(next.masterTake.actorTracks[0], source.masterTake.actorTracks[0])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[0], source.masterTake.actorTracks[1]?.keyframes[0])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[2], source.masterTake.actorTracks[1]?.keyframes[2])
    assert.deepEqual(next.masterTake.actorTracks[1]?.keyframes[1]?.position, { x: 4, y: 0, z: -1 })
    assert.equal(spatialViewportModule.updateSpatialActorPosition!(source, 'actor-track-support', 5, { x: 4, y: 0, z: -1 }), source)
  })

  test('dispatches a local camera action through the strip handler only when a keyframe exists', async () => {
    const spatialControlModule = await import('./SpatialCameraControlStrip') as {
      dispatchSpatialCameraAction?: (input: {
        state: SpatialPrevisState
        currentTimeSec: number
        action: '推/拉'
        onChange: (next: SpatialPrevisState) => void
      }) => void
    }
    assert.equal(typeof spatialControlModule.dispatchSpatialCameraAction, 'function')

    let changed: SpatialPrevisState | null = null
    spatialControlModule.dispatchSpatialCameraAction!({
      state,
      currentTimeSec: 6,
      action: '推/拉',
      onChange: (next) => { changed = next },
    })
    assert.ok(changed)
    assert.notEqual(changed, state)

    changed = null
    spatialControlModule.dispatchSpatialCameraAction!({
      state,
      currentTimeSec: 5,
      action: '推/拉',
      onChange: (next) => { changed = next },
    })
    assert.equal(changed, null)
  })
})
