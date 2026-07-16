import type {
  CreatorExecutableSkill,
  CreatorSkillManifest,
  CreatorSkillTarget,
} from './types'

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const CREATOR_SKILL_TARGETS = new Set<CreatorSkillTarget>(['text', 'image', 'video'])

function normalizeIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function normalizeArtifactTypes(value: unknown, field: string, requireOne = false) {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    throw new TypeError(`${field} must be ${requireOne ? 'a non-empty' : 'an'} array`)
  }

  return value.map((artifactType) => normalizeIdentifier(artifactType, field))
}

function normalizeNodeKinds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new TypeError('acceptedNodeKinds must be an array')
  }
  for (const kind of value) {
    if (!CREATOR_SKILL_TARGETS.has(kind as CreatorSkillTarget)) {
      throw new TypeError(`Invalid accepted node kind: ${String(kind)}`)
    }
  }
  return [...value] as CreatorSkillTarget[]
}

function normalizeManifest(manifest: CreatorSkillManifest): CreatorSkillManifest {
  const id = normalizeIdentifier(manifest.id, 'manifest.id')
  if (typeof manifest.version !== 'string' || !SEMANTIC_VERSION_PATTERN.test(manifest.version)) {
    throw new TypeError('manifest.version must use numeric major.minor.patch format')
  }
  if (manifest.executionPolicy !== 'deterministic-local') {
    throw new TypeError('Stage A executable Skills must use deterministic-local execution')
  }
  if (manifest.independentlyCallable !== true) {
    throw new TypeError('Executable Creator Skills must be independently callable')
  }

  return {
    ...manifest,
    id,
    acceptedNodeKinds: normalizeNodeKinds(manifest.acceptedNodeKinds),
    acceptedArtifactTypes: normalizeArtifactTypes(
      manifest.acceptedArtifactTypes,
      'acceptedArtifactTypes',
    ),
    outputArtifactTypes: normalizeArtifactTypes(
      manifest.outputArtifactTypes,
      'outputArtifactTypes',
      true,
    ),
  }
}

function semanticVersionParts(version: string) {
  return version.split('.').map(Number)
}

function compareSemanticVersions(left: string, right: string) {
  const leftParts = semanticVersionParts(left)
  const rightParts = semanticVersionParts(right)
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!
    if (difference !== 0) return difference
  }
  return 0
}

export function createCreatorExecutableSkillRegistry(
  skills: CreatorExecutableSkill[],
): ReadonlyMap<string, CreatorExecutableSkill> {
  const registry = new Map<string, CreatorExecutableSkill>()

  for (const skill of skills) {
    if (!skill || typeof skill !== 'object' || typeof skill.run !== 'function' || !skill.manifest) {
      throw new TypeError('Executable Creator Skill must include a manifest and run function')
    }
    const manifest = normalizeManifest(skill.manifest)
    const key = `${manifest.id}@${manifest.version}`
    if (registry.has(key)) {
      throw new TypeError(`Duplicate executable Creator Skill: ${key}`)
    }
    registry.set(key, { ...skill, manifest })
  }

  return registry
}

export function getExecutableCreatorSkillFromRegistry(
  registry: ReadonlyMap<string, CreatorExecutableSkill>,
  skillId: string,
  skillVersion?: string,
): CreatorExecutableSkill | null {
  const normalizedId = typeof skillId === 'string' ? skillId.trim() : ''
  if (!normalizedId) return null

  if (skillVersion !== undefined) {
    const normalizedVersion = skillVersion.trim()
    if (!SEMANTIC_VERSION_PATTERN.test(normalizedVersion)) return null
    return registry.get(`${normalizedId}@${normalizedVersion}`) ?? null
  }

  let latest: CreatorExecutableSkill | null = null
  for (const skill of registry.values()) {
    if (skill.manifest.id !== normalizedId) continue
    if (!latest || compareSemanticVersions(skill.manifest.version, latest.manifest.version) > 0) {
      latest = skill
    }
  }
  return latest
}

const EMPTY_EXECUTABLE_SKILLS: readonly CreatorExecutableSkill[] = []

export const CREATOR_EXECUTABLE_SKILL_REGISTRY = createCreatorExecutableSkillRegistry([
  ...EMPTY_EXECUTABLE_SKILLS,
])

export function getExecutableCreatorSkill(
  skillId: string,
  skillVersion?: string,
): CreatorExecutableSkill | null {
  return getExecutableCreatorSkillFromRegistry(
    CREATOR_EXECUTABLE_SKILL_REGISTRY,
    skillId,
    skillVersion,
  )
}
