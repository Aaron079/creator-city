import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type {
  CreatorSkillEvidence,
  CreatorSkillRunResult,
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'
import {
  evaluateStoryboardDirectorAdvisories,
} from './advisory'
import type {
  RecipeReviewItem,
  StoryboardDirectorRecipe,
} from './types'

const source = {
  id: 'source-1',
  kind: 'text' as const,
  title: 'Pilot',
  prompt: 'INT. APARTMENT - NIGHT\nMara crosses to the window while Jose watches.',
}

function approved<T>(draft: T): RecipeReviewItem<T> {
  return { ...draft, decision: 'approved' }
}

function resultWithEvidence(evidence: CreatorSkillEvidence[]): CreatorSkillRunResult {
  return {
    skillId: 'local-test-skill',
    skillVersion: '1.0.0',
    runFingerprint: 'csk1_test',
    status: 'ready',
    artifacts: [],
    evidence,
    warnings: [],
    blockers: [],
  }
}

function sourceEvidence(
  evidenceId: string,
  lineStart: number,
  lineEnd: number,
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId: 'local-test-rule',
    sourceNodeId: source.id,
    lineStart,
    lineEnd,
    excerpt: source.prompt,
    explanation: 'Local test evidence.',
  }
}

function recipeFixture(): StoryboardDirectorRecipe {
  const scene = approved<ScriptSceneDraft>({
    sceneId: 'scene-1',
    order: 1,
    heading: 'INT. APARTMENT - NIGHT',
    location: 'APARTMENT',
    timeOfDay: 'NIGHT',
    characters: ['Mara', 'Jose'],
    actionSummary: 'Mara crosses to the window while Jose watches.',
    sourceText: source.prompt,
    lineStart: 1,
    lineEnd: 2,
    reviewStatus: 'pending',
  })
  const beat = approved<NarrativeBeatDraft>({
    beatId: 'beat-1',
    sceneId: scene.sceneId,
    order: 1,
    type: 'turn',
    sourceText: scene.actionSummary,
    summary: 'Mara makes a decisive turn toward the window.',
    lineStart: 2,
    lineEnd: 2,
    reviewStatus: 'pending',
  })
  const shots = [
    approved<ShotPlanDraft>({
      shotId: 'shot-1',
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      order: 1,
      objective: 'Establish Mara choosing the window.',
      subject: 'Mara',
      action: 'Mara crosses left to right toward the window.',
      suggestedShotSize: 'medium',
      sourceText: scene.actionSummary,
      lineStart: 2,
      lineEnd: 2,
      outputKind: 'image',
      duration: 5,
      reviewStatus: 'pending',
    }),
    approved<ShotPlanDraft>({
      shotId: 'shot-2',
      sceneId: scene.sceneId,
      beatId: beat.beatId,
      order: 2,
      objective: 'Hold Jose reacting to the decision.',
      subject: 'Jose',
      action: 'Jose watches Mara continue toward the window.',
      suggestedShotSize: 'close',
      sourceText: scene.actionSummary,
      lineStart: 2,
      lineEnd: 2,
      outputKind: 'image',
      duration: 5,
      reviewStatus: 'pending',
    }),
  ]

  return {
    schemaVersion: 3,
    recipeId: 'sdr1_recipe',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    sourceNode: source,
    sourceFingerprint: 'csf1_source',
    activeStage: 'shot-review',
    scene: {
      status: 'approved', generation: 1, sourceFingerprint: 'csf1_source',
      result: resultWithEvidence([sourceEvidence('scene-evidence-001', 1, 2)]),
      drafts: [scene], approvedArtifact: null, staleResult: null,
    },
    beat: {
      status: 'approved', generation: 1, sourceFingerprint: 'csf1_source',
      result: resultWithEvidence([sourceEvidence('narrative-beat-evidence-001-001', 2, 2)]),
      drafts: [beat], approvedArtifact: null, staleResult: null,
    },
    shot: {
      status: 'approved', generation: 1, sourceFingerprint: 'csf1_source',
      result: resultWithEvidence([
        sourceEvidence('shot-plan-evidence-001-001', 2, 2),
        sourceEvidence('shot-plan-evidence-001-002', 2, 2),
      ]),
      drafts: shots, approvedArtifact: null, staleResult: null,
      options: {
        requestedShotCount: 2,
        outputMode: 'image',
        pacing: 'standard',
        shotSizeStrategy: 'auto',
        userInstruction: '',
      },
    },
    findings: [],
    advisoryDecisions: [],
    storyboard: { version: '1', shots: [], updatedAt: '2026-08-13T00:00:00.000Z' },
    receipts: [],
    sketchBoard: null,
    legacyImportStatus: 'not-offered',
    audit: { createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z' },
  }
}

describe('Storyboard Director local advisories', () => {
  test('emits deterministic, local-only advisory findings in professional review order', () => {
    const recipe = recipeFixture()
    const first = evaluateStoryboardDirectorAdvisories(recipe)
    const second = evaluateStoryboardDirectorAdvisories(recipe)

    assert.deepEqual(first.findings.map((finding) => finding.code), [
      'LOCAL_NARRATIVE_PURPOSE_REVIEW',
      'LOCAL_COMPOSITION_HIERARCHY_REVIEW',
      'LOCAL_CONTINUITY_CONFIRMATION',
      'LOCAL_LIGHTING_MOTIVATION_REVIEW',
    ])
    assert.deepEqual(first.findings, second.findings)
    assert.ok(first.findings.every((finding) => finding.severity === 'advisory'))
    assert.ok(first.findings.every((finding) => (
      finding.advisory
      && finding.advisory.ruleIds.length > 0
      && /^ckr1_[0-9a-f]{8}$/.test(finding.advisory.selectionFingerprint)
      && /^sdrf1_[0-9a-f]{8}$/.test(finding.findingId)
      && finding.evidenceIds.length > 0
      && Boolean(finding.shotId)
    )))
    const approvedEvidenceIds = new Set([
      ...recipe.scene.result?.evidence ?? [],
      ...recipe.beat.result?.evidence ?? [],
      ...recipe.shot.result?.evidence ?? [],
    ].map((item) => item.evidenceId))
    assert.ok(first.findings.every((finding) => (
      finding.evidenceIds.every((evidenceId) => approvedEvidenceIds.has(evidenceId))
    )))
    assert.match(first.receipt.selectionFingerprint, /^ckr1_[0-9a-f]{8}$/)
    assert.match(
      first.findings.find((finding) => finding.code === 'LOCAL_CONTINUITY_CONFIRMATION')!.message,
      /需要人工确认/,
    )
  })

  test('does not infer advisories when no approved structured evidence is available', () => {
    const recipe = recipeFixture()
    recipe.scene.drafts = []
    recipe.beat.drafts = []
    recipe.shot.drafts = []

    assert.deepEqual(evaluateStoryboardDirectorAdvisories(recipe).findings, [])
  })

  test('does not emit a signal whose approved stages have no real source evidence', () => {
    const recipe = recipeFixture()
    recipe.scene.result = null
    recipe.beat.result = null
    recipe.shot.result = null

    assert.deepEqual(evaluateStoryboardDirectorAdvisories(recipe).findings, [])
  })

  test('restores a decision only for the exact advisory and knowledge-selection tuple', () => {
    const recipe = recipeFixture()
    const original = evaluateStoryboardDirectorAdvisories(recipe).findings[0]!
    const metadata = original.advisory!
    recipe.advisoryDecisions = [{
      advisoryId: original.findingId,
      inputFingerprint: metadata.inputFingerprint,
      selectionFingerprint: metadata.selectionFingerprint,
      decision: 'ignored',
      decidedAt: '2026-08-13T00:00:00.000Z',
    }]

    assert.equal(
      evaluateStoryboardDirectorAdvisories(recipe).findings[0]!.advisory!.handling,
      'ignored',
    )
    for (const decision of [
      { ...recipe.advisoryDecisions[0]!, advisoryId: 'sdrf1_other' },
      { ...recipe.advisoryDecisions[0]!, inputFingerprint: 'sdra1_00000000' },
      { ...recipe.advisoryDecisions[0]!, selectionFingerprint: 'ckr1_00000000' },
    ]) {
      recipe.advisoryDecisions = [decision]
      assert.equal(
        evaluateStoryboardDirectorAdvisories(recipe).findings[0]!.advisory!.handling,
        'open',
      )
    }
  })
})
