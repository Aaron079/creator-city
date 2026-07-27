import type {
  CreatorSkillArtifact,
  CreatorSkillReviewStatus,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
  ScriptSceneDraft,
  NarrativeBeatDraft,
  ShotPlanDraft,
  ShotPlanningOptions,
} from '../../skills'
import type { StoryboardState } from '../types'

export const STORYBOARD_DIRECTOR_RECIPE_VERSION = 1 as const
export const STORYBOARD_DIRECTOR_RECIPE_SKILL_VERSION = '1.0.0' as const
export const STORYBOARD_DIRECTOR_MAX_RECEIPTS = 360

export type StoryboardDirectorStageId =
  | 'source'
  | 'scene-review'
  | 'beat-review'
  | 'shot-review'

export type StoryboardDirectorStageStatus =
  | 'idle'
  | 'running'
  | 'needs-review'
  | 'approved'
  | 'stale'
  | 'blocked'

export type RecipeReviewItem<T> = T & {
  decision: CreatorSkillReviewStatus
}

export type StoryboardDirectorStage<T> = {
  status: StoryboardDirectorStageStatus
  generation: number
  sourceFingerprint: string
  result: CreatorSkillRunResult | null
  drafts: T[]
  approvedArtifact: CreatorSkillArtifact | null
  staleResult: CreatorSkillRunResult | null
}

export type StoryboardDirectorPartialBatchOperation =
  | 'grouped-materialization'
  | 'draft-node-creation'

export type StoryboardDirectorPartialBatch = {
  batchId: string
  operation: StoryboardDirectorPartialBatchOperation
  plannedCount: number
  createdCount: number
  uncreatedCount: number
  plannedIdentities: string[]
  successfulTargetIds: string[]
}

export type StoryboardDirectorFinding = {
  findingId: string
  severity: 'blocking' | 'advisory'
  code: string
  message: string
  sceneId?: string
  beatId?: string
  shotId?: string
  partialBatch?: StoryboardDirectorPartialBatch
  evidenceIds: string[]
}

export type StoryboardDirectorMaterializationReceipt = {
  identity: string
  kind: 'scene' | 'beat' | 'shot-plan' | 'shot-card' | 'draft-node'
  resultId: string
  targetId: string
}

export type StoryboardDirectorRecipe = {
  schemaVersion: typeof STORYBOARD_DIRECTOR_RECIPE_VERSION
  recipeId: string
  projectId: string
  workflowId: string
  sourceNode: CreatorSkillSourceNode
  sourceFingerprint: string
  activeStage: StoryboardDirectorStageId
  scene: StoryboardDirectorStage<RecipeReviewItem<ScriptSceneDraft>>
  beat: StoryboardDirectorStage<RecipeReviewItem<NarrativeBeatDraft>>
  shot: StoryboardDirectorStage<RecipeReviewItem<ShotPlanDraft>> & {
    options: ShotPlanningOptions
  }
  findings: StoryboardDirectorFinding[]
  storyboard: StoryboardState
  receipts: StoryboardDirectorMaterializationReceipt[]
  legacyImportStatus: 'not-offered' | 'available' | 'imported' | 'dismissed'
  audit: { createdAt: string; updatedAt: string }
}
