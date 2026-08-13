import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allApprovedEvidenceIds,
  STORYBOARD_ADVISORY_EVALUATION_CASES,
} from './advisoryEvaluation.fixtures'
import { evaluateStoryboardDirectorAdvisories } from './advisory'

test('defines the deterministic owned storyboard advisory evaluation matrix', () => {
  assert.deepEqual(
    STORYBOARD_ADVISORY_EVALUATION_CASES.map((evaluationCase) => evaluationCase.caseId),
    [
      'all-signals',
      'narrative-only',
      'composition-only',
      'continuity-only',
      'lighting-only',
      'no-approved-stages',
      'no-real-evidence',
      'decision-scope-change',
    ],
  )
  assert.equal(allApprovedEvidenceIds(STORYBOARD_ADVISORY_EVALUATION_CASES[0]!.recipe).size > 0, true)
  const noApprovedStages = STORYBOARD_ADVISORY_EVALUATION_CASES.find(
    (evaluationCase) => evaluationCase.caseId === 'no-approved-stages',
  )!
  assert.equal(allApprovedEvidenceIds(noApprovedStages.recipe).size, 0)
  assert.deepEqual(
    STORYBOARD_ADVISORY_EVALUATION_CASES.filter((evaluationCase) => evaluationCase.expectedSilence)
      .map((evaluationCase) => evaluationCase.caseId),
    ['no-approved-stages', 'no-real-evidence'],
  )
})

test('keeps the owned evaluation matrix immutable for consumers', () => {
  const allSignals = STORYBOARD_ADVISORY_EVALUATION_CASES[0]!
  assert.equal(Object.isFrozen(STORYBOARD_ADVISORY_EVALUATION_CASES), true)
  assert.equal(Object.isFrozen(allSignals), true)
  assert.equal(Object.isFrozen(allSignals.expectedCodes), true)
  assert.equal(Object.isFrozen(allSignals.recipe), true)
  assert.throws(() => {
    ;(allSignals.expectedCodes as string[]).push('MUTATED')
  }, TypeError)
})

test('isolates owned advisory signals and keeps silent cases silent', () => {
  for (const evaluationCase of STORYBOARD_ADVISORY_EVALUATION_CASES) {
    const evidenceIds = allApprovedEvidenceIds(evaluationCase.recipe)
    const sourceId = evaluationCase.recipe.sourceNode.id
    const attachedEvidence = [
      ...(evaluationCase.recipe.scene.result?.evidence ?? []),
      ...(evaluationCase.recipe.beat.result?.evidence ?? []),
      ...(evaluationCase.recipe.shot.result?.evidence ?? []),
    ]
    assert.ok(attachedEvidence.every((item) => item.sourceNodeId === sourceId), evaluationCase.caseId)
    if (evaluationCase.caseId === 'no-real-evidence') {
      assert.equal(attachedEvidence.length, 0)
      assert.equal(evidenceIds.size, 0)
    }
    assert.deepEqual(
      evaluateStoryboardDirectorAdvisories(evaluationCase.recipe).findings.map((finding) => finding.code),
      evaluationCase.expectedCodes,
      evaluationCase.caseId,
    )
  }
})

test('uses the narrative-only sample for an explicit purpose-change review', () => {
  const narrativeOnly = STORYBOARD_ADVISORY_EVALUATION_CASES.find(
    (evaluationCase) => evaluationCase.caseId === 'narrative-only',
  )!
  assert.match(narrativeOnly.recipe.scene.drafts[0]!.actionSummary, /secure approval/i)
  assert.match(narrativeOnly.recipe.beat.drafts[0]!.summary, /rejected pitch/i)
  assert.deepEqual(
    evaluateStoryboardDirectorAdvisories(narrativeOnly.recipe).findings.map((finding) => finding.code),
    ['LOCAL_NARRATIVE_PURPOSE_REVIEW'],
  )
})
