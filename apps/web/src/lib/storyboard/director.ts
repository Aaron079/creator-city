import type {
  ShotCard,
  StoryboardRecipeShotProvenance,
  StoryboardState,
} from './types'

const EMPTY_STATE: StoryboardState = { version: '1', shots: [], updatedAt: '' }
const MAX_SHOTS = 120

type PropertyRead =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'value'; value: unknown }

function fail(message: string): never {
  throw new TypeError(message)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function ownData(value: object, key: PropertyKey): PropertyRead {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) return { status: 'absent' }
    if (!descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return { status: 'invalid' }
    }
    return { status: 'value', value: descriptor.value }
  } catch {
    return { status: 'invalid' }
  }
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  let keys: PropertyKey[]
  try {
    keys = Reflect.ownKeys(value)
  } catch {
    return fail('Storyboard state contains unreadable keys')
  }
  const allowed = new Set([...required, ...optional])
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    fail('Storyboard state contains unsupported fields')
  }
  for (const key of required) {
    if (ownData(value, key).status !== 'value') fail(`${key} is required`)
  }
}

function requiredString(value: Record<string, unknown>, key: string) {
  const property = ownData(value, key)
  if (property.status !== 'value' || typeof property.value !== 'string') {
    return fail(`${key} must be a string`)
  }
  return property.value
}

function requiredId(value: Record<string, unknown>, key: string) {
  const result = requiredString(value, key)
  if (!result || result !== result.trim()) fail(`${key} must be a trimmed nonempty string`)
  return result
}

function optionalString(value: Record<string, unknown>, key: string) {
  const property = ownData(value, key)
  if (property.status === 'absent') return undefined
  if (property.status !== 'value' || typeof property.value !== 'string') {
    return fail(`${key} must be a string`)
  }
  return property.value
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > MAX_SHOTS) fail(`${field} must be an array`)
  let keys: PropertyKey[]
  try {
    keys = Reflect.ownKeys(value)
  } catch {
    return fail(`${field} is unreadable`)
  }
  if (keys.length !== value.length + 1) fail(`${field} must be dense`)
  const result: string[] = []
  const seen = new Set<string>()
  for (let index = 0; index < value.length; index += 1) {
    const property = ownData(value, String(index))
    if (property.status !== 'value'
      || typeof property.value !== 'string'
      || !property.value
      || property.value !== property.value.trim()
      || seen.has(property.value)) {
      fail(`${field} must contain unique identifiers`)
    }
    seen.add(property.value)
    result.push(property.value)
  }
  return result
}

function recipeProvenance(value: unknown): StoryboardRecipeShotProvenance {
  if (!isPlainRecord(value)) fail('recipe provenance must be a plain object')
  exactKeys(value, ['recipeId', 'sourceArtifactId', 'sceneId', 'shotId'], ['beatId'])
  const beatId = optionalString(value, 'beatId')
  if (beatId !== undefined && (!beatId || beatId !== beatId.trim())) {
    fail('beatId must be a trimmed nonempty string')
  }
  return {
    recipeId: requiredId(value, 'recipeId'),
    sourceArtifactId: requiredId(value, 'sourceArtifactId'),
    sceneId: requiredId(value, 'sceneId'),
    ...(beatId !== undefined ? { beatId } : {}),
    shotId: requiredId(value, 'shotId'),
  }
}

function cloneShotCard(value: unknown): ShotCard {
  if (!isPlainRecord(value)) fail('shot must be a plain object')
  exactKeys(
    value,
    ['id', 'index', 'title', 'nodeIds', 'createdAt', 'updatedAt'],
    [
      'shotType',
      'durationSec',
      'mood',
      'cameraMovement',
      'directorNote',
      'characterIds',
      'sceneIds',
      'thumbnailUrl',
      'recipe',
    ],
  )
  const indexProperty = ownData(value, 'index')
  if (indexProperty.status !== 'value'
    || !Number.isSafeInteger(indexProperty.value)
    || (indexProperty.value as number) < 0) {
    fail('shot.index must be a nonnegative safe integer')
  }
  const durationProperty = ownData(value, 'durationSec')
  let durationSec: number | undefined
  if (durationProperty.status !== 'absent') {
    if (durationProperty.status !== 'value'
      || typeof durationProperty.value !== 'number'
      || !Number.isFinite(durationProperty.value)
      || durationProperty.value < 0) {
      fail('shot.durationSec must be a nonnegative finite number')
    }
    durationSec = durationProperty.value
  }
  const characterIdsProperty = ownData(value, 'characterIds')
  const sceneIdsProperty = ownData(value, 'sceneIds')
  const recipeProperty = ownData(value, 'recipe')
  const nodeIdsProperty = ownData(value, 'nodeIds')
  if (nodeIdsProperty.status !== 'value') fail('shot.nodeIds is invalid')
  if (characterIdsProperty.status === 'invalid') fail('shot.characterIds is invalid')
  if (sceneIdsProperty.status === 'invalid') fail('shot.sceneIds is invalid')
  if (recipeProperty.status === 'invalid') fail('shot.recipe is invalid')
  const shotType = optionalString(value, 'shotType')
  const mood = optionalString(value, 'mood')
  const cameraMovement = optionalString(value, 'cameraMovement')
  const directorNote = optionalString(value, 'directorNote')
  const thumbnailUrl = optionalString(value, 'thumbnailUrl')
  const result: ShotCard = {
    id: requiredId(value, 'id'),
    index: indexProperty.value as number,
    title: requiredString(value, 'title'),
    nodeIds: stringArray(nodeIdsProperty.value, 'shot.nodeIds'),
    createdAt: requiredString(value, 'createdAt'),
    updatedAt: requiredString(value, 'updatedAt'),
  }
  if (shotType !== undefined) result.shotType = shotType
  if (durationSec !== undefined) result.durationSec = durationSec
  if (mood !== undefined) result.mood = mood
  if (cameraMovement !== undefined) result.cameraMovement = cameraMovement
  if (directorNote !== undefined) result.directorNote = directorNote
  if (characterIdsProperty.status === 'value') {
    result.characterIds = stringArray(characterIdsProperty.value, 'shot.characterIds')
  }
  if (sceneIdsProperty.status === 'value') {
    result.sceneIds = stringArray(sceneIdsProperty.value, 'shot.sceneIds')
  }
  if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl
  if (recipeProperty.status === 'value') result.recipe = recipeProvenance(recipeProperty.value)
  return result
}

export function cloneAndValidateStoryboardState(value: unknown): StoryboardState {
  if (!isPlainRecord(value)) fail('Storyboard state must be a plain object')
  exactKeys(value, ['version', 'shots', 'updatedAt'])
  const shotsProperty = ownData(value, 'shots')
  if (shotsProperty.status !== 'value'
    || !Array.isArray(shotsProperty.value)
    || shotsProperty.value.length > MAX_SHOTS) {
    fail('Storyboard state shots are invalid')
  }
  let keys: PropertyKey[]
  try {
    keys = Reflect.ownKeys(shotsProperty.value)
  } catch {
    return fail('Storyboard state shots are unreadable')
  }
  if (keys.length !== shotsProperty.value.length + 1) {
    fail('Storyboard state shots must be dense')
  }
  const shots = new Array<ShotCard>(shotsProperty.value.length)
  const shotIds = new Set<string>()
  for (let index = 0; index < shots.length; index += 1) {
    const property = ownData(shotsProperty.value, String(index))
    if (property.status !== 'value') fail('Storyboard state shots must be dense data')
    const shot = cloneShotCard(property.value)
    if (shotIds.has(shot.id)) fail('Storyboard state shot IDs must be unique')
    shotIds.add(shot.id)
    shots[index] = shot
  }
  return {
    version: requiredString(value, 'version'),
    shots,
    updatedAt: requiredString(value, 'updatedAt'),
  }
}

export function directorStorageKey(projectId?: string) {
  return `creator-city:storyboard:director:${projectId || 'local'}`
}

export type LegacyDirectorStateReadResult =
  | { status: 'absent' }
  | { status: 'valid'; state: StoryboardState }
  | { status: 'invalid' }

export function readLegacyDirectorState(projectId?: string): LegacyDirectorStateReadResult {
  if (typeof window === 'undefined') return { status: 'absent' }
  try {
    const raw = window.localStorage.getItem(directorStorageKey(projectId))
    if (!raw) return { status: 'absent' }
    return { status: 'valid', state: cloneAndValidateStoryboardState(JSON.parse(raw)) }
  } catch {
    return { status: 'invalid' }
  }
}

export function readDirectorState(projectId?: string): StoryboardState {
  const result = readLegacyDirectorState(projectId)
  return result.status === 'valid'
    ? result.state
    : { ...EMPTY_STATE, shots: [] }
}

export function writeDirectorState(state: StoryboardState, projectId?: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(directorStorageKey(projectId), JSON.stringify(state))
}

export function createShotCard(index: number): ShotCard {
  const now = new Date().toISOString()
  const num = String(index + 1).padStart(2, '0')
  return {
    id: `shot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    index,
    title: `S${num}`,
    nodeIds: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function addNodeToShot(shot: ShotCard, nodeId: string, thumbnailUrl?: string): ShotCard {
  const nodeIds = shot.nodeIds.includes(nodeId) ? shot.nodeIds : [...shot.nodeIds, nodeId]
  return {
    ...shot,
    nodeIds,
    thumbnailUrl: thumbnailUrl ?? shot.thumbnailUrl,
    updatedAt: new Date().toISOString(),
  }
}

export function reindexShots(shots: ShotCard[]): ShotCard[] {
  return shots.map((shot, i) => {
    const num = String(i + 1).padStart(2, '0')
    return { ...shot, index: i, title: shot.title.match(/^S\d+$/) ? `S${num}` : shot.title }
  })
}
