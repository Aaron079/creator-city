import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { StoryboardSketchFrame } from './types'
import {
  createStoryboardSketchRenderKey,
  renderStoryboardSketchSvg,
} from './renderer'

function readyFrame(overrides: Partial<StoryboardSketchFrame> = {}): StoryboardSketchFrame {
  return {
    shotId: 'scene-001-shot-001',
    renderKey: '',
    status: 'ready',
    composition: 'single',
    camera: { label: '中景', angle: 'eye-level' },
    subjects: [{ label: '林 <主角>', anchor: 'lower-center' }],
    actionLine: 'left-to-right',
    movement: 'static',
    notes: [],
    ...overrides,
  }
}

describe('local storyboard sketch renderer', () => {
  test('renders the same local frame as stable escaped SVG', () => {
    const frame = readyFrame()
    const first = renderStoryboardSketchSvg(frame)
    const second = renderStoryboardSketchSvg(frame)

    assert.equal(createStoryboardSketchRenderKey(frame), createStoryboardSketchRenderKey(frame))
    assert.equal(first, second)
    assert.match(first, /<svg/)
    assert.match(first, /林 &lt;主角&gt;/)
    assert.doesNotMatch(first, /<script|https?:\/\//i)
  })

  test('changes only the affected frame render key when movement changes', () => {
    const frame = readyFrame()
    const changed = readyFrame({ movement: 'pan' })

    assert.notEqual(createStoryboardSketchRenderKey(frame), createStoryboardSketchRenderKey(changed))
  })

  test('canonicalizes semantically identical frames before deriving a render key', () => {
    const frame = readyFrame()
    const reordered = Object.assign({}, {
      notes: frame.notes,
      movement: frame.movement,
      actionLine: frame.actionLine,
      subjects: frame.subjects,
      camera: frame.camera,
      composition: frame.composition,
      status: frame.status,
      renderKey: frame.renderKey,
      shotId: frame.shotId,
    }) as StoryboardSketchFrame

    assert.equal(createStoryboardSketchRenderKey(frame), createStoryboardSketchRenderKey(reordered))
  })

  test('uses no shared SVG marker and reserves a footer below every review note', () => {
    const first = renderStoryboardSketchSvg(readyFrame())
    const duplicate = renderStoryboardSketchSvg(readyFrame())
    const unresolved = renderStoryboardSketchSvg(readyFrame({
      status: 'needs-review',
      subjects: [],
      notes: ['缺少主体。', '缺少动作。', '镜头尚未审核通过。'],
    }))

    assert.equal(first, duplicate)
    assert.doesNotMatch(first, /<marker|url\(#/)
    assert.match(unresolved, /y="181"[^>]*>运镜:/)
    assert.doesNotMatch(unresolved, /y="160"[^>]*>运镜:/)
  })

  test('renders unresolved frames visibly without inventing a subject silhouette', () => {
    const output = renderStoryboardSketchSvg(readyFrame({
      status: 'needs-review',
      subjects: [],
      notes: ['缺少主体，需审核后再生成草图分镜。'],
    }))

    assert.match(output, /需审核/)
    assert.doesNotMatch(output, /data-subject=/)
  })
})
