import { isCreatorSkillArtifact } from './artifacts'
import {
  CREATOR_EXECUTABLE_SKILL_REGISTRY,
  getExecutableCreatorSkillFromRegistry,
} from './executable-registry'
import { createCreatorSkillFingerprint } from './fingerprint'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillIssue,
  CreatorSkillRunInput,
  CreatorSkillRunResult,
  CreatorSkillSourceNode,
  CreatorSkillTarget,
} from './types'

const FALLBACK_FINGERPRINT = 'csf1_00000000'
const CREATOR_SKILL_TARGETS = new Set<CreatorSkillTarget>(['text', 'image', 'video'])
const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

class InvalidArtifactError extends TypeError {}

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function cloneInputValue(value: unknown, active = new WeakSet<object>()): unknown {
  if (value === null) return null

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return value
  if (valueType === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Input numbers must be finite')
    return value
  }
  if (valueType === 'undefined') return undefined
  if (valueType !== 'object') throw new TypeError(`Unsupported input value: ${valueType}`)

  const objectValue = value as object
  if (active.has(objectValue)) throw new TypeError('Cyclic Creator Skill input')

  if (Array.isArray(value)) {
    active.add(objectValue)
    try {
      return value
        .filter((item) => item !== undefined)
        .map((item) => cloneInputValue(item, active))
    } finally {
      active.delete(objectValue)
    }
  }

  const prototype = Object.getPrototypeOf(objectValue)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Unsupported input value: ${objectValue.constructor?.name ?? 'object'}`)
  }
  if (Object.getOwnPropertySymbols(objectValue).length > 0) {
    throw new TypeError('Unsupported input value: symbol key')
  }

  active.add(objectValue)
  const clone: Record<string, unknown> = {}
  try {
    for (const key of Object.keys(objectValue).sort(compareStrings)) {
      const clonedValue = cloneInputValue((value as Record<string, unknown>)[key], active)
      if (clonedValue !== undefined) clone[key] = clonedValue
    }
  } finally {
    active.delete(objectValue)
  }
  return clone
}

function normalizeIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeSourceNode(value: unknown): CreatorSkillSourceNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Source nodes must be objects')
  }
  const sourceNode = value as Record<string, unknown>
  if (!CREATOR_SKILL_TARGETS.has(sourceNode.kind as CreatorSkillTarget)) {
    throw new TypeError(`Invalid source node kind: ${String(sourceNode.kind)}`)
  }
  if (typeof sourceNode.title !== 'string' || typeof sourceNode.prompt !== 'string') {
    throw new TypeError('Source node title and prompt must be strings')
  }
  if (sourceNode.resultText !== undefined && typeof sourceNode.resultText !== 'string') {
    throw new TypeError('Source node resultText must be a string when provided')
  }

  return {
    id: normalizeIdentifier(sourceNode.id, 'sourceNode.id'),
    kind: sourceNode.kind as CreatorSkillTarget,
    title: sourceNode.title,
    prompt: sourceNode.prompt,
    ...(sourceNode.resultText !== undefined ? { resultText: sourceNode.resultText } : {}),
    ...(sourceNode.metadataJson !== undefined
      ? { metadataJson: cloneInputValue(sourceNode.metadataJson) }
      : {}),
  }
}

function normalizeArtifact(value: unknown): CreatorSkillArtifact {
  if (!isCreatorSkillArtifact(value)) {
    throw new InvalidArtifactError('Artifact must use the canonical Creator Skill shape')
  }
  let payload: unknown
  try {
    payload = cloneInputValue(value.payload)
  } catch {
    throw new InvalidArtifactError('Artifact payload must use supported input values')
  }
  return {
    artifactId: value.artifactId,
    artifactType: value.artifactType,
    artifactVersion: value.artifactVersion,
    sourceNodeIds: [...value.sourceNodeIds],
    sourceArtifactIds: [...value.sourceArtifactIds],
    payload,
  }
}

function normalizeProjectContext(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('projectContext must be an object')
  }
  const context = value as Record<string, unknown>
  if (context.projectId !== undefined && typeof context.projectId !== 'string') {
    throw new TypeError('projectContext.projectId must be a string')
  }
  if (context.workflowId !== undefined && typeof context.workflowId !== 'string') {
    throw new TypeError('projectContext.workflowId must be a string')
  }
  return {
    ...(context.projectId !== undefined
      ? { projectId: normalizeIdentifier(context.projectId, 'projectContext.projectId') }
      : {}),
    ...(context.workflowId !== undefined
      ? { workflowId: normalizeIdentifier(context.workflowId, 'projectContext.workflowId') }
      : {}),
  }
}

function normalizeRunInput(value: CreatorSkillRunInput): CreatorSkillRunInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Creator Skill input must be an object')
  }
  if (!Array.isArray(value.sourceNodes)) {
    throw new TypeError('sourceNodes must be an array')
  }
  if (value.artifacts !== undefined && !Array.isArray(value.artifacts)) {
    throw new InvalidArtifactError('artifacts must be an array')
  }
  if (value.options !== undefined) {
    const prototype = value.options && Object.getPrototypeOf(value.options)
    if (!value.options || (prototype !== Object.prototype && prototype !== null)) {
      throw new TypeError('options must be a plain object')
    }
  }

  const sourceNodes = value.sourceNodes
    .map(normalizeSourceNode)
    .sort((left, right) => compareStrings(left.id, right.id))
  const artifacts = value.artifacts
    ?.map(normalizeArtifact)
    .sort((left, right) => (
      compareStrings(left.artifactType, right.artifactType)
      || compareStrings(left.artifactId, right.artifactId)
    ))

  return {
    sourceNodes,
    ...(artifacts ? { artifacts } : {}),
    ...(value.projectContext !== undefined
      ? { projectContext: normalizeProjectContext(value.projectContext) }
      : {}),
    ...(value.options !== undefined
      ? { options: cloneInputValue(value.options) as Record<string, unknown> }
      : {}),
  }
}

function blockedResult(
  skillId: string,
  skillVersion: string,
  runFingerprint: string,
  code: string,
  message: string,
): CreatorSkillRunResult {
  const blocker: CreatorSkillIssue = { code, message }
  return {
    skillId,
    skillVersion,
    runFingerprint,
    status: 'blocked',
    artifacts: [],
    evidence: [],
    warnings: [],
    blockers: [blocker],
  }
}

function hasSupportedInput(skill: CreatorExecutableSkill, input: CreatorSkillRunInput) {
  const { manifest } = skill
  const hasAcceptedNode = input.sourceNodes.some((node) => (
    manifest.acceptedNodeKinds.includes(node.kind)
  ))
  const hasAcceptedArtifact = (input.artifacts ?? []).some((artifact) => (
    manifest.acceptedArtifactTypes.includes(artifact.artifactType)
  ))
  const hasUnsupportedNode = input.sourceNodes.some((node) => (
    !manifest.acceptedNodeKinds.includes(node.kind)
  ))
  const hasUnsupportedArtifact = (input.artifacts ?? []).some((artifact) => (
    !manifest.acceptedArtifactTypes.includes(artifact.artifactType)
  ))

  return (hasAcceptedNode || hasAcceptedArtifact)
    && !hasUnsupportedNode
    && !hasUnsupportedArtifact
}

function isValidExecutionResult(
  value: unknown,
  outputArtifactTypes: string[],
): value is CreatorSkillRunResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Partial<CreatorSkillRunResult>
  if (!['ready', 'needs-review', 'blocked'].includes(result.status ?? '')) return false
  if (!Array.isArray(result.artifacts)
    || !Array.isArray(result.evidence)
    || !Array.isArray(result.warnings)
    || !Array.isArray(result.blockers)) {
    return false
  }
  return result.artifacts.every((artifact) => (
    isCreatorSkillArtifact(artifact)
    && outputArtifactTypes.includes(artifact.artifactType)
  ))
}

export function runCreatorSkillFromRegistry(
  registry: ReadonlyMap<string, CreatorExecutableSkill>,
  skillId: string,
  input: CreatorSkillRunInput,
  skillVersion?: string,
): CreatorSkillRunResult {
  const normalizedSkillId = typeof skillId === 'string' ? skillId.trim() : ''
  const normalizedSkillVersion = typeof skillVersion === 'string' ? skillVersion.trim() : ''
  const hasInvalidVersion = skillVersion !== undefined
    && (typeof skillVersion !== 'string'
      || !SEMANTIC_VERSION_PATTERN.test(normalizedSkillVersion))
  if (!normalizedSkillId || hasInvalidVersion) {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'INVALID_SKILL_INPUT',
      'Creator Skill identity or version is invalid.',
    )
  }

  let skill: CreatorExecutableSkill | null
  try {
    skill = getExecutableCreatorSkillFromRegistry(registry, skillId, skillVersion)
  } catch {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'INVALID_SKILL_INPUT',
      'Creator Skill lookup failed.',
    )
  }
  if (!skill) {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'SKILL_NOT_FOUND',
      'Executable Creator Skill was not found.',
    )
  }

  const { id, version, outputArtifactTypes } = skill.manifest
  let normalizedInput: CreatorSkillRunInput
  let runFingerprint: string
  try {
    normalizedInput = normalizeRunInput(input)
    runFingerprint = createCreatorSkillFingerprint(id, version, normalizedInput)
  } catch (error) {
    const invalidArtifact = error instanceof InvalidArtifactError
    return blockedResult(
      id,
      version,
      FALLBACK_FINGERPRINT,
      invalidArtifact ? 'INVALID_SKILL_ARTIFACT' : 'INVALID_SKILL_INPUT',
      invalidArtifact
        ? 'Creator Skill input contains a malformed Artifact.'
        : 'Creator Skill input could not be normalized.',
    )
  }

  if (!hasSupportedInput(skill, normalizedInput)) {
    return blockedResult(
      id,
      version,
      runFingerprint,
      'UNSUPPORTED_SKILL_INPUT',
      'Creator Skill input is not supported by the registered manifest.',
    )
  }

  let executionResult: CreatorSkillRunResult
  try {
    executionResult = skill.run(normalizedInput, runFingerprint)
  } catch {
    return blockedResult(
      id,
      version,
      runFingerprint,
      'SKILL_EXECUTION_FAILED',
      'Creator Skill execution failed.',
    )
  }

  try {
    if (!isValidExecutionResult(executionResult, outputArtifactTypes)) {
      return blockedResult(
        id,
        version,
        runFingerprint,
        'INVALID_SKILL_OUTPUT',
        'Creator Skill returned invalid output.',
      )
    }

    return {
      ...executionResult,
      skillId: id,
      skillVersion: version,
      runFingerprint,
      artifacts: [...executionResult.artifacts],
      evidence: [...executionResult.evidence],
      warnings: [...executionResult.warnings],
      blockers: [...executionResult.blockers],
    }
  } catch {
    return blockedResult(
      id,
      version,
      runFingerprint,
      'INVALID_SKILL_OUTPUT',
      'Creator Skill returned invalid output.',
    )
  }
}

export function runCreatorSkill(
  skillId: string,
  input: CreatorSkillRunInput,
  skillVersion?: string,
): CreatorSkillRunResult {
  return runCreatorSkillFromRegistry(
    CREATOR_EXECUTABLE_SKILL_REGISTRY,
    skillId,
    input,
    skillVersion,
  )
}
