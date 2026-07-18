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
  try {
    if (!Array.isArray(value)) {
      throw new TypeError(`${field} must be an array`)
    }
    const normalized: string[] = []
    const seen = new Set<string>()
    const length = value.length
    for (let index = 0; index < length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError(`${field} must be a dense array`)
      }
      const id = normalizeRequiredIdentifier(value[index], field)
      if (!seen.has(id)) {
        seen.add(id)
        normalized.push(id)
      }
    }
    normalized.sort()
    return normalized
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError(`${field} could not be read`)
  }
}

function isTrimmedIdentifier(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
}

function isCanonicalIdentifierArray(value: unknown): value is string[] {
  try {
    if (!Array.isArray(value)) return false
    const length = value.length
    for (let index = 0; index < length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) return false
      const id = value[index]
      if (!isTrimmedIdentifier(id)) return false
      if (index > 0 && value[index - 1] >= id) return false
    }
    return true
  } catch {
    return false
  }
}

const ARTIFACT_FIELDS = [
  'artifactId',
  'artifactType',
  'artifactVersion',
  'sourceNodeIds',
  'sourceArtifactIds',
  'payload',
] as const

function failClone(message: string): never {
  throw new TypeError(message)
}

function isPlainObject(value: object) {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function ownEnumerableDataValue(
  value: object,
  key: PropertyKey,
  field: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
    return failClone(`${field} must be an own enumerable data property`)
  }
  return descriptor.value
}

function assertExactArtifactKeys(value: object) {
  const keys = Reflect.ownKeys(value)
  if (keys.length !== ARTIFACT_FIELDS.length) {
    failClone('artifact must contain exactly the canonical fields')
  }
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]
    if (typeof key !== 'string' || !ARTIFACT_FIELDS.includes(key as typeof ARTIFACT_FIELDS[number])) {
      failClone('artifact must contain exactly the canonical fields')
    }
  }
}

function sortedOwnStringKeys(value: object, field: string): string[] {
  const ownKeys = Reflect.ownKeys(value)
  const keys = new Array<string>(ownKeys.length)
  for (let index = 0; index < ownKeys.length; index += 1) {
    const key = ownKeys[index]
    if (typeof key !== 'string') failClone(`${field} must not contain symbol keys`)
    keys[index] = key
  }
  return keys.sort()
}

function cloneCanonicalSourceIdentifiers(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) failClone(`${field} must be an array`)

  const keys = Reflect.ownKeys(value)
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
  if (!lengthDescriptor || !('value' in lengthDescriptor)) {
    failClone(`${field}.length must be an own data property`)
  }
  const arrayLength = lengthDescriptor.value
  if (!Number.isSafeInteger(arrayLength) || arrayLength < 0) {
    failClone(`${field}.length must be valid`)
  }
  if (keys.length !== arrayLength + 1) {
    failClone(`${field} must be a dense array without extra properties`)
  }

  const result = new Array<string>(arrayLength)
  let previous: string | undefined
  for (let index = 0; index < arrayLength; index += 1) {
    const id = ownEnumerableDataValue(value, String(index), `${field}[${index}]`)
    if (!isTrimmedIdentifier(id)) {
      failClone(`${field} must contain trimmed non-empty strings`)
    }
    if (previous !== undefined && previous >= id) {
      failClone(`${field} must be sorted and unique`)
    }
    result[index] = id
    previous = id
  }
  return result
}

function cloneJsonData(value: unknown, ancestors: WeakSet<object>, field: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) failClone(`${field} must contain only finite numbers`)
    return value
  }
  if (typeof value !== 'object') {
    failClone(`${field} must contain only JSON-compatible values`)
  }
  if (ancestors.has(value)) failClone(`${field} must not contain cycles`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
      if (!lengthDescriptor || !('value' in lengthDescriptor)) {
        failClone(`${field}.length must be an own data property`)
      }
      const length = lengthDescriptor.value
      const keys = Reflect.ownKeys(value)
      if (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1) {
        failClone(`${field} must be a dense array without extra properties`)
      }

      const result = new Array<unknown>(length)
      for (let index = 0; index < length; index += 1) {
        const item = ownEnumerableDataValue(value, String(index), `${field}[${index}]`)
        result[index] = cloneJsonData(item, ancestors, `${field}[${index}]`)
      }
      return result
    }

    if (!isPlainObject(value)) failClone(`${field} must contain only plain objects`)
    const result: Record<string, unknown> = {}
    const keys = sortedOwnStringKeys(value, field)
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!
      const item = ownEnumerableDataValue(value, key, `${field}.${key}`)
      Object.defineProperty(result, key, {
        value: cloneJsonData(item, ancestors, `${field}.${key}`),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  } finally {
    ancestors.delete(value)
  }
}

export function createCreatorSkillArtifact<T>(
  input: CreatorSkillArtifactInput<T>,
): CreatorSkillArtifact<T> {
  if (!Number.isInteger(input.artifactVersion) || input.artifactVersion <= 0) {
    throw new TypeError('artifactVersion must be a positive integer')
  }
  if (input.payload === undefined) {
    throw new TypeError('payload must not be undefined')
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

export function cloneCreatorSkillArtifact(value: unknown): CreatorSkillArtifact {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) {
      failClone('artifact must be a plain object')
    }
    assertExactArtifactKeys(value)

    const artifactId = ownEnumerableDataValue(value, 'artifactId', 'artifactId')
    const artifactType = ownEnumerableDataValue(value, 'artifactType', 'artifactType')
    const artifactVersion = ownEnumerableDataValue(value, 'artifactVersion', 'artifactVersion')
    const sourceNodeIds = ownEnumerableDataValue(value, 'sourceNodeIds', 'sourceNodeIds')
    const sourceArtifactIds = ownEnumerableDataValue(
      value,
      'sourceArtifactIds',
      'sourceArtifactIds',
    )
    const payload = ownEnumerableDataValue(value, 'payload', 'payload')

    if (!isTrimmedIdentifier(artifactId)) failClone('artifactId must be a trimmed non-empty string')
    if (!isTrimmedIdentifier(artifactType)) failClone('artifactType must be a trimmed non-empty string')
    if (typeof artifactVersion !== 'number'
      || !Number.isInteger(artifactVersion)
      || artifactVersion <= 0) {
      failClone('artifactVersion must be a positive integer')
    }

    const ancestors = new WeakSet<object>()
    ancestors.add(value)
    return {
      artifactId,
      artifactType,
      artifactVersion,
      sourceNodeIds: cloneCanonicalSourceIdentifiers(sourceNodeIds, 'sourceNodeIds'),
      sourceArtifactIds: cloneCanonicalSourceIdentifiers(sourceArtifactIds, 'sourceArtifactIds'),
      payload: cloneJsonData(payload, ancestors, 'payload'),
    }
  } catch (error) {
    if (error instanceof TypeError) throw error
    throw new TypeError('Creator Skill artifact could not be cloned')
  }
}

export function isCreatorSkillArtifact(value: unknown): value is CreatorSkillArtifact {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !isPlainObject(value)) {
      return false
    }
    assertExactArtifactKeys(value)

    const artifact = value as Record<string, unknown>
    return isTrimmedIdentifier(artifact.artifactId)
      && isTrimmedIdentifier(artifact.artifactType)
      && typeof artifact.artifactVersion === 'number'
      && Number.isInteger(artifact.artifactVersion)
      && artifact.artifactVersion > 0
      && isCanonicalIdentifierArray(artifact.sourceNodeIds)
      && isCanonicalIdentifierArray(artifact.sourceArtifactIds)
      && artifact.payload !== undefined
  } catch {
    return false
  }
}
