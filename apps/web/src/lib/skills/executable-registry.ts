import type {
  CreatorExecutableSkill,
  CreatorSkillCategory,
  CreatorSkillManifest,
  CreatorSkillTarget,
} from './types'

const SEMANTIC_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const CREATOR_SKILL_TARGETS = new Set<CreatorSkillTarget>(['text', 'image', 'video'])
const CREATOR_SKILL_CATEGORIES = new Set<CreatorSkillCategory>([
  'story',
  'visual',
  'color',
  'camera',
  'character',
  'scene',
  'continuity',
])

function normalizeIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function validateMeaningfulText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value
}

function normalizeArtifactTypes(value: unknown, field: string, requireOne = false) {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    throw new TypeError(`${field} must be ${requireOne ? 'a non-empty' : 'an'} array`)
  }

  return [...new Set(
    Array.from(value, (artifactType) => normalizeIdentifier(artifactType, field)),
  )]
}

function normalizeNodeKinds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new TypeError('acceptedNodeKinds must be an array')
  }
  const nodeKinds = Array.from(value)
  for (const kind of nodeKinds) {
    if (!CREATOR_SKILL_TARGETS.has(kind as CreatorSkillTarget)) {
      throw new TypeError(`Invalid accepted node kind: ${String(kind)}`)
    }
  }
  return [...new Set(nodeKinds)] as CreatorSkillTarget[]
}

function normalizeManifest(manifest: CreatorSkillManifest): CreatorSkillManifest {
  const id = normalizeIdentifier(manifest.id, 'manifest.id')
  const name = validateMeaningfulText(manifest.name, 'manifest.name')
  const description = validateMeaningfulText(manifest.description, 'manifest.description')
  const version = manifest.version
  const category = manifest.category
  const executionPolicy = manifest.executionPolicy
  const independentlyCallable = manifest.independentlyCallable
  const inputNodeKinds = manifest.acceptedNodeKinds
  const inputArtifactTypes = manifest.acceptedArtifactTypes
  const inputOutputArtifactTypes = manifest.outputArtifactTypes
  if (typeof version !== 'string' || !SEMANTIC_VERSION_PATTERN.test(version)) {
    throw new TypeError('manifest.version must use numeric major.minor.patch format')
  }
  if (!CREATOR_SKILL_CATEGORIES.has(category)) {
    throw new TypeError(`Invalid Creator Skill category: ${String(category)}`)
  }
  if (executionPolicy !== 'deterministic-local') {
    throw new TypeError('Stage A executable Skills must use deterministic-local execution')
  }
  if (independentlyCallable !== true) {
    throw new TypeError('Executable Creator Skills must be independently callable')
  }

  const acceptedNodeKinds = Object.freeze(normalizeNodeKinds(inputNodeKinds))
  const acceptedArtifactTypes = Object.freeze(normalizeArtifactTypes(
    inputArtifactTypes,
    'acceptedArtifactTypes',
  ))
  const outputArtifactTypes = Object.freeze(normalizeArtifactTypes(
    inputOutputArtifactTypes,
    'outputArtifactTypes',
    true,
  ))

  return Object.freeze({
    id,
    version,
    name,
    description,
    category,
    executionPolicy,
    acceptedNodeKinds: acceptedNodeKinds as unknown as CreatorSkillTarget[],
    acceptedArtifactTypes: acceptedArtifactTypes as unknown as string[],
    outputArtifactTypes: outputArtifactTypes as unknown as string[],
    independentlyCallable: true,
  })
}

function createReadonlyMapFacade(
  backing: Map<string, CreatorExecutableSkill>,
): ReadonlyMap<string, CreatorExecutableSkill> {
  let facade: ReadonlyMap<string, CreatorExecutableSkill>
  const view: ReadonlyMap<string, CreatorExecutableSkill> = {
    get size() {
      return backing.size
    },
    get(key) {
      return backing.get(key)
    },
    has(key) {
      return backing.has(key)
    },
    forEach(callback, thisArg) {
      backing.forEach((value, key) => callback.call(thisArg, value, key, facade))
    },
    entries() {
      return backing.entries()
    },
    keys() {
      return backing.keys()
    },
    values() {
      return backing.values()
    },
    [Symbol.iterator]() {
      return backing[Symbol.iterator]()
    },
  }
  facade = Object.freeze(view)
  return facade
}

function compareDecimalStrings(left: string, right: string) {
  const lengthDifference = left.length - right.length
  if (lengthDifference !== 0) return lengthDifference
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function compareSemanticVersions(left: string, right: string) {
  const leftParts = left.split('.')
  const rightParts = right.split('.')
  for (let index = 0; index < 3; index += 1) {
    const difference = compareDecimalStrings(leftParts[index]!, rightParts[index]!)
    if (difference !== 0) return difference
  }
  return 0
}

export function createCreatorExecutableSkillRegistry(
  skills: CreatorExecutableSkill[],
): ReadonlyMap<string, CreatorExecutableSkill> {
  const registry = new Map<string, CreatorExecutableSkill>()

  for (const skill of skills) {
    if (!skill || typeof skill !== 'object') {
      throw new TypeError('Executable Creator Skill must include a manifest and run function')
    }
    const run = skill.run
    const inputManifest = skill.manifest
    if (typeof run !== 'function' || !inputManifest) {
      throw new TypeError('Executable Creator Skill must include a manifest and run function')
    }
    const manifest = normalizeManifest(inputManifest)
    const key = `${manifest.id}@${manifest.version}`
    if (registry.has(key)) {
      throw new TypeError(`Duplicate executable Creator Skill: ${key}`)
    }
    registry.set(key, Object.freeze({ manifest, run }))
  }

  return createReadonlyMapFacade(registry)
}

export function getExecutableCreatorSkillFromRegistry(
  registry: ReadonlyMap<string, CreatorExecutableSkill>,
  skillId: string,
  skillVersion?: string,
): CreatorExecutableSkill | null {
  const normalizedId = typeof skillId === 'string' ? skillId.trim() : ''
  if (!normalizedId) return null

  if (skillVersion !== undefined) {
    if (typeof skillVersion !== 'string') return null
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
