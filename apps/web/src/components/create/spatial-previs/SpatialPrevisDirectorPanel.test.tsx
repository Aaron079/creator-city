/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialPrevisDirectorPanel.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { assessAuthoringRisks } from '@/lib/spatial-previs/coverage'
import { applyBeatPatch } from '@/lib/spatial-previs/normalize'
import {
  applySpatialPrevisBeatPatch,
  canMutateSpatialPrevisEditor,
  createSpatialPrevisSaveGuard,
  nextSpatialPrevisEditorMode,
  selectSpatialPrevisEditorMode,
  SpatialPrevisDirectorPanel,
} from './SpatialPrevisDirectorPanel'
import { clampSpatialPrevisTime, commitSpatialNumericDraft } from './SpatialPrevisTimeline'
import { replaceWhiteboxDraft } from '@/lib/spatial-previs/whitebox'
import type { SpatialPrevisState, SpatialSceneReference } from '@/lib/spatial-previs/types'
import * as directorPanelModule from './SpatialPrevisDirectorPanel'

Object.assign(globalThis, { React })

const state: SpatialPrevisState = {
  version: 2,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    whitebox: { entities: [] },
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
  assert.match(markup, /role="tab"/)
  assert.match(markup, /role="tabpanel"/)
  assert.match(markup, /aria-controls="[^"]+"/)
  assert.match(markup, /tabindex="0"/)
  assert.match(markup, /tabindex="-1"/)
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

test('clamps shared timeline time to the master take duration', () => {
  assert.equal(clampSpatialPrevisTime(-2, state.masterTake.durationSec), 0)
  assert.equal(clampSpatialPrevisTime(18, state.masterTake.durationSec), state.masterTake.durationSec)
  assert.equal(clampSpatialPrevisTime(Number.NaN, state.masterTake.durationSec), 0)
})

test('keeps incomplete numeric drafts local and commits only complete finite coordinates', () => {
  assert.equal(commitSpatialNumericDraft('', 4), 4)
  assert.equal(commitSpatialNumericDraft('-', 4), 4)
  assert.equal(commitSpatialNumericDraft('3x', 4), 4)
  assert.equal(commitSpatialNumericDraft('-2.5', 4), -2.5)
})

test('maps roving tab keys to the next persistent editor mode', () => {
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'ArrowRight'), 'beats')
  assert.equal(nextSpatialPrevisEditorMode('beats', 'ArrowLeft'), 'continuous')
  assert.equal(nextSpatialPrevisEditorMode('beats', 'Home'), 'continuous')
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'End'), 'beats')
  assert.equal(nextSpatialPrevisEditorMode('continuous', 'Enter'), null)
})

test('reports save success, failure, and a pending guard without concurrent calls', async () => {
  const guard = createSpatialPrevisSaveGuard()
  let saveCalls = 0
  let resolveFirst: ((value: 'success') => void) | undefined
  const first = guard.save(state, () => {
    saveCalls += 1
    return new Promise<'success'>((resolve) => { resolveFirst = resolve })
  })

  assert.equal(guard.isPending(), true)
  assert.equal(await guard.save(state, () => {
    saveCalls += 1
    return 'success'
  }), 'pending')
  assert.equal(saveCalls, 1)

  resolveFirst?.('success')
  assert.equal(await first, 'success')
  assert.equal(guard.isPending(), false)
  assert.equal(await guard.save(state, () => 'failed'), 'failed')
  assert.equal(await guard.save(state, () => 'conflict'), 'conflict')
  assert.equal(await guard.save(state, () => Promise.reject(new Error('save failed'))), 'failed')
})

test('blocks all editor mutations while the accepted save snapshot is pending', async () => {
  const guard = createSpatialPrevisSaveGuard()
  let resolveSave: ((value: 'success') => void) | undefined
  let acceptedSnapshot: SpatialPrevisState | null = null
  const pendingSave = guard.save(state, (next) => {
    acceptedSnapshot = next
    return new Promise<'success'>((resolve) => { resolveSave = resolve })
  })

  assert.equal(canMutateSpatialPrevisEditor(guard.isPending()), false)
  assert.equal(acceptedSnapshot, state)
  resolveSave?.('success')
  assert.equal(await pendingSave, 'success')
  assert.equal(canMutateSpatialPrevisEditor(guard.isPending()), true)
})

test('treats a scene-asset upload as busy for save, close, and editor mutation guards', () => {
  type BusyGuard = (isSaving: boolean, isReloading: boolean, isSceneAssetsUploading: boolean) => boolean
  const isSpatialPrevisBusy = (directorPanelModule as unknown as {
    isSpatialPrevisBusy?: BusyGuard
  }).isSpatialPrevisBusy

  assert.equal(typeof isSpatialPrevisBusy, 'function')
  const isBusy = isSpatialPrevisBusy?.(false, false, true)
  assert.equal(isBusy, true)
  assert.equal(canMutateSpatialPrevisEditor(isBusy ?? false), false)
})

test('accepts completed scene references during upload but rejects them while saving or reloading', () => {
  type SceneReferenceGuard = (isSaving: boolean, isReloading: boolean) => boolean
  const canReplaceSpatialPrevisSceneReferences = (directorPanelModule as unknown as {
    canReplaceSpatialPrevisSceneReferences?: SceneReferenceGuard
  }).canReplaceSpatialPrevisSceneReferences
  const completedReference: SpatialSceneReference = {
    id: 'scene-upload-completed',
    assetId: 'asset-upload-completed',
    title: 'Completed scene reference',
    mediaType: 'image',
    url: '/api/assets/asset-upload-completed/file',
    source: 'upload',
  }

  assert.equal(typeof canReplaceSpatialPrevisSceneReferences, 'function')
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(false, false), true)
  const updated = canReplaceSpatialPrevisSceneReferences?.(false, false)
    ? replaceWhiteboxDraft(state, [completedReference])
    : state
  assert.deepEqual(updated.scene.references, [completedReference])
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(true, false), false)
  assert.equal(canReplaceSpatialPrevisSceneReferences?.(false, true), false)
})

test('keeps a failed beat patch state intact and provides an inline error message', () => {
  const noMidpointState: SpatialPrevisState = {
    ...state,
    masterTake: {
      ...state.masterTake,
      cameraTrack: {
        ...state.masterTake.cameraTrack,
        keyframes: state.masterTake.cameraTrack.keyframes.filter((keyframe) => keyframe.timeSec !== 6),
      },
    },
  }

  const result = applySpatialPrevisBeatPatch(noMidpointState, 'beat-01', {
    position: { x: 3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })

  assert.equal(result.state, noMidpointState)
  assert.equal(result.error, '无法更新节拍。')
})

test('keeps unavailable coverage advisory-only while beat fields remain editable', () => {
  const unavailableState: SpatialPrevisState = {
    ...state,
    scene: {
      ...state.scene,
      coverage: { mode: 'unavailable', cameraFreedom: 'disabled' },
    },
    editorMode: 'beats',
  }
  const result = applySpatialPrevisBeatPatch(unavailableState, 'beat-01', {
    position: { x: -3, y: 2, z: 4 },
    target: { x: 1, y: 1, z: -2 },
  })
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: unavailableState,
    onSave: () => undefined,
    onClose: () => undefined,
  }))
  const [risk] = assessAuthoringRisks(
    unavailableState.scene.coverage,
    unavailableState.masterTake.cameraTrack.keyframes.map((keyframe) => keyframe.position),
  )

  assert.notEqual(result.state, unavailableState)
  assert.equal(risk?.blocking, false)
  assert.match(markup, /Camera positions cannot be validated/)
  assert.match(markup, /aria-label="相机位置 X"/)
  assert.doesNotMatch(markup, /aria-label="相机位置 X"[^>]*disabled=/)
})

test('renders neutral delivery actions and keeps provider delivery inside an advanced disclosure', () => {
  const markup = renderToStaticMarkup(createElement(SpatialPrevisDirectorPanel, {
    initialState: state,
    onSave: () => undefined,
    onCreateDeliveryNode: () => undefined,
    onDownloadDeliveryPackage: () => undefined,
    onSaveDeliveryPackageToAssets: async () => undefined,
    onDeliverToSeedance: async () => ({ success: true, message: 'submitted' }),
    onClose: () => undefined,
  }))
  const footerMarkup = markup.slice(markup.lastIndexOf('<footer'))

  assert.match(footerMarkup, /生成预演节点/)
  assert.match(markup, /下载交付包/)
  assert.match(markup, /保存到素材库/)
  assert.match(markup, /<details/)
  assert.match(markup, /高级交付/)
  assert.doesNotMatch(footerMarkup, /Seedance|seedance-2\.5|生成到 Seedance/)
})
