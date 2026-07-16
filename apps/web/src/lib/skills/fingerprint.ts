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

function canonicalize(value: unknown): unknown {
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
      normalized[key] = canonicalize(record[key])
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
  skillVersion: string,
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
