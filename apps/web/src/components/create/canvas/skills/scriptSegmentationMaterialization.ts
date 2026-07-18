import type {
  CreatorSkillArtifact,
  CreatorSkillEvidence,
  CreatorSkillNodeMetadata as SharedCreatorSkillNodeMetadata,
  CreatorSkillRunResult,
} from '../../../../lib/skills/types'
import type { ScriptSceneDraft } from '../../../../lib/skills/script-segmentation/types'

const SKILL_ID = 'script-segmentation'
const SKILL_VERSION = '1.0.0'
const RUN_FINGERPRINT = /^csf1_[0-9a-f]{8}$/

export type ApprovedSceneDraft = Omit<
  ScriptSceneDraft,
  'heading' | 'sourceText' | 'reviewStatus'
> & {
  heading: string
  sourceText: string
  reviewStatus: 'approved'
}

export type ScriptSceneApprovalContext = {
  runFingerprint: string
  sourceArtifactId: string
}

export type CreatorSkillNodeMetadata = SharedCreatorSkillNodeMetadata & {
  creatorSkill: SharedCreatorSkillNodeMetadata['creatorSkill'] & {
    approvedArtifact: CreatorSkillArtifact
  }
}

export type SceneNodeMaterializationPlan = {
  resultId: string
  title: string
  prompt: string
  metadataJson: CreatorSkillNodeMetadata
  evidence: CreatorSkillEvidence[]
}

type MaterializationInput = {
  sourceNodeId: string
  result: CreatorSkillRunResult
  approvalContext: ScriptSceneApprovalContext
  approvedScenes: ApprovedSceneDraft[]
  existingNodes: Array<{ metadataJson?: unknown }>
}

type MaterializationResult = {
  create: SceneNodeMaterializationPlan[]
  duplicates: string[]
}

type OptionalStringSnapshot = {
  present: boolean
  value: string | undefined
}

type SceneSnapshot = {
  sceneId: string
  order: number
  heading: string
  location: OptionalStringSnapshot
  timeOfDay: OptionalStringSnapshot
  characters: string[]
  actionSummary: string
  sourceText: string
  lineStart: number
  lineEnd: number
  reviewStatus: 'pending' | 'approved'
}

type PayloadSnapshot = {
  format: 'headed-script' | 'paragraph-fallback'
  scenes: SceneSnapshot[]
}

type ResultSnapshot = {
  skillId: string
  skillVersion: string
  runFingerprint: string
  status: string
  artifacts: unknown
  evidence: unknown
}

const MISSING = Symbol('missing')

function fail(message: string): never {
  throw new TypeError(message)
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireRecord(value: unknown, field: string): Record<PropertyKey, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`)
  return value
}

function ownData(
  record: object,
  key: PropertyKey,
  field: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    fail(`${field} must be an own data property`)
  }
  return descriptor.value
}

function optionalOwnString(
  record: object,
  key: PropertyKey,
  field: string,
): OptionalStringSnapshot {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (!descriptor) {
    if (key in record) fail(`${field} must not be inherited`)
    return { present: false, value: undefined }
  }
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    fail(`${field} must be an own data property`)
  }
  if (descriptor.value !== undefined && typeof descriptor.value !== 'string') {
    fail(`${field} must be a string when present`)
  }
  return {
    present: true,
    value: descriptor.value as string | undefined,
  }
}

function tryOwnData(record: unknown, key: PropertyKey): unknown | typeof MISSING {
  if (!isRecord(record)) return MISSING
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key)
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return MISSING
    }
    return descriptor.value
  } catch {
    return MISSING
  }
}

function requiredString(record: object, key: PropertyKey, field: string) {
  const value = ownData(record, key, field)
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value
}

function requiredIdentifier(record: object, key: PropertyKey, field: string) {
  const value = requiredString(record, key, field)
  if (!value || value !== value.trim()) fail(`${field} must be a trimmed nonempty string`)
  return value
}

function requiredPositiveInteger(record: object, key: PropertyKey, field: string) {
  const value = ownData(record, key, field)
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    fail(`${field} must be a positive integer`)
  }
  return value
}

function snapshotDenseArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`)

  const lengthValue = ownData(value, 'length', `${field}.length`)
  if (typeof lengthValue !== 'number' || !Number.isInteger(lengthValue) || lengthValue < 0) {
    fail(`${field}.length must be a nonnegative integer`)
  }
  const snapshot = new Array<T>(lengthValue)
  for (let index = 0; index < lengthValue; index += 1) {
    snapshot[index] = ownData(value, index, `${field}[${index}]`) as T
  }
  return snapshot
}

function snapshotStringArray(value: unknown, field: string) {
  const values = snapshotDenseArray<unknown>(value, field)
  const snapshot = new Array<string>(values.length)
  for (let index = 0; index < values.length; index += 1) {
    const entry = values[index]
    if (typeof entry !== 'string') fail(`${field} must contain only strings`)
    snapshot[index] = entry
  }
  return snapshot
}

function snapshotIdentifierArray(value: unknown, field: string) {
  const identifiers = snapshotStringArray(value, field)
  for (let index = 0; index < identifiers.length; index += 1) {
    const identifier = identifiers[index]!
    if (!identifier || identifier !== identifier.trim()) {
      fail(`${field} must contain trimmed nonempty identifiers`)
    }
    if (index > 0 && identifiers[index - 1]! >= identifier) {
      fail(`${field} must be sorted and unique`)
    }
  }
  return identifiers
}

function snapshotScene(value: unknown, expectedStatus: 'pending' | 'approved'): SceneSnapshot {
  const scene = requireRecord(value, 'scene')
  const sceneId = requiredIdentifier(scene, 'sceneId', 'scene.sceneId')
  const order = requiredPositiveInteger(scene, 'order', 'scene.order')
  const heading = requiredString(scene, 'heading', 'scene.heading')
  const location = optionalOwnString(scene, 'location', 'scene.location')
  const timeOfDay = optionalOwnString(scene, 'timeOfDay', 'scene.timeOfDay')
  const characters = snapshotStringArray(
    ownData(scene, 'characters', 'scene.characters'),
    'scene.characters',
  )
  const actionSummary = requiredString(scene, 'actionSummary', 'scene.actionSummary')
  const sourceText = requiredString(scene, 'sourceText', 'scene.sourceText')
  if (!sourceText.trim()) fail('scene.sourceText must be nonempty')
  const lineStart = requiredPositiveInteger(scene, 'lineStart', 'scene.lineStart')
  const lineEnd = requiredPositiveInteger(scene, 'lineEnd', 'scene.lineEnd')
  if (lineEnd < lineStart) fail('scene line range is invalid')
  const reviewStatus = requiredString(scene, 'reviewStatus', 'scene.reviewStatus')
  if (reviewStatus !== expectedStatus) fail(`scene.reviewStatus must be ${expectedStatus}`)

  return {
    sceneId,
    order,
    heading,
    location,
    timeOfDay,
    characters,
    actionSummary,
    sourceText,
    lineStart,
    lineEnd,
    reviewStatus,
  }
}

function snapshotPayload(value: unknown): PayloadSnapshot {
  const payload = requireRecord(value, 'scene-breakdown payload')
  const format = requiredString(payload, 'format', 'scene-breakdown payload.format')
  if (format !== 'headed-script' && format !== 'paragraph-fallback') {
    fail('scene-breakdown payload format is invalid')
  }
  const sceneValues = snapshotDenseArray<unknown>(
    ownData(payload, 'scenes', 'scene-breakdown payload.scenes'),
    'scene-breakdown scenes',
  )
  if (sceneValues.length === 0) fail('scene-breakdown scenes must be nonempty')

  const scenes = new Array<SceneSnapshot>(sceneValues.length)
  const sceneIds = new Set<string>()
  const orders = new Set<number>()
  const ranges = new Set<string>()
  for (let index = 0; index < sceneValues.length; index += 1) {
    const scene = snapshotScene(sceneValues[index], 'pending')
    const range = `${scene.lineStart}:${scene.lineEnd}`
    if (sceneIds.has(scene.sceneId) || orders.has(scene.order) || ranges.has(range)) {
      fail('scene IDs, orders, and line ranges must be unique')
    }
    sceneIds.add(scene.sceneId)
    orders.add(scene.order)
    ranges.add(range)
    scenes[index] = scene
  }

  return { format, scenes }
}

function snapshotResult(value: unknown): ResultSnapshot {
  const result = requireRecord(value, 'result')
  return {
    skillId: requiredIdentifier(result, 'skillId', 'result.skillId'),
    skillVersion: requiredIdentifier(result, 'skillVersion', 'result.skillVersion'),
    runFingerprint: requiredIdentifier(result, 'runFingerprint', 'result.runFingerprint'),
    status: requiredString(result, 'status', 'result.status'),
    artifacts: ownData(result, 'artifacts', 'result.artifacts'),
    evidence: ownData(result, 'evidence', 'result.evidence'),
  }
}

function snapshotApprovalContext(value: unknown): ScriptSceneApprovalContext {
  const context = requireRecord(value, 'approvalContext')
  return {
    runFingerprint: requiredIdentifier(
      context,
      'runFingerprint',
      'approvalContext.runFingerprint',
    ),
    sourceArtifactId: requiredIdentifier(
      context,
      'sourceArtifactId',
      'approvalContext.sourceArtifactId',
    ),
  }
}

function findSceneBreakdown(artifactsValue: unknown, sourceNodeId: string) {
  const artifacts = snapshotDenseArray<unknown>(artifactsValue, 'result.artifacts')
  let artifactId = ''
  let payload: PayloadSnapshot | undefined
  let candidateCount = 0

  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]
    const artifactType = tryOwnData(artifact, 'artifactType')
    const artifactVersion = tryOwnData(artifact, 'artifactVersion')
    if (artifactType !== 'scene-breakdown' || artifactVersion !== 1) continue

    const record = requireRecord(artifact, 'scene-breakdown Artifact')
    const nextArtifactId = requiredIdentifier(record, 'artifactId', 'Artifact.artifactId')
    const sourceNodeIds = snapshotIdentifierArray(
      ownData(record, 'sourceNodeIds', 'Artifact.sourceNodeIds'),
      'Artifact.sourceNodeIds',
    )
    snapshotIdentifierArray(
      ownData(record, 'sourceArtifactIds', 'Artifact.sourceArtifactIds'),
      'Artifact.sourceArtifactIds',
    )
    if (sourceNodeIds.length !== 1 || sourceNodeIds[0] !== sourceNodeId) {
      fail('scene-breakdown source does not match the supplied source node')
    }

    artifactId = nextArtifactId
    payload = snapshotPayload(ownData(record, 'payload', 'Artifact.payload'))
    candidateCount += 1
  }

  if (candidateCount !== 1 || !payload) {
    fail('result must contain exactly one valid scene-breakdown Artifact v1')
  }
  return { artifactId, payload }
}

function sameOptionalString(left: OptionalStringSnapshot, right: OptionalStringSnapshot) {
  return left.value === right.value
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function immutableSceneFieldsMatch(approved: SceneSnapshot, artifact: SceneSnapshot) {
  return approved.sceneId === artifact.sceneId
    && approved.order === artifact.order
    && sameOptionalString(approved.location, artifact.location)
    && sameOptionalString(approved.timeOfDay, artifact.timeOfDay)
    && sameStringArray(approved.characters, artifact.characters)
    && approved.actionSummary === artifact.actionSummary
    && approved.lineStart === artifact.lineStart
    && approved.lineEnd === artifact.lineEnd
}

function readApprovals(approvedScenesValue: unknown, artifactScenes: SceneSnapshot[]) {
  const approvalValues = snapshotDenseArray<unknown>(approvedScenesValue, 'approvedScenes')
  const artifactById = new Map<string, SceneSnapshot>()
  for (let index = 0; index < artifactScenes.length; index += 1) {
    const scene = artifactScenes[index]!
    artifactById.set(scene.sceneId, scene)
  }

  const approvals = new Map<string, SceneSnapshot>()
  for (let index = 0; index < approvalValues.length; index += 1) {
    const approved = snapshotScene(approvalValues[index], 'approved')
    const artifact = artifactById.get(approved.sceneId)
    if (!artifact) fail('approved scene does not exist in the Artifact')
    if (approvals.has(approved.sceneId)) fail('approved scene IDs must be unique')
    if (!immutableSceneFieldsMatch(approved, artifact)) {
      fail('approved scene immutable fields do not match the Artifact')
    }
    approvals.set(approved.sceneId, approved)
  }
  return approvals
}

function snapshotEvidence(value: unknown): CreatorSkillEvidence {
  const evidence = requireRecord(value, 'evidence')
  const evidenceId = requiredIdentifier(evidence, 'evidenceId', 'evidence.evidenceId')
  const ruleId = requiredIdentifier(evidence, 'ruleId', 'evidence.ruleId')
  const sourceNodeId = requiredIdentifier(
    evidence,
    'sourceNodeId',
    'evidence.sourceNodeId',
  )
  const lineStart = requiredPositiveInteger(evidence, 'lineStart', 'evidence.lineStart')
  const lineEnd = requiredPositiveInteger(evidence, 'lineEnd', 'evidence.lineEnd')
  if (lineEnd < lineStart) fail('evidence line range is invalid')
  const excerpt = requiredString(evidence, 'excerpt', 'evidence.excerpt')
  const explanation = requiredString(evidence, 'explanation', 'evidence.explanation')

  return {
    evidenceId,
    ruleId,
    sourceNodeId,
    lineStart,
    lineEnd,
    excerpt,
    explanation,
  }
}

function expectedEvidenceId(order: number) {
  return `scene-evidence-${String(order).padStart(3, '0')}`
}

function validateEvidence(
  evidenceValue: unknown,
  sourceNodeId: string,
  payload: PayloadSnapshot,
) {
  const evidenceValues = snapshotDenseArray<unknown>(evidenceValue, 'result.evidence')
  if (evidenceValues.length !== payload.scenes.length) {
    fail('result evidence must map one-to-one to Artifact scenes')
  }

  const expectedRuleId = payload.format === 'headed-script'
    ? 'HEADED_SCENE_BOUNDARY'
    : 'FALLBACK_PARAGRAPH_BOUNDARY'
  const sceneByEvidenceId = new Map<string, SceneSnapshot>()
  for (let index = 0; index < payload.scenes.length; index += 1) {
    const scene = payload.scenes[index]!
    sceneByEvidenceId.set(expectedEvidenceId(scene.order), scene)
  }

  const evidenceIds = new Set<string>()
  const ranges = new Set<string>()
  const evidenceBySceneId = new Map<string, CreatorSkillEvidence>()
  for (let index = 0; index < evidenceValues.length; index += 1) {
    const evidence = snapshotEvidence(evidenceValues[index])
    if (evidenceIds.has(evidence.evidenceId)) fail('evidence IDs must be unique')
    evidenceIds.add(evidence.evidenceId)

    const scene = sceneByEvidenceId.get(evidence.evidenceId)
    if (!scene) fail('evidence ID is not canonical for an Artifact scene')
    const range = `${evidence.sourceNodeId}:${evidence.lineStart}:${evidence.lineEnd}`
    if (ranges.has(range)) fail('evidence scene ranges must be one-to-one')
    ranges.add(range)
    if (evidence.ruleId !== expectedRuleId
      || evidence.sourceNodeId !== sourceNodeId
      || evidence.lineStart !== scene.lineStart
      || evidence.lineEnd !== scene.lineEnd
      || evidence.excerpt !== scene.sourceText) {
      fail('evidence does not match its canonical Artifact scene')
    }
    if (evidenceBySceneId.has(scene.sceneId)) {
      fail('Artifact scene has ambiguous evidence')
    }
    evidenceBySceneId.set(scene.sceneId, evidence)
  }

  for (let index = 0; index < payload.scenes.length; index += 1) {
    if (!evidenceBySceneId.has(payload.scenes[index]!.sceneId)) {
      fail('Artifact scene is missing canonical evidence')
    }
  }
  return evidenceBySceneId
}

function cloneEvidence(value: CreatorSkillEvidence): CreatorSkillEvidence {
  return {
    evidenceId: value.evidenceId,
    ruleId: value.ruleId,
    sourceNodeId: value.sourceNodeId,
    lineStart: value.lineStart,
    lineEnd: value.lineEnd,
    excerpt: value.excerpt,
    explanation: value.explanation,
  }
}

function normalizeArtifactSourceText(value: string) {
  return value.replace(/\r\n?/g, '\n')
}

function lineCount(value: string) {
  let count = 1
  let offset = value.indexOf('\n')
  while (offset !== -1) {
    count += 1
    offset = value.indexOf('\n', offset + 1)
  }
  return count
}

function containsTrimmedLine(sourceText: string, expected: string) {
  let offset = 0
  while (offset <= sourceText.length) {
    const newline = sourceText.indexOf('\n', offset)
    const end = newline === -1 ? sourceText.length : newline
    if (sourceText.slice(offset, end).trim() === expected) return true
    if (newline === -1) return false
    offset = newline + 1
  }
  return false
}

function duplicateResultIds(existingNodesValue: unknown, runFingerprint: string) {
  const nodes = snapshotDenseArray<unknown>(existingNodesValue, 'existingNodes')
  const duplicates = new Set<string>()

  for (let index = 0; index < nodes.length; index += 1) {
    const metadata = tryOwnData(nodes[index], 'metadataJson')
    if (metadata === MISSING) continue
    const creatorSkill = tryOwnData(metadata, 'creatorSkill')
    if (creatorSkill === MISSING) continue
    const skillId = tryOwnData(creatorSkill, 'skillId')
    const fingerprint = tryOwnData(creatorSkill, 'runFingerprint')
    const resultId = tryOwnData(creatorSkill, 'resultId')
    if (skillId === SKILL_ID
      && fingerprint === runFingerprint
      && typeof resultId === 'string') {
      duplicates.add(resultId)
    }
  }
  return duplicates
}

function snapshotInput(value: unknown) {
  const input = requireRecord(value, 'materialization input')
  return {
    sourceNodeId: requiredIdentifier(input, 'sourceNodeId', 'sourceNodeId'),
    result: ownData(input, 'result', 'result'),
    approvalContext: ownData(input, 'approvalContext', 'approvalContext'),
    approvedScenes: ownData(input, 'approvedScenes', 'approvedScenes'),
    existingNodes: ownData(input, 'existingNodes', 'existingNodes'),
  }
}

function planMaterialization(inputValue: MaterializationInput): MaterializationResult {
  const input = snapshotInput(inputValue)
  const result = snapshotResult(input.result)
  if (result.skillId !== SKILL_ID || result.skillVersion !== SKILL_VERSION) {
    fail('result Skill identity is invalid')
  }
  if (result.status !== 'ready' && result.status !== 'needs-review') {
    fail('result status is invalid for materialization')
  }
  if (!RUN_FINGERPRINT.test(result.runFingerprint)) {
    fail('result runFingerprint is invalid')
  }

  const artifact = findSceneBreakdown(result.artifacts, input.sourceNodeId)
  const context = snapshotApprovalContext(input.approvalContext)
  if (context.runFingerprint !== result.runFingerprint
    || context.sourceArtifactId !== artifact.artifactId) {
    fail('approvalContext does not match the analyzed run and Artifact')
  }

  const evidenceBySceneId = validateEvidence(
    result.evidence,
    input.sourceNodeId,
    artifact.payload,
  )
  const approvals = readApprovals(input.approvedScenes, artifact.payload.scenes)
  const existingResultIds = duplicateResultIds(input.existingNodes, result.runFingerprint)
  const create: SceneNodeMaterializationPlan[] = []
  const duplicates: string[] = []

  for (let index = 0; index < artifact.payload.scenes.length; index += 1) {
    const artifactScene = artifact.payload.scenes[index]!
    const approved = approvals.get(artifactScene.sceneId)
    if (!approved) continue
    if (existingResultIds.has(artifactScene.sceneId)) {
      duplicates.push(artifactScene.sceneId)
      continue
    }

    const evidence = evidenceBySceneId.get(artifactScene.sceneId)
    if (!evidence) fail('approved scene is missing canonical evidence')
    const approvedSourceText = normalizeArtifactSourceText(approved.sourceText)
    const approvedHeading = approved.heading.trim()
    const preservesHeadedFormat = artifact.payload.format === 'headed-script'
      && Boolean(approvedHeading)
      && containsTrimmedLine(approvedSourceText, approvedHeading)
    const approvedArtifact: CreatorSkillArtifact = {
      artifactId: `scene-breakdown-${artifactScene.sceneId}-approved`,
      artifactType: 'scene-breakdown',
      artifactVersion: 1,
      sourceNodeIds: [input.sourceNodeId],
      sourceArtifactIds: [artifact.artifactId],
      payload: {
        format: preservesHeadedFormat ? 'headed-script' : 'paragraph-fallback',
        scenes: [{
          sceneId: artifactScene.sceneId,
          order: artifactScene.order,
          heading: preservesHeadedFormat ? approvedHeading : '',
          ...(approved.location.value !== undefined ? { location: approved.location.value } : {}),
          ...(approved.timeOfDay.value !== undefined ? { timeOfDay: approved.timeOfDay.value } : {}),
          characters: approved.characters.slice(),
          actionSummary: artifactScene.actionSummary,
          sourceText: approvedSourceText,
          lineStart: artifactScene.lineStart,
          lineEnd: artifactScene.lineStart + lineCount(approvedSourceText) - 1,
          reviewStatus: 'pending',
        }],
      },
    }
    create.push({
      resultId: artifactScene.sceneId,
      title: approved.heading.trim() || `场景 ${artifactScene.order}`,
      prompt: approved.sourceText,
      metadataJson: {
        creatorSkill: {
          skillId: SKILL_ID,
          skillVersion: SKILL_VERSION,
          runFingerprint: result.runFingerprint,
          sourceNodeIds: [input.sourceNodeId],
          sourceArtifactIds: [artifact.artifactId],
          resultType: 'scene',
          resultId: artifactScene.sceneId,
          reviewStatus: 'approved',
          evidence: [cloneEvidence(evidence)],
          approvedArtifact,
        },
      },
      evidence: [cloneEvidence(evidence)],
    })
  }

  return { create, duplicates }
}

export function planScriptSceneMaterialization(
  input: MaterializationInput,
): MaterializationResult {
  try {
    return planMaterialization(input)
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('materialization input could not be read')
  }
}
