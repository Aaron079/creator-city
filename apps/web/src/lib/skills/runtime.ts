import { isCreatorSkillArtifact } from './artifacts'
import {
  CREATOR_EXECUTABLE_SKILL_REGISTRY,
  createCreatorExecutableSkillRegistry,
  getExecutableCreatorSkillFromRegistry,
} from './executable-registry'
import { createCreatorSkillFingerprint } from './fingerprint'
import type {
  CreatorExecutableSkill,
  CreatorSkillArtifact,
  CreatorSkillEvidence,
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

function defineEnumerableDataProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  })
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
      if (clonedValue !== undefined) defineEnumerableDataProperty(clone, key, clonedValue)
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
    ? Array.from(value.artifacts, normalizeArtifact)
    .sort((left, right) => (
      compareStrings(left.artifactType, right.artifactType)
      || compareStrings(left.artifactId, right.artifactId)
    ))
    : undefined

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactFields(
  record: Record<string, unknown>,
  requiredFields: readonly string[],
  optionalFields: readonly string[] = [],
) {
  const ownKeys = Reflect.ownKeys(record)
  if (ownKeys.some((key) => typeof key !== 'string')) return false
  const allowedFields = new Set([...requiredFields, ...optionalFields])
  return requiredFields.every((field) => Object.prototype.hasOwnProperty.call(record, field))
    && ownKeys.every((key) => allowedFields.has(key as string))
}

function normalizeOutputString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeEvidence(
  value: unknown,
  sourceNodeIds: ReadonlySet<string>,
): CreatorSkillEvidence {
  const fields = [
    'evidenceId',
    'ruleId',
    'sourceNodeId',
    'lineStart',
    'lineEnd',
    'excerpt',
    'explanation',
  ] as const
  if (!isPlainRecord(value) || !hasExactFields(value, fields)) {
    throw new TypeError('Evidence must use the exact Creator Skill evidence shape')
  }
  const sourceNodeId = normalizeOutputString(value.sourceNodeId, 'evidence.sourceNodeId')
  if (!sourceNodeIds.has(sourceNodeId)) {
    throw new TypeError('Evidence sourceNodeId must reference an input source node')
  }
  if (!Number.isInteger(value.lineStart)
    || !Number.isInteger(value.lineEnd)
    || (value.lineStart as number) < 1
    || (value.lineEnd as number) < (value.lineStart as number)) {
    throw new TypeError('Evidence line range must be positive and ordered')
  }

  return {
    evidenceId: normalizeOutputString(value.evidenceId, 'evidence.evidenceId'),
    ruleId: normalizeOutputString(value.ruleId, 'evidence.ruleId'),
    sourceNodeId,
    lineStart: value.lineStart as number,
    lineEnd: value.lineEnd as number,
    excerpt: normalizeOutputString(value.excerpt, 'evidence.excerpt'),
    explanation: normalizeOutputString(value.explanation, 'evidence.explanation'),
  }
}

function normalizeIssue(
  value: unknown,
  sourceNodeIds: ReadonlySet<string>,
  artifactIds: ReadonlySet<string>,
): CreatorSkillIssue {
  const requiredFields = ['code', 'message'] as const
  const optionalFields = ['sourceNodeId', 'artifactId'] as const
  if (!isPlainRecord(value) || !hasExactFields(value, requiredFields, optionalFields)) {
    throw new TypeError('Issue must use the exact Creator Skill issue shape')
  }

  const issue: CreatorSkillIssue = {
    code: normalizeOutputString(value.code, 'issue.code'),
    message: normalizeOutputString(value.message, 'issue.message'),
  }
  if (Object.prototype.hasOwnProperty.call(value, 'sourceNodeId')) {
    const sourceNodeId = normalizeOutputString(value.sourceNodeId, 'issue.sourceNodeId')
    if (!sourceNodeIds.has(sourceNodeId)) {
      throw new TypeError('Issue sourceNodeId must reference an input source node')
    }
    issue.sourceNodeId = sourceNodeId
  }
  if (Object.prototype.hasOwnProperty.call(value, 'artifactId')) {
    const artifactId = normalizeOutputString(value.artifactId, 'issue.artifactId')
    if (!artifactIds.has(artifactId)) {
      throw new TypeError('Issue artifactId must reference an input or output Artifact')
    }
    issue.artifactId = artifactId
  }
  return issue
}

type NormalizedExecutionResult = Pick<
  CreatorSkillRunResult,
  'status' | 'artifacts' | 'evidence' | 'warnings' | 'blockers'
>

function normalizeExecutionResult(
  value: unknown,
  outputArtifactTypes: string[],
  input: CreatorSkillRunInput,
): NormalizedExecutionResult | null {
  if (!isPlainRecord(value)) return null
  const result = value as Partial<CreatorSkillRunResult>
  if (!['ready', 'needs-review', 'blocked'].includes(result.status ?? '')) return null
  if (!Array.isArray(result.artifacts)
    || !Array.isArray(result.evidence)
    || !Array.isArray(result.warnings)
    || !Array.isArray(result.blockers)) {
    return null
  }
  const artifacts = Array.from(result.artifacts, normalizeArtifact)
  const sourceNodeIds = new Set(input.sourceNodes.map((node) => node.id))
  const inputArtifactIds = new Set((input.artifacts ?? []).map((artifact) => artifact.artifactId))
  const outputArtifactIds = new Set<string>()
  const artifactIdsByType = new Map<string, Set<string>>()
  for (const artifact of artifacts) {
    if (!outputArtifactTypes.includes(artifact.artifactType)) return null
    if (artifact.sourceNodeIds.some((sourceNodeId) => !sourceNodeIds.has(sourceNodeId))) {
      return null
    }
    if (artifact.sourceArtifactIds.some((artifactId) => !inputArtifactIds.has(artifactId))) {
      return null
    }
    const artifactIds = artifactIdsByType.get(artifact.artifactType) ?? new Set<string>()
    if (artifactIds.has(artifact.artifactId)) return null
    artifactIds.add(artifact.artifactId)
    artifactIdsByType.set(artifact.artifactType, artifactIds)
    outputArtifactIds.add(artifact.artifactId)
  }

  const knownArtifactIds = new Set([...inputArtifactIds, ...outputArtifactIds])
  const evidence = Array.from(
    result.evidence,
    (entry) => normalizeEvidence(entry, sourceNodeIds),
  )
  const warnings = Array.from(
    result.warnings,
    (entry) => normalizeIssue(entry, sourceNodeIds, knownArtifactIds),
  )
  const blockers = Array.from(
    result.blockers,
    (entry) => normalizeIssue(entry, sourceNodeIds, knownArtifactIds),
  )
  if (result.status === 'blocked') {
    if (artifacts.length > 0 || blockers.length === 0) return null
  } else if (blockers.length > 0) {
    return null
  }

  return {
    status: result.status as CreatorSkillRunResult['status'],
    artifacts,
    evidence,
    warnings,
    blockers,
  }
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

  let registeredSkill: CreatorExecutableSkill | null
  try {
    registeredSkill = getExecutableCreatorSkillFromRegistry(registry, skillId, skillVersion)
  } catch {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'INVALID_SKILL_INPUT',
      'Creator Skill lookup failed.',
    )
  }
  if (!registeredSkill) {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'SKILL_NOT_FOUND',
      'Executable Creator Skill was not found.',
    )
  }

  let skill: CreatorExecutableSkill
  try {
    const isolatedRegistry = createCreatorExecutableSkillRegistry([registeredSkill])
    const isolatedSkill = isolatedRegistry.values().next().value
    if (!isolatedSkill
      || isolatedSkill.manifest.id !== normalizedSkillId
      || (normalizedSkillVersion
        && isolatedSkill.manifest.version !== normalizedSkillVersion)) {
      throw new TypeError('Registry returned a mismatched Creator Skill')
    }
    skill = isolatedSkill
  } catch {
    return blockedResult(
      normalizedSkillId,
      normalizedSkillVersion,
      FALLBACK_FINGERPRINT,
      'INVALID_SKILL_INPUT',
      'Creator Skill registration is invalid.',
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
    const normalizedExecution = normalizeExecutionResult(
      executionResult,
      outputArtifactTypes,
      normalizedInput,
    )
    if (!normalizedExecution) {
      return blockedResult(
        id,
        version,
        runFingerprint,
        'INVALID_SKILL_OUTPUT',
        'Creator Skill returned invalid output.',
      )
    }

    return {
      skillId: id,
      skillVersion: version,
      runFingerprint,
      status: normalizedExecution.status,
      artifacts: normalizedExecution.artifacts,
      evidence: normalizedExecution.evidence,
      warnings: normalizedExecution.warnings,
      blockers: normalizedExecution.blockers,
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
