import { NARRATIVE_BEAT_ANALYSIS_SKILL } from './narrative-beat-analysis'
import { SCRIPT_SEGMENTATION_SKILL } from './script-segmentation'
import { SHOT_PLANNING_SKILL } from './shot-planning'
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

function copyDenseArray<T>(value: unknown, field: string): T[] {
  try {
    if (!Array.isArray(value)) {
      throw new TypeError(`${field} must be an array`)
    }
    const copy: T[] = []
    const length = value.length
    for (let index = 0; index < length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError(`${field} must be a dense array`)
      }
      copy.push(value[index] as T)
    }
    return copy
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError(`${field} could not be read`)
  }
}

function normalizeArtifactTypes(value: unknown, field: string, requireOne = false) {
  const artifactTypes = copyDenseArray<unknown>(value, field)
  if (requireOne && artifactTypes.length === 0) {
    throw new TypeError(`${field} must be ${requireOne ? 'a non-empty' : 'an'} array`)
  }

  const normalized: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < artifactTypes.length; index += 1) {
    const artifactType = normalizeIdentifier(artifactTypes[index], field)
    if (!seen.has(artifactType)) {
      seen.add(artifactType)
      normalized.push(artifactType)
    }
  }
  return normalized
}

function normalizeNodeKinds(value: unknown) {
  const nodeKinds = copyDenseArray<unknown>(value, 'acceptedNodeKinds')
  const normalized: CreatorSkillTarget[] = []
  const seen = new Set<CreatorSkillTarget>()
  for (let index = 0; index < nodeKinds.length; index += 1) {
    const kind = nodeKinds[index]
    if (!CREATOR_SKILL_TARGETS.has(kind as CreatorSkillTarget)) {
      throw new TypeError(`Invalid accepted node kind: ${String(kind)}`)
    }
    if (!seen.has(kind as CreatorSkillTarget)) {
      seen.add(kind as CreatorSkillTarget)
      normalized.push(kind as CreatorSkillTarget)
    }
  }
  return normalized
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
  const facade: ReadonlyMap<string, CreatorExecutableSkill> = Object.freeze({
    get size() {
      return backing.size
    },
    get(key: string) {
      return backing.get(key)
    },
    has(key: string) {
      return backing.has(key)
    },
    forEach(
      callback: (
        value: CreatorExecutableSkill,
        key: string,
        map: ReadonlyMap<string, CreatorExecutableSkill>,
      ) => void,
      thisArg?: unknown,
    ) {
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
  })
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
  const skillList = copyDenseArray<CreatorExecutableSkill>(skills, 'skills')

  for (let index = 0; index < skillList.length; index += 1) {
    const skill = skillList[index]!
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

export const CREATOR_EXECUTABLE_SKILL_REGISTRY = createCreatorExecutableSkillRegistry([
  SCRIPT_SEGMENTATION_SKILL,
  NARRATIVE_BEAT_ANALYSIS_SKILL,
  SHOT_PLANNING_SKILL,
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
