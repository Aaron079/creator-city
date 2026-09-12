import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { rotationFromTarget } from '@/lib/spatial-previs/camera'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'
import { SpatialPrevisTimeline } from './SpatialPrevisTimeline'

Object.assign(globalThis, { React })

const state: SpatialPrevisState = {
  version: 4,
  projectId: 'project-timeline',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'take-timeline',
    durationSec: 30,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-lead',
      anchorId: 'lead',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: 0, y: 0, z: 0 }, action: 'enter' },
        { id: 'actor-mid', timeSec: 15, position: { x: 2, y: 0, z: -2 }, action: 'turn' },
      ],
    }],
    cameraTrack: {
      id: 'camera-director',
      keyframes: [
        { id: 'director-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 1.6, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 35, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'director-mid', timeSec: 15, position: { x: 1, y: 2, z: 5 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 1, y: 2, z: 5 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 50, shotScale: 'medium', motionBaseline: 'push', intent: 'push' },
      ],
    },
    aerialCameraTrack: {
      id: 'camera-aerial',
      keyframes: [
        { id: 'aerial-start', timeSec: 0, position: { x: 0, y: 9, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 9, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
      ],
    },
    beats: [],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-12T00:00:00.000Z',
}

test('renders blue actor curves and a yellow active-camera curve with draggable time points', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisTimeline, {
    state,
    currentTimeSec: 6,
    cameraMode: 'director',
    onCurrentTimeChange: () => undefined,
    onCameraKeyframeRetime: () => undefined,
    onActorKeyframeRetime: () => undefined,
    onBeatPatch: () => undefined,
  }))

  assert.match(markup, /data-spatial-curve="camera"/)
  assert.match(markup, /data-spatial-curve="actor"/)
  assert.match(markup, /aria-label="调整相机关键帧 1，0s"/)
  assert.match(markup, /aria-label="调整相机关键帧 2，15s"/)
  assert.match(markup, /aria-label="调整演员 1关键帧 1，0s"/)
  assert.match(markup, /top:17\.857142857142858%/)
})

test('keeps curve strips out of the beat editor mode', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisTimeline, {
    state: { ...state, editorMode: 'beats' },
    currentTimeSec: 6,
    cameraMode: 'aerial',
    onCurrentTimeChange: () => undefined,
    onCameraKeyframeRetime: () => undefined,
    onActorKeyframeRetime: () => undefined,
    onBeatPatch: () => undefined,
  }))

  assert.doesNotMatch(markup, /data-spatial-curve=/)
})
