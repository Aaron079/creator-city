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

function isIdentifierArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((id) => typeof id === 'string' && Boolean(id.trim()))
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
  return typeof artifact.artifactId === 'string'
    && Boolean(artifact.artifactId.trim())
    && typeof artifact.artifactType === 'string'
    && Boolean(artifact.artifactType.trim())
    && typeof artifact.artifactVersion === 'number'
    && Number.isInteger(artifact.artifactVersion)
    && artifact.artifactVersion > 0
    && isIdentifierArray(artifact.sourceNodeIds)
    && isIdentifierArray(artifact.sourceArtifactIds)
    && Object.prototype.hasOwnProperty.call(artifact, 'payload')
}
