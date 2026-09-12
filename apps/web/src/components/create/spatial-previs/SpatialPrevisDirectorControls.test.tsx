/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorControls.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { rotationFromTarget } from '@/lib/spatial-previs/camera'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'
import {
  applyDirectorCameraAction,
  applyDirectorLens,
  changeDirectorDuration,
  closeDirectorPopover,
  DIRECTOR_CONTROL_POPOVERS,
  DIRECTOR_DURATION_OPTIONS,
  DIRECTOR_SHOT_SCALES,
  recordDirectorCameraKeyframe,
  SpatialPrevisDirectorControls,
  toggleDirectorPopover,
} from './SpatialPrevisDirectorControls'

const state: SpatialPrevisState = {
  version: 4,
  projectId: 'project-director-controls',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: { entities: [] },
  },
  masterTake: {
    id: 'take-director-controls',
    durationSec: 30,
    aspectRatio: '16:9',
    actorTracks: [{
      id: 'actor-lead',
      anchorId: 'lead',
      keyframes: [
        { id: 'actor-start', timeSec: 0, position: { x: 0, y: 0, z: 0 }, action: 'start' },
        { id: 'actor-middle', timeSec: 15, position: { x: 3, y: 0, z: -2 }, action: 'turn' },
        { id: 'actor-end', timeSec: 30, position: { x: 6, y: 0, z: -4 }, action: 'end' },
      ],
    }],
    cameraTrack: {
      id: 'director-camera',
      keyframes: [
        { id: 'director-start', timeSec: 0, position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 2, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 35, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'director-middle', timeSec: 15, position: { x: 0, y: 2, z: 5 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 2, z: 5 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 50, shotScale: 'medium', motionBaseline: 'static', intent: 'static' },
        { id: 'director-end', timeSec: 30, position: { x: 2, y: 2, z: 4 }, target: { x: 2, y: 1, z: -2 }, rotation: rotationFromTarget({ x: 2, y: 2, z: 4 }, { x: 2, y: 1, z: -2 }), focalLengthMm: 65, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
      ],
    },
    aerialCameraTrack: {
      id: 'aerial-camera',
      keyframes: [
        { id: 'aerial-start', timeSec: 0, position: { x: 0, y: 10, z: 8 }, target: { x: 0, y: 1, z: 0 }, rotation: rotationFromTarget({ x: 0, y: 10, z: 8 }, { x: 0, y: 1, z: 0 }), focalLengthMm: 24, shotScale: 'wide', motionBaseline: 'static', intent: 'static' },
        { id: 'aerial-end', timeSec: 30, position: { x: 4, y: 12, z: 6 }, target: { x: 2, y: 1, z: -2 }, rotation: rotationFromTarget({ x: 4, y: 12, z: 6 }, { x: 2, y: 1, z: -2 }), focalLengthMm: 28, shotScale: 'long', motionBaseline: 'static', intent: 'static' },
      ],
    },
    beats: [{ id: 'beat-middle', label: '中段', startSec: 9, endSec: 24 }],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-11T00:00:00.000Z',
}

test('renders compact first-level director controls without a persistent duplicate camera strip', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorControls, {
    state,
    currentTimeSec: 15,
    actorTrackId: 'actor-lead',
    onChange: () => undefined,
    onSelectionToolChange: () => undefined,
    onCurrentTimeChange: () => undefined,
  }))
  assert.ok(markup.includes('人物走位'))

  assert.match(markup, /aria-label="导演镜头控制"/)
  for (const label of ['选择与拖拽', '摄影机位移与高度', '摄影机角度', '记录相机关键帧', '调整时长', '镜头参数', '相机动作', 'Director', '航拍']) {
    assert.match(markup, new RegExp(`aria-label="${label}"`))
  }
  assert.doesNotMatch(markup, /aria-label="切换机位方案"/)
  assert.doesNotMatch(markup, /aria-label="局部相机控制"/)
  assert.doesNotMatch(markup, /aria-label="推"/)
})

test('opens one director popover at a time and closes every popover on active click, Escape, or outside pointer', () => {
  assert.deepEqual(DIRECTOR_CONTROL_POPOVERS, ['selection', 'duration', 'lens', 'camera-actions', 'actor-route'])

  for (const popover of DIRECTOR_CONTROL_POPOVERS) {
    assert.equal(toggleDirectorPopover(null, popover), popover)
    assert.equal(toggleDirectorPopover(popover, popover), null)
    assert.equal(closeDirectorPopover(popover, 'escape'), null)
    assert.equal(closeDirectorPopover(popover, 'outside-pointer'), null)
  }

  assert.equal(toggleDirectorPopover('duration', 'lens'), 'lens')
  assert.equal(toggleDirectorPopover('selection', 'camera-actions'), 'camera-actions')
})

test('accepts every approved duration and proportionally remaps every track and playhead', () => {
  assert.deepEqual(DIRECTOR_DURATION_OPTIONS, [5, 10, 15, 30, 45, 60, 90, 120, 180])

  for (const durationSec of DIRECTOR_DURATION_OPTIONS) {
    const resized = changeDirectorDuration(state, 15, durationSec)
    assert.equal(resized.state.masterTake.durationSec, durationSec)
    assert.equal(resized.currentTimeSec, durationSec / 2)
    assert.equal(resized.state.masterTake.actorTracks[0]?.keyframes[1]?.timeSec, durationSec / 2)
    assert.equal(resized.state.masterTake.cameraTrack.keyframes[1]?.timeSec, durationSec / 2)
    assert.equal(resized.state.masterTake.aerialCameraTrack.keyframes[1]?.timeSec, durationSec)
    assert.deepEqual(resized.state.masterTake.beats[0], {
      id: 'beat-middle',
      label: '中段',
      startSec: durationSec * 0.3,
      endSec: durationSec * 0.8,
    })
  }
})

test('records and routes camera operations only to the selected director or aerial track', () => {
  const recordedAerial = recordDirectorCameraKeyframe(state, 'aerial', 15)
  assert.equal(recordedAerial.masterTake.aerialCameraTrack.keyframes.length, 3)
  assert.equal(recordedAerial.masterTake.cameraTrack.keyframes.length, 3)

  const directorMove = applyDirectorCameraAction(state, 'director', 15, '推', 'actor-lead')
  assert.notDeepEqual(directorMove.masterTake.cameraTrack.keyframes[1]?.position, state.masterTake.cameraTrack.keyframes[1]?.position)
  assert.equal(directorMove.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)

  const aerialMove = applyDirectorCameraAction(state, 'aerial', 15, '推', 'actor-lead')
  assert.equal(aerialMove.masterTake.cameraTrack, state.masterTake.cameraTrack)
  assert.equal(aerialMove.masterTake.aerialCameraTrack.keyframes.length, 3)
})

test('applies legal shot scale and focal selections, accepts a custom 8-600 focal length, and ignores invalid lens input', () => {
  assert.deepEqual(DIRECTOR_SHOT_SCALES.map((item) => item.label), ['极近景', '特写', '近景', '中近景', '中景', '中全景', '全景', '远景', '大远景', '建立镜头'])

  const scaled = applyDirectorLens(state, 'director', 15, { shotScale: 'close-up' })
  assert.equal(scaled.masterTake.cameraTrack.keyframes[1]?.shotScale, 'close-up')
  assert.equal(scaled.masterTake.aerialCameraTrack, state.masterTake.aerialCameraTrack)

  const custom = applyDirectorLens(state, 'aerial', 15, { focalLengthMm: 73 })
  assert.equal(custom.masterTake.aerialCameraTrack.keyframes.find((frame) => frame.timeSec === 15)?.focalLengthMm, 73)
  assert.equal(custom.masterTake.cameraTrack, state.masterTake.cameraTrack)

  assert.equal(applyDirectorLens(state, 'director', 15, { focalLengthMm: 7 }), state)
  assert.equal(applyDirectorLens(state, 'director', 15, { focalLengthMm: 601 }), state)
  assert.equal(applyDirectorLens(state, 'director', 15, { focalLengthMm: Number.NaN }), state)
})
