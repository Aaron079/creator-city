import type {
  NarrativeBeatMapPayload,
  ShotPlanPayload,
} from '../../../../lib/skills'
import { cloneAndValidateStoryboardState } from '../../../../lib/storyboard/director'
import {
  createRecipeMaterializationIdentity,
  createStoryboardDirectorPartialBatchIdentity,
} from '../../../../lib/storyboard/recipe/identity'
import {
  analyzeStoryboardDirectorRecipe,
  summarizeStoryboardDirectorRecipe,
} from '../../../../lib/storyboard/recipe/intelligence'
import {
  storyboardDirectorRecipeMetadata,
  readStoryboardDirectorRecipe,
} from '../../../../lib/storyboard/recipe/persistence'
import {
  STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  type StoryboardDirectorMaterializationReceipt,
  type StoryboardDirectorPartialBatch,
  type StoryboardDirectorPartialBatchOperation,
  type StoryboardDirectorRecipe,
} from '../../../../lib/storyboard/recipe/types'
import type { ShotCard, StoryboardState } from '../../../../lib/storyboard/types'
import {
  planNarrativeBeatMaterialization,
  planShotPlanMaterialization,
  type ApprovedNarrativeBeat,
  type ApprovedNarrativeBeatScene,
  type ApprovedShotPlan,
  type ApprovedShotPlanScene,
} from './groupedSkillMaterialization'
import {
  planScriptSceneMaterialization,
  type ApprovedSceneDraft,
} from './scriptSegmentationMaterialization'

const MATERIALIZATION_KINDS = [
  'scene',
  'beat',
  'shot-plan',
  'shot-card',
  'draft-node',
] as const
const MAX_EXISTING_NODES = 10_000
const MAX_METADATA_ITEMS = 120
const MAX_GROUPED_KINDS = 3
const MAX_GROUPED_ARTIFACT_DEPTH = 16
const MAX_GROUPED_ARTIFACT_NODES = 10_000

type GroupedKind = 'scene' | 'beat' | 'shot-plan'
type ExistingNode = { metadataJson?: unknown; title?: string; prompt?: string }
type ExistingControlNode = ExistingNode & { id: string }

type SafeRead =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'value'; value: unknown }

function fail(message: string): never {
  throw new TypeError(message)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  try {
    if (Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function ownData(value: unknown, key: PropertyKey): SafeRead {
  if (!value || typeof value !== 'object') return { status: 'absent' }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) {
      let prototype = Object.getPrototypeOf(value)
      while (prototype) {
        if (Object.getOwnPropertyDescriptor(prototype, key)) return { status: 'invalid' }
        prototype = Object.getPrototypeOf(prototype)
      }
      return { status: 'absent' }
    }
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { status: 'invalid' }
    }
    return { status: 'value', value: descriptor.value }
  } catch {
    return { status: 'invalid' }
  }
}

function ownValue(value: unknown, key: PropertyKey) {
  const property = ownData(value, key)
  return property.status === 'value' ? property.value : undefined
}

function snapshotDenseArray<T>(
  value: unknown,
  field: string,
  maxLength: number,
): T[] {
  try {
    if (!Array.isArray(value)) fail(`${field} must be an array`)
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(field)) throw error
    return fail(`${field} must be a readable array`)
  }
  let lengthDescriptor: PropertyDescriptor | undefined
  let keys: PropertyKey[]
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
    keys = Reflect.ownKeys(value)
  } catch {
    return fail(`${field} array descriptors are unreadable`)
  }
  if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
    fail(`${field}.length must be an own data property`)
  }
  const length = lengthDescriptor.value
  if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) {
    fail(`${field}.length exceeds its bounded dense-array limit`)
  }
  for (const key of keys) {
    if (typeof key !== 'string' || key === 'length' || !/^(0|[1-9][0-9]*)$/u.test(key)) {
      continue
    }
    const index = Number(key)
    if (Number.isSafeInteger(index) && index >= length) {
      fail(`${field} contains an out-of-range indexed property`)
    }
  }
  const snapshot = new Array<T>(length)
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    } catch {
      return fail(`${field}[${index}] descriptor is unreadable`)
    }
    if (!descriptor
      || !descriptor.enumerable
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      fail(`${field} must be dense with own enumerable data elements`)
    }
    snapshot[index] = descriptor.value as T
  }
  return snapshot
}

function snapshotExistingNodes<T extends ExistingNode>(value: unknown, field: string): T[] {
  const nodes = snapshotDenseArray<unknown>(value, field, MAX_EXISTING_NODES)
  return nodes.map((node, index) => {
    if (!isPlainRecord(node)) fail(`${field}[${index}] must be a plain object`)
    return node as T
  })
}

function exactOwnKeys(value: unknown, expected: readonly string[]) {
  if (!isPlainRecord(value)) return false
  try {
    const keys = Reflect.ownKeys(value)
    return keys.length === expected.length
      && keys.every((key) => typeof key === 'string' && expected.includes(key))
  } catch {
    return false
  }
}

function requiredId(value: unknown, field: string) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail(`${field} must be a trimmed nonempty string`)
  }
  return value
}

function sourceArtifactId(
  artifact: StoryboardDirectorRecipe['scene']['approvedArtifact'],
  field: string,
) {
  if (!artifact || artifact.sourceArtifactIds.length !== 1) {
    fail(`${field} approved Artifact must identify one source Artifact`)
  }
  return requiredId(artifact.sourceArtifactIds[0], `${field} source Artifact ID`)
}

function assertNoBlockingFindings(recipe: StoryboardDirectorRecipe) {
  if (analyzeStoryboardDirectorRecipe(recipe).some((finding) => finding.severity === 'blocking')) {
    fail('Storyboard Director Recipe has blocking Intelligence findings')
  }
}

function assertRecipeReadyForRequestedKinds(
  recipe: StoryboardDirectorRecipe,
  kinds: GroupedKind[],
) {
  assertNoBlockingFindings(recipe)
  const requested = new Set<GroupedKind>()
  for (const kind of kinds) {
    if (kind !== 'scene' && kind !== 'beat' && kind !== 'shot-plan') {
      fail('Storyboard Director grouped materialization kind is invalid')
    }
    requested.add(kind)
  }
  const stages = [
    ['scene', recipe.scene],
    ['beat', recipe.beat],
    ['shot-plan', recipe.shot],
  ] as const
  for (const [kind, stage] of stages) {
    if (!requested.has(kind)) continue
    if (stage.status !== 'approved' || !stage.result || !stage.approvedArtifact) {
      fail(`Storyboard Director ${kind} stage is not ready for materialization`)
    }
  }
}

function assertShotMaterializationReady(recipe: StoryboardDirectorRecipe) {
  assertNoBlockingFindings(recipe)
  if (recipe.shot.status !== 'approved'
    || !recipe.shot.result
    || !recipe.shot.approvedArtifact) {
    fail('Storyboard Director shot stage is not ready for materialization')
  }
}

export type StoryboardDirectorControlNodePlan = {
  title: '分镜导演'
  prompt: string
  metadataJson: { storyboardDirectorRecipe: StoryboardDirectorRecipe }
  edgeLabel: '分镜导演'
  edgeToolId: 'storyboard-director'
  edgeToolIcon: '🎬'
}

export function storyboardDirectorRecipeSummary(recipe: StoryboardDirectorRecipe) {
  const summary = summarizeStoryboardDirectorRecipe(recipe)
  return [
    '分镜导演 Recipe',
    `当前阶段: ${recipe.activeStage}`,
    `已批准: ${summary.approvedScenes} 场景 / ${summary.approvedBeats} 节拍 / ${summary.approvedShots} 镜头`,
    `节拍覆盖: ${summary.coveredBeats}/${summary.approvedBeats}`,
    `待处理: ${summary.blockingCount} 阻塞 / ${summary.advisoryCount} 提醒`,
    `来源: ${summary.sourceFresh ? '有效' : '已变化'}`,
    `落地: ${summary.ready ? '可执行' : '未就绪'}`,
  ].join('\n')
}

function controlNodePlan(recipe: StoryboardDirectorRecipe): StoryboardDirectorControlNodePlan {
  return {
    title: '分镜导演',
    prompt: storyboardDirectorRecipeSummary(recipe),
    metadataJson: storyboardDirectorRecipeMetadata(recipe),
    edgeLabel: '分镜导演',
    edgeToolId: 'storyboard-director',
    edgeToolIcon: '🎬',
  }
}

function findRecipeIdentityMatches(
  recipeId: string,
  snapshotNodes: ExistingControlNode[],
) {
  const valid: string[] = []
  const invalid: string[] = []
  for (let index = 0; index < snapshotNodes.length; index += 1) {
    const node = snapshotNodes[index]
    const nodeId = ownValue(node, 'id')
    if (typeof nodeId !== 'string' || !nodeId || nodeId !== nodeId.trim()) {
      fail(`existingNodes[${index}].id must be a trimmed nonempty string`)
    }
    const metadata = ownData(node, 'metadataJson')
    if (metadata.status === 'absent') continue
    if (metadata.status === 'value' && metadata.value == null) continue
    if (metadata.status !== 'value' || !isPlainRecord(metadata.value)) {
      invalid.push(nodeId)
      continue
    }
    const stored = ownData(metadata.value, 'storyboardDirectorRecipe')
    if (stored.status === 'absent') continue
    if (stored.status !== 'value' || !isPlainRecord(stored.value)) {
      invalid.push(nodeId)
      continue
    }
    const storedId = ownData(stored.value, 'recipeId')
    if (storedId.status !== 'value'
      || typeof storedId.value !== 'string'
      || !storedId.value
      || storedId.value !== storedId.value.trim()) {
      invalid.push(nodeId)
      continue
    }
    if (storedId.value !== recipeId) continue
    const read = readStoryboardDirectorRecipe(metadata.value)
    if (read.status === 'valid' && read.recipe.recipeId === recipeId) {
      valid.push(nodeId)
    } else {
      invalid.push(nodeId)
    }
  }
  return { valid, invalid }
}

export function planStoryboardDirectorControlNode(
  recipe: StoryboardDirectorRecipe,
  existingNodes: ExistingControlNode[],
):
  | { status: 'create'; plan: StoryboardDirectorControlNodePlan }
  | { status: 'existing'; nodeId: string }
  | { status: 'conflict'; nodeIds: string[] } {
  const nodes = snapshotExistingNodes<ExistingControlNode>(existingNodes, 'existingNodes')
  const matches = findRecipeIdentityMatches(recipe.recipeId, nodes)
  if (matches.invalid.length || matches.valid.length > 1) {
    return { status: 'conflict', nodeIds: [...matches.valid, ...matches.invalid] }
  }
  if (matches.valid.length === 1) return { status: 'existing', nodeId: matches.valid[0]! }
  return { status: 'create', plan: controlNodePlan(recipe) }
}

function approvedSceneDrafts(recipe: StoryboardDirectorRecipe): ApprovedSceneDraft[] {
  return recipe.scene.drafts.flatMap(({ decision, ...scene }) => (
    decision === 'approved'
      ? [{ ...scene, reviewStatus: 'approved' as const }]
      : []
  ))
}

function approvedBeatScenes(recipe: StoryboardDirectorRecipe): ApprovedNarrativeBeatScene[] {
  const artifact = recipe.beat.approvedArtifact
  if (!artifact) fail('Storyboard Director beat approved Artifact is missing')
  const payload = artifact.payload as NarrativeBeatMapPayload
  const approved = new Map<string, ApprovedNarrativeBeat[]>()
  for (const { decision, ...beat } of recipe.beat.drafts) {
    if (decision === 'approved') {
      const sceneBeats = approved.get(beat.sceneId) ?? []
      sceneBeats.push({ ...beat, reviewStatus: 'approved' })
      approved.set(beat.sceneId, sceneBeats)
    }
  }
  return payload.scenes.map((scene) => ({
    sceneId: scene.sceneId,
    order: scene.order,
    heading: scene.heading,
    beats: approved.get(scene.sceneId) ?? [],
  }))
}

function approvedShotScenes(recipe: StoryboardDirectorRecipe): ApprovedShotPlanScene[] {
  const artifact = recipe.shot.approvedArtifact
  if (!artifact) fail('Storyboard Director shot approved Artifact is missing')
  const payload = artifact.payload as ShotPlanPayload
  const approved = new Map<string, ApprovedShotPlan[]>()
  for (const { decision, ...shot } of recipe.shot.drafts) {
    if (decision === 'approved') {
      const sceneShots = approved.get(shot.sceneId) ?? []
      sceneShots.push({ ...shot, reviewStatus: 'approved' })
      approved.set(shot.sceneId, sceneShots)
    }
  }
  return payload.scenes.map((scene) => ({
    sceneId: scene.sceneId,
    order: scene.order,
    heading: scene.heading,
    shots: approved.get(scene.sceneId) ?? [],
  }))
}

function sceneMaterializationInput(
  recipe: StoryboardDirectorRecipe,
  existingNodes: ExistingNode[],
) {
  if (!recipe.scene.result || !recipe.scene.approvedArtifact) {
    fail('Storyboard Director scene stage is incomplete')
  }
  return {
    sourceNodeId: recipe.sourceNode.id,
    result: recipe.scene.result,
    approvalContext: {
      runFingerprint: recipe.scene.result.runFingerprint,
      sourceArtifactId: sourceArtifactId(recipe.scene.approvedArtifact, 'scene'),
    },
    approvedScenes: approvedSceneDrafts(recipe),
    existingNodes,
  }
}

function beatMaterializationInput(
  recipe: StoryboardDirectorRecipe,
  existingNodes: ExistingNode[],
) {
  if (!recipe.beat.result || !recipe.beat.approvedArtifact) {
    fail('Storyboard Director beat stage is incomplete')
  }
  return {
    result: recipe.beat.result,
    approvalContext: {
      runFingerprint: recipe.beat.result.runFingerprint,
      sourceArtifactId: sourceArtifactId(recipe.beat.approvedArtifact, 'beat'),
    },
    approvedScenes: approvedBeatScenes(recipe),
    existingNodes,
  }
}

function shotMaterializationInput(
  recipe: StoryboardDirectorRecipe,
  existingNodes: ExistingNode[],
) {
  if (!recipe.shot.result || !recipe.shot.approvedArtifact) {
    fail('Storyboard Director shot stage is incomplete')
  }
  return {
    result: recipe.shot.result,
    approvalContext: {
      runFingerprint: recipe.shot.result.runFingerprint,
      sourceArtifactId: sourceArtifactId(recipe.shot.approvedArtifact, 'shot'),
    },
    approvedScenes: approvedShotScenes(recipe),
    existingNodes,
  }
}

type GroupedNodePlan = {
  resultId: string
  metadataJson: Record<string, unknown>
}

const GROUPED_CREATOR_SKILL_KEYS = [
  'skillId',
  'skillVersion',
  'runFingerprint',
  'sourceNodeIds',
  'sourceArtifactIds',
  'resultType',
  'resultId',
  'reviewStatus',
  'evidence',
  'approvedArtifact',
] as const

type ExpectedComparisonState = {
  nodes: number
  ancestors: WeakSet<object>
}

function expectedArrayValues(
  value: unknown,
  expectedLength: number,
): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null
  } catch {
    return null
  }
  let lengthDescriptor: PropertyDescriptor | undefined
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
  } catch {
    return null
  }
  if (!lengthDescriptor
    || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
    || lengthDescriptor.value !== expectedLength) return null
  let keys: PropertyKey[]
  try {
    keys = Reflect.ownKeys(value)
  } catch {
    return null
  }
  if (keys.length !== expectedLength + 1) return null
  const result = new Array<unknown>(expectedLength)
  for (let index = 0; index < expectedLength; index += 1) {
    let descriptor: PropertyDescriptor | undefined
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    } catch {
      return null
    }
    if (!descriptor
      || !descriptor.enumerable
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
    result[index] = descriptor.value
  }
  return result
}

function expectedValueMatches(
  value: unknown,
  expected: unknown,
  state: ExpectedComparisonState,
  depth = 0,
): boolean {
  state.nodes += 1
  if (state.nodes > MAX_GROUPED_ARTIFACT_NODES || depth > MAX_GROUPED_ARTIFACT_DEPTH) {
    return false
  }
  if (expected === null
    || typeof expected === 'boolean'
    || typeof expected === 'number') return value === expected
  if (typeof expected === 'string') {
    return typeof value === 'string'
      && value.length === expected.length
      && value === expected
  }
  if (!expected || typeof expected !== 'object'
    || !value || typeof value !== 'object') return false
  if (state.ancestors.has(value)) return false
  state.ancestors.add(value)
  try {
    if (Array.isArray(expected)) {
      const values = expectedArrayValues(value, expected.length)
      if (!values) return false
      for (let index = 0; index < expected.length; index += 1) {
        if (!expectedValueMatches(values[index], expected[index], state, depth + 1)) {
          return false
        }
      }
      return true
    }
    if (!isPlainRecord(expected) || !isPlainRecord(value)) return false
    let expectedKeys: PropertyKey[]
    let actualKeys: PropertyKey[]
    try {
      expectedKeys = Reflect.ownKeys(expected)
      actualKeys = Reflect.ownKeys(value)
    } catch {
      return false
    }
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) {
      return false
    }
    for (const key of expectedKeys) {
      if (typeof key !== 'string') return false
      const actual = ownData(value, key)
      const expectedProperty = ownData(expected, key)
      if (actual.status !== 'value'
        || expectedProperty.status !== 'value'
        || !expectedValueMatches(actual.value, expectedProperty.value, state, depth + 1)) {
        return false
      }
    }
    return true
  } finally {
    state.ancestors.delete(value)
  }
}

function expectedArtifactMatches(value: unknown, expected: unknown) {
  return expectedValueMatches(value, expected, {
    nodes: 0,
    ancestors: new WeakSet<object>(),
  })
}

function strictGroupedMetadataMatches(metadata: unknown, plan: GroupedNodePlan) {
  if (!exactOwnKeys(metadata, ['creatorSkill'])) return false
  const creatorSkill = ownValue(metadata, 'creatorSkill')
  const expectedSkill = ownValue(plan.metadataJson, 'creatorSkill')
  if (!exactOwnKeys(creatorSkill, GROUPED_CREATOR_SKILL_KEYS)
    || !exactOwnKeys(expectedSkill, GROUPED_CREATOR_SKILL_KEYS)) return false
  for (const key of [
    'skillId',
    'skillVersion',
    'runFingerprint',
    'resultType',
    'resultId',
    'reviewStatus',
  ] as const) {
    if (ownValue(creatorSkill, key) !== ownValue(expectedSkill, key)) return false
  }
  if (!sameScalarRecordArray(
    ownValue(creatorSkill, 'sourceNodeIds'),
    ownValue(expectedSkill, 'sourceNodeIds'),
    'grouped metadata creatorSkill.sourceNodeIds',
  ) || !sameScalarRecordArray(
    ownValue(creatorSkill, 'sourceArtifactIds'),
    ownValue(expectedSkill, 'sourceArtifactIds'),
    'grouped metadata creatorSkill.sourceArtifactIds',
  ) || !sameScalarRecordArray(
    ownValue(creatorSkill, 'evidence'),
    ownValue(expectedSkill, 'evidence'),
    'grouped metadata creatorSkill.evidence',
  )) return false
  return expectedArtifactMatches(
    ownValue(creatorSkill, 'approvedArtifact'),
    ownValue(expectedSkill, 'approvedArtifact'),
  )
}

function snapshotGroupedExistingMetadata(
  nodes: ExistingNode[],
  expectedPlans: GroupedNodePlan[],
) {
  const expectedByRun = new Map<string, Map<string, GroupedNodePlan>>()
  for (const plan of expectedPlans) {
    const creatorSkill = ownValue(plan.metadataJson, 'creatorSkill')
    const skillId = requiredId(
      ownValue(creatorSkill, 'skillId'),
      'expected grouped metadata skillId',
    )
    const runFingerprint = requiredId(
      ownValue(creatorSkill, 'runFingerprint'),
      'expected grouped metadata runFingerprint',
    )
    const key = `${skillId}\n${runFingerprint}`
    const byResult = expectedByRun.get(key) ?? new Map<string, GroupedNodePlan>()
    byResult.set(plan.resultId, plan)
    expectedByRun.set(key, byResult)
  }
  const snapshots: ExistingNode[] = []
  for (let index = 0; index < nodes.length; index += 1) {
    const metadata = ownData(nodes[index], 'metadataJson')
    if (metadata.status === 'absent') {
      snapshots.push({})
      continue
    }
    if (metadata.status !== 'value' || !isPlainRecord(metadata.value)) {
      fail(`existingNodes[${index}] grouped metadata is unreadable`)
    }
    const creatorSkill = ownData(metadata.value, 'creatorSkill')
    if (creatorSkill.status === 'absent') {
      snapshots.push({ metadataJson: {} })
      continue
    }
    if (creatorSkill.status !== 'value' || !isPlainRecord(creatorSkill.value)) {
      fail(`existingNodes[${index}] grouped metadata creatorSkill is unreadable`)
    }
    const skillId = ownData(creatorSkill.value, 'skillId')
    const runFingerprint = ownData(creatorSkill.value, 'runFingerprint')
    const resultId = ownData(creatorSkill.value, 'resultId')
    if (skillId.status === 'invalid'
      || runFingerprint.status === 'invalid'
      || resultId.status === 'invalid') {
      fail(`existingNodes[${index}] grouped metadata identity is unreadable`)
    }
    const skillValue = skillId.status === 'value' && typeof skillId.value === 'string'
      ? skillId.value
      : undefined
    const runValue = runFingerprint.status === 'value' && typeof runFingerprint.value === 'string'
      ? runFingerprint.value
      : undefined
    const resultValue = resultId.status === 'value' && typeof resultId.value === 'string'
      ? resultId.value
      : undefined
    if (skillValue !== undefined && runValue !== undefined) {
      const candidates = expectedByRun.get(`${skillValue}\n${runValue}`)
      if (candidates) {
        if (resultValue === undefined) {
          fail(`existingNodes[${index}] matching grouped metadata resultId is malformed`)
        }
        const plan = candidates.get(resultValue)
        if (plan && !strictGroupedMetadataMatches(metadata.value, plan)) {
          fail(`existingNodes[${index}] matching grouped metadata is incomplete or conflicting`)
        }
      }
    }
    snapshots.push({
      metadataJson: {
        creatorSkill: {
          ...(skillValue !== undefined ? { skillId: skillValue } : {}),
          ...(runValue !== undefined ? { runFingerprint: runValue } : {}),
          ...(resultValue !== undefined ? { resultId: resultValue } : {}),
        },
      },
    })
  }
  return snapshots
}

export function planStoryboardDirectorGroupedNodes(
  recipe: StoryboardDirectorRecipe,
  kinds: GroupedKind[],
  existingNodes: ExistingNode[],
) {
  const requestedKinds = snapshotDenseArray<GroupedKind>(kinds, 'kinds', MAX_GROUPED_KINDS)
  const nodes = snapshotExistingNodes<ExistingNode>(existingNodes, 'existingNodes')
  assertRecipeReadyForRequestedKinds(recipe, requestedKinds)
  const expectedScene = requestedKinds.includes('scene')
    ? planScriptSceneMaterialization(sceneMaterializationInput(recipe, []))
    : { create: [], duplicates: [] }
  const expectedBeat = requestedKinds.includes('beat')
    ? planNarrativeBeatMaterialization(beatMaterializationInput(recipe, []))
    : { create: [], duplicates: [] }
  const expectedShot = requestedKinds.includes('shot-plan')
    ? planShotPlanMaterialization(shotMaterializationInput(recipe, []))
    : { create: [], duplicates: [] }
  const groupedNodes = snapshotGroupedExistingMetadata(nodes, [
    ...expectedScene.create,
    ...expectedBeat.create,
    ...expectedShot.create,
  ])
  const scene = requestedKinds.includes('scene')
    ? planScriptSceneMaterialization(sceneMaterializationInput(recipe, groupedNodes))
    : { create: [], duplicates: [] }
  const beat = requestedKinds.includes('beat')
    ? planNarrativeBeatMaterialization(beatMaterializationInput(recipe, groupedNodes))
    : { create: [], duplicates: [] }
  const shot = requestedKinds.includes('shot-plan')
    ? planShotPlanMaterialization(shotMaterializationInput(recipe, groupedNodes))
    : { create: [], duplicates: [] }
  return {
    create: [...scene.create, ...beat.create, ...shot.create],
    duplicates: [...scene.duplicates, ...beat.duplicates, ...shot.duplicates],
  }
}

function approvedShots(recipe: StoryboardDirectorRecipe): ApprovedShotPlan[] {
  return recipe.shot.drafts.flatMap(({ decision, ...shot }) => (
    decision === 'approved'
      ? [{ ...shot, reviewStatus: 'approved' as const }]
      : []
  ))
}

function recipeShotCard(
  recipe: StoryboardDirectorRecipe,
  shot: ApprovedShotPlan,
  index: number,
  now: string,
): ShotCard {
  const shotType = {
    wide: 'ELS',
    full: 'LS',
    medium: 'MS',
    close: 'CU',
    'extreme-close': 'ECU',
  }[shot.suggestedShotSize]
  return {
    id: `recipe-${recipe.recipeId}-${shot.shotId}`,
    index,
    title: `S${String(index + 1).padStart(2, '0')}`,
    shotType,
    durationSec: shot.duration,
    directorNote: `${shot.objective}\n${shot.action}`.trim(),
    nodeIds: [],
    createdAt: now,
    updatedAt: now,
    recipe: {
      recipeId: recipe.recipeId,
      sourceArtifactId: recipe.shot.approvedArtifact!.artifactId,
      sceneId: shot.sceneId,
      ...(shot.beatId ? { beatId: shot.beatId } : {}),
      shotId: shot.shotId,
    },
  }
}

function sameRecipeFields(left: ShotCard, right: ShotCard) {
  return left.shotType === right.shotType
    && left.durationSec === right.durationSec
    && left.directorNote === right.directorNote
    && left.recipe?.recipeId === right.recipe?.recipeId
    && left.recipe?.sourceArtifactId === right.recipe?.sourceArtifactId
    && left.recipe?.sceneId === right.recipe?.sceneId
    && left.recipe?.beatId === right.recipe?.beatId
    && left.recipe?.shotId === right.recipe?.shotId
}

export function planStoryboardDirectorShotBoardSync(
  recipe: StoryboardDirectorRecipe,
  currentState: StoryboardState,
  now: string,
) {
  assertShotMaterializationReady(recipe)
  const current = cloneAndValidateStoryboardState(currentState)
  const cards = current.shots.slice()
  const cardIds = new Set(cards.map((card) => card.id))
  const sameRecipeIndexes = new Map<string, number>()
  for (let index = 0; index < cards.length; index += 1) {
    const provenance = cards[index]!.recipe
    if (provenance?.recipeId !== recipe.recipeId) continue
    if (sameRecipeIndexes.has(provenance.shotId)) {
      fail('Storyboard shot board has duplicate matching Recipe shots')
    }
    sameRecipeIndexes.set(provenance.shotId, index)
  }

  const createdShotIds: string[] = []
  const updatedShotIds: string[] = []
  const reviewedShots = approvedShots(recipe)
  let changed = current.version !== '2'
  for (const shot of reviewedShots) {
    const existingIndex = sameRecipeIndexes.get(shot.shotId)
    if (existingIndex === undefined) {
      const planned = recipeShotCard(recipe, shot, cards.length, now)
      if (cardIds.has(planned.id)) {
        fail(`Storyboard shot card ID conflict: ${planned.id}`)
      }
      cards.push(planned)
      cardIds.add(planned.id)
      sameRecipeIndexes.set(shot.shotId, cards.length - 1)
      createdShotIds.push(shot.shotId)
      changed = true
      continue
    }
    const existing = cards[existingIndex]!
    const planned = recipeShotCard(recipe, shot, existingIndex, now)
    if (sameRecipeFields(existing, planned)) continue
    cards[existingIndex] = {
      ...existing,
      shotType: planned.shotType,
      durationSec: planned.durationSec,
      directorNote: planned.directorNote,
      recipe: planned.recipe,
      nodeIds: existing.nodeIds.slice(),
      updatedAt: now,
    }
    updatedShotIds.push(shot.shotId)
    changed = true
  }

  const reviewedShotIds = new Set(reviewedShots.map((shot) => shot.shotId))
  const currentSlots: number[] = []
  for (let index = 0; index < cards.length; index += 1) {
    const provenance = cards[index]!.recipe
    if (provenance?.recipeId === recipe.recipeId && reviewedShotIds.has(provenance.shotId)) {
      currentSlots.push(index)
    }
  }
  const reviewedCards = reviewedShots.map((shot) => {
    const index = sameRecipeIndexes.get(shot.shotId)
    if (index === undefined) fail('Storyboard shot board is missing a planned Recipe card')
    return cards[index]!
  })
  for (let index = 0; index < currentSlots.length; index += 1) {
    const slot = currentSlots[index]!
    const card = reviewedCards[index]!
    if (cards[slot] !== card) changed = true
    cards[slot] = card
  }

  const reindexed = cards.map((card, index) => {
    const title = card.recipe?.recipeId === recipe.recipeId
      ? `S${String(index + 1).padStart(2, '0')}`
      : card.title
    if (card.index === index && card.title === title) return card
    changed = true
    return { ...card, index, title }
  })
  const state = cloneAndValidateStoryboardState({
    version: '2',
    shots: reindexed,
    updatedAt: changed ? now : current.updatedAt,
  })
  return {
    state,
    createdShotIds,
    updatedShotIds,
  }
}

export type StoryboardDirectorDraftNodePlan = {
  identity: string
  resultId: string
  kind: 'image' | 'video'
  title: string
  prompt: string
  metadataJson: Record<string, unknown>
}

function evidenceForShot(recipe: StoryboardDirectorRecipe, shot: ApprovedShotPlan) {
  return (recipe.shot.result?.evidence ?? []).filter((item) => (
    item.lineStart === shot.lineStart
    && item.lineEnd === shot.lineEnd
    && item.excerpt === shot.sourceText
  )).map((item) => ({ ...item }))
}

function draftNodePlan(
  recipe: StoryboardDirectorRecipe,
  shot: ApprovedShotPlan,
): StoryboardDirectorDraftNodePlan {
  const result = recipe.shot.result!
  const artifact = recipe.shot.approvedArtifact!
  const resultArtifact = result.artifacts[0]
  if (!resultArtifact) fail('Storyboard Director shot result Artifact is missing')
  const identity = createRecipeMaterializationIdentity(
    recipe.recipeId,
    'draft-node',
    artifact.artifactId,
    shot.shotId,
  )
  const kindLabel = shot.outputKind === 'video' ? `视频 ${shot.duration}s` : '图片'
  const details = [
    shot.subject.trim() ? `主体：${shot.subject.trim()}` : '',
    shot.action.trim() ? `行动：${shot.action.trim()}` : '',
    `景别：${shot.suggestedShotSize}`,
  ].filter(Boolean)
  return {
    identity,
    resultId: shot.shotId,
    kind: shot.outputKind,
    title: `镜头 · ${shot.suggestedShotSize} · ${kindLabel}`,
    prompt: `${shot.objective.trim() || shot.sourceText}\n\n[${details.join(' · ')}]`,
    metadataJson: {
      duration: shot.duration,
      outputKind: shot.outputKind,
      shotId: shot.shotId,
      storyboardDirectorMaterialization: {
        recipeId: recipe.recipeId,
        shotId: shot.shotId,
        sourceArtifactId: artifact.artifactId,
        identity,
        outputKind: shot.outputKind,
        duration: shot.duration,
      },
      creatorSkill: {
        skillId: result.skillId,
        skillVersion: result.skillVersion,
        runFingerprint: result.runFingerprint,
        sourceNodeIds: resultArtifact.sourceNodeIds.slice(),
        sourceArtifactIds: [resultArtifact.artifactId],
        resultType: 'shot-draft',
        resultId: shot.shotId,
        reviewStatus: 'approved',
        evidence: evidenceForShot(recipe, shot),
      },
    },
  }
}

function strictDraftMetadataMatches(
  metadata: unknown,
  plan: StoryboardDirectorDraftNodePlan,
) {
  if (!exactOwnKeys(metadata, [
    'duration',
    'outputKind',
    'shotId',
    'storyboardDirectorMaterialization',
    'creatorSkill',
  ])) return false
  const expected = plan.metadataJson
  if (ownValue(metadata, 'duration') !== expected.duration
    || ownValue(metadata, 'outputKind') !== expected.outputKind
    || ownValue(metadata, 'shotId') !== expected.shotId) return false
  const materialization = ownValue(metadata, 'storyboardDirectorMaterialization')
  const expectedMaterialization = expected.storyboardDirectorMaterialization
  if (!exactOwnKeys(materialization, [
    'recipeId',
    'shotId',
    'sourceArtifactId',
    'identity',
    'outputKind',
    'duration',
  ])) return false
  for (const key of [
    'recipeId',
    'shotId',
    'sourceArtifactId',
    'identity',
    'outputKind',
    'duration',
  ] as const) {
    if (ownValue(materialization, key) !== ownValue(expectedMaterialization, key)) return false
  }
  const creatorSkill = ownValue(metadata, 'creatorSkill')
  const expectedSkill = expected.creatorSkill
  if (!exactOwnKeys(creatorSkill, [
    'skillId',
    'skillVersion',
    'runFingerprint',
    'sourceNodeIds',
    'sourceArtifactIds',
    'resultType',
    'resultId',
    'reviewStatus',
    'evidence',
  ])) return false
  for (const key of [
    'skillId',
    'skillVersion',
    'runFingerprint',
    'resultType',
    'resultId',
    'reviewStatus',
  ] as const) {
    if (ownValue(creatorSkill, key) !== ownValue(expectedSkill, key)) return false
  }
  return sameScalarRecordArray(
    ownValue(creatorSkill, 'sourceNodeIds'),
    ownValue(expectedSkill, 'sourceNodeIds'),
    'metadata.creatorSkill.sourceNodeIds',
  ) && sameScalarRecordArray(
    ownValue(creatorSkill, 'sourceArtifactIds'),
    ownValue(expectedSkill, 'sourceArtifactIds'),
    'metadata.creatorSkill.sourceArtifactIds',
  ) && sameScalarRecordArray(
    ownValue(creatorSkill, 'evidence'),
    ownValue(expectedSkill, 'evidence'),
    'metadata.creatorSkill.evidence',
  )
}

function sameScalarRecordArray(left: unknown, right: unknown, field: string): boolean {
  const leftItems = snapshotDenseArray<unknown>(left, field, MAX_METADATA_ITEMS)
  const rightItems = snapshotDenseArray<unknown>(right, `${field} expected`, MAX_METADATA_ITEMS)
  if (leftItems.length !== rightItems.length) return false
  for (let index = 0; index < leftItems.length; index += 1) {
    const leftItem = leftItems[index]
    const rightItem = rightItems[index]
    if (isPlainRecord(leftItem) || isPlainRecord(rightItem)) {
      if (!isPlainRecord(leftItem) || !isPlainRecord(rightItem)) return false
      let keys: PropertyKey[]
      try {
        keys = Reflect.ownKeys(rightItem)
      } catch {
        return false
      }
      if (!exactOwnKeys(leftItem, keys.filter((key): key is string => typeof key === 'string'))) {
        return false
      }
      for (const key of keys) {
        if (typeof key !== 'string' || ownValue(leftItem, key) !== ownValue(rightItem, key)) {
          return false
        }
      }
      continue
    }
    if (leftItem !== rightItem) return false
  }
  return true
}

export function planStoryboardDirectorDraftNodes(
  recipe: StoryboardDirectorRecipe,
  existingNodes: ExistingNode[],
) {
  assertShotMaterializationReady(recipe)
  const plans = approvedShots(recipe).map((shot) => draftNodePlan(recipe, shot))
  const byIdentity = new Map(plans.map((plan) => [plan.identity, plan]))
  const existing = new Set<string>()
  const nodes = snapshotExistingNodes<ExistingNode>(existingNodes, 'existingNodes')
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]!
    const metadata = ownData(node, 'metadataJson')
    if (metadata.status === 'absent') continue
    if (metadata.status !== 'value' || !isPlainRecord(metadata.value)) {
      fail(`existingNodes[${index}].metadataJson is malformed`)
    }
    const materialization = ownData(metadata.value, 'storyboardDirectorMaterialization')
    if (materialization.status === 'absent') continue
    if (materialization.status !== 'value' || !isPlainRecord(materialization.value)) {
      fail(`existingNodes[${index}] Storyboard Director metadata is malformed`)
    }
    const identity = ownData(materialization.value, 'identity')
    if (identity.status !== 'value' || typeof identity.value !== 'string') {
      fail(`existingNodes[${index}] Storyboard Director identity is malformed`)
    }
    const identityValue = requiredId(
      identity.value,
      `existingNodes[${index}] Storyboard Director metadata identity`,
    )
    const plan = byIdentity.get(identityValue)
    if (!plan) continue
    if (!strictDraftMetadataMatches(metadata.value, plan)) {
      fail('matching Storyboard Director draft metadata is malformed')
    }
    if (existing.has(identityValue)) {
      fail('duplicate Storyboard Director draft materialization identity')
    }
    existing.add(identityValue)
  }
  return {
    create: plans.filter((plan) => !existing.has(plan.identity)),
    duplicates: plans.filter((plan) => existing.has(plan.identity)).map((plan) => plan.identity),
  }
}

function uniqueApprovedSceneIds(
  drafts: Array<{ decision: string; sceneId: string }>,
) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const draft of drafts) {
    if (draft.decision !== 'approved' || seen.has(draft.sceneId)) continue
    seen.add(draft.sceneId)
    result.push(draft.sceneId)
  }
  return result
}

function expectedReceiptClaims(recipe: StoryboardDirectorRecipe) {
  const expected = new Map<string, Omit<StoryboardDirectorMaterializationReceipt, 'targetId'>>()
  const add = (
    kind: StoryboardDirectorMaterializationReceipt['kind'],
    artifactId: string,
    resultIds: string[],
  ) => {
    for (const resultId of resultIds) {
      const identity = createRecipeMaterializationIdentity(
        recipe.recipeId,
        kind,
        artifactId,
        resultId,
      )
      expected.set(identity, { identity, kind, resultId })
    }
  }
  if (recipe.scene.approvedArtifact) {
    for (const item of recipe.scene.drafts.filter((draft) => draft.decision === 'approved')) {
      add('scene', `scene-breakdown-${item.sceneId}-approved`, [item.sceneId])
    }
  }
  if (recipe.beat.approvedArtifact) {
    for (const sceneId of uniqueApprovedSceneIds(recipe.beat.drafts)) {
      add('beat', `narrative-beat-map-${sceneId}-approved`, [sceneId])
    }
  }
  if (recipe.shot.approvedArtifact) {
    const shotSceneIds = uniqueApprovedSceneIds(recipe.shot.drafts)
    const shotIds = recipe.shot.drafts
      .filter((item) => item.decision === 'approved')
      .map((item) => item.shotId)
    for (const sceneId of shotSceneIds) {
      add('shot-plan', `shot-plan-${sceneId}-approved`, [sceneId])
    }
    add('shot-card', recipe.shot.approvedArtifact.artifactId, shotIds)
    add('draft-node', recipe.shot.approvedArtifact.artifactId, shotIds)
  }
  return expected
}

function snapshotReceipt(
  value: unknown,
  field: string,
): StoryboardDirectorMaterializationReceipt {
  if (!exactOwnKeys(value, ['identity', 'kind', 'resultId', 'targetId'])) {
    fail(`${field} is malformed`)
  }
  const identity = requiredId(ownValue(value, 'identity'), `${field}.identity`)
  const kind = ownValue(value, 'kind')
  if (!MATERIALIZATION_KINDS.includes(
    kind as StoryboardDirectorMaterializationReceipt['kind'],
  )) fail(`${field}.kind is invalid`)
  return {
    identity,
    kind: kind as StoryboardDirectorMaterializationReceipt['kind'],
    resultId: requiredId(ownValue(value, 'resultId'), `${field}.resultId`),
    targetId: requiredId(ownValue(value, 'targetId'), `${field}.targetId`),
  }
}

export function recordStoryboardDirectorReceipts(
  recipe: StoryboardDirectorRecipe,
  completed: Array<{
    identity: string
    kind: StoryboardDirectorMaterializationReceipt['kind']
    resultId: string
    targetId: string
  }>,
  now: string,
) {
  const expected = expectedReceiptClaims(recipe)
  const existingReceipts = snapshotDenseArray<unknown>(
    recipe.receipts,
    'recipe.receipts',
    STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  )
  const completedItems = snapshotDenseArray<unknown>(
    completed,
    'completed',
    STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  )
  const receipts: StoryboardDirectorMaterializationReceipt[] = []
  const byIdentity = new Map<string, StoryboardDirectorMaterializationReceipt>()
  const validate = (receipt: StoryboardDirectorMaterializationReceipt) => {
    const claim = expected.get(receipt.identity)
    if (!claim || claim.kind !== receipt.kind || claim.resultId !== receipt.resultId) {
      fail('receipt claim does not match a deterministic materialization plan')
    }
  }
  for (let index = 0; index < existingReceipts.length; index += 1) {
    const receipt = snapshotReceipt(existingReceipts[index], `recipe.receipts[${index}]`)
    validate(receipt)
    const existing = byIdentity.get(receipt.identity)
    if (existing && existing.targetId !== receipt.targetId) fail('receipt conflict')
    if (existing) fail('duplicate receipt identity')
    byIdentity.set(receipt.identity, receipt)
    receipts.push(receipt)
  }

  let changed = false
  for (let index = 0; index < completedItems.length; index += 1) {
    const item = snapshotReceipt(completedItems[index], `completed[${index}]`)
    validate(item)
    const existing = byIdentity.get(item.identity)
    if (existing && existing.targetId !== item.targetId) fail('receipt conflict')
    if (existing) continue
    byIdentity.set(item.identity, item)
    receipts.push(item)
    changed = true
  }
  if (!changed) return recipe
  return {
    ...recipe,
    receipts,
    audit: { ...recipe.audit, updatedAt: now },
  }
}

export function removeStoryboardDirectorReceiptsForTarget(
  recipe: StoryboardDirectorRecipe,
  targetId: string,
  now: string,
) {
  const stableTargetId = requiredId(targetId, 'targetId')
  const removedReceipts = recipe.receipts.filter((receipt) => (
    receipt.targetId === stableTargetId
  ))
  if (removedReceipts.length === 0) {
    return { recipe, removedReceipts: [] as StoryboardDirectorMaterializationReceipt[] }
  }
  return {
    recipe: {
      ...recipe,
      receipts: recipe.receipts.filter((receipt) => receipt.targetId !== stableTargetId),
      audit: { ...recipe.audit, updatedAt: now },
    },
    removedReceipts: removedReceipts.map((receipt) => ({ ...receipt })),
  }
}

export function storyboardDirectorPartialBatchBlockers(
  recipe: StoryboardDirectorRecipe,
): StoryboardDirectorPartialBatch[] {
  return recipe.findings.flatMap((finding) => (
    finding.code === 'PARTIAL_MATERIALIZATION_BATCH'
      && finding.severity === 'blocking'
      && finding.partialBatch
      ? [{
          ...finding.partialBatch,
          plannedIdentities: [...finding.partialBatch.plannedIdentities],
          successfulTargetIds: [...finding.partialBatch.successfulTargetIds],
        }]
      : []
  ))
}

export function recordStoryboardDirectorRecoveryBatch(
  recipe: StoryboardDirectorRecipe,
  operation: StoryboardDirectorPartialBatchOperation,
  plannedIdentities: string[],
  completed: Array<{
    identity: string
    targetId: string
    receipt?: StoryboardDirectorMaterializationReceipt
  }>,
  now: string,
  receiptRecorder: (
    recipe: StoryboardDirectorRecipe,
    receipt: StoryboardDirectorMaterializationReceipt,
    now: string,
  ) => StoryboardDirectorRecipe = (current, receipt, auditTime) => (
    recordStoryboardDirectorReceipts(current, [receipt], auditTime)
  ),
) {
  const plannedItems = snapshotDenseArray<unknown>(
    plannedIdentities,
    'plannedIdentities',
    STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  ).map((value, index) => requiredId(value, `plannedIdentities[${index}]`)).sort()
  if (plannedItems.length === 0 || new Set(plannedItems).size !== plannedItems.length) {
    fail('plannedIdentities must contain unique deterministic identities')
  }
  const completedItems = snapshotDenseArray<unknown>(
    completed,
    'completed',
    STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  ).map((value, index) => {
    if (!isPlainRecord(value)) fail(`completed[${index}] is malformed`)
    let keys: PropertyKey[]
    try {
      keys = Reflect.ownKeys(value)
    } catch {
      return fail(`completed[${index}] descriptors are unreadable`)
    }
    if (keys.some((key) => (
      typeof key !== 'string'
      || !['identity', 'targetId', 'receipt'].includes(key)
    ))) fail(`completed[${index}] is malformed`)
    const receiptValue = ownData(value, 'receipt')
    if (receiptValue.status === 'invalid') {
      fail(`completed[${index}].receipt is malformed`)
    }
    return {
      identity: requiredId(ownValue(value, 'identity'), `completed[${index}].identity`),
      targetId: requiredId(ownValue(value, 'targetId'), `completed[${index}].targetId`),
      ...(receiptValue.status === 'value'
        ? { receipt: snapshotReceipt(receiptValue.value, `completed[${index}].receipt`) }
        : {}),
    }
  })
  const plannedSet = new Set(plannedItems)
  const successfulTargetIds: string[] = []
  const completedIdentities = new Set<string>()
  for (const item of completedItems) {
    if (!plannedSet.has(item.identity) || completedIdentities.has(item.identity)) {
      fail('completed receipt does not belong to this partial batch')
    }
    completedIdentities.add(item.identity)
    successfulTargetIds.push(item.targetId)
  }
  if (new Set(successfulTargetIds).size !== successfulTargetIds.length) {
    fail('partial batch target IDs must be unique')
  }
  const uncreatedCount = plannedItems.length - completedItems.length
  const batchId = createStoryboardDirectorPartialBatchIdentity(
    recipe.recipeId,
    operation,
    plannedItems,
  )
  const blocker: StoryboardDirectorPartialBatch = {
    batchId,
    operation,
    plannedCount: plannedItems.length,
    createdCount: completedItems.length,
    uncreatedCount,
    plannedIdentities: plannedItems,
    successfulTargetIds,
  }
  const noun = operation === 'draft-node-creation' ? 'draft nodes' : 'nodes'
  const blockedRecipe: StoryboardDirectorRecipe = {
    ...recipe,
    findings: [
      ...recipe.findings.filter((finding) => finding.findingId !== batchId.replace(/^sdrb1_/, 'sdrf1_')),
      {
        findingId: batchId.replace(/^sdrb1_/, 'sdrf1_'),
        severity: 'blocking',
        code: 'PARTIAL_MATERIALIZATION_BATCH',
        message: `Created ${completedItems.length} ${noun}; ${uncreatedCount} were not created. Receipt persistence requires inspection before acknowledging this batch.`,
        evidenceIds: [],
        partialBatch: blocker,
      },
    ],
    audit: { ...recipe.audit, updatedAt: now },
  }
  let recordedRecipe = blockedRecipe
  let receiptsRecorded = true
  for (const item of completedItems) {
    if (!item.receipt) {
      receiptsRecorded = false
      continue
    }
    try {
      recordedRecipe = receiptRecorder(recordedRecipe, item.receipt, now)
    } catch {
      receiptsRecorded = false
    }
  }
  return { recipe: recordedRecipe, blocker, receiptsRecorded }
}

export function recordStoryboardDirectorPartialBatch(
  recipe: StoryboardDirectorRecipe,
  operation: StoryboardDirectorPartialBatchOperation,
  plannedIdentities: string[],
  completed: Array<{
    identity: string
    kind: StoryboardDirectorMaterializationReceipt['kind']
    resultId: string
    targetId: string
  }>,
  now: string,
) {
  const completedItems = snapshotDenseArray<unknown>(
    completed,
    'completed',
    STORYBOARD_DIRECTOR_MAX_RECEIPTS,
  ).map((value, index) => snapshotReceipt(value, `completed[${index}]`))
  return recordStoryboardDirectorRecoveryBatch(
    recipe,
    operation,
    plannedIdentities,
    completedItems.map((receipt) => ({
      identity: receipt.identity,
      targetId: receipt.targetId,
      receipt,
    })),
    now,
  )
}

export function acknowledgeStoryboardDirectorPartialBatch(
  recipe: StoryboardDirectorRecipe,
  batchId: string,
  now: string,
) {
  const stableBatchId = requiredId(batchId, 'batchId')
  const findings = recipe.findings.filter((finding) => (
    finding.code !== 'PARTIAL_MATERIALIZATION_BATCH'
    || finding.partialBatch?.batchId !== stableBatchId
  ))
  if (findings.length === recipe.findings.length) return recipe
  return {
    ...recipe,
    findings,
    audit: { ...recipe.audit, updatedAt: now },
  }
}

export function attemptStoryboardDirectorRecipeCommit(
  recipe: StoryboardDirectorRecipe,
  commit: (nextRecipe: StoryboardDirectorRecipe) => boolean | void,
) {
  try {
    return commit(recipe) !== false
  } catch {
    return false
  }
}

export function importLegacyShotBoard(
  recipe: StoryboardDirectorRecipe,
  legacyState: StoryboardState,
  now: string,
) {
  if (recipe.storyboard.shots.length !== 0) {
    fail('Cannot import legacy Storyboard state into a nonempty cloud shot board')
  }
  let storyboard: StoryboardState
  try {
    storyboard = cloneAndValidateStoryboardState(legacyState)
  } catch {
    return fail('Legacy Storyboard state is invalid')
  }
  return {
    ...recipe,
    storyboard: { ...storyboard, updatedAt: now },
    legacyImportStatus: 'imported' as const,
    audit: { ...recipe.audit, updatedAt: now },
  }
}
