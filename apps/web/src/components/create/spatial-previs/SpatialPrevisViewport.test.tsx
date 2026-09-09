/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisViewport.test.tsx
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { applySpatialCameraAction } from './SpatialCameraControlStrip'
import { SpatialPrevisViewport } from './SpatialPrevisViewport'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'

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

describe('SpatialPrevisViewport', () => {
  test('renders the spatial viewport contract and familiar local camera actions', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 6, onChange: () => undefined }),
    )

    assert.match(markup, /data-spatial-previs-viewport="true"/)
    assert.match(markup, /data-spatial-camera-preview="true"/)
    assert.match(markup, /aria-label="推\/拉"/)
    assert.match(markup, /aria-label="跟拍"/)
  })

  test('renders the sampled shared camera frame in the live preview', () => {
    const markup = renderToStaticMarkup(
      createElement(SpatialPrevisViewport, { state, currentTimeSec: 3, onChange: () => undefined }),
    )

    assert.match(markup, /42\.5 mm/)
    assert.match(markup, /3 s/)
  })

  test('updates only the existing master camera keyframe for a local camera action', () => {
    const next = applySpatialCameraAction(state, 6, '跟拍')
    const previousKeyframe = state.masterTake.cameraTrack.keyframes[1]
    const nextKeyframe = next.masterTake.cameraTrack.keyframes[1]

    assert.ok(previousKeyframe)
    assert.ok(nextKeyframe)
    assert.notEqual(next, state)
    assert.notEqual(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
    assert.equal(nextKeyframe?.id, 'camera-beat')
    assert.equal(nextKeyframe?.intent, 'follow')
    assert.deepEqual(previousKeyframe?.target, { x: 0, y: 1, z: -1 })
    assert.notDeepEqual(nextKeyframe?.position, previousKeyframe?.position)
    assert.notEqual(nextKeyframe?.focalLengthMm, previousKeyframe?.focalLengthMm)
    assert.equal(applySpatialCameraAction(state, 5, '跟拍'), state)
  })
})
