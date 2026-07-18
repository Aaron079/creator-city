import {
  isCreatorSkillArtifact,
  runCreatorSkill,
  type CreatorSkillArtifact,
  type CreatorSkillReviewStatus,
  type CreatorSkillRunResult,
  type CreatorSkillSourceNode,
  type NarrativeBeatDraft,
  type NarrativeBeatMapPayload,
  type NarrativeBeatType,
  type PlannedShotSize,
  type SceneBreakdownPayload,
  type ScriptSceneDraft,
  type ShotOutputKind,
  type ShotPlanDraft,
  type ShotPlanningOptions,
  type ShotPlanPayload,
} from '../../skills'
import { createStoryboardDirectorRecipeIdentity } from './identity'
import {
  STORYBOARD_DIRECTOR_RECIPE_VERSION,
  type RecipeReviewItem,
  type StoryboardDirectorRecipe,
  type StoryboardDirectorStage,
  type StoryboardDirectorStageId,
} from './types'

type ReviewStageId = Exclude<StoryboardDirectorStageId, 'source'>
type AnyReviewDraft = RecipeReviewItem<ScriptSceneDraft>
  | RecipeReviewItem<NarrativeBeatDraft>
  | RecipeReviewItem<ShotPlanDraft>

export type StoryboardRecipeSkillRunner = typeof runCreatorSkill

export type StoryboardRecipeOperationToken = {
  recipeId: string
  sourceFingerprint: string
  stageId: StoryboardDirectorStageId
  runFingerprint: string
  generation: number
}

export const DEFAULT_SHOT_PLANNING_OPTIONS: ShotPlanningOptions = {
  requestedShotCount: 5,
  outputMode: 'mixed',
  pacing: 'standard',
  shotSizeStrategy: 'auto',
  userInstruction: '',
}

const EDITABLE_FIELDS = {
  'scene-review': new Set(['heading', 'location', 'timeOfDay', 'characters', 'actionSummary']),
  'beat-review': new Set(['summary', 'type']),
  'shot-review': new Set([
    'objective',
    'subject',
    'action',
    'suggestedShotSize',
    'outputKind',
    'duration',
  ]),
} as const

const BEAT_TYPES = new Set<NarrativeBeatType>([
  'setup',
  'goal',
  'action',
  'reaction',
  'turn',
  'closure',
  'unclassified',
])
const SHOT_SIZES = new Set<PlannedShotSize>([
  'wide',
  'full',
  'medium',
  'close',
  'extreme-close',
])
const SHOT_OUTPUT_KINDS = new Set<ShotOutputKind>(['image', 'video'])

function emptyStage<T>(sourceFingerprint: string): StoryboardDirectorStage<T> {
  return {
    status: 'idle',
    generation: 0,
    sourceFingerprint,
    result: null,
    drafts: [],
    approvedArtifact: null,
    staleResult: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && value === value.trim()
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

function isLineRange(value: Record<string, unknown>) {
  return isPositiveInteger(value.lineStart)
    && isPositiveInteger(value.lineEnd)
    && value.lineEnd >= value.lineStart
}

function readScene(value: unknown): ScriptSceneDraft | null {
  if (!isRecord(value)
    || !isIdentifier(value.sceneId)
    || !isPositiveInteger(value.order)
    || typeof value.heading !== 'string'
    || !Array.isArray(value.characters)
    || !value.characters.every((character) => typeof character === 'string')
    || typeof value.actionSummary !== 'string'
    || typeof value.sourceText !== 'string'
    || !isLineRange(value)
    || value.reviewStatus !== 'pending'
    || (value.location !== undefined && typeof value.location !== 'string')
    || (value.timeOfDay !== undefined && typeof value.timeOfDay !== 'string')) {
    return null
  }
  return {
    sceneId: value.sceneId,
    order: value.order,
    heading: value.heading,
    ...(value.location !== undefined ? { location: value.location } : {}),
    ...(value.timeOfDay !== undefined ? { timeOfDay: value.timeOfDay } : {}),
    characters: value.characters.slice(),
    actionSummary: value.actionSummary,
    sourceText: value.sourceText,
    lineStart: value.lineStart as number,
    lineEnd: value.lineEnd as number,
    reviewStatus: 'pending',
  }
}

function readScenePayload(value: unknown): SceneBreakdownPayload | null {
  if (!isRecord(value)
    || (value.format !== 'headed-script' && value.format !== 'paragraph-fallback')
    || !Array.isArray(value.scenes)
    || value.scenes.length === 0) {
    return null
  }
  const scenes: ScriptSceneDraft[] = []
  for (const valueScene of value.scenes) {
    const scene = readScene(valueScene)
    if (!scene) return null
    scenes.push(scene)
  }
  return { format: value.format, scenes }
}

function readBeat(value: unknown): NarrativeBeatDraft | null {
  if (!isRecord(value)
    || !isIdentifier(value.beatId)
    || !isIdentifier(value.sceneId)
    || !isPositiveInteger(value.order)
    || !BEAT_TYPES.has(value.type as NarrativeBeatType)
    || typeof value.sourceText !== 'string'
    || typeof value.summary !== 'string'
    || !isLineRange(value)
    || value.reviewStatus !== 'pending'
    || (value.needsReviewReason !== undefined
      && typeof value.needsReviewReason !== 'string')) {
    return null
  }
  return {
    beatId: value.beatId,
    sceneId: value.sceneId,
    order: value.order,
    type: value.type as NarrativeBeatType,
    sourceText: value.sourceText,
    summary: value.summary,
    lineStart: value.lineStart as number,
    lineEnd: value.lineEnd as number,
    reviewStatus: 'pending',
    ...(value.needsReviewReason !== undefined
      ? { needsReviewReason: value.needsReviewReason }
      : {}),
  }
}

function readBeatPayload(value: unknown): NarrativeBeatMapPayload | null {
  if (!isRecord(value) || !Array.isArray(value.scenes) || value.scenes.length === 0) return null
  const scenes: NarrativeBeatMapPayload['scenes'] = []
  for (const valueScene of value.scenes) {
    if (!isRecord(valueScene)
      || !isIdentifier(valueScene.sceneId)
      || !isPositiveInteger(valueScene.order)
      || typeof valueScene.heading !== 'string'
      || !Array.isArray(valueScene.beats)
      || valueScene.beats.length === 0) {
      return null
    }
    const beats: NarrativeBeatDraft[] = []
    for (const valueBeat of valueScene.beats) {
      const beat = readBeat(valueBeat)
      if (!beat || beat.sceneId !== valueScene.sceneId) return null
      beats.push(beat)
    }
    scenes.push({
      sceneId: valueScene.sceneId,
      order: valueScene.order,
      heading: valueScene.heading,
      beats,
    })
  }
  return { scenes }
}

function readShot(value: unknown): ShotPlanDraft | null {
  if (!isRecord(value)
    || !isIdentifier(value.shotId)
    || !isIdentifier(value.sceneId)
    || (value.beatId !== undefined && !isIdentifier(value.beatId))
    || !isPositiveInteger(value.order)
    || typeof value.objective !== 'string'
    || typeof value.subject !== 'string'
    || typeof value.action !== 'string'
    || !SHOT_SIZES.has(value.suggestedShotSize as PlannedShotSize)
    || typeof value.sourceText !== 'string'
    || !isLineRange(value)
    || !SHOT_OUTPUT_KINDS.has(value.outputKind as ShotOutputKind)
    || (value.duration !== 5 && value.duration !== 10)
    || value.reviewStatus !== 'pending'
    || (value.needsReviewReason !== undefined
      && typeof value.needsReviewReason !== 'string')) {
    return null
  }
  return {
    shotId: value.shotId,
    sceneId: value.sceneId,
    ...(value.beatId !== undefined ? { beatId: value.beatId } : {}),
    order: value.order,
    objective: value.objective,
    subject: value.subject,
    action: value.action,
    suggestedShotSize: value.suggestedShotSize as PlannedShotSize,
    sourceText: value.sourceText,
    lineStart: value.lineStart as number,
    lineEnd: value.lineEnd as number,
    outputKind: value.outputKind as ShotOutputKind,
    duration: value.duration,
    reviewStatus: 'pending',
    ...(value.needsReviewReason !== undefined
      ? { needsReviewReason: value.needsReviewReason }
      : {}),
  }
}

function readShotPayload(value: unknown): ShotPlanPayload | null {
  if (!isRecord(value) || !Array.isArray(value.scenes) || value.scenes.length === 0) return null
  const scenes: ShotPlanPayload['scenes'] = []
  for (const valueScene of value.scenes) {
    if (!isRecord(valueScene)
      || !isIdentifier(valueScene.sceneId)
      || !isPositiveInteger(valueScene.order)
      || typeof valueScene.heading !== 'string'
      || !Array.isArray(valueScene.shots)
      || valueScene.shots.length === 0) {
      return null
    }
    const shots: ShotPlanDraft[] = []
    for (const valueShot of valueScene.shots) {
      const shot = readShot(valueShot)
      if (!shot || shot.sceneId !== valueScene.sceneId) return null
      shots.push(shot)
    }
    scenes.push({
      sceneId: valueScene.sceneId,
      order: valueScene.order,
      heading: valueScene.heading,
      shots,
    })
  }
  return { scenes }
}

function requireSingleArtifact(
  result: CreatorSkillRunResult,
  artifactType: string,
): CreatorSkillArtifact | null {
  if (result.status === 'blocked'
    || result.artifacts.length !== 1
    || !isCreatorSkillArtifact(result.artifacts[0])
    || result.artifacts[0]?.artifactType !== artifactType
    || result.artifacts[0].artifactVersion !== 1
    || result.artifacts[0].sourceNodeIds.length !== 1) {
    return null
  }
  return result.artifacts[0]
}

function stageFromSceneResult(
  result: CreatorSkillRunResult,
  artifact: CreatorSkillArtifact | null,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorStage<RecipeReviewItem<ScriptSceneDraft>> {
  const payload = artifact ? readScenePayload(artifact.payload) : null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result,
    drafts: payload
      ? payload.scenes.map((scene) => ({ ...scene, characters: scene.characters.slice(), decision: 'pending' }))
      : [],
    approvedArtifact: null,
    staleResult,
  }
}

function stageFromBeatResult(
  result: CreatorSkillRunResult,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorStage<RecipeReviewItem<NarrativeBeatDraft>> {
  const artifact = requireSingleArtifact(result, 'narrative-beat-map')
  const payload = artifact ? readBeatPayload(artifact.payload) : null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result,
    drafts: payload
      ? payload.scenes.flatMap((scene) => scene.beats.map((beat) => ({ ...beat, decision: 'pending' })))
      : [],
    approvedArtifact: null,
    staleResult,
  }
}

function stageFromShotResult(
  result: CreatorSkillRunResult,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorRecipe['shot'] {
  const artifact = requireSingleArtifact(result, 'shot-plan')
  const payload = artifact ? readShotPayload(artifact.payload) : null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result,
    drafts: payload
      ? payload.scenes.flatMap((scene) => scene.shots.map((shot) => ({ ...shot, decision: 'pending' })))
      : [],
    approvedArtifact: null,
    staleResult,
    options: { ...DEFAULT_SHOT_PLANNING_OPTIONS },
  }
}

export function createStoryboardDirectorRecipe(
  context: { projectId: string; workflowId: string },
  source: CreatorSkillSourceNode,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
): StoryboardDirectorRecipe {
  const identity = createStoryboardDirectorRecipeIdentity(context, source)
  const sourceNode = {
    id: source.id,
    kind: 'text' as const,
    title: source.title,
    prompt: identity.sourceText,
  }
  const sceneResult = runner('script-segmentation', {
    sourceNodes: [sourceNode],
    projectContext: context,
  })
  const sceneArtifact = requireSingleArtifact(sceneResult, 'scene-breakdown')
  return {
    schemaVersion: STORYBOARD_DIRECTOR_RECIPE_VERSION,
    recipeId: identity.recipeId,
    projectId: context.projectId,
    workflowId: context.workflowId,
    sourceNode,
    sourceFingerprint: identity.sourceFingerprint,
    activeStage: 'scene-review',
    scene: stageFromSceneResult(
      sceneResult,
      sceneArtifact,
      identity.sourceFingerprint,
    ),
    beat: emptyStage(identity.sourceFingerprint),
    shot: {
      ...emptyStage(identity.sourceFingerprint),
      options: { ...DEFAULT_SHOT_PLANNING_OPTIONS },
    },
    findings: [],
    storyboard: { version: '2', shots: [], updatedAt: now },
    receipts: [],
    legacyImportStatus: 'not-offered',
    audit: { createdAt: now, updatedAt: now },
  }
}

function stageForReviewId(recipe: StoryboardDirectorRecipe, stageId: ReviewStageId) {
  if (stageId === 'scene-review') return recipe.scene
  if (stageId === 'beat-review') return recipe.beat
  return recipe.shot
}

function stageForId(recipe: StoryboardDirectorRecipe, stageId: StoryboardDirectorStageId) {
  return stageId === 'source' ? recipe.scene : stageForReviewId(recipe, stageId)
}

function assertRecipeSourceCurrent(recipe: StoryboardDirectorRecipe) {
  if (recipe.activeStage === 'source') {
    throw new TypeError('Recipe source is stale')
  }
}

function draftId(stageId: ReviewStageId, draft: Record<string, unknown>) {
  if (stageId === 'scene-review') return draft.sceneId
  if (stageId === 'beat-review') return draft.beatId
  return draft.shotId
}

function stageWithDrafts(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  drafts: AnyReviewDraft[],
) {
  if (stageId === 'scene-review') {
    return {
      ...recipe,
      scene: {
        ...recipe.scene,
        status: 'needs-review' as const,
        approvedArtifact: null,
        drafts: drafts as StoryboardDirectorRecipe['scene']['drafts'],
      },
    }
  }
  if (stageId === 'beat-review') {
    return {
      ...recipe,
      beat: {
        ...recipe.beat,
        status: 'needs-review' as const,
        approvedArtifact: null,
        drafts: drafts as StoryboardDirectorRecipe['beat']['drafts'],
      },
    }
  }
  return {
    ...recipe,
    shot: {
      ...recipe.shot,
      status: 'needs-review' as const,
      approvedArtifact: null,
      drafts: drafts as StoryboardDirectorRecipe['shot']['drafts'],
    },
  }
}

function staleStage<T extends StoryboardDirectorStage<unknown>>(stage: T, force = false): T {
  const hasReviewData = Boolean(
    stage.result
    || stage.staleResult
    || stage.approvedArtifact
    || stage.drafts.length > 0,
  )
  if (!force && !hasReviewData) return stage
  return {
    ...stage,
    status: 'stale',
    result: null,
    staleResult: stage.result ?? stage.staleResult,
  }
}

export function invalidateRecipeAfter(
  recipe: StoryboardDirectorRecipe,
  stageId: StoryboardDirectorStageId,
  now: string,
): StoryboardDirectorRecipe {
  if (stageId === 'source') {
    return {
      ...recipe,
      activeStage: 'source',
      scene: staleStage(recipe.scene, true),
      beat: staleStage(recipe.beat, true),
      shot: staleStage(recipe.shot, true),
      audit: { ...recipe.audit, updatedAt: now },
    }
  }
  if (stageId === 'scene-review') {
    return {
      ...recipe,
      activeStage: 'scene-review',
      beat: staleStage(recipe.beat),
      shot: staleStage(recipe.shot),
      audit: { ...recipe.audit, updatedAt: now },
    }
  }
  if (stageId === 'beat-review') {
    return {
      ...recipe,
      activeStage: 'beat-review',
      shot: staleStage(recipe.shot),
      audit: { ...recipe.audit, updatedAt: now },
    }
  }
  return {
    ...recipe,
    activeStage: 'shot-review',
    audit: { ...recipe.audit, updatedAt: now },
  }
}

function finishReviewChange(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  drafts: AnyReviewDraft[],
  now: string,
) {
  return invalidateRecipeAfter(stageWithDrafts(recipe, stageId, drafts), stageId, now)
}

export function setRecipeDecision(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  itemId: string,
  decision: CreatorSkillReviewStatus,
  now: string,
): StoryboardDirectorRecipe {
  assertRecipeSourceCurrent(recipe)
  if (!['pending', 'approved', 'rejected'].includes(decision)) {
    throw new TypeError('Recipe decision is invalid')
  }
  const stage = stageForReviewId(recipe, stageId)
  let found = false
  let changed = false
  const drafts = stage.drafts.map((draft) => {
    if (draftId(stageId, draft as unknown as Record<string, unknown>) !== itemId) return draft
    found = true
    if (draft.decision === decision) return draft
    changed = true
    return { ...draft, decision }
  })
  if (!found) throw new TypeError(`Recipe review item not found: ${itemId}`)
  if (!changed) return recipe
  return finishReviewChange(recipe, stageId, drafts, now)
}

function validateEditableValue(stageId: ReviewStageId, field: string, value: unknown) {
  if (stageId === 'scene-review') {
    if (field === 'characters') {
      if (!Array.isArray(value) || !value.every((character) => typeof character === 'string')) {
        throw new TypeError('Scene characters must be an array of strings')
      }
      return value.slice()
    }
    if ((field === 'location' || field === 'timeOfDay') && value === undefined) return undefined
    if (typeof value !== 'string') throw new TypeError(`Scene ${field} must be a string`)
    return value
  }
  if (stageId === 'beat-review') {
    if (field === 'type') {
      if (!BEAT_TYPES.has(value as NarrativeBeatType)) {
        throw new TypeError('Beat type is invalid')
      }
      return value
    }
    if (typeof value !== 'string') throw new TypeError('Beat summary must be a string')
    return value
  }
  if (field === 'suggestedShotSize') {
    if (!SHOT_SIZES.has(value as PlannedShotSize)) throw new TypeError('Shot size is invalid')
    return value
  }
  if (field === 'outputKind') {
    if (!SHOT_OUTPUT_KINDS.has(value as ShotOutputKind)) throw new TypeError('Shot output kind is invalid')
    return value
  }
  if (field === 'duration') {
    if (value !== 5 && value !== 10) throw new TypeError('Shot duration must be 5 or 10')
    return value
  }
  if (typeof value !== 'string') throw new TypeError(`Shot ${field} must be a string`)
  return value
}

export function updateRecipeDraft(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  itemId: string,
  patch: Record<string, unknown>,
  now: string,
): StoryboardDirectorRecipe {
  assertRecipeSourceCurrent(recipe)
  if (!isRecord(patch)) throw new TypeError('Recipe patch must be an object')
  const keys = Object.keys(patch)
  for (const key of keys) {
    if (!EDITABLE_FIELDS[stageId].has(key as never)) {
      throw new TypeError(`${key} is immutable or not editable for ${stageId}`)
    }
  }
  const validatedPatch = Object.fromEntries(
    keys.map((key) => [key, validateEditableValue(stageId, key, patch[key])]),
  )
  const stage = stageForReviewId(recipe, stageId)
  let found = false
  let changed = false
  const drafts = stage.drafts.map((draft) => {
    if (draftId(stageId, draft as unknown as Record<string, unknown>) !== itemId) return draft
    found = true
    const next = { ...draft } as Record<string, unknown>
    for (const key of keys) {
      const value = validatedPatch[key]
      if (value === undefined) delete next[key]
      else next[key] = value
    }
    if (keys.every((key) => {
      const left = (draft as unknown as Record<string, unknown>)[key]
      const right = next[key]
      return Array.isArray(left) && Array.isArray(right)
        ? left.length === right.length && left.every((item, index) => item === right[index])
        : left === right
    })) {
      return draft
    }
    changed = true
    return next as unknown as typeof draft
  })
  if (!found) throw new TypeError(`Recipe review item not found: ${itemId}`)
  if (!changed) return recipe
  return finishReviewChange(recipe, stageId, drafts, now)
}

export function moveRecipeDraft(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  itemId: string,
  direction: -1 | 1,
  now: string,
): StoryboardDirectorRecipe {
  assertRecipeSourceCurrent(recipe)
  if (direction !== -1 && direction !== 1) throw new TypeError('Recipe move direction is invalid')
  const stage = stageForReviewId(recipe, stageId)
  const index = stage.drafts.findIndex(
    (draft) => draftId(stageId, draft as unknown as Record<string, unknown>) === itemId,
  )
  if (index === -1) throw new TypeError(`Recipe review item not found: ${itemId}`)
  const target = index + direction
  if (target < 0 || target >= stage.drafts.length) return recipe
  if (stageId !== 'scene-review'
    && stage.drafts[index]!.sceneId !== stage.drafts[target]!.sceneId) {
    return recipe
  }
  const drafts = stage.drafts.slice()
  const current = drafts[index]!
  drafts[index] = drafts[target]!
  drafts[target] = current
  return finishReviewChange(recipe, stageId, drafts, now)
}

function approvedArtifactId(type: string, sourceArtifactId: string) {
  return `${type}-${sourceArtifactId}-recipe-approved`
}

function assertApprovable<T>(
  recipe: StoryboardDirectorRecipe,
  stage: StoryboardDirectorStage<RecipeReviewItem<T>>,
  artifactType: string,
) {
  assertRecipeSourceCurrent(recipe)
  if (stage.status === 'blocked' || stage.result?.status === 'blocked') {
    throw new TypeError('Blocked Recipe stage cannot be approved')
  }
  if (stage.status === 'stale'
    || stage.sourceFingerprint !== recipe.sourceFingerprint
    || !stage.result) {
    throw new TypeError('Recipe stage source fingerprint is stale')
  }
  const artifact = requireSingleArtifact(stage.result, artifactType)
  if (!artifact) throw new TypeError('Recipe stage result is malformed or blocked')
  if (stage.drafts.some((draft) => draft.decision === 'pending')) {
    throw new TypeError('Recipe stage has unresolved decisions')
  }
  if (!stage.drafts.some((draft) => draft.decision === 'approved')) {
    throw new TypeError('Recipe stage requires at least one approved item')
  }
  return artifact
}

function sceneCheckpoint(
  recipe: StoryboardDirectorRecipe,
): CreatorSkillArtifact<SceneBreakdownPayload> {
  const sourceArtifact = assertApprovable(recipe, recipe.scene, 'scene-breakdown')
  const sourcePayload = readScenePayload(sourceArtifact.payload)
  if (!sourcePayload) throw new TypeError('Recipe scene result is malformed')
  const scenes = recipe.scene.drafts
    .filter((scene) => scene.decision === 'approved')
    .map(({ decision: _decision, ...scene }) => ({
      ...scene,
      characters: scene.characters.slice(),
      reviewStatus: 'pending' as const,
    }))
  return {
    artifactId: approvedArtifactId('scene-breakdown', sourceArtifact.artifactId),
    artifactType: 'scene-breakdown',
    artifactVersion: 1,
    sourceNodeIds: sourceArtifact.sourceNodeIds.slice(),
    sourceArtifactIds: [sourceArtifact.artifactId],
    payload: { format: sourcePayload.format, scenes },
  }
}

function beatCheckpoint(
  recipe: StoryboardDirectorRecipe,
): CreatorSkillArtifact<NarrativeBeatMapPayload> {
  const sourceArtifact = assertApprovable(recipe, recipe.beat, 'narrative-beat-map')
  const sourcePayload = readBeatPayload(sourceArtifact.payload)
  if (!sourcePayload) throw new TypeError('Recipe beat result is malformed')
  const sourceScenes = new Map(sourcePayload.scenes.map((scene) => [scene.sceneId, scene]))
  const scenes: NarrativeBeatMapPayload['scenes'] = []
  const byScene = new Map<string, NarrativeBeatMapPayload['scenes'][number]>()
  for (const { decision, ...beat } of recipe.beat.drafts) {
    if (decision !== 'approved') continue
    const sourceScene = sourceScenes.get(beat.sceneId)
    if (!sourceScene) throw new TypeError('Approved beat references an unknown scene')
    let scene = byScene.get(beat.sceneId)
    if (!scene) {
      scene = {
        sceneId: sourceScene.sceneId,
        order: sourceScene.order,
        heading: sourceScene.heading,
        beats: [],
      }
      byScene.set(beat.sceneId, scene)
      scenes.push(scene)
    }
    scene.beats.push({ ...beat, reviewStatus: 'pending' })
  }
  return {
    artifactId: approvedArtifactId('narrative-beat-map', sourceArtifact.artifactId),
    artifactType: 'narrative-beat-map',
    artifactVersion: 1,
    sourceNodeIds: sourceArtifact.sourceNodeIds.slice(),
    sourceArtifactIds: [sourceArtifact.artifactId],
    payload: { scenes },
  }
}

function shotCheckpoint(
  recipe: StoryboardDirectorRecipe,
): CreatorSkillArtifact<ShotPlanPayload> {
  const sourceArtifact = assertApprovable(recipe, recipe.shot, 'shot-plan')
  const sourcePayload = readShotPayload(sourceArtifact.payload)
  if (!sourcePayload) throw new TypeError('Recipe shot result is malformed')
  const sourceScenes = new Map(sourcePayload.scenes.map((scene) => [scene.sceneId, scene]))
  const scenes: ShotPlanPayload['scenes'] = []
  const byScene = new Map<string, ShotPlanPayload['scenes'][number]>()
  for (const { decision, ...shot } of recipe.shot.drafts) {
    if (decision !== 'approved') continue
    const sourceScene = sourceScenes.get(shot.sceneId)
    if (!sourceScene) throw new TypeError('Approved shot references an unknown scene')
    let scene = byScene.get(shot.sceneId)
    if (!scene) {
      scene = {
        sceneId: sourceScene.sceneId,
        order: sourceScene.order,
        heading: sourceScene.heading,
        shots: [],
      }
      byScene.set(shot.sceneId, scene)
      scenes.push(scene)
    }
    scene.shots.push({ ...shot, reviewStatus: 'pending' })
  }
  return {
    artifactId: approvedArtifactId('shot-plan', sourceArtifact.artifactId),
    artifactType: 'shot-plan',
    artifactVersion: 1,
    sourceNodeIds: sourceArtifact.sourceNodeIds.slice(),
    sourceArtifactIds: [sourceArtifact.artifactId],
    payload: { scenes },
  }
}

function replacementGeneration(stage: StoryboardDirectorStage<unknown>) {
  return stage.result || stage.staleResult || stage.approvedArtifact || stage.drafts.length > 0
    ? stage.generation + 1
    : stage.generation
}

export function approveSceneStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
): StoryboardDirectorRecipe {
  const approvedArtifact = sceneCheckpoint(recipe)
  const result = runner('narrative-beat-analysis', {
    sourceNodes: [],
    artifacts: [approvedArtifact],
    projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
  })
  const beat = stageFromBeatResult(
    result,
    recipe.sourceFingerprint,
    replacementGeneration(recipe.beat),
    recipe.beat.result ?? recipe.beat.staleResult,
  )
  return {
    ...recipe,
    activeStage: 'beat-review',
    scene: { ...recipe.scene, status: 'approved', approvedArtifact },
    beat,
    shot: staleStage(recipe.shot),
    audit: { ...recipe.audit, updatedAt: now },
  }
}

export function approveBeatStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
): StoryboardDirectorRecipe {
  const approvedArtifact = beatCheckpoint(recipe)
  const result = runner('shot-planning', {
    sourceNodes: [],
    artifacts: [approvedArtifact],
    projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
    options: recipe.shot.options,
  })
  const shot = stageFromShotResult(
    result,
    recipe.sourceFingerprint,
    replacementGeneration(recipe.shot),
    recipe.shot.result ?? recipe.shot.staleResult,
  )
  shot.options = { ...recipe.shot.options }
  return {
    ...recipe,
    activeStage: 'shot-review',
    beat: { ...recipe.beat, status: 'approved', approvedArtifact },
    shot,
    audit: { ...recipe.audit, updatedAt: now },
  }
}

export function approveShotStage(
  recipe: StoryboardDirectorRecipe,
  now: string,
): StoryboardDirectorRecipe {
  const approvedArtifact = shotCheckpoint(recipe)
  return {
    ...recipe,
    activeStage: 'shot-review',
    shot: { ...recipe.shot, status: 'approved', approvedArtifact },
    audit: { ...recipe.audit, updatedAt: now },
  }
}

function clearFindingsForStage(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
) {
  if (stageId === 'scene-review') {
    return recipe.findings.filter((finding) => (
      !finding.sceneId && !finding.beatId && !finding.shotId
    ))
  }
  if (stageId === 'beat-review') {
    return recipe.findings.filter((finding) => !finding.beatId && !finding.shotId)
  }
  return recipe.findings.filter((finding) => !finding.shotId)
}

export function rerunRecipeStage(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  now: string,
  runner: StoryboardRecipeSkillRunner = runCreatorSkill,
): StoryboardDirectorRecipe {
  assertRecipeSourceCurrent(recipe)
  if (stageId === 'scene-review') {
    const result = runner('script-segmentation', {
      sourceNodes: [recipe.sourceNode],
      projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
    })
    const next = invalidateRecipeAfter(recipe, stageId, now)
    return {
      ...next,
      scene: stageFromSceneResult(
        result,
        requireSingleArtifact(result, 'scene-breakdown'),
        recipe.sourceFingerprint,
        recipe.scene.generation + 1,
        recipe.scene.result ?? recipe.scene.staleResult,
      ),
      findings: clearFindingsForStage(recipe, stageId),
    }
  }
  if (stageId === 'beat-review') {
    if (!recipe.scene.approvedArtifact || recipe.scene.status !== 'approved') {
      throw new TypeError('Beat rerun requires the approved scene Artifact')
    }
    const result = runner('narrative-beat-analysis', {
      sourceNodes: [],
      artifacts: [recipe.scene.approvedArtifact],
      projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
    })
    const next = invalidateRecipeAfter(recipe, stageId, now)
    return {
      ...next,
      beat: stageFromBeatResult(
        result,
        recipe.sourceFingerprint,
        recipe.beat.generation + 1,
        recipe.beat.result ?? recipe.beat.staleResult,
      ),
      findings: clearFindingsForStage(recipe, stageId),
    }
  }
  if (!recipe.beat.approvedArtifact || recipe.beat.status !== 'approved') {
    throw new TypeError('Shot rerun requires the approved beat Artifact')
  }
  const result = runner('shot-planning', {
    sourceNodes: [],
    artifacts: [recipe.beat.approvedArtifact],
    projectContext: { projectId: recipe.projectId, workflowId: recipe.workflowId },
    options: recipe.shot.options,
  })
  const shot = stageFromShotResult(
    result,
    recipe.sourceFingerprint,
    recipe.shot.generation + 1,
    recipe.shot.result ?? recipe.shot.staleResult,
  )
  shot.options = { ...recipe.shot.options }
  return {
    ...recipe,
    activeStage: 'shot-review',
    shot,
    findings: clearFindingsForStage(recipe, stageId),
    audit: { ...recipe.audit, updatedAt: now },
  }
}

export function markRecipeSourceFreshness(
  recipe: StoryboardDirectorRecipe,
  source: CreatorSkillSourceNode,
  now: string,
): StoryboardDirectorRecipe {
  const identity = createStoryboardDirectorRecipeIdentity(
    { projectId: recipe.projectId, workflowId: recipe.workflowId },
    source,
  )
  if (identity.recipeId === recipe.recipeId
    && identity.sourceFingerprint === recipe.sourceFingerprint) {
    return recipe
  }
  return invalidateRecipeAfter(recipe, 'source', now)
}

export function markRecipeSourceMissing(
  recipe: StoryboardDirectorRecipe,
  now: string,
): StoryboardDirectorRecipe {
  const stale = invalidateRecipeAfter(recipe, 'source', now)
  const finding = {
    findingId: 'source-node-missing',
    severity: 'blocking' as const,
    code: 'SOURCE_NODE_MISSING',
    message: 'The Storyboard Director Recipe source node is missing.',
    evidenceIds: [],
  }
  return {
    ...stale,
    findings: [
      ...stale.findings.filter((entry) => entry.code !== finding.code),
      finding,
    ],
  }
}

export function changeImpactForStage(
  recipe: StoryboardDirectorRecipe,
  stageId: StoryboardDirectorStageId,
) {
  return {
    beatCount: stageId === 'source' || stageId === 'scene-review'
      ? recipe.beat.drafts.length
      : 0,
    shotCount: stageId !== 'shot-review' ? recipe.shot.drafts.length : 0,
  }
}

export function createRecipeOperationToken(
  recipe: StoryboardDirectorRecipe,
  stageId: StoryboardDirectorStageId,
): StoryboardRecipeOperationToken {
  const stage = stageForId(recipe, stageId)
  const runFingerprint = stage.result?.runFingerprint
  if (!runFingerprint) throw new TypeError('Recipe stage has no current operation')
  return {
    recipeId: recipe.recipeId,
    sourceFingerprint: recipe.sourceFingerprint,
    stageId,
    runFingerprint,
    generation: stage.generation,
  }
}

export function isRecipeOperationCurrent(
  token: StoryboardRecipeOperationToken,
  recipe: StoryboardDirectorRecipe,
) {
  const stage = stageForId(recipe, token.stageId)
  return token.recipeId === recipe.recipeId
    && token.sourceFingerprint === recipe.sourceFingerprint
    && token.runFingerprint === stage.result?.runFingerprint
    && token.generation === stage.generation
}
