import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { ShotPlanDraft } from '../../skills/shot-planning/types'
import type { RecipeReviewItem } from '../recipe/types'
import { deriveStoryboardSketchFrame } from './grammar'

function approvedShot(
  overrides: Partial<RecipeReviewItem<ShotPlanDraft>> = {},
): RecipeReviewItem<ShotPlanDraft> {
  return {
    shotId: 'scene-001-shot-001',
    sceneId: 'scene-001',
    order: 1,
    objective: 'Introduce the station.',
    subject: '林',
    action: '走入空旷车站',
    suggestedShotSize: 'wide',
    sourceText: '林走入空旷车站。',
    lineStart: 1,
    lineEnd: 1,
    outputKind: 'image',
    duration: 5,
    reviewStatus: 'pending',
    decision: 'approved',
    ...overrides,
  }
}

describe('deriveStoryboardSketchFrame', () => {
  test('derives a wide establishing frame with deterministic subject blocking', () => {
    const frame = deriveStoryboardSketchFrame(approvedShot())

    assert.equal(frame.status, 'ready')
    assert.equal(frame.composition, 'establishing')
    assert.equal(frame.camera.label, '远景')
    assert.equal(frame.camera.angle, 'eye-level')
    assert.deepEqual(frame.subjects, [{ label: '林', anchor: 'lower-center' }])
    assert.equal(frame.actionLine, 'none')
    assert.equal(frame.movement, 'static')
  })

  test('derives explicit direction, camera angle, and movement without invention', () => {
    const frame = deriveStoryboardSketchFrame(approvedShot({
      subject: '林与阿岚',
      action: '林从左向右推进，镜头俯拍并跟拍。',
      suggestedShotSize: 'full',
    }))

    assert.equal(frame.composition, 'two-shot')
    assert.equal(frame.camera.label, '全景')
    assert.equal(frame.camera.angle, 'high')
    assert.deepEqual(frame.subjects, [
      { label: '林', anchor: 'lower-left' },
      { label: '阿岚', anchor: 'lower-right' },
    ])
    assert.equal(frame.actionLine, 'left-to-right')
    assert.equal(frame.movement, 'dolly')
  })

  test('marks an underspecified shot unresolved instead of inventing a subject', () => {
    const frame = deriveStoryboardSketchFrame(approvedShot({ subject: '', action: '气氛紧张' }))

    assert.equal(frame.status, 'needs-review')
    assert.deepEqual(frame.subjects, [])
    assert.match(frame.notes.join(' '), /主体/)
  })

  test('marks a missing action unresolved instead of inventing movement', () => {
    const frame = deriveStoryboardSketchFrame(approvedShot({ action: '   ' }))

    assert.equal(frame.status, 'needs-review')
    assert.equal(frame.actionLine, 'none')
    assert.equal(frame.movement, 'static')
    assert.match(frame.notes.join(' '), /动作/)
  })

  test('marks pending and rejected review items unresolved instead of producing ready frames', () => {
    for (const decision of ['pending', 'rejected'] as const) {
      const frame = deriveStoryboardSketchFrame(approvedShot({ decision }))

      assert.equal(frame.status, 'needs-review')
      assert.match(frame.notes.join(' '), /审核/)
    }
  })

  test('marks four or more subjects unresolved instead of overlapping anchors', () => {
    const frame = deriveStoryboardSketchFrame(approvedShot({
      subject: '林、阿岚、周、陈',
    }))

    assert.equal(frame.status, 'needs-review')
    assert.equal(frame.subjects.length, 0)
    assert.match(frame.notes.join(' '), /主体/)
  })
})
