import type {
  CreatorSkillArtifact,
  CreatorSkillIssue,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
} from '../../skills'
import { createStoryboardDirectorRecipeIdentity } from './identity'
import {
  STORYBOARD_DIRECTOR_RECIPE_VERSION,
  type StoryboardDirectorRecipe,
  type StoryboardDirectorStageStatus,
} from './types'

const MAX_SCENES = 40
const MAX_BEATS = 120
const MAX_SHOTS = 120
const MAX_COLLECTION_ITEMS = 120
const MAX_CLONE_ARRAY_LENGTH = 10_000

export type StoryboardDirectorRecipeReadResult =
  | { status: 'absent' }
  | { status: 'valid'; recipe: StoryboardDirectorRecipe }
  | { status: 'invalid'; issue: CreatorSkillIssue }
  | { status: 'unsupported'; issue: CreatorSkillIssue }

type PropertyReadResult =
  | { status: 'absent' }
  | { status: 'accessor' }
  | { status: 'value'; value: unknown }

type PlainRecord = Record<string, unknown>

function fail(message: string): never {
  throw new TypeError(message)
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (!isObject(value) || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownData(value: object, key: PropertyKey): PropertyReadResult {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor) return { status: 'absent' }
  if (!('value' in descriptor)) return { status: 'accessor' }
  return { status: 'value', value: descriptor.value }
}

function ownEnumerableData(value: object, key: PropertyKey, field: string) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    return fail(`${field} must be an own enumerable data property`)
  }
  return descriptor.value
}

function cloneJsonValue(
  value: unknown,
  ancestors: WeakSet<object>,
  field: string,
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${field} must be finite`)
    return value
  }
  if (!isObject(value)) fail(`${field} must contain JSON-compatible values`)
  if (ancestors.has(value)) fail(`${field} must not contain cycles`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const length = ownEnumerableArrayLength(value, field)
      if (length > MAX_CLONE_ARRAY_LENGTH) fail(`${field} exceeds the persistence limit`)
      const keys = Reflect.ownKeys(value)
      if (keys.length !== length + 1) {
        fail(`${field} must be a dense array without extra properties`)
      }
      const clone = new Array<unknown>(length)
      for (let index = 0; index < length; index += 1) {
        clone[index] = cloneJsonValue(
          ownEnumerableData(value, String(index), `${field}[${index}]`),
          ancestors,
          `${field}[${index}]`,
        )
      }
      return clone
    }

    if (!isPlainRecord(value)) fail(`${field} must be a plain object`)
    const clone: PlainRecord = {}
    const keys = Reflect.ownKeys(value)
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      if (typeof key !== 'string') fail(`${field} must not contain symbol keys`)
      Object.defineProperty(clone, key, {
        value: cloneJsonValue(
          ownEnumerableData(value, key, `${field}.${key}`),
          ancestors,
          `${field}.${key}`,
        ),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return clone
  } finally {
    ancestors.delete(value)
  }
}

function ownEnumerableArrayLength(value: unknown[], field: string) {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'length')
  if (!descriptor || !('value' in descriptor)) fail(`${field}.length must be an own data property`)
  const length = descriptor.value
  if (!Number.isSafeInteger(length) || length < 0) fail(`${field}.length is invalid`)
  return length as number
}

function record(
  value: unknown,
  field: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): PlainRecord {
  if (!isPlainRecord(value)) fail(`${field} must be a plain object`)
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  const keys = Reflect.ownKeys(value)
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (typeof key !== 'string' || !allowed.has(key)) fail(`${field} has unexpected fields`)
  }
  for (let index = 0; index < requiredKeys.length; index += 1) {
    const key = requiredKeys[index]!
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(`${field}.${key} is required`)
  }
  return value
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function identifier(value: unknown, field: string) {
  const id = stringValue(value, field)
  if (!id || id !== id.trim()) fail(`${field} must be a trimmed non-empty string`)
  return id
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${field} is invalid`)
  }
  return value as T
}

function finiteNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} must be finite`)
  return value
}

function integer(value: unknown, field: string, minimum = 0) {
  const number = finiteNumber(value, field)
  if (!Number.isSafeInteger(number) || number < minimum) fail(`${field} must be an integer`)
  return number
}

function positiveInteger(value: unknown, field: string) {
  return integer(value, field, 1)
}

function arrayValue(value: unknown, field: string, maximum = MAX_COLLECTION_ITEMS): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`)
  if (value.length > maximum) fail(`${field} exceeds the persistence limit`)
  return value
}

function optionalString(value: PlainRecord, key: string, field: string) {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return
  stringValue(value[key], `${field}.${key}`)
}

function stringArray(value: unknown, field: string, identifiers = false) {
  const values = arrayValue(value, field)
  for (let index = 0; index < values.length; index += 1) {
    if (identifiers) identifier(values[index], `${field}[${index}]`)
    else stringValue(values[index], `${field}[${index}]`)
  }
  return values as string[]
}

function assertUnique(values: readonly string[], field: string) {
  const seen = new Set<string>()
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!
    if (seen.has(value)) fail(`${field} must contain unique IDs`)
    seen.add(value)
  }
}

function validateArtifact(value: unknown, field: string): asserts value is CreatorSkillArtifact {
  const artifact = record(value, field, [
    'artifactId',
    'artifactType',
    'artifactVersion',
    'sourceNodeIds',
    'sourceArtifactIds',
    'payload',
  ])
  identifier(artifact.artifactId, `${field}.artifactId`)
  identifier(artifact.artifactType, `${field}.artifactType`)
  positiveInteger(artifact.artifactVersion, `${field}.artifactVersion`)
  const sourceNodeIds = stringArray(artifact.sourceNodeIds, `${field}.sourceNodeIds`, true)
  const sourceArtifactIds = stringArray(
    artifact.sourceArtifactIds,
    `${field}.sourceArtifactIds`,
    true,
  )
  assertUnique(sourceNodeIds, `${field}.sourceNodeIds`)
  assertUnique(sourceArtifactIds, `${field}.sourceArtifactIds`)
}

function validateEvidence(value: unknown, field: string) {
  const evidence = record(value, field, [
    'evidenceId',
    'ruleId',
    'sourceNodeId',
    'lineStart',
    'lineEnd',
    'excerpt',
    'explanation',
  ])
  identifier(evidence.evidenceId, `${field}.evidenceId`)
  identifier(evidence.ruleId, `${field}.ruleId`)
  identifier(evidence.sourceNodeId, `${field}.sourceNodeId`)
  const lineStart = positiveInteger(evidence.lineStart, `${field}.lineStart`)
  const lineEnd = positiveInteger(evidence.lineEnd, `${field}.lineEnd`)
  if (lineEnd < lineStart) fail(`${field}.lineEnd must not precede lineStart`)
  stringValue(evidence.excerpt, `${field}.excerpt`)
  stringValue(evidence.explanation, `${field}.explanation`)
  return evidence.evidenceId as string
}

function validateIssue(value: unknown, field: string) {
  const issue = record(value, field, ['code', 'message'], ['sourceNodeId', 'artifactId'])
  identifier(issue.code, `${field}.code`)
  stringValue(issue.message, `${field}.message`)
  if (Object.prototype.hasOwnProperty.call(issue, 'sourceNodeId')) {
    identifier(issue.sourceNodeId, `${field}.sourceNodeId`)
  }
  if (Object.prototype.hasOwnProperty.call(issue, 'artifactId')) {
    identifier(issue.artifactId, `${field}.artifactId`)
  }
}

function validateRunResult(value: unknown, field: string): asserts value is CreatorSkillRunResult {
  const result = record(value, field, [
    'skillId',
    'skillVersion',
    'runFingerprint',
    'status',
    'artifacts',
    'evidence',
    'warnings',
    'blockers',
  ])
  identifier(result.skillId, `${field}.skillId`)
  identifier(result.skillVersion, `${field}.skillVersion`)
  identifier(result.runFingerprint, `${field}.runFingerprint`)
  enumValue(result.status, `${field}.status`, ['ready', 'needs-review', 'blocked'])

  const artifacts = arrayValue(result.artifacts, `${field}.artifacts`)
  const artifactIds: string[] = []
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]
    validateArtifact(artifact, `${field}.artifacts[${index}]`)
    artifactIds.push(artifact.artifactId)
  }
  assertUnique(artifactIds, `${field}.artifacts`)

  const evidence = arrayValue(result.evidence, `${field}.evidence`)
  const evidenceIds: string[] = []
  for (let index = 0; index < evidence.length; index += 1) {
    evidenceIds.push(validateEvidence(evidence[index], `${field}.evidence[${index}]`))
  }
  assertUnique(evidenceIds, `${field}.evidence`)

  for (const key of ['warnings', 'blockers'] as const) {
    const issues = arrayValue(result[key], `${field}.${key}`)
    for (let index = 0; index < issues.length; index += 1) {
      validateIssue(issues[index], `${field}.${key}[${index}]`)
    }
  }
}

function validateNullableResult(value: unknown, field: string) {
  if (value !== null) validateRunResult(value, field)
}

function validateNullableArtifact(value: unknown, field: string) {
  if (value !== null) validateArtifact(value, field)
}

const STAGE_FIELDS = [
  'status',
  'generation',
  'sourceFingerprint',
  'result',
  'drafts',
  'approvedArtifact',
  'staleResult',
] as const

function validateStage(
  value: unknown,
  field: string,
  maximumDrafts: number,
  validateDraft: (draft: unknown, field: string) => string,
  withOptions = false,
) {
  const stage = record(value, field, withOptions ? [...STAGE_FIELDS, 'options'] : STAGE_FIELDS)
  enumValue<StoryboardDirectorStageStatus>(stage.status, `${field}.status`, [
    'idle',
    'running',
    'needs-review',
    'approved',
    'stale',
    'blocked',
  ])
  integer(stage.generation, `${field}.generation`)
  stringValue(stage.sourceFingerprint, `${field}.sourceFingerprint`)
  validateNullableResult(stage.result, `${field}.result`)
  validateNullableArtifact(stage.approvedArtifact, `${field}.approvedArtifact`)
  validateNullableResult(stage.staleResult, `${field}.staleResult`)
  const drafts = arrayValue(stage.drafts, `${field}.drafts`, maximumDrafts)
  const ids: string[] = []
  for (let index = 0; index < drafts.length; index += 1) {
    ids.push(validateDraft(drafts[index], `${field}.drafts[${index}]`))
  }
  assertUnique(ids, `${field}.drafts`)
  return stage
}

function validateReviewFields(item: PlainRecord, field: string) {
  enumValue(item.reviewStatus, `${field}.reviewStatus`, ['pending'])
  enumValue(item.decision, `${field}.decision`, ['pending', 'approved', 'rejected'])
}

function validateSourceRange(item: PlainRecord, field: string) {
  const lineStart = positiveInteger(item.lineStart, `${field}.lineStart`)
  const lineEnd = positiveInteger(item.lineEnd, `${field}.lineEnd`)
  if (lineEnd < lineStart) fail(`${field}.lineEnd must not precede lineStart`)
}

function validateSceneDraft(value: unknown, field: string) {
  const scene = record(value, field, [
    'sceneId',
    'order',
    'heading',
    'characters',
    'actionSummary',
    'sourceText',
    'lineStart',
    'lineEnd',
    'reviewStatus',
    'decision',
  ], ['location', 'timeOfDay'])
  const sceneId = identifier(scene.sceneId, `${field}.sceneId`)
  positiveInteger(scene.order, `${field}.order`)
  stringValue(scene.heading, `${field}.heading`)
  optionalString(scene, 'location', field)
  optionalString(scene, 'timeOfDay', field)
  const characters = stringArray(scene.characters, `${field}.characters`, true)
  assertUnique(characters, `${field}.characters`)
  stringValue(scene.actionSummary, `${field}.actionSummary`)
  stringValue(scene.sourceText, `${field}.sourceText`)
  validateSourceRange(scene, field)
  validateReviewFields(scene, field)
  return sceneId
}

function validateBeatDraft(value: unknown, field: string) {
  const beat = record(value, field, [
    'beatId',
    'sceneId',
    'order',
    'type',
    'sourceText',
    'summary',
    'lineStart',
    'lineEnd',
    'reviewStatus',
    'decision',
  ], ['needsReviewReason'])
  const beatId = identifier(beat.beatId, `${field}.beatId`)
  identifier(beat.sceneId, `${field}.sceneId`)
  positiveInteger(beat.order, `${field}.order`)
  enumValue(beat.type, `${field}.type`, [
    'setup',
    'goal',
    'action',
    'reaction',
    'turn',
    'closure',
    'unclassified',
  ])
  stringValue(beat.sourceText, `${field}.sourceText`)
  stringValue(beat.summary, `${field}.summary`)
  optionalString(beat, 'needsReviewReason', field)
  validateSourceRange(beat, field)
  validateReviewFields(beat, field)
  return beatId
}

function validateShotDraft(value: unknown, field: string) {
  const shot = record(value, field, [
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
    'decision',
  ], ['beatId', 'needsReviewReason'])
  const shotId = identifier(shot.shotId, `${field}.shotId`)
  identifier(shot.sceneId, `${field}.sceneId`)
  if (Object.prototype.hasOwnProperty.call(shot, 'beatId')) {
    identifier(shot.beatId, `${field}.beatId`)
  }
  positiveInteger(shot.order, `${field}.order`)
  stringValue(shot.objective, `${field}.objective`)
  stringValue(shot.subject, `${field}.subject`)
  stringValue(shot.action, `${field}.action`)
  enumValue(shot.suggestedShotSize, `${field}.suggestedShotSize`, [
    'wide',
    'full',
    'medium',
    'close',
    'extreme-close',
  ])
  stringValue(shot.sourceText, `${field}.sourceText`)
  validateSourceRange(shot, field)
  enumValue(shot.outputKind, `${field}.outputKind`, ['image', 'video'])
  if (shot.duration !== 5 && shot.duration !== 10) fail(`${field}.duration is invalid`)
  optionalString(shot, 'needsReviewReason', field)
  validateReviewFields(shot, field)
  return shotId
}

function validateShotOptions(value: unknown, field: string) {
  const options = record(value, field, [
    'requestedShotCount',
    'outputMode',
    'pacing',
    'shotSizeStrategy',
    'userInstruction',
  ])
  const requestedShotCount = positiveInteger(
    options.requestedShotCount,
    `${field}.requestedShotCount`,
  )
  if (requestedShotCount > MAX_SHOTS) fail(`${field}.requestedShotCount exceeds the limit`)
  enumValue(options.outputMode, `${field}.outputMode`, ['image', 'video', 'mixed'])
  enumValue(options.pacing, `${field}.pacing`, ['slow_cinematic', 'standard', 'fast_social'])
  enumValue(options.shotSizeStrategy, `${field}.shotSizeStrategy`, [
    'auto',
    'wide_to_close',
    'close_heavy',
    'wide_heavy',
  ])
  stringValue(options.userInstruction, `${field}.userInstruction`)
}

function validateSourceNode(value: unknown, field: string): CreatorSkillSourceNode {
  const source = record(value, field, [
    'id',
    'kind',
    'title',
    'prompt',
  ], ['resultText', 'metadataJson'])
  identifier(source.id, `${field}.id`)
  enumValue(source.kind, `${field}.kind`, ['text'])
  stringValue(source.title, `${field}.title`)
  stringValue(source.prompt, `${field}.prompt`)
  optionalString(source, 'resultText', field)
  return source as CreatorSkillSourceNode
}

function validateFinding(value: unknown, field: string) {
  const finding = record(value, field, [
    'findingId',
    'severity',
    'code',
    'message',
    'evidenceIds',
  ], ['sceneId', 'beatId', 'shotId'])
  const findingId = identifier(finding.findingId, `${field}.findingId`)
  enumValue(finding.severity, `${field}.severity`, ['blocking', 'advisory'])
  identifier(finding.code, `${field}.code`)
  stringValue(finding.message, `${field}.message`)
  for (const key of ['sceneId', 'beatId', 'shotId'] as const) {
    if (Object.prototype.hasOwnProperty.call(finding, key)) {
      identifier(finding[key], `${field}.${key}`)
    }
  }
  const evidenceIds = stringArray(finding.evidenceIds, `${field}.evidenceIds`, true)
  assertUnique(evidenceIds, `${field}.evidenceIds`)
  return findingId
}

const SHOT_CARD_REQUIRED_FIELDS = [
  'id',
  'index',
  'title',
  'nodeIds',
  'createdAt',
  'updatedAt',
] as const

const SHOT_CARD_OPTIONAL_FIELDS = [
  'shotType',
  'durationSec',
  'mood',
  'cameraMovement',
  'directorNote',
  'characterIds',
  'sceneIds',
  'thumbnailUrl',
] as const

function validateShotCard(value: unknown, field: string) {
  const shot = record(value, field, SHOT_CARD_REQUIRED_FIELDS, SHOT_CARD_OPTIONAL_FIELDS)
  const id = identifier(shot.id, `${field}.id`)
  integer(shot.index, `${field}.index`)
  stringValue(shot.title, `${field}.title`)
  const nodeIds = stringArray(shot.nodeIds, `${field}.nodeIds`, true)
  assertUnique(nodeIds, `${field}.nodeIds`)
  for (const key of [
    'shotType',
    'mood',
    'cameraMovement',
    'directorNote',
    'thumbnailUrl',
  ] as const) {
    optionalString(shot, key, field)
  }
  if (Object.prototype.hasOwnProperty.call(shot, 'durationSec')) {
    const duration = finiteNumber(shot.durationSec, `${field}.durationSec`)
    if (duration < 0) fail(`${field}.durationSec must not be negative`)
  }
  for (const key of ['characterIds', 'sceneIds'] as const) {
    if (!Object.prototype.hasOwnProperty.call(shot, key)) continue
    const ids = stringArray(shot[key], `${field}.${key}`, true)
    assertUnique(ids, `${field}.${key}`)
  }
  stringValue(shot.createdAt, `${field}.createdAt`)
  stringValue(shot.updatedAt, `${field}.updatedAt`)
  return id
}

function validateStoryboard(value: unknown, field: string) {
  const storyboard = record(value, field, ['version', 'shots', 'updatedAt'])
  stringValue(storyboard.version, `${field}.version`)
  stringValue(storyboard.updatedAt, `${field}.updatedAt`)
  const shots = arrayValue(storyboard.shots, `${field}.shots`, MAX_SHOTS)
  const ids: string[] = []
  for (let index = 0; index < shots.length; index += 1) {
    ids.push(validateShotCard(shots[index], `${field}.shots[${index}]`))
  }
  assertUnique(ids, `${field}.shots`)
}

function validateReceipt(value: unknown, field: string) {
  const receipt = record(value, field, ['identity', 'kind', 'resultId', 'targetId'])
  const identity = identifier(receipt.identity, `${field}.identity`)
  enumValue(receipt.kind, `${field}.kind`, [
    'scene',
    'beat',
    'shot-plan',
    'shot-card',
    'draft-node',
  ])
  identifier(receipt.resultId, `${field}.resultId`)
  identifier(receipt.targetId, `${field}.targetId`)
  return identity
}

function validateAudit(value: unknown, field: string) {
  const audit = record(value, field, ['createdAt', 'updatedAt'])
  stringValue(audit.createdAt, `${field}.createdAt`)
  stringValue(audit.updatedAt, `${field}.updatedAt`)
}

const RECIPE_FIELDS = [
  'schemaVersion',
  'recipeId',
  'projectId',
  'workflowId',
  'sourceNode',
  'sourceFingerprint',
  'activeStage',
  'scene',
  'beat',
  'shot',
  'findings',
  'storyboard',
  'receipts',
  'legacyImportStatus',
  'audit',
] as const

function validateRecipe(value: unknown): asserts value is StoryboardDirectorRecipe {
  const recipe = record(value, 'storyboardDirectorRecipe', RECIPE_FIELDS)
  if (recipe.schemaVersion !== STORYBOARD_DIRECTOR_RECIPE_VERSION) {
    fail('storyboardDirectorRecipe.schemaVersion is invalid')
  }
  const recipeId = identifier(recipe.recipeId, 'storyboardDirectorRecipe.recipeId')
  const projectId = identifier(recipe.projectId, 'storyboardDirectorRecipe.projectId')
  const workflowId = identifier(recipe.workflowId, 'storyboardDirectorRecipe.workflowId')
  const sourceNode = validateSourceNode(
    recipe.sourceNode,
    'storyboardDirectorRecipe.sourceNode',
  )
  const sourceFingerprint = identifier(
    recipe.sourceFingerprint,
    'storyboardDirectorRecipe.sourceFingerprint',
  )
  enumValue(recipe.activeStage, 'storyboardDirectorRecipe.activeStage', [
    'source',
    'scene-review',
    'beat-review',
    'shot-review',
  ])
  validateStage(recipe.scene, 'storyboardDirectorRecipe.scene', MAX_SCENES, validateSceneDraft)
  validateStage(recipe.beat, 'storyboardDirectorRecipe.beat', MAX_BEATS, validateBeatDraft)
  const shot = validateStage(
    recipe.shot,
    'storyboardDirectorRecipe.shot',
    MAX_SHOTS,
    validateShotDraft,
    true,
  )
  validateShotOptions(shot.options, 'storyboardDirectorRecipe.shot.options')

  const findings = arrayValue(recipe.findings, 'storyboardDirectorRecipe.findings')
  const findingIds: string[] = []
  for (let index = 0; index < findings.length; index += 1) {
    findingIds.push(validateFinding(findings[index], `storyboardDirectorRecipe.findings[${index}]`))
  }
  assertUnique(findingIds, 'storyboardDirectorRecipe.findings')
  validateStoryboard(recipe.storyboard, 'storyboardDirectorRecipe.storyboard')

  const receipts = arrayValue(recipe.receipts, 'storyboardDirectorRecipe.receipts')
  const receiptIds: string[] = []
  for (let index = 0; index < receipts.length; index += 1) {
    receiptIds.push(validateReceipt(receipts[index], `storyboardDirectorRecipe.receipts[${index}]`))
  }
  assertUnique(receiptIds, 'storyboardDirectorRecipe.receipts')
  enumValue(recipe.legacyImportStatus, 'storyboardDirectorRecipe.legacyImportStatus', [
    'not-offered',
    'available',
    'imported',
    'dismissed',
  ])
  validateAudit(recipe.audit, 'storyboardDirectorRecipe.audit')

  const expectedIdentity = createStoryboardDirectorRecipeIdentity(
    { projectId, workflowId },
    sourceNode,
  )
  if (recipeId !== expectedIdentity.recipeId
    || sourceFingerprint !== expectedIdentity.sourceFingerprint) {
    fail('Storyboard Director Recipe identity does not match its source snapshot')
  }
}

function readPositiveInteger(value: unknown, field: string) {
  if (!isPlainRecord(value)) fail(`${field} owner must be a plain object`)
  const property = ownData(value, field)
  if (property.status !== 'value') fail(`${field} must be an own data property`)
  return positiveInteger(property.value, field)
}

function invalid(code: 'STORYBOARD_RECIPE_INVALID'): StoryboardDirectorRecipeReadResult {
  return {
    status: 'invalid',
    issue: {
      code,
      message: 'Storyboard Director Recipe metadata is invalid',
    },
  }
}

function unsupported(
  code: 'STORYBOARD_RECIPE_VERSION_UNSUPPORTED',
): StoryboardDirectorRecipeReadResult {
  return {
    status: 'unsupported',
    issue: {
      code,
      message: 'Storyboard Director Recipe metadata version is unsupported',
    },
  }
}

export function cloneStoryboardDirectorRecipe(value: unknown): StoryboardDirectorRecipe {
  try {
    const clone = cloneJsonValue(value, new WeakSet<object>(), 'storyboardDirectorRecipe')
    validateRecipe(clone)
    return clone
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Storyboard Director Recipe could not be cloned')
  }
}

export function storyboardDirectorRecipeMetadata(recipe: StoryboardDirectorRecipe) {
  return { storyboardDirectorRecipe: cloneStoryboardDirectorRecipe(recipe) }
}

export function readStoryboardDirectorRecipe(
  metadataJson: unknown,
): StoryboardDirectorRecipeReadResult {
  if (!isObject(metadataJson)) return { status: 'absent' }
  try {
    const property = ownData(metadataJson, 'storyboardDirectorRecipe')
    if (property.status === 'absent') return { status: 'absent' }
    if (property.status !== 'value' || !isPlainRecord(metadataJson)) {
      return invalid('STORYBOARD_RECIPE_INVALID')
    }
    const version = readPositiveInteger(property.value, 'schemaVersion')
    if (version !== STORYBOARD_DIRECTOR_RECIPE_VERSION) {
      return unsupported('STORYBOARD_RECIPE_VERSION_UNSUPPORTED')
    }
    return { status: 'valid', recipe: cloneStoryboardDirectorRecipe(property.value) }
  } catch {
    return invalid('STORYBOARD_RECIPE_INVALID')
  }
}
