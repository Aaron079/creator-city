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
  assert.ok(allApprovedEvidenceIds(STORYBOARD_ADVISORY_EVALUATION_CASES[0]!.recipe).length > 0)
})

test('isolates owned advisory signals and keeps silent cases silent', () => {
  for (const evaluationCase of STORYBOARD_ADVISORY_EVALUATION_CASES) {
    assert.deepEqual(
      evaluateStoryboardDirectorAdvisories(evaluationCase.recipe).findings.map((finding) => finding.code),
      evaluationCase.expectedCodes,
      evaluationCase.caseId,
    )
  }
})
