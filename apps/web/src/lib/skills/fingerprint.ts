import type {
  CreatorSkillArtifact,
  CreatorSkillRunInput,
  CreatorSkillSourceNode,
} from './types'

function normalizeString(value: string) {
  return value.normalize('NFC')
}

function compareStrings(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareSourceNodes(left: CreatorSkillSourceNode, right: CreatorSkillSourceNode) {
  return compareStrings(normalizeString(left.id), normalizeString(right.id))
}

function artifactSortKey(artifact: CreatorSkillArtifact) {
  return `${normalizeString(artifact.type)}\u0000${normalizeString(artifact.artifactId)}`
}

function compareArtifacts(left: CreatorSkillArtifact, right: CreatorSkillArtifact) {
  return compareStrings(artifactSortKey(left), artifactSortKey(right))
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') return normalizeString(value)
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map(canonicalize)
  }
  if (!value || typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort(compareStrings)) {
    if (record[key] !== undefined) {
      normalized[normalizeString(key)] = canonicalize(record[key])
    }
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
  skillVersion: number,
  input: CreatorSkillRunInput,
): string {
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
