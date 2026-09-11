/**
 * Run: cd apps/web && node_modules/.bin/tsx --test src/components/create/spatial-previs/SpatialWhiteboxToolbar.test.tsx
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SpatialPrevisState } from '@/lib/spatial-previs/types'
import {
  appendManualWhiteboxEntity,
  SpatialWhiteboxToolbar,
} from './SpatialWhiteboxToolbar'

const state: SpatialPrevisState = {
  version: 3,
  projectId: 'project-previs-01',
  scene: {
    sourceMode: 'multi-view',
    coverage: { mode: 'verified', cameraFreedom: 'full' },
    references: [],
    assetSets: [],
    whitebox: {
      entities: [{
        id: 'wall-existing',
        label: '现有墙体',
        confidence: 0.75,
        kind: 'wall',
        position: { x: 0, y: 1.5, z: 0 },
        rotationY: 0,
        size: { x: 4, y: 3, z: 0.2 },
        sourceAssetIds: ['asset-scene'],
      }],
    },
  },
  masterTake: {
    id: 'take-1',
    durationSec: 12,
    aspectRatio: '16:9',
    actorTracks: [],
    cameraTrack: { id: 'camera-track', keyframes: [] },
    beats: [],
  },
  editorMode: 'continuous',
  updatedAt: '2026-09-09T00:00:00.000Z',
}

test('renders only the five compact additive whitebox actions', () => {
  const markup = renderToStaticMarkup(createElement(SpatialWhiteboxToolbar, {
    state,
    onChange: () => undefined,
  }))

  assert.match(markup, /role="toolbar"/)
  assert.match(markup, /\+ 地面/)
  assert.match(markup, /\+ 墙体/)
  assert.match(markup, /\+ 开口/)
  assert.match(markup, /\+ 家具/)
  assert.match(markup, /\+ 道具/)
  assert.equal((markup.match(/<button/g) ?? []).length, 5)
})

test('appends a deterministic manual solid without changing the master take', () => {
  const next = appendManualWhiteboxEntity(state, 'wall')

  assert.equal(next.scene.whitebox.entities.length, 2)
  assert.deepEqual(next.scene.whitebox.entities[0], state.scene.whitebox.entities[0])
  assert.deepEqual(next.scene.whitebox.entities[1], {
    id: 'manual-wall-1',
    label: '手动墙体 1',
    confidence: 1,
    kind: 'wall',
    position: { x: 0.5, y: 1.5, z: 0.5 },
    rotationY: 0,
    size: { x: 4, y: 3, z: 0.2 },
    sourceAssetIds: ['manual'],
  })
  assert.equal(next.masterTake, state.masterTake)
})

test('continues the highest same-kind manual id after rebuilt solids were removed', () => {
  const rebuiltAfterRemoval: SpatialPrevisState = {
    ...state,
    scene: {
      ...state.scene,
      whitebox: {
        entities: [
          { ...state.scene.whitebox.entities[0]!, id: 'wall-rebuilt', label: '重建墙体' },
          { ...state.scene.whitebox.entities[0]!, id: 'manual-wall-4', label: '手动墙体 4', confidence: 1, sourceAssetIds: ['manual'] },
          { ...state.scene.whitebox.entities[0]!, id: 'manual-floor-12', label: '手动地面 12', confidence: 1, kind: 'floor', sourceAssetIds: ['manual'] },
        ],
      },
    },
  }

  const next = appendManualWhiteboxEntity(rebuiltAfterRemoval, 'wall')

  assert.equal(next.scene.whitebox.entities.at(-1)?.id, 'manual-wall-5')
  assert.equal(next.scene.whitebox.entities.at(-1)?.label, '手动墙体 5')
})

test('disables every add action only when the toolbar is explicitly busy', () => {
  const enabledMarkup = renderToStaticMarkup(createElement(SpatialWhiteboxToolbar, {
    state,
    onChange: () => undefined,
  }))
  const disabledMarkup = renderToStaticMarkup(createElement(SpatialWhiteboxToolbar, {
    state,
    disabled: true,
    onChange: () => undefined,
  }))

  assert.equal((enabledMarkup.match(/ disabled=""/g) ?? []).length, 0)
  assert.equal((disabledMarkup.match(/ disabled=""/g) ?? []).length, 5)
})
