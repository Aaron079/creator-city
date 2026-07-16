import type {
  CreatorSkillArtifact,
  CreatorSkillRunInput,
  CreatorSkillSourceNode,
} from './types'

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareSourceNodes(left: CreatorSkillSourceNode, right: CreatorSkillSourceNode) {
  return compareStrings(left.id, right.id)
}

function compareArtifacts(left: CreatorSkillArtifact, right: CreatorSkillArtifact) {
  const typeOrder = compareStrings(left.artifactType, right.artifactType)
  return typeOrder || compareStrings(left.artifactId, right.artifactId)
}

function assertUniqueSourceNodeIds(sourceNodes: CreatorSkillSourceNode[]) {
  const ids = new Set<string>()
  for (const sourceNode of sourceNodes) {
    if (ids.has(sourceNode.id)) {
      throw new TypeError(`Duplicate source node id: ${sourceNode.id}`)
    }
    ids.add(sourceNode.id)
  }
}

function assertUniqueArtifactIdentities(artifacts: CreatorSkillArtifact[]) {
  const idsByType = new Map<string, Set<string>>()
  for (const artifact of artifacts) {
    const ids = idsByType.get(artifact.artifactType) ?? new Set<string>()
    if (ids.has(artifact.artifactId)) {
      throw new TypeError(
        `Duplicate artifact identity: ${artifact.artifactType}, ${artifact.artifactId}`,
      )
    }
    ids.add(artifact.artifactId)
    idsByType.set(artifact.artifactType, ids)
  }
}

function unsupportedValue(value: unknown): never {
  if (value && typeof value === 'object') {
    const name = value.constructor?.name ?? 'non-plain object'
    throw new TypeError(`Unsupported fingerprint value: ${name}`)
  }
  throw new TypeError(`Unsupported fingerprint value: ${typeof value}`)
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

function canonicalize(value: unknown, active = new WeakSet<object>()): unknown {
  if (value === null) return null

  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return value
  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Fingerprint numbers must be finite')
    }
    return value
  }
  if (valueType !== 'object') return unsupportedValue(value)

  const objectValue = value as object
  if (active.has(objectValue)) {
    throw new TypeError('Cyclic fingerprint input')
  }

  if (Array.isArray(value)) {
    active.add(objectValue)
    try {
      return value
        .filter((item) => item !== undefined)
        .map((item) => canonicalize(item, active))
    } finally {
      active.delete(objectValue)
    }
  }

  const prototype = Object.getPrototypeOf(objectValue)
  if (prototype !== Object.prototype && prototype !== null) {
    return unsupportedValue(value)
  }
  if (Object.getOwnPropertySymbols(objectValue).length > 0) {
    throw new TypeError('Unsupported fingerprint value: symbol key')
  }

  active.add(objectValue)
  const record = objectValue as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  try {
    for (const key of Object.keys(record).sort(compareStrings)) {
      if (record[key] !== undefined) {
        defineEnumerableDataProperty(normalized, key, canonicalize(record[key], active))
      }
    }
  } finally {
    active.delete(objectValue)
  }
  return normalized
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export function createCreatorSkillFingerprint(
  skillId: string,
  skillVersion: string,
  input: CreatorSkillRunInput,
): string {
  assertUniqueSourceNodeIds(input.sourceNodes)
  if (input.artifacts) assertUniqueArtifactIdentities(input.artifacts)

  const orderedInput: CreatorSkillRunInput = {
    ...input,
    sourceNodes: [...input.sourceNodes].sort(compareSourceNodes),
    ...(input.artifacts
      ? { artifacts: [...input.artifacts].sort(compareArtifacts) }
      : {}),
  }
  const serialized = JSON.stringify(canonicalize({
    skillId,
    skillVersion,
    input: orderedInput,
  }))
  const hash = fnv1a(serialized)
  return `csf1_${hash.toString(16).padStart(8, '0')}`
}
