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

function transformDenseArray<T>(
  value: unknown,
  field: string,
  transform: (item: unknown) => T,
  invalidArray: (message: string) => Error = (message) => new TypeError(message),
): T[] {
  if (!Array.isArray(value)) {
    throw invalidArray(`${field} must be an array`)
  }
  const transformed: T[] = []
  let length: number
  try {
    length = value.length
  } catch {
    throw invalidArray(`${field} could not be read`)
  }
  for (let index = 0; index < length; index += 1) {
    let hasOwnSlot: boolean
    let item: unknown
    try {
      hasOwnSlot = Object.prototype.hasOwnProperty.call(value, index)
      if (hasOwnSlot) item = value[index]
    } catch {
      throw invalidArray(`${field}[${index}] could not be read`)
    }
    if (!hasOwnSlot) {
      throw invalidArray(`${field} must be a dense array`)
    }
    transformed.push(transform(item))
  }
  return transformed
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
      return transformDenseArray(
        value,
        'Nested input array',
        (item) => {
          if (item === undefined) {
            throw new TypeError('Nested input arrays must not contain undefined entries')
          }
          return cloneInputValue(item, active)
        },
      )
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
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InvalidArtifactError('Artifact must use the canonical Creator Skill shape')
    }
    const record = value as Record<string, unknown>
    const invalidArtifact = (message: string) => new InvalidArtifactError(message)
    const sourceNodeIds = transformDenseArray<string>(
      record.sourceNodeIds,
      'artifact.sourceNodeIds',
      (id) => id as string,
      invalidArtifact,
    )
    const sourceArtifactIds = transformDenseArray<string>(
      record.sourceArtifactIds,
      'artifact.sourceArtifactIds',
      (id) => id as string,
      invalidArtifact,
    )
    if (!Object.prototype.hasOwnProperty.call(record, 'payload')) {
      throw new InvalidArtifactError('Artifact must include a payload')
    }
    const snapshot: CreatorSkillArtifact = {
      artifactId: record.artifactId as string,
      artifactType: record.artifactType as string,
      artifactVersion: record.artifactVersion as number,
      sourceNodeIds,
      sourceArtifactIds,
      payload: record.payload,
    }
    if (!isCreatorSkillArtifact(snapshot)) {
      throw new InvalidArtifactError('Artifact must use the canonical Creator Skill shape')
    }
    const payload = cloneInputValue(snapshot.payload)
    return {
      artifactId: snapshot.artifactId,
      artifactType: snapshot.artifactType,
      artifactVersion: snapshot.artifactVersion,
      sourceNodeIds,
      sourceArtifactIds,
      payload,
    }
  } catch (error) {
    if (error instanceof InvalidArtifactError) throw error
    throw new InvalidArtifactError('Artifact could not be normalized')
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
  const inputSourceNodes = value.sourceNodes
  const inputArtifacts = value.artifacts
  if (!Array.isArray(inputSourceNodes)) {
    throw new TypeError('sourceNodes must be an array')
  }
  if (inputArtifacts !== undefined && !Array.isArray(inputArtifacts)) {
    throw new InvalidArtifactError('artifacts must be an array')
  }
  if (value.options !== undefined) {
    const prototype = value.options && Object.getPrototypeOf(value.options)
    if (!value.options || (prototype !== Object.prototype && prototype !== null)) {
      throw new TypeError('options must be a plain object')
    }
  }

  const sourceNodes = transformDenseArray(
    inputSourceNodes,
    'sourceNodes',
    normalizeSourceNode,
  )
  sourceNodes.sort((left, right) => compareStrings(left.id, right.id))
  const artifacts = inputArtifacts
    ? transformDenseArray(
      inputArtifacts,
      'artifacts',
      normalizeArtifact,
      (message) => new InvalidArtifactError(message),
    )
    : undefined
  artifacts?.sort((left, right) => (
      compareStrings(left.artifactType, right.artifactType)
      || compareStrings(left.artifactId, right.artifactId)
    ))
  if (artifacts) {
    const artifactTypesById = new Map<string, string>()
    for (let index = 0; index < artifacts.length; index += 1) {
      const artifact = artifacts[index]!
      const existingType = artifactTypesById.get(artifact.artifactId)
      if (existingType !== undefined && existingType !== artifact.artifactType) {
        throw new InvalidArtifactError(
          'Artifact IDs must not be reused across different Artifact types',
        )
      }
      artifactTypesById.set(artifact.artifactId, artifact.artifactType)
    }
  }

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

function preserveOutputText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value
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
    excerpt: preserveOutputText(value.excerpt, 'evidence.excerpt'),
    explanation: preserveOutputText(value.explanation, 'evidence.explanation'),
  }
}

function normalizeIssue(
  value: unknown,
  sourceNodeIds: ReadonlySet<string>,
  artifactProvenance: ReadonlyMap<string, ReadonlySet<string>>,
): CreatorSkillIssue {
  const requiredFields = ['code', 'message'] as const
  const optionalFields = ['sourceNodeId', 'artifactId'] as const
  if (!isPlainRecord(value) || !hasExactFields(value, requiredFields, optionalFields)) {
    throw new TypeError('Issue must use the exact Creator Skill issue shape')
  }

  const issue: CreatorSkillIssue = {
    code: normalizeOutputString(value.code, 'issue.code'),
    message: preserveOutputText(value.message, 'issue.message'),
  }
  let sourceNodeId: string | undefined
  if (Object.prototype.hasOwnProperty.call(value, 'sourceNodeId')) {
    sourceNodeId = normalizeOutputString(value.sourceNodeId, 'issue.sourceNodeId')
    if (!sourceNodeIds.has(sourceNodeId)) {
      throw new TypeError('Issue sourceNodeId must reference an input source node')
    }
    issue.sourceNodeId = sourceNodeId
  }
  let artifactId: string | undefined
  if (Object.prototype.hasOwnProperty.call(value, 'artifactId')) {
    artifactId = normalizeOutputString(value.artifactId, 'issue.artifactId')
    if (!artifactProvenance.has(artifactId)) {
      throw new TypeError('Issue artifactId must reference an input or output Artifact')
    }
    issue.artifactId = artifactId
  }
  if (sourceNodeId !== undefined && artifactId !== undefined) {
    const artifactSourceNodeIds = artifactProvenance.get(artifactId)
    if (!artifactSourceNodeIds?.has(sourceNodeId)) {
      throw new TypeError('Issue sourceNodeId must belong to the referenced Artifact')
    }
  }
  return issue
}

type NormalizedExecutionResult = Pick<
  CreatorSkillRunResult,
  'status' | 'artifacts' | 'evidence' | 'warnings' | 'blockers'
>

function normalizeExecutionResult(
  value: unknown,
  outputArtifactTypes: readonly string[],
  directSourceNodeIds: ReadonlySet<string>,
  validatedSourceNodeIds: ReadonlySet<string>,
  inputArtifactProvenance: ReadonlyMap<string, ReadonlySet<string>>,
): NormalizedExecutionResult | null {
  if (!isPlainRecord(value)) return null
  const result = value as Partial<CreatorSkillRunResult>
  const status = result.status
  const resultArtifacts = result.artifacts
  const resultEvidence = result.evidence
  const resultWarnings = result.warnings
  const resultBlockers = result.blockers
  if (!['ready', 'needs-review', 'blocked'].includes(status ?? '')) return null
  if (!Array.isArray(resultArtifacts)
    || !Array.isArray(resultEvidence)
    || !Array.isArray(resultWarnings)
    || !Array.isArray(resultBlockers)) {
    return null
  }
  const artifacts = transformDenseArray(
    resultArtifacts,
    'result.artifacts',
    normalizeArtifact,
  )
  const outputArtifactIds = new Set<string>()
  const issueArtifactProvenance = new Map<string, Set<string>>()
  for (const [artifactId, sourceNodeIds] of inputArtifactProvenance) {
    issueArtifactProvenance.set(artifactId, new Set(sourceNodeIds))
  }
  for (const artifact of artifacts) {
    if (!outputArtifactTypes.includes(artifact.artifactType)) return null
    if (inputArtifactProvenance.has(artifact.artifactId)
      || outputArtifactIds.has(artifact.artifactId)) {
      return null
    }
    const allowedSourceNodeIds = new Set(directSourceNodeIds)
    for (let index = 0; index < artifact.sourceArtifactIds.length; index += 1) {
      const sourceArtifactId = artifact.sourceArtifactIds[index]!
      const inheritedSourceNodeIds = inputArtifactProvenance.get(sourceArtifactId)
      if (!inheritedSourceNodeIds) return null
      for (const sourceNodeId of inheritedSourceNodeIds) {
        allowedSourceNodeIds.add(sourceNodeId)
      }
    }
    if (artifact.sourceNodeIds.some((sourceNodeId) => !allowedSourceNodeIds.has(sourceNodeId))) {
      return null
    }
    outputArtifactIds.add(artifact.artifactId)
    const artifactSourceNodeIds = issueArtifactProvenance.get(artifact.artifactId)
      ?? new Set<string>()
    for (let index = 0; index < artifact.sourceNodeIds.length; index += 1) {
      artifactSourceNodeIds.add(artifact.sourceNodeIds[index]!)
    }
    issueArtifactProvenance.set(artifact.artifactId, artifactSourceNodeIds)
  }

  const evidence = transformDenseArray(
    resultEvidence,
    'result.evidence',
    (entry) => normalizeEvidence(entry, validatedSourceNodeIds),
  )
  const warnings = transformDenseArray(
    resultWarnings,
    'result.warnings',
    (entry) => normalizeIssue(entry, validatedSourceNodeIds, issueArtifactProvenance),
  )
  const blockers = transformDenseArray(
    resultBlockers,
    'result.blockers',
    (entry) => normalizeIssue(entry, validatedSourceNodeIds, issueArtifactProvenance),
  )
  if (status === 'blocked') {
    if (artifacts.length > 0 || blockers.length === 0) return null
  } else if (blockers.length > 0) {
    return null
  }

  return {
    status: status as CreatorSkillRunResult['status'],
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

  const directSourceNodeIds = new Set<string>()
  for (let index = 0; index < normalizedInput.sourceNodes.length; index += 1) {
    directSourceNodeIds.add(normalizedInput.sourceNodes[index]!.id)
  }
  const validatedSourceNodeIds = new Set(directSourceNodeIds)
  const inputArtifactProvenance = new Map<string, Set<string>>()
  const normalizedArtifacts = normalizedInput.artifacts
  if (normalizedArtifacts) {
    for (let index = 0; index < normalizedArtifacts.length; index += 1) {
      const artifact = normalizedArtifacts[index]!
      const sourceNodeIds = inputArtifactProvenance.get(artifact.artifactId) ?? new Set<string>()
      for (let sourceIndex = 0; sourceIndex < artifact.sourceNodeIds.length; sourceIndex += 1) {
        const sourceNodeId = artifact.sourceNodeIds[sourceIndex]!
        sourceNodeIds.add(sourceNodeId)
        validatedSourceNodeIds.add(sourceNodeId)
      }
      inputArtifactProvenance.set(artifact.artifactId, sourceNodeIds)
    }
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
      directSourceNodeIds,
      validatedSourceNodeIds,
      inputArtifactProvenance,
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
