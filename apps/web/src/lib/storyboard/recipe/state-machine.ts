import {
  createCreatorSkillFingerprint,
  isCreatorSkillArtifact,
  NARRATIVE_BEAT_ANALYSIS_MANIFEST,
  runCreatorSkill,
  SCRIPT_SEGMENTATION_MANIFEST,
  SHOT_PLANNING_MANIFEST,
  type CreatorSkillArtifact,
  type CreatorSkillRunInput,
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
const MAX_SCENES = 40
const MAX_REVIEW_ITEMS = 120
const MAX_SCENE_CHARACTERS = 120
const MAX_CHARACTER_CODE_POINTS = 40
const NON_WHITESPACE = /\S/u

const RESULT_FIELDS = [
  'skillId',
  'skillVersion',
  'runFingerprint',
  'status',
  'artifacts',
  'evidence',
  'warnings',
  'blockers',
] as const
const EVIDENCE_FIELDS = [
  'evidenceId',
  'ruleId',
  'sourceNodeId',
  'lineStart',
  'lineEnd',
  'excerpt',
  'explanation',
] as const
const SCENE_FIELDS = [
  'sceneId',
  'order',
  'heading',
  'characters',
  'actionSummary',
  'sourceText',
  'lineStart',
  'lineEnd',
  'reviewStatus',
] as const
const BEAT_FIELDS = [
  'beatId',
  'sceneId',
  'order',
  'type',
  'sourceText',
  'summary',
  'lineStart',
  'lineEnd',
  'reviewStatus',
] as const
const SHOT_FIELDS = [
  'shotId',
  'sceneId',
  'order',
  'objective',
  'subject',
  'action',
  'suggestedShotSize',
  'sourceText',
  'lineStart',
  'lineEnd',
  'outputKind',
  'duration',
  'reviewStatus',
] as const

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
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactFields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  const keys = Reflect.ownKeys(value)
  const allowed = new Set([...required, ...optional])
  return keys.every((key) => typeof key === 'string' && allowed.has(key))
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value) && value === value.trim()
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function isLineRange(value: Record<string, unknown>) {
  return isPositiveInteger(value.lineStart)
    && isPositiveInteger(value.lineEnd)
    && value.lineEnd >= value.lineStart
}

function sameStrings(value: unknown, expected: readonly string[]) {
  return isDenseArray(value)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index])
}

function hasExpectedLineCount(sourceText: string, expected: number) {
  let count = 1
  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') count += 1
  }
  return count === expected
}

function containsHeadingLine(sourceText: string, heading: string) {
  return sourceText.split('\n').some((line) => line.trim() === heading)
}

function readScene(value: unknown): ScriptSceneDraft | null {
  if (!isRecord(value)
    || !hasExactFields(value, SCENE_FIELDS, ['location', 'timeOfDay'])
    || !isPositiveInteger(value.order)
    || value.sceneId !== `scene-${String(value.order).padStart(3, '0')}`
    || typeof value.heading !== 'string'
    || !isDenseArray(value.characters)
    || !value.characters.every((character) => (
      typeof character === 'string' && Boolean(character.trim())
    ))
    || typeof value.actionSummary !== 'string'
    || typeof value.sourceText !== 'string'
    || !NON_WHITESPACE.test(value.sourceText)
    || value.sourceText.includes('\r')
    || !isLineRange(value)
    || value.reviewStatus !== 'pending'
    || (value.location !== undefined && typeof value.location !== 'string')
    || (value.timeOfDay !== undefined && typeof value.timeOfDay !== 'string')) {
    return null
  }
  const lineStart = value.lineStart as number
  const lineEnd = value.lineEnd as number
  if (!hasExpectedLineCount(value.sourceText, lineEnd - lineStart + 1)
    || (value.heading && !containsHeadingLine(value.sourceText, value.heading))) {
    return null
  }
  return {
    sceneId: value.sceneId as string,
    order: value.order,
    heading: value.heading,
    ...(value.location !== undefined ? { location: value.location } : {}),
    ...(value.timeOfDay !== undefined ? { timeOfDay: value.timeOfDay } : {}),
    characters: (value.characters as string[]).slice(),
    actionSummary: value.actionSummary,
    sourceText: value.sourceText,
    lineStart,
    lineEnd,
    reviewStatus: 'pending',
  }
}

function readScenePayloadUnsafe(
  value: unknown,
  expectedSourceText?: string,
): SceneBreakdownPayload | null {
  if (!isRecord(value)
    || !hasExactFields(value, ['format', 'scenes'])
    || (value.format !== 'headed-script' && value.format !== 'paragraph-fallback')
    || !isDenseArray(value.scenes)
    || value.scenes.length === 0
    || value.scenes.length > MAX_SCENES) {
    return null
  }
  const scenes: ScriptSceneDraft[] = []
  const sceneIds = new Set<string>()
  const sceneOrders = new Set<number>()
  let previousOrder = 0
  let previousLineEnd = 0
  const sourceLines = expectedSourceText?.replace(/\r\n/g, '\n').split('\n')
  for (const valueScene of value.scenes) {
    const scene = readScene(valueScene)
    if (!scene
      || sceneIds.has(scene.sceneId)
      || sceneOrders.has(scene.order)
      || scene.order <= previousOrder
      || scene.lineStart <= previousLineEnd
      || (value.format === 'headed-script' ? !scene.heading : Boolean(scene.heading))) {
      return null
    }
    if (sourceLines
      && (scene.lineEnd > sourceLines.length
        || sourceLines.slice(scene.lineStart - 1, scene.lineEnd).join('\n') !== scene.sourceText)) {
      return null
    }
    scenes.push(scene)
    sceneIds.add(scene.sceneId)
    sceneOrders.add(scene.order)
    previousOrder = scene.order
    previousLineEnd = scene.lineEnd
  }
  return { format: value.format, scenes }
}

function readScenePayload(
  value: unknown,
  expectedSourceText?: string,
): SceneBreakdownPayload | null {
  try {
    return readScenePayloadUnsafe(value, expectedSourceText)
  } catch {
    return null
  }
}

function readBeat(value: unknown): NarrativeBeatDraft | null {
  if (!isRecord(value)
    || !hasExactFields(value, BEAT_FIELDS, ['needsReviewReason'])
    || !isIdentifier(value.beatId)
    || !isIdentifier(value.sceneId)
    || !isPositiveInteger(value.order)
    || !BEAT_TYPES.has(value.type as NarrativeBeatType)
    || typeof value.sourceText !== 'string'
    || !value.sourceText.trim()
    || value.sourceText.includes('\r')
    || value.sourceText.includes('\n')
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

function readBeatPayloadUnsafe(
  value: unknown,
  sourceArtifact?: CreatorSkillArtifact,
  preserveReviewedOrder = false,
): NarrativeBeatMapPayload | null {
  if (!isRecord(value)
    || !hasExactFields(value, ['scenes'])
    || !isDenseArray(value.scenes)
    || value.scenes.length === 0
    || value.scenes.length > MAX_SCENES) {
    return null
  }
  const sourcePayload = sourceArtifact ? readScenePayload(sourceArtifact.payload) : null
  if (sourceArtifact && !sourcePayload) return null
  const sourceScenes = new Map(sourcePayload?.scenes.map((scene) => [scene.sceneId, scene]))
  const scenes: NarrativeBeatMapPayload['scenes'] = []
  const sceneIds = new Set<string>()
  const sceneOrders = new Set<number>()
  const globalBeatIds = new Set<string>()
  let totalBeats = 0
  let previousSceneOrder = 0
  let previousSceneLineEnd = 0
  for (const valueScene of value.scenes) {
    if (!isRecord(valueScene)
      || !hasExactFields(valueScene, ['sceneId', 'order', 'heading', 'beats'])
      || !isPositiveInteger(valueScene.order)
      || valueScene.sceneId !== `scene-${String(valueScene.order).padStart(3, '0')}`
      || sceneIds.has(valueScene.sceneId as string)
      || sceneOrders.has(valueScene.order as number)
      || (valueScene.order as number) <= previousSceneOrder
      || typeof valueScene.heading !== 'string'
      || !isDenseArray(valueScene.beats)
      || valueScene.beats.length === 0) {
      return null
    }
    const sourceScene = sourceScenes.get(valueScene.sceneId as string)
    if (sourceArtifact && (!sourceScene
      || sourceScene.order !== valueScene.order
      || sourceScene.heading !== valueScene.heading)) {
      return null
    }
    const beats: NarrativeBeatDraft[] = []
    const beatOrders = new Set<number>()
    let previousBeatOrder = 0
    for (const valueBeat of valueScene.beats) {
      totalBeats += 1
      const beat = readBeat(valueBeat)
      if (!beat
        || totalBeats > MAX_REVIEW_ITEMS
        || beat.sceneId !== valueScene.sceneId
        || beat.beatId !== `${valueScene.sceneId}-beat-${String(beat.order).padStart(3, '0')}`
        || globalBeatIds.has(beat.beatId)
        || beatOrders.has(beat.order)
        || (!preserveReviewedOrder && beat.order <= previousBeatOrder)
        || beat.lineStart !== beat.lineEnd) {
        return null
      }
      if (sourceScene) {
        const sourceLine = sourceScene.sourceText.split('\n')[beat.lineStart - sourceScene.lineStart]
        if (beat.lineStart < sourceScene.lineStart
          || beat.lineEnd > sourceScene.lineEnd
          || sourceLine === undefined
          || !sourceLine.includes(beat.sourceText)) {
          return null
        }
      }
      beats.push(beat)
      globalBeatIds.add(beat.beatId)
      beatOrders.add(beat.order)
      previousBeatOrder = beat.order
    }
    const beatsByOriginalOrder = beats.slice().sort((left, right) => left.order - right.order)
    for (let index = 1; index < beatsByOriginalOrder.length; index += 1) {
      const previous = beatsByOriginalOrder[index - 1]!
      const current = beatsByOriginalOrder[index]!
      if (current.lineStart < previous.lineStart
        || (current.lineStart <= previous.lineEnd
          && (current.lineStart !== previous.lineStart
            || current.lineEnd !== previous.lineEnd))) {
        return null
      }
    }
    const firstLineStart = beatsByOriginalOrder[0]!.lineStart
    const finalLineEnd = beatsByOriginalOrder[beatsByOriginalOrder.length - 1]!.lineEnd
    if (firstLineStart <= previousSceneLineEnd) return null
    scenes.push({
      sceneId: valueScene.sceneId as string,
      order: valueScene.order as number,
      heading: valueScene.heading,
      beats,
    })
    sceneIds.add(valueScene.sceneId as string)
    sceneOrders.add(valueScene.order as number)
    previousSceneOrder = valueScene.order as number
    previousSceneLineEnd = finalLineEnd
  }
  if (sourcePayload && scenes.length !== sourcePayload.scenes.length) return null
  return { scenes }
}

function readBeatPayload(
  value: unknown,
  sourceArtifact?: CreatorSkillArtifact,
  preserveReviewedOrder = false,
): NarrativeBeatMapPayload | null {
  try {
    return readBeatPayloadUnsafe(value, sourceArtifact, preserveReviewedOrder)
  } catch {
    return null
  }
}

function readShot(value: unknown): ShotPlanDraft | null {
  if (!isRecord(value)
    || !hasExactFields(value, SHOT_FIELDS, ['beatId', 'needsReviewReason'])
    || !isIdentifier(value.shotId)
    || !isIdentifier(value.sceneId)
    || (value.beatId !== undefined && !isIdentifier(value.beatId))
    || !isPositiveInteger(value.order)
    || typeof value.objective !== 'string'
    || typeof value.subject !== 'string'
    || typeof value.action !== 'string'
    || !SHOT_SIZES.has(value.suggestedShotSize as PlannedShotSize)
    || typeof value.sourceText !== 'string'
    || !value.sourceText.trim()
    || value.sourceText.includes('\r')
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

function readShotPayloadUnsafe(
  value: unknown,
  sourceArtifact?: CreatorSkillArtifact,
): ShotPlanPayload | null {
  if (!isRecord(value)
    || !hasExactFields(value, ['scenes'])
    || !isDenseArray(value.scenes)
    || value.scenes.length === 0
    || value.scenes.length > MAX_SCENES) {
    return null
  }
  const sourcePayload = sourceArtifact
    ? readBeatPayload(sourceArtifact.payload, undefined, true)
    : null
  if (sourceArtifact && !sourcePayload) return null
  const sourceScenes = new Map(sourcePayload?.scenes.map((scene) => [scene.sceneId, scene]))
  const sourceBeats = new Map(sourcePayload?.scenes.flatMap(
    (scene) => scene.beats.map((beat) => [beat.beatId, beat] as const),
  ))
  const scenes: ShotPlanPayload['scenes'] = []
  const sceneIds = new Set<string>()
  const sceneOrders = new Set<number>()
  const globalShotIds = new Set<string>()
  const referencedBeatIds = new Set<string>()
  let totalShots = 0
  let previousSceneOrder = 0
  for (const valueScene of value.scenes) {
    if (!isRecord(valueScene)
      || !hasExactFields(valueScene, ['sceneId', 'order', 'heading', 'shots'])
      || !isPositiveInteger(valueScene.order)
      || valueScene.sceneId !== `scene-${String(valueScene.order).padStart(3, '0')}`
      || sceneIds.has(valueScene.sceneId as string)
      || sceneOrders.has(valueScene.order as number)
      || (valueScene.order as number) <= previousSceneOrder
      || typeof valueScene.heading !== 'string'
      || !isDenseArray(valueScene.shots)
      || valueScene.shots.length === 0) {
      return null
    }
    const sourceScene = sourceScenes.get(valueScene.sceneId as string)
    if (sourceArtifact && (!sourceScene
      || sourceScene.order !== valueScene.order
      || sourceScene.heading !== valueScene.heading)) {
      return null
    }
    const shots: ShotPlanDraft[] = []
    const shotOrders = new Set<number>()
    let previousShotOrder = 0
    for (const valueShot of valueScene.shots) {
      totalShots += 1
      const shot = readShot(valueShot)
      if (!shot
        || totalShots > MAX_REVIEW_ITEMS
        || shot.sceneId !== valueScene.sceneId
        || shot.shotId !== `${valueScene.sceneId}-shot-${String(shot.order).padStart(3, '0')}`
        || globalShotIds.has(shot.shotId)
        || shotOrders.has(shot.order)
        || shot.order <= previousShotOrder) {
        return null
      }
      const sourceBeat = shot.beatId ? sourceBeats.get(shot.beatId) : undefined
      if (sourceArtifact && (!sourceBeat
        || sourceBeat.sceneId !== shot.sceneId
        || sourceBeat.sourceText !== shot.sourceText
        || sourceBeat.lineStart !== shot.lineStart
        || sourceBeat.lineEnd !== shot.lineEnd)) {
        return null
      }
      shots.push(shot)
      globalShotIds.add(shot.shotId)
      shotOrders.add(shot.order)
      previousShotOrder = shot.order
      if (shot.beatId) referencedBeatIds.add(shot.beatId)
    }
    scenes.push({
      sceneId: valueScene.sceneId as string,
      order: valueScene.order as number,
      heading: valueScene.heading,
      shots,
    })
    sceneIds.add(valueScene.sceneId as string)
    sceneOrders.add(valueScene.order as number)
    previousSceneOrder = valueScene.order as number
  }
  if (sourcePayload
    && (scenes.length !== sourcePayload.scenes.length
      || sourceBeats.size !== referencedBeatIds.size)) {
    return null
  }
  return { scenes }
}

function readShotPayload(
  value: unknown,
  sourceArtifact?: CreatorSkillArtifact,
): ShotPlanPayload | null {
  try {
    return readShotPayloadUnsafe(value, sourceArtifact)
  } catch {
    return null
  }
}

type ExpectedRunContract = {
  skillId: string
  skillVersion: string
  runFingerprint: string
  artifactId: string
  artifactType: string
  sourceNodeId: string
  sourceArtifactIds: string[]
}

function expectedRunContract(
  skillId: string,
  skillVersion: string,
  input: CreatorSkillRunInput,
  artifactId: string,
  artifactType: string,
  sourceNodeId: string,
  sourceArtifactIds: string[],
): ExpectedRunContract {
  return {
    skillId,
    skillVersion,
    runFingerprint: createCreatorSkillFingerprint(skillId, skillVersion, input),
    artifactId,
    artifactType,
    sourceNodeId,
    sourceArtifactIds,
  }
}

function validIssue(
  value: unknown,
  expected: ExpectedRunContract,
) {
  if (!isRecord(value)
    || !hasExactFields(value, ['code', 'message'], ['sourceNodeId', 'artifactId'])
    || !isIdentifier(value.code)
    || typeof value.message !== 'string'
    || !value.message.trim()
    || (value.sourceNodeId !== undefined && value.sourceNodeId !== expected.sourceNodeId)) {
    return false
  }
  const artifactIds = new Set([expected.artifactId, ...expected.sourceArtifactIds])
  return value.artifactId === undefined
    || (isIdentifier(value.artifactId) && artifactIds.has(value.artifactId))
}

function validEvidenceShape(value: unknown, expected: ExpectedRunContract) {
  return isRecord(value)
    && hasExactFields(value, EVIDENCE_FIELDS)
    && isIdentifier(value.evidenceId)
    && isIdentifier(value.ruleId)
    && value.sourceNodeId === expected.sourceNodeId
    && isLineRange(value)
    && typeof value.excerpt === 'string'
    && Boolean(value.excerpt.trim())
    && typeof value.explanation === 'string'
    && Boolean(value.explanation.trim())
}

function requireExpectedArtifact(
  result: CreatorSkillRunResult,
  expected: ExpectedRunContract,
): CreatorSkillArtifact | null {
  try {
    if (!isRecord(result)
      || !hasExactFields(result, RESULT_FIELDS)
      || result.skillId !== expected.skillId
      || result.skillVersion !== expected.skillVersion
      || result.runFingerprint !== expected.runFingerprint
      || !['ready', 'needs-review', 'blocked'].includes(result.status)
      || !isDenseArray(result.artifacts)
      || !isDenseArray(result.evidence)
      || !isDenseArray(result.warnings)
      || !isDenseArray(result.blockers)
      || !result.evidence.every((entry) => validEvidenceShape(entry, expected))
      || !result.warnings.every((entry) => validIssue(entry, expected))
      || !result.blockers.every((entry) => validIssue(entry, expected))) {
      return null
    }
    if (result.status === 'blocked') {
      if (result.artifacts.length > 0
        || result.evidence.length > 0
        || result.warnings.length > 0
        || result.blockers.length === 0) {
        return null
      }
      return null
    }
    if (result.blockers.length > 0
      || result.artifacts.length !== 1
      || (result.status === 'ready') !== (result.warnings.length === 0)) {
      return null
    }
    const artifact = result.artifacts[0]
    if (!isCreatorSkillArtifact(artifact)
      || artifact.artifactId !== expected.artifactId
      || artifact.artifactType !== expected.artifactType
      || artifact.artifactVersion !== 1
      || !sameStrings(artifact.sourceNodeIds, [expected.sourceNodeId])
      || !sameStrings(artifact.sourceArtifactIds, expected.sourceArtifactIds)) {
      return null
    }
    return artifact
  } catch {
    return null
  }
}

type EvidenceTarget = {
  evidenceId: string
  lineStart: number
  lineEnd: number
  sourceText: string
}

function resultEvidenceMatches(
  result: CreatorSkillRunResult,
  targets: EvidenceTarget[],
) {
  if (result.evidence.length !== targets.length) return false
  const evidenceIds = new Set<string>()
  return result.evidence.every((evidence, index) => {
    const target = targets[index]
    if (!target || evidenceIds.has(evidence.evidenceId)) return false
    evidenceIds.add(evidence.evidenceId)
    return evidence.evidenceId === target.evidenceId
      && evidence.lineStart === target.lineStart
      && evidence.lineEnd === target.lineEnd
      && evidence.excerpt === target.sourceText
  })
}

type ValidatedResult<T> = {
  artifact: CreatorSkillArtifact
  payload: T
}

function cloneRunResult(result: CreatorSkillRunResult) {
  try {
    return structuredClone(result) as CreatorSkillRunResult
  } catch {
    return null
  }
}

function validateSceneResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceText: string,
  sourceNodeId: string,
): ValidatedResult<SceneBreakdownPayload> | null {
  try {
    const artifact = requireExpectedArtifact(result, expectedRunContract(
      SCRIPT_SEGMENTATION_MANIFEST.id,
      SCRIPT_SEGMENTATION_MANIFEST.version,
      input,
      'scene-breakdown-001',
      'scene-breakdown',
      sourceNodeId,
      [],
    ))
    if (!artifact
      || result.warnings.some((warning) => warning.code === 'SCENE_LIMIT_REACHED')) {
      return null
    }
    const payload = readScenePayload(artifact.payload, sourceText)
    if (!payload || !resultEvidenceMatches(
      result,
      payload.scenes.map((scene) => ({
        evidenceId: `scene-evidence-${String(scene.order).padStart(3, '0')}`,
        lineStart: scene.lineStart,
        lineEnd: scene.lineEnd,
        sourceText: scene.sourceText,
      })),
    )) {
      return null
    }
    return { artifact, payload }
  } catch {
    return null
  }
}

function validateBeatResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceArtifact: CreatorSkillArtifact,
): ValidatedResult<NarrativeBeatMapPayload> | null {
  try {
    const artifact = requireExpectedArtifact(result, expectedRunContract(
      NARRATIVE_BEAT_ANALYSIS_MANIFEST.id,
      NARRATIVE_BEAT_ANALYSIS_MANIFEST.version,
      input,
      'narrative-beat-map-001',
      'narrative-beat-map',
      sourceArtifact.sourceNodeIds[0]!,
      [sourceArtifact.artifactId],
    ))
    const payload = artifact ? readBeatPayload(artifact.payload, sourceArtifact) : null
    if (!artifact || !payload || !resultEvidenceMatches(
      result,
      payload.scenes.flatMap((scene) => scene.beats.map((beat) => ({
        evidenceId: `narrative-beat-evidence-${String(scene.order).padStart(3, '0')}-${String(beat.order).padStart(3, '0')}`,
        lineStart: beat.lineStart,
        lineEnd: beat.lineEnd,
        sourceText: beat.sourceText,
      }))),
    )) {
      return null
    }
    return { artifact, payload }
  } catch {
    return null
  }
}

function validateShotResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceArtifact: CreatorSkillArtifact,
): ValidatedResult<ShotPlanPayload> | null {
  try {
    const artifact = requireExpectedArtifact(result, expectedRunContract(
      SHOT_PLANNING_MANIFEST.id,
      SHOT_PLANNING_MANIFEST.version,
      input,
      'shot-plan-001',
      'shot-plan',
      sourceArtifact.sourceNodeIds[0]!,
      [sourceArtifact.artifactId],
    ))
    const payload = artifact ? readShotPayload(artifact.payload, sourceArtifact) : null
    if (!artifact || !payload || !resultEvidenceMatches(
      result,
      payload.scenes.flatMap((scene) => scene.shots.map((shot) => ({
        evidenceId: `shot-plan-evidence-${String(scene.order).padStart(3, '0')}-${String(shot.order).padStart(3, '0')}`,
        lineStart: shot.lineStart,
        lineEnd: shot.lineEnd,
        sourceText: shot.sourceText,
      }))),
    )) {
      return null
    }
    return { artifact, payload }
  } catch {
    return null
  }
}

function stageFromSceneResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceText: string,
  sourceNodeId: string,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorStage<RecipeReviewItem<ScriptSceneDraft>> {
  const ownedResult = cloneRunResult(result)
  const validated = ownedResult
    ? validateSceneResult(ownedResult, input, sourceText, sourceNodeId)
    : null
  const payload = validated?.payload ?? null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result: ownedResult,
    drafts: payload
      ? payload.scenes.map((scene) => ({ ...scene, characters: scene.characters.slice(), decision: 'pending' }))
      : [],
    approvedArtifact: null,
    staleResult,
  }
}

function stageFromBeatResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceArtifact: CreatorSkillArtifact,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorStage<RecipeReviewItem<NarrativeBeatDraft>> {
  const ownedResult = cloneRunResult(result)
  const validated = ownedResult ? validateBeatResult(ownedResult, input, sourceArtifact) : null
  const payload = validated?.payload ?? null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result: ownedResult,
    drafts: payload
      ? payload.scenes.flatMap((scene) => scene.beats.map((beat) => ({ ...beat, decision: 'pending' })))
      : [],
    approvedArtifact: null,
    staleResult,
  }
}

function stageFromShotResult(
  result: CreatorSkillRunResult,
  input: CreatorSkillRunInput,
  sourceArtifact: CreatorSkillArtifact,
  sourceFingerprint: string,
  generation = 0,
  staleResult: CreatorSkillRunResult | null = null,
): StoryboardDirectorRecipe['shot'] {
  const ownedResult = cloneRunResult(result)
  const validated = ownedResult ? validateShotResult(ownedResult, input, sourceArtifact) : null
  const payload = validated?.payload ?? null
  return {
    status: payload ? 'needs-review' : 'blocked',
    generation,
    sourceFingerprint,
    result: ownedResult,
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
  const projectContext = {
    projectId: context.projectId.trim(),
    workflowId: context.workflowId.trim(),
  }
  const sourceNode = {
    id: source.id.trim(),
    kind: 'text' as const,
    title: source.title.trim(),
    prompt: identity.sourceText,
  }
  const sceneInput: CreatorSkillRunInput = {
    sourceNodes: [sourceNode],
    projectContext,
  }
  const sceneResult = runner('script-segmentation', sceneInput)
  return {
    schemaVersion: STORYBOARD_DIRECTOR_RECIPE_VERSION,
    recipeId: identity.recipeId,
    projectId: projectContext.projectId,
    workflowId: projectContext.workflowId,
    sourceNode,
    sourceFingerprint: identity.sourceFingerprint,
    activeStage: 'scene-review',
    scene: stageFromSceneResult(
      sceneResult,
      sceneInput,
      sourceNode.prompt,
      sourceNode.id,
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

function assertReviewMutationAllowed(
  recipe: StoryboardDirectorRecipe,
  stageId: ReviewStageId,
  operation: 'decision' | 'edit' | 'reorder',
) {
  assertRecipeSourceCurrent(recipe)
  const stage = stageForReviewId(recipe, stageId)
  if (stage.status === 'approved') {
    if (operation === 'decision') {
      throw new TypeError('Approved Recipe stage decisions are finalized')
    }
    if (!stage.approvedArtifact) {
      throw new TypeError('Approved Recipe stage is not reviewable without its checkpoint')
    }
  } else if (stage.status !== 'needs-review') {
    throw new TypeError(`Recipe stage is not reviewable while ${stage.status}`)
  } else if (recipe.activeStage !== stageId) {
    throw new TypeError('Recipe stage is not the current reviewable stage')
  }
  if (!stage.result || stage.sourceFingerprint !== recipe.sourceFingerprint) {
    throw new TypeError('Recipe stage is not reviewable without a current result')
  }
  if (stageId === 'beat-review'
    && (recipe.scene.status !== 'approved' || !recipe.scene.approvedArtifact)) {
    throw new TypeError('Beat review requires the current approved scene checkpoint upstream')
  }
  if (stageId === 'shot-review'
    && (recipe.beat.status !== 'approved' || !recipe.beat.approvedArtifact)) {
    throw new TypeError('Shot review requires the current approved beat checkpoint upstream')
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
  assertReviewMutationAllowed(recipe, stageId, 'decision')
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

function validateSceneCharacters(value: unknown) {
  try {
    if (!Array.isArray(value)
      || !Number.isSafeInteger(value.length)
      || value.length > MAX_SCENE_CHARACTERS
      || Reflect.ownKeys(value).length !== value.length + 1) {
      throw new TypeError('Scene characters must be a bounded dense array without extra properties')
    }
    const characters: string[] = []
    const seen = new Set<string>()
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      const character = descriptor && 'value' in descriptor ? descriptor.value : undefined
      if (!descriptor?.enumerable
        || typeof character !== 'string'
        || !character
        || character !== character.trim()
        || Array.from(character).length > MAX_CHARACTER_CODE_POINTS
        || seen.has(character)) {
        throw new TypeError('Scene characters must contain unique trimmed bounded strings')
      }
      seen.add(character)
      characters.push(character)
    }
    return characters
  } catch (error) {
    if (error instanceof TypeError && /Scene characters/.test(error.message)) throw error
    throw new TypeError('Scene characters are invalid')
  }
}

function validateEditableValue(stageId: ReviewStageId, field: string, value: unknown) {
  if (stageId === 'scene-review') {
    if (field === 'characters') {
      return validateSceneCharacters(value)
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
  assertReviewMutationAllowed(recipe, stageId, 'edit')
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
  assertReviewMutationAllowed(recipe, stageId, 'reorder')
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
) {
  assertRecipeSourceCurrent(recipe)
  if (stage.status === 'blocked' || stage.result?.status === 'blocked') {
    throw new TypeError('Blocked Recipe stage cannot be approved')
  }
  if (stage.status !== 'needs-review'
    || stage.sourceFingerprint !== recipe.sourceFingerprint
    || !stage.result) {
    throw new TypeError('Recipe stage is not current and reviewable')
  }
  if (stage.drafts.some((draft) => draft.decision === 'pending')) {
    throw new TypeError('Recipe stage has unresolved decisions')
  }
  if (!stage.drafts.some((draft) => draft.decision === 'approved')) {
    throw new TypeError('Recipe stage requires at least one approved item')
  }
}

function projectContextForRecipe(recipe: StoryboardDirectorRecipe) {
  return { projectId: recipe.projectId, workflowId: recipe.workflowId }
}

function sceneInputForRecipe(recipe: StoryboardDirectorRecipe): CreatorSkillRunInput {
  return {
    sourceNodes: [recipe.sourceNode],
    projectContext: projectContextForRecipe(recipe),
  }
}

function requireCurrentSceneResult(recipe: StoryboardDirectorRecipe) {
  const result = recipe.scene.result
  const validated = result ? validateSceneResult(
    result,
    sceneInputForRecipe(recipe),
    recipe.sourceNode.prompt,
    recipe.sourceNode.id,
  ) : null
  if (!validated) throw new TypeError('Recipe scene result contract is malformed')
  return validated
}

function sceneSkillHandoffArtifact(
  recipe: StoryboardDirectorRecipe,
  checkpoint: CreatorSkillArtifact,
): CreatorSkillArtifact<SceneBreakdownPayload> {
  const validated = requireCurrentSceneResult(recipe)
  const expectedArtifactId = approvedArtifactId('scene-breakdown', validated.artifact.artifactId)
  if (checkpoint.artifactId !== expectedArtifactId) {
    throw new TypeError('Recipe scene checkpoint identity is malformed')
  }
  const approvedSceneIds = new Set(
    recipe.scene.drafts
      .filter((scene) => scene.decision === 'approved')
      .map((scene) => scene.sceneId),
  )
  const reviewedScenes = new Map(
    recipe.scene.drafts.map((scene) => [scene.sceneId, scene]),
  )
  const scenes = validated.payload.scenes
    .filter((scene) => approvedSceneIds.has(scene.sceneId))
    .map((scene) => {
      const reviewed = reviewedScenes.get(scene.sceneId)
      if (!reviewed) throw new TypeError('Recipe scene checkpoint selection is malformed')
      return {
        sceneId: scene.sceneId,
        order: scene.order,
        heading: scene.heading,
        ...(reviewed.location !== undefined ? { location: reviewed.location } : {}),
        ...(reviewed.timeOfDay !== undefined ? { timeOfDay: reviewed.timeOfDay } : {}),
        characters: reviewed.characters.slice(),
        actionSummary: reviewed.actionSummary,
        sourceText: scene.sourceText,
        lineStart: scene.lineStart,
        lineEnd: scene.lineEnd,
        reviewStatus: 'pending' as const,
      }
    })
  if (scenes.length === 0 || scenes.length !== approvedSceneIds.size) {
    throw new TypeError('Recipe scene checkpoint selection is malformed')
  }
  // The Recipe checkpoint retains reviewed display fields/order. The public Skill
  // receives immutable source evidence in canonical order under the same stable ID.
  return {
    artifactId: expectedArtifactId,
    artifactType: 'scene-breakdown',
    artifactVersion: 1,
    sourceNodeIds: validated.artifact.sourceNodeIds.slice(),
    sourceArtifactIds: [validated.artifact.artifactId],
    payload: { format: validated.payload.format, scenes },
  }
}

function sceneCheckpoint(
  recipe: StoryboardDirectorRecipe,
): CreatorSkillArtifact<SceneBreakdownPayload> {
  assertApprovable(recipe, recipe.scene)
  const validated = requireCurrentSceneResult(recipe)
  const sourceArtifact = validated.artifact
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
    payload: { format: validated.payload.format, scenes },
  }
}

function beatCheckpoint(
  recipe: StoryboardDirectorRecipe,
): CreatorSkillArtifact<NarrativeBeatMapPayload> {
  assertApprovable(recipe, recipe.beat)
  if (!recipe.scene.approvedArtifact || recipe.scene.status !== 'approved') {
    throw new TypeError('Beat approval requires the approved scene checkpoint upstream')
  }
  const sceneHandoff = sceneSkillHandoffArtifact(recipe, recipe.scene.approvedArtifact)
  const input: CreatorSkillRunInput = {
    sourceNodes: [],
    artifacts: [sceneHandoff],
    projectContext: projectContextForRecipe(recipe),
  }
  const validated = recipe.beat.result
    ? validateBeatResult(recipe.beat.result, input, sceneHandoff)
    : null
  if (!validated) throw new TypeError('Recipe beat result contract is malformed')
  const sourceArtifact = validated.artifact
  const sourcePayload = validated.payload
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
  assertApprovable(recipe, recipe.shot)
  if (!recipe.beat.approvedArtifact || recipe.beat.status !== 'approved') {
    throw new TypeError('Shot approval requires the approved beat checkpoint upstream')
  }
  const input: CreatorSkillRunInput = {
    sourceNodes: [],
    artifacts: [recipe.beat.approvedArtifact],
    projectContext: projectContextForRecipe(recipe),
    options: recipe.shot.options,
  }
  const validated = recipe.shot.result
    ? validateShotResult(recipe.shot.result, input, recipe.beat.approvedArtifact)
    : null
  if (!validated) throw new TypeError('Recipe shot result contract is malformed')
  const sourceArtifact = validated.artifact
  const sourcePayload = validated.payload
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
  const handoffArtifact = sceneSkillHandoffArtifact(recipe, approvedArtifact)
  const input: CreatorSkillRunInput = {
    sourceNodes: [],
    artifacts: [handoffArtifact],
    projectContext: projectContextForRecipe(recipe),
  }
  const result = runner('narrative-beat-analysis', input)
  const beat = stageFromBeatResult(
    result,
    input,
    handoffArtifact,
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
  const input: CreatorSkillRunInput = {
    sourceNodes: [],
    artifacts: [approvedArtifact],
    projectContext: projectContextForRecipe(recipe),
    options: recipe.shot.options,
  }
  const result = runner('shot-planning', input)
  const shot = stageFromShotResult(
    result,
    input,
    approvedArtifact,
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
    const input: CreatorSkillRunInput = {
      sourceNodes: [recipe.sourceNode],
      projectContext: projectContextForRecipe(recipe),
    }
    const result = runner('script-segmentation', input)
    const next = invalidateRecipeAfter(recipe, stageId, now)
    return {
      ...next,
      scene: stageFromSceneResult(
        result,
        input,
        recipe.sourceNode.prompt,
        recipe.sourceNode.id,
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
    const handoffArtifact = sceneSkillHandoffArtifact(recipe, recipe.scene.approvedArtifact)
    const input: CreatorSkillRunInput = {
      sourceNodes: [],
      artifacts: [handoffArtifact],
      projectContext: projectContextForRecipe(recipe),
    }
    const result = runner('narrative-beat-analysis', input)
    const next = invalidateRecipeAfter(recipe, stageId, now)
    return {
      ...next,
      beat: stageFromBeatResult(
        result,
        input,
        handoffArtifact,
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
  const input: CreatorSkillRunInput = {
    sourceNodes: [],
    artifacts: [recipe.beat.approvedArtifact],
    projectContext: projectContextForRecipe(recipe),
    options: recipe.shot.options,
  }
  const result = runner('shot-planning', input)
  const shot = stageFromShotResult(
    result,
    input,
    recipe.beat.approvedArtifact,
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
