import { isCreatorSkillArtifact } from '../../../../lib/skills/artifacts'
import type {
  CreatorSkillEvidence,
  CreatorSkillRunResult,
} from '../../../../lib/skills/types'
import type {
  SceneBreakdownPayload,
  ScriptSceneDraft,
} from '../../../../lib/skills/script-segmentation/types'

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

export type CreatorSkillNodeMetadata = {
  creatorSkill: {
    skillId: string
    skillVersion: string
    runFingerprint: string
    sourceNodeIds: string[]
    sourceArtifactIds: string[]
    resultType: string
    resultId: string
    reviewStatus: 'approved'
    evidence: CreatorSkillEvidence[]
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
  approvedScenes: ApprovedSceneDraft[]
  existingNodes: Array<{ metadataJson?: unknown }>
}

type MaterializationResult = {
  create: SceneNodeMaterializationPlan[]
  duplicates: string[]
}

function fail(message: string): never {
  throw new TypeError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isTrimmedIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
}

function snapshotDenseArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`)

  const length = value.length
  const snapshot = new Array<T>(length)
  for (let index = 0; index < length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) {
      fail(`${field} must be a dense array`)
    }
    try {
      snapshot[index] = value[index] as T
    } catch {
      fail(`${field} contains an unreadable slot`)
    }
  }
  return snapshot
}

function isStringArray(value: unknown, field: string) {
  const entries = snapshotDenseArray<unknown>(value, field)
  for (let index = 0; index < entries.length; index += 1) {
    if (typeof entries[index] !== 'string') return false
  }
  return true
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isScriptSceneDraft(value: unknown): value is ScriptSceneDraft {
  if (!isRecord(value)) return false
  return isTrimmedIdentifier(value.sceneId)
    && isPositiveInteger(value.order)
    && typeof value.heading === 'string'
    && isOptionalString(value.location)
    && isOptionalString(value.timeOfDay)
    && isStringArray(value.characters, 'scene characters')
    && typeof value.actionSummary === 'string'
    && typeof value.sourceText === 'string'
    && Boolean(value.sourceText.trim())
    && isPositiveInteger(value.lineStart)
    && isPositiveInteger(value.lineEnd)
    && value.lineEnd >= value.lineStart
    && value.reviewStatus === 'pending'
}

function readPayload(value: unknown): SceneBreakdownPayload {
  if (!isRecord(value)) fail('scene-breakdown payload must be an object')
  if (value.format !== 'headed-script' && value.format !== 'paragraph-fallback') {
    fail('scene-breakdown payload format is invalid')
  }
  const scenes = snapshotDenseArray<unknown>(value.scenes, 'scene-breakdown scenes')
  if (scenes.length === 0) {
    fail('scene-breakdown scenes must be a nonempty dense array')
  }

  const sceneIds = new Set<string>()
  const orders = new Set<number>()
  const validatedScenes = new Array<ScriptSceneDraft>(scenes.length)
  for (let index = 0; index < scenes.length; index += 1) {
    const candidate = scenes[index]
    if (!isScriptSceneDraft(candidate)) fail('scene-breakdown scene is invalid')
    if (sceneIds.has(candidate.sceneId) || orders.has(candidate.order)) {
      fail('scene-breakdown scene IDs and orders must be unique')
    }
    sceneIds.add(candidate.sceneId)
    orders.add(candidate.order)
    validatedScenes[index] = candidate
  }

  return {
    format: value.format,
    scenes: validatedScenes,
  }
}

function findSceneBreakdown(
  result: CreatorSkillRunResult,
  sourceNodeId: string,
) {
  const artifacts = snapshotDenseArray<unknown>(result.artifacts, 'result artifacts')
  let candidate: unknown
  let candidateCount = 0
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]
    if (isRecord(artifact)
      && artifact.artifactType === 'scene-breakdown'
      && artifact.artifactVersion === 1) {
      candidate = artifact
      candidateCount += 1
    }
  }
  if (candidateCount !== 1 || !isCreatorSkillArtifact(candidate)) {
    fail('result must contain exactly one valid scene-breakdown Artifact v1')
  }

  const artifact = candidate
  if (artifact.sourceNodeIds.length !== 1 || artifact.sourceNodeIds[0] !== sourceNodeId) {
    fail('scene-breakdown source does not match the supplied source node')
  }

  return {
    artifactId: artifact.artifactId,
    payload: readPayload(artifact.payload),
  }
}

function readApprovals(
  approvedScenes: ApprovedSceneDraft[],
  artifactScenes: ScriptSceneDraft[],
) {
  const approvalEntries = snapshotDenseArray<unknown>(approvedScenes, 'approvedScenes')
  const artifactSceneIds = new Set<string>()
  for (let index = 0; index < artifactScenes.length; index += 1) {
    artifactSceneIds.add(artifactScenes[index]!.sceneId)
  }
  const approvals = new Map<string, ApprovedSceneDraft>()
  for (let index = 0; index < approvalEntries.length; index += 1) {
    const candidate = approvalEntries[index]
    if (!isRecord(candidate)) fail('approved scene must be an object')
    if (!isTrimmedIdentifier(candidate.sceneId) || !artifactSceneIds.has(candidate.sceneId)) {
      fail('approved scene does not exist in the Artifact')
    }
    if (approvals.has(candidate.sceneId)) fail('approved scene IDs must be unique')
    if (candidate.reviewStatus !== 'approved') fail('scene must be approved')
    if (typeof candidate.heading !== 'string') fail('approved scene heading must be a string')
    if (typeof candidate.sourceText !== 'string' || !candidate.sourceText.trim()) {
      fail('approved scene sourceText must be nonempty')
    }
    approvals.set(candidate.sceneId, candidate as ApprovedSceneDraft)
  }
  return approvals
}

function validEvidence(value: unknown): value is CreatorSkillEvidence {
  if (!isRecord(value)) return false
  return isTrimmedIdentifier(value.evidenceId)
    && isTrimmedIdentifier(value.ruleId)
    && isTrimmedIdentifier(value.sourceNodeId)
    && isPositiveInteger(value.lineStart)
    && isPositiveInteger(value.lineEnd)
    && value.lineEnd >= value.lineStart
    && typeof value.excerpt === 'string'
    && typeof value.explanation === 'string'
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

function cloneEvidenceArray(values: readonly CreatorSkillEvidence[]) {
  const clones = new Array<CreatorSkillEvidence>(values.length)
  for (let index = 0; index < values.length; index += 1) {
    clones[index] = cloneEvidence(values[index]!)
  }
  return clones
}

function matchingEvidence(
  evidence: readonly unknown[],
  sourceNodeId: string,
  scene: ScriptSceneDraft,
) {
  const matches: CreatorSkillEvidence[] = []
  for (let index = 0; index < evidence.length; index += 1) {
    const candidate = evidence[index]
    try {
      if (validEvidence(candidate)
        && candidate.sourceNodeId === sourceNodeId
        && candidate.lineStart === scene.lineStart
        && candidate.lineEnd === scene.lineEnd) {
        matches.push(cloneEvidence(candidate))
      }
    } catch {
      continue
    }
  }
  return matches
}

function duplicateResultIds(
  existingNodes: Array<{ metadataJson?: unknown }>,
  runFingerprint: string,
) {
  const nodes = snapshotDenseArray<{ metadataJson?: unknown }>(
    existingNodes,
    'existingNodes',
  )
  const duplicates = new Set<string>()

  for (let index = 0; index < nodes.length; index += 1) {
    try {
      const metadata = nodes[index]?.metadataJson
      if (!isRecord(metadata) || !isRecord(metadata.creatorSkill)) continue
      const creatorSkill = metadata.creatorSkill
      if (creatorSkill.skillId === SKILL_ID
        && creatorSkill.runFingerprint === runFingerprint
        && typeof creatorSkill.resultId === 'string') {
        duplicates.add(creatorSkill.resultId)
      }
    } catch {
      continue
    }
  }
  return duplicates
}

function planMaterialization(input: MaterializationInput): MaterializationResult {
  if (!isRecord(input)) fail('materialization input must be an object')
  if (!isTrimmedIdentifier(input.sourceNodeId)) {
    fail('sourceNodeId must be a trimmed nonempty string')
  }

  const { result } = input
  if (!isRecord(result)) fail('result must be an object')
  if (result.skillId !== SKILL_ID || result.skillVersion !== SKILL_VERSION) {
    fail('result Skill identity is invalid')
  }
  if (result.status !== 'ready' && result.status !== 'needs-review') {
    fail('result status is invalid for materialization')
  }
  if (typeof result.runFingerprint !== 'string'
    || !RUN_FINGERPRINT.test(result.runFingerprint)) {
    fail('result runFingerprint is invalid')
  }

  const artifact = findSceneBreakdown(result, input.sourceNodeId)
  const approvals = readApprovals(input.approvedScenes, artifact.payload.scenes)
  const existingResultIds = duplicateResultIds(input.existingNodes, result.runFingerprint)
  const resultEvidence = snapshotDenseArray<unknown>(result.evidence, 'result evidence')
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

    const sceneEvidence = matchingEvidence(
      resultEvidence,
      input.sourceNodeId,
      artifactScene,
    )
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
          evidence: cloneEvidenceArray(sceneEvidence),
        },
      },
      evidence: cloneEvidenceArray(sceneEvidence),
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
