import type {
  CreatorSkillEvidence,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
  NarrativeBeatDraft,
  ScriptSceneDraft,
  ShotPlanDraft,
} from '../../skills'
import type {
  RecipeReviewItem,
  StoryboardDirectorRecipe,
  StoryboardDirectorStageStatus,
} from './types'

const CREATED_AT = '2026-08-13T00:00:00.000Z'
const EXPECTED_CODES = {
  narrative: 'LOCAL_NARRATIVE_PURPOSE_REVIEW',
  composition: 'LOCAL_COMPOSITION_HIERARCHY_REVIEW',
  continuity: 'LOCAL_CONTINUITY_CONFIRMATION',
  lighting: 'LOCAL_LIGHTING_MOTIVATION_REVIEW',
} as const

export type StoryboardAdvisoryEvaluationCase = {
  caseId: string
  recipe: StoryboardDirectorRecipe
  expectedCodes: string[]
}

type FixtureSignals = {
  narrative?: boolean
  composition?: boolean
  continuity?: boolean
  lighting?: boolean
  approved?: boolean
  realEvidence?: boolean
}

function sourceFor(caseId: string): CreatorSkillSourceNode {
  return {
    id: `evaluation-source-${caseId}`,
    kind: 'text',
    title: `Owned advisory evaluation ${caseId}`,
    prompt: 'INT. OWNED STUDIO - DAY\nAvery studies the storyboard at the worktable.',
  }
}

function reviewItem<T>(draft: T, decision: 'approved' | 'pending'): RecipeReviewItem<T> {
  return { ...draft, decision }
}

function result(evidence: CreatorSkillEvidence[]): CreatorSkillRunResult {
  return {
    skillId: 'owned-advisory-evaluation',
    skillVersion: '1.0.0',
    runFingerprint: 'csk1_owned_advisory_evaluation',
    status: 'ready',
    artifacts: [],
    evidence,
    warnings: [],
    blockers: [],
  }
}

function evidence(
  source: CreatorSkillSourceNode,
  evidenceId: string,
  lineStart: number,
  lineEnd: number,
  realEvidence: boolean,
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId: 'owned-advisory-evaluation-rule',
    sourceNodeId: realEvidence ? source.id : `${source.id}-unmatched`,
    lineStart,
    lineEnd,
    excerpt: source.prompt,
    explanation: 'Owned synthetic evaluation evidence.',
  }
}

function expectedCodes(signals: FixtureSignals): string[] {
  return [
    signals.narrative ? EXPECTED_CODES.narrative : null,
    signals.composition ? EXPECTED_CODES.composition : null,
    signals.continuity ? EXPECTED_CODES.continuity : null,
    signals.lighting ? EXPECTED_CODES.lighting : null,
  ].filter((code): code is string => Boolean(code))
}

function evaluationRecipe(caseId: string, signals: FixtureSignals): StoryboardDirectorRecipe {
  const sourceNode = sourceFor(caseId)
  const approved = signals.approved !== false
  const realEvidence = signals.realEvidence !== false
  const stageStatus: StoryboardDirectorStageStatus = approved ? 'approved' : 'needs-review'
  const decision = approved ? 'approved' : 'pending'
  const sceneId = `evaluation-scene-${caseId}`
  const beatId = `evaluation-beat-${caseId}`

  const scene = reviewItem<ScriptSceneDraft>({
    sceneId,
    order: 1,
    heading: signals.lighting ? 'INT. OWNED STUDIO - DAY' : 'INT. OWNED STUDIO',
    location: signals.lighting ? 'OWNED STUDIO' : undefined,
    timeOfDay: signals.lighting ? 'DAY' : undefined,
    characters: signals.composition ? ['Avery', 'Blake'] : ['Avery'],
    actionSummary: 'Avery studies the storyboard at the worktable.',
    sourceText: sourceNode.prompt,
    lineStart: 1,
    lineEnd: 2,
    reviewStatus: 'pending',
  }, decision)
  const beat = reviewItem<NarrativeBeatDraft>({
    beatId,
    sceneId,
    order: 1,
    type: signals.narrative ? 'reaction' : 'action',
    sourceText: 'Avery studies the storyboard at the worktable.',
    summary: signals.narrative
      ? 'Avery reacts to the storyboard decision.'
      : 'Avery studies the storyboard.',
    lineStart: 2,
    lineEnd: 2,
    reviewStatus: 'pending',
  }, decision)
  const shotCount = signals.continuity ? 2 : 1
  const shots = Array.from({ length: shotCount }, (_, index) => reviewItem<ShotPlanDraft>({
    shotId: `evaluation-shot-${caseId}-${index + 1}`,
    sceneId,
    beatId,
    order: index + 1,
    objective: 'Show Avery considering the board.',
    subject: 'Avery',
    action: index === 0 ? 'Avery studies the board.' : 'Avery continues studying the board.',
    suggestedShotSize: index === 0 ? 'medium' : 'close',
    sourceText: 'Avery studies the storyboard at the worktable.',
    lineStart: 2,
    lineEnd: 2,
    outputKind: 'image',
    duration: 5,
    reviewStatus: 'pending',
  }, decision))

  return {
    schemaVersion: 3,
    recipeId: `sdr1_evaluation_${caseId}`,
    projectId: 'owned-advisory-evaluation-project',
    workflowId: 'owned-advisory-evaluation-workflow',
    sourceNode,
    sourceFingerprint: `csf1_evaluation_${caseId}`,
    activeStage: 'shot-review',
    scene: {
      status: stageStatus,
      generation: 1,
      sourceFingerprint: `csf1_evaluation_${caseId}`,
      result: result([evidence(sourceNode, `scene-evidence-${caseId}`, 1, 2, realEvidence)]),
      drafts: [scene],
      approvedArtifact: null,
      staleResult: null,
    },
    beat: {
      status: stageStatus,
      generation: 1,
      sourceFingerprint: `csf1_evaluation_${caseId}`,
      result: result([evidence(sourceNode, `beat-evidence-${caseId}`, 2, 2, realEvidence)]),
      drafts: [beat],
      approvedArtifact: null,
      staleResult: null,
    },
    shot: {
      status: stageStatus,
      generation: 1,
      sourceFingerprint: `csf1_evaluation_${caseId}`,
      result: result(shots.map((shot) => (
        evidence(sourceNode, `shot-evidence-${caseId}-${shot.order}`, 2, 2, realEvidence)
      ))),
      drafts: shots,
      approvedArtifact: null,
      staleResult: null,
      options: {
        requestedShotCount: shotCount,
        outputMode: 'image',
        pacing: 'standard',
        shotSizeStrategy: 'auto',
        userInstruction: '',
      },
    },
    findings: [],
    advisoryDecisions: [],
    storyboard: { version: '1', shots: [], updatedAt: CREATED_AT },
    receipts: [],
    sketchBoard: null,
    legacyImportStatus: 'not-offered',
    audit: { createdAt: CREATED_AT, updatedAt: CREATED_AT },
  }
}

export function allApprovedEvidenceIds(recipe: StoryboardDirectorRecipe): string[] {
  const stages = [recipe.scene, recipe.beat, recipe.shot]
  return [...new Set(stages.flatMap((stage) => (
    stage.status === 'approved' ? stage.result?.evidence.map((item) => item.evidenceId) ?? [] : []
  )))].sort()
}

export const STORYBOARD_ADVISORY_EVALUATION_CASES: readonly StoryboardAdvisoryEvaluationCase[] = [
  {
    caseId: 'all-signals',
    recipe: evaluationRecipe('all-signals', {
      narrative: true, composition: true, continuity: true, lighting: true,
    }),
    expectedCodes: expectedCodes({ narrative: true, composition: true, continuity: true, lighting: true }),
  },
  {
    caseId: 'narrative-only',
    recipe: evaluationRecipe('narrative-only', { narrative: true }),
    expectedCodes: expectedCodes({ narrative: true }),
  },
  {
    caseId: 'composition-only',
    recipe: evaluationRecipe('composition-only', { composition: true }),
    expectedCodes: expectedCodes({ composition: true }),
  },
  {
    caseId: 'continuity-only',
    recipe: evaluationRecipe('continuity-only', { continuity: true }),
    expectedCodes: expectedCodes({ continuity: true }),
  },
  {
    caseId: 'lighting-only',
    recipe: evaluationRecipe('lighting-only', { lighting: true }),
    expectedCodes: expectedCodes({ lighting: true }),
  },
  {
    caseId: 'no-approved-stages',
    recipe: evaluationRecipe('no-approved-stages', {
      narrative: true, composition: true, continuity: true, lighting: true, approved: false,
    }),
    expectedCodes: [],
  },
  {
    caseId: 'no-real-evidence',
    recipe: evaluationRecipe('no-real-evidence', {
      narrative: true, composition: true, continuity: true, lighting: true, realEvidence: false,
    }),
    expectedCodes: [],
  },
  {
    caseId: 'decision-scope-change',
    recipe: evaluationRecipe('decision-scope-change', { narrative: true }),
    expectedCodes: expectedCodes({ narrative: true }),
  },
]
