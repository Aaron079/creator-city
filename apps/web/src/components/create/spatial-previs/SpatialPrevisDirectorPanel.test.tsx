/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import { selectSpatialPrevisEditorMode, SpatialPrevisDirectorPanel } from './SpatialPrevisDirectorPanel'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'

Object.assign(globalThis, { React })

const state: SpatialPrevisState = {
  version: 1,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
  },
  masterTake: {
    id: 'take-1',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-track-lead',
      anchorId: 'lead-performer',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: -2, y: 0, z: 1 }, action: 'enter' },
        { id: 'actor-mid', timeSec: 6, position: { x: 0, y: 0, z: -1 }, action: 'turn' },
        { id: 'actor-end', timeSec: 12, position: { x: 2, y: 0, z: -2 }, action: 'exit' },
      ],
    }],
    cameraTrack: {
      id: 'camera-track',
      keyframes: [
        { id: 'camera-start', timeSec: 0, position: { x: 0, y: 1.6, z: 8 }, target: { x: -2, y: 1, z: 1 }, focalLengthMm: 35, intent: 'static' },
        { id: 'camera-mid', timeSec: 6, position: { x: 0, y: 1.8, z: 5 }, target: { x: 0, y: 1, z: -1 }, focalLengthMm: 50, intent: 'push' },
        { id: 'camera-end', timeSec: 12, position: { x: 2, y: 2.4, z: 4 }, target: { x: 2, y: 1, z: -2 }, focalLengthMm: 65, intent: 'follow' },
      ],
    },
    beats: [{ id: 'beat-01', label: 'Arrival', startSec: 0, endSec: 12 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-09T00:00:00.000Z',
}

test('renders both synchronized timeline tabs for the supplied master take', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: state,
    onSave: () => undefined,
    onClose: () => undefined,
  }))

  assert.match(markup, /连续走位/)
  assert.match(markup, /剧情节拍/)
  assert.match(markup, /data-master-take-id="take-1"/)
})

test('switches only the editor mode while retaining the one master take', () => {
  const next = selectSpatialPrevisEditorMode(state, 'beats')

  assert.equal(next.editorMode, 'beats')
  assert.equal(next.masterTake, state.masterTake)
  assert.equal(next.masterTake.id, 'take-1')
  assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.cameraTrack, state.masterTake.cameraTrack)
})

test('patches a beat camera keyframe in the existing master take without duplicate collections', () => {
  const next = applyBeatPatch(state, 'beat-01', {
    position: { x: 3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })

  assert.equal(next.masterTake.id, state.masterTake.id)
  assert.equal(next.masterTake.actorTracks, state.masterTake.actorTracks)
  assert.equal(next.masterTake.cameraTrack.id, state.masterTake.cameraTrack.id)
  assert.notEqual(next.masterTake.cameraTrack.keyframes, state.masterTake.cameraTrack.keyframes)
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[1]?.position, { x: 3, y: 2, z: 4 })
  assert.deepEqual(next.masterTake.cameraTrack.keyframes[1]?.target, { x: 1, y: 1, z: -2 })
})
