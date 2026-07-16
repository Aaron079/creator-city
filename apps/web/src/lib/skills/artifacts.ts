import type { CreatorSkillArtifact } from './types'

type CreatorSkillArtifactInput<T> = {
  artifactId: string
  artifactType: string
  artifactVersion: number
  sourceNodeIds: readonly string[]
  sourceArtifactIds?: readonly string[]
  payload: T
}

function normalizeRequiredIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeSourceIdentifiers(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${field} must be an array`)
  }

  return [...new Set(value.map((id) => normalizeRequiredIdentifier(id, field)))].sort()
}

function isTrimmedIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
}

function isCanonicalIdentifierArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false

  for (let index = 0; index < value.length; index += 1) {
    const id = value[index]
    if (!isTrimmedIdentifier(id)) return false
    if (index > 0 && value[index - 1] >= id) return false
  }
  return true
}

export function createCreatorSkillArtifact<T>(
  input: CreatorSkillArtifactInput<T>,
): CreatorSkillArtifact<T> {
  if (!Number.isInteger(input.artifactVersion) || input.artifactVersion <= 0) {
    throw new TypeError('artifactVersion must be a positive integer')
  }

  return {
    artifactId: normalizeRequiredIdentifier(input.artifactId, 'artifactId'),
    artifactType: normalizeRequiredIdentifier(input.artifactType, 'artifactType'),
    artifactVersion: input.artifactVersion,
    sourceNodeIds: normalizeSourceIdentifiers(input.sourceNodeIds, 'sourceNodeIds'),
    sourceArtifactIds: normalizeSourceIdentifiers(input.sourceArtifactIds ?? [], 'sourceArtifactIds'),
    payload: input.payload,
  }
}

export function isCreatorSkillArtifact(value: unknown): value is CreatorSkillArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const artifact = value as Record<string, unknown>
  return isTrimmedIdentifier(artifact.artifactId)
    && isTrimmedIdentifier(artifact.artifactType)
    && typeof artifact.artifactVersion === 'number'
    && Number.isInteger(artifact.artifactVersion)
    && artifact.artifactVersion > 0
    && isCanonicalIdentifierArray(artifact.sourceNodeIds)
    && isCanonicalIdentifierArray(artifact.sourceArtifactIds)
    && Object.prototype.hasOwnProperty.call(artifact, 'payload')
    && artifact.payload !== undefined
}
