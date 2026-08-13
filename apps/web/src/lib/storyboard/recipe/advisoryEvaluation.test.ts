import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  allApprovedEvidenceIds,
  STORYBOARD_ADVISORY_EVALUATION_CASES,
} from './advisoryEvaluation.fixtures'
import { evaluateStoryboardDirectorAdvisories } from './advisory'
import { setStoryboardAdvisoryDecision } from './state-machine'

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
    const mutableExpectedCodes = allSignals.expectedCodes as string[]
    mutableExpectedCodes.push('MUTATED')
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

test('measures the owned advisory quality gate with a scoped decision lifecycle', () => {
  const results = STORYBOARD_ADVISORY_EVALUATION_CASES.map((evaluationCase) => {
    const output = evaluateStoryboardDirectorAdvisories(evaluationCase.recipe)
    const repeatedOutput = evaluateStoryboardDirectorAdvisories(evaluationCase.recipe)

    assert.deepEqual(repeatedOutput, output, `${evaluationCase.caseId} should evaluate deterministically`)

    return { evaluationCase, output }
  })

  for (const { evaluationCase, output } of results) {
    const findings = output.findings
    assert.deepEqual(
      findings.map((finding) => finding.code),
      evaluationCase.expectedCodes,
      evaluationCase.caseId,
    )
    assert.match(output.receipt.selectionFingerprint, /^ckr1_[0-9a-f]{8}$/)
    assert.equal(output.receipt.allowedUse, 'retrieval')
    assert.ok(output.receipt.recordIds.length > 0)

    const approvedEvidenceIds = allApprovedEvidenceIds(evaluationCase.recipe)
    for (const finding of findings) {
      assert.equal(finding.severity, 'advisory')
      assert.ok(finding.advisory, `${evaluationCase.caseId} should preserve advisory identity`)
      assert.match(finding.findingId, /^sdrf1_/)
      assert.match(finding.advisory.inputFingerprint, /^sdra1_/)
      assert.equal(finding.advisory.selectionFingerprint, output.receipt.selectionFingerprint)
      assert.ok(finding.advisory.ruleIds.length > 0)
      assert.ok(finding.advisory.ruleIds.every((ruleId) => output.receipt.recordIds.includes(ruleId)))
      assert.ok(finding.evidenceIds.length > 0)
      assert.ok(finding.evidenceIds.every((evidenceId) => approvedEvidenceIds.has(evidenceId)))
    }
  }

  const decisionCase = results.find(
    ({ evaluationCase }) => evaluationCase.caseId === 'decision-scope-change',
  )!
  const decisionFinding = decisionCase.output.findings[0]!
  const ignoredRecipe = setStoryboardAdvisoryDecision(
    decisionCase.evaluationCase.recipe,
    decisionFinding,
    'ignored',
    '2026-08-13T00:00:00.000Z',
  )
  const ignoredFinding = evaluateStoryboardDirectorAdvisories(ignoredRecipe).findings[0]!
  assert.equal(ignoredFinding.advisory?.handling, 'ignored')

  const changedSourceRecipe = {
    ...ignoredRecipe,
    sourceFingerprint: `${ignoredRecipe.sourceFingerprint}-source-change`,
  }
  const reopenedFinding = evaluateStoryboardDirectorAdvisories(changedSourceRecipe).findings[0]!
  assert.equal(reopenedFinding.advisory?.handling, 'open')

  // This case validates decision lineage, so it stays out of the content-finding total.
  const contentResults = results.filter(
    ({ evaluationCase }) => evaluationCase.caseId !== 'decision-scope-change',
  )
  const qualityGate = {
    caseCount: results.length,
    expectedFindingCount: contentResults.reduce(
      (total, { evaluationCase }) => total + evaluationCase.expectedCodes.length,
      0,
    ),
    emittedFindingCount: contentResults.reduce(
      (total, { output }) => total + output.findings.length,
      0,
    ),
    exactMatchCount: results.filter(({ evaluationCase, output }) => (
      output.findings.length === evaluationCase.expectedCodes.length
      && output.findings.every(
        (finding, index) => finding.code === evaluationCase.expectedCodes[index],
      )
    )).length,
    silenceMatchCount: results.filter(({ evaluationCase, output }) => (
      evaluationCase.expectedSilence && output.findings.length === 0
    )).length,
    decisionInvalidationCount: Number(
      ignoredFinding.advisory?.handling === 'ignored'
      && reopenedFinding.advisory?.handling === 'open',
    ),
  }

  assert.deepEqual(qualityGate, {
    caseCount: 8,
    expectedFindingCount: 8,
    emittedFindingCount: 8,
    exactMatchCount: 8,
    silenceMatchCount: 2,
    decisionInvalidationCount: 1,
  })
})
