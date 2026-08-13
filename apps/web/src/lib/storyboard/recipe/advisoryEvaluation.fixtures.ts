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
  caseId: StoryboardAdvisoryEvaluationCaseId
  recipe: StoryboardDirectorRecipe
  expectedCodes: readonly StoryboardAdvisoryEvaluationCode[]
  expectedSilence: boolean
}

export type StoryboardAdvisoryEvaluationCaseId =
  | 'all-signals'
  | 'narrative-only'
  | 'composition-only'
  | 'continuity-only'
  | 'lighting-only'
  | 'no-approved-stages'
  | 'no-real-evidence'
  | 'decision-scope-change'

export type StoryboardAdvisoryEvaluationCode =
  (typeof EXPECTED_CODES)[keyof typeof EXPECTED_CODES]

type FixtureSignals = {
  narrative?: boolean
  composition?: boolean
  continuity?: boolean
  lighting?: boolean
  approved?: boolean
  evidence?: boolean
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
): CreatorSkillEvidence {
  return {
    evidenceId,
    ruleId: 'owned-advisory-evaluation-rule',
    sourceNodeId: source.id,
    lineStart,
    lineEnd,
    excerpt: source.prompt,
    explanation: 'Owned synthetic evaluation evidence.',
  }
}

function evaluationRecipe(
  caseId: StoryboardAdvisoryEvaluationCaseId,
  signals: FixtureSignals,
): StoryboardDirectorRecipe {
  const sourceNode = sourceFor(caseId)
  const approved = signals.approved !== false
  const hasEvidence = signals.evidence !== false
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
    actionSummary: signals.narrative
      ? 'Avery must secure approval for the final animation pitch.'
      : 'Avery studies the storyboard at the worktable.',
    sourceText: signals.narrative
      ? `${sourceNode.prompt}\nAvery prepares the final animation pitch for approval.`
      : sourceNode.prompt,
    lineStart: 1,
    lineEnd: 2,
    reviewStatus: 'pending',
  }, decision)
  const beat = reviewItem<NarrativeBeatDraft>({
    beatId,
    sceneId,
    order: 1,
    type: signals.narrative ? 'reaction' : 'action',
    sourceText: signals.narrative
      ? 'The planned pitch is rejected, and Avery reacts to the sudden change in purpose.'
      : 'Avery studies the storyboard at the worktable.',
    summary: signals.narrative
      ? 'Avery reacts to the rejected pitch, shifting from presentation to recovery.'
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
      result: result(hasEvidence
        ? [evidence(sourceNode, `scene-evidence-${caseId}`, 1, 2)]
        : []),
      drafts: [scene],
      approvedArtifact: null,
      staleResult: null,
    },
    beat: {
      status: stageStatus,
      generation: 1,
      sourceFingerprint: `csf1_evaluation_${caseId}`,
      result: result(hasEvidence
        ? [evidence(sourceNode, `beat-evidence-${caseId}`, 2, 2)]
        : []),
      drafts: [beat],
      approvedArtifact: null,
      staleResult: null,
    },
    shot: {
      status: stageStatus,
      generation: 1,
      sourceFingerprint: `csf1_evaluation_${caseId}`,
      result: result(hasEvidence
        ? shots.map((shot) => evidence(sourceNode, `shot-evidence-${caseId}-${shot.order}`, 2, 2))
        : []),
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

export function allApprovedEvidenceIds(recipe: StoryboardDirectorRecipe): ReadonlySet<string> {
  const stages = [recipe.scene, recipe.beat, recipe.shot]
  return new Set(stages.flatMap((stage) => stage.result?.evidence.map((item) => item.evidenceId) ?? []))
}

function evaluationCase(
  caseId: StoryboardAdvisoryEvaluationCaseId,
  signals: FixtureSignals,
  expectedCodes: readonly StoryboardAdvisoryEvaluationCode[],
  expectedSilence = expectedCodes.length === 0,
): StoryboardAdvisoryEvaluationCase {
  return {
    caseId,
    recipe: evaluationRecipe(caseId, signals),
    expectedCodes,
    expectedSilence,
  }
}

export const STORYBOARD_ADVISORY_EVALUATION_CASES = Object.freeze([
  evaluationCase('all-signals', {
    narrative: true, composition: true, continuity: true, lighting: true,
  }, [
    EXPECTED_CODES.narrative,
    EXPECTED_CODES.composition,
    EXPECTED_CODES.continuity,
    EXPECTED_CODES.lighting,
  ]),
  evaluationCase('narrative-only', { narrative: true }, [EXPECTED_CODES.narrative]),
  evaluationCase('composition-only', { composition: true }, [EXPECTED_CODES.composition]),
  evaluationCase('continuity-only', { continuity: true }, [EXPECTED_CODES.continuity]),
  evaluationCase('lighting-only', { lighting: true }, [EXPECTED_CODES.lighting]),
  evaluationCase('no-approved-stages', {
      narrative: true, composition: true, continuity: true, lighting: true, approved: false,
  }, []),
  evaluationCase('no-real-evidence', {
    narrative: true, composition: true, continuity: true, lighting: true, evidence: false,
  }, []),
  evaluationCase('decision-scope-change', { narrative: true }, [EXPECTED_CODES.narrative]),
] satisfies readonly StoryboardAdvisoryEvaluationCase[])
