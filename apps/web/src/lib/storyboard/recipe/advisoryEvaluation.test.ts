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
  assert.deepEqual(
    STORYBOARD_ADVISORY_EVALUATION_CASES.filter((evaluationCase) => evaluationCase.expectedSilence)
      .map((evaluationCase) => evaluationCase.caseId),
    ['no-approved-stages', 'no-real-evidence'],
  )
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
