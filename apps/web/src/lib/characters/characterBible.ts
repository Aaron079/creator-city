import type { CharacterBible, CharacterBoundNode, CharacterProfile } from './types'

export const EMPTY_CHARACTER_BIBLE: CharacterBible = { characters: [] }

export function getCharacterBibleKey(projectId: string) {
  return `creator-city:character-bible:${projectId}`
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const values = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return values.length ? values : undefined
}

function nowIso() {
  return new Date().toISOString()
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `character-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeCharacterProfile(input: unknown): CharacterProfile | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const name = stringValue(record.name)
  if (!id || !name) return null
  return {
    id,
    name,
    role: stringValue(record.role),
    logline: stringValue(record.logline),
    appearance: stringValue(record.appearance),
    ageAndTemperament: stringValue(record.ageAndTemperament),
    costume: stringValue(record.costume),
    hairstyle: stringValue(record.hairstyle),
    props: stringValue(record.props),
    behaviorRules: stringValue(record.behaviorRules),
    negativeRules: stringValue(record.negativeRules),
    referenceKeywords: stringList(record.referenceKeywords),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
  }
}

export function normalizeCharacterBible(input: unknown): CharacterBible {
  const record = recordValue(input)
  const characters = Array.isArray(record.characters)
    ? record.characters
        .map((item) => normalizeCharacterProfile(item))
        .filter((item): item is CharacterProfile => Boolean(item))
    : []
  return {
    characters,
    updatedAt: stringValue(record.updatedAt),
  }
}

export function createCharacterProfile(
  input: Partial<CharacterProfile> = {},
): CharacterProfile {
  const timestamp = nowIso()
  return {
    id: input.id || createId(),
    name: input.name || '未来城市信使',
    role: input.role,
    logline: input.logline || '在雨夜城市中传递秘密文件的孤独信使',
    appearance: input.appearance || '黑色长风衣，冷峻眼神，瘦高身材',
    ageAndTemperament: input.ageAndTemperament,
    costume: input.costume || '黑色防水长风衣，深色内搭，旧皮靴',
    hairstyle: input.hairstyle || '短发，略凌乱，被雨水打湿',
    props: input.props || '金属信筒、旧式纸质信件',
    behaviorRules: input.behaviorRules,
    negativeRules: input.negativeRules || '不要变成儿童，不要更换红色衣服，不要变成卡通角色',
    referenceKeywords: input.referenceKeywords,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

export function updateCharacterProfile(
  bible: CharacterBible,
  characterId: string,
  patch: Partial<CharacterProfile>,
): CharacterBible {
  return {
    characters: bible.characters.map((character) => (
      character.id === characterId
        ? { ...character, ...patch, id: character.id, updatedAt: nowIso() }
        : character
    )),
    updatedAt: nowIso(),
  }
}

export function deleteCharacterProfile(
  bible: CharacterBible,
  characterId: string,
): CharacterBible {
  return {
    characters: bible.characters.filter((character) => character.id !== characterId),
    updatedAt: nowIso(),
  }
}

export function getCharacterById(
  bible: CharacterBible | null | undefined,
  characterId: string,
) {
  return bible?.characters.find((character) => character.id === characterId) ?? null
}

export function getNodeCharacterIds(node: CharacterBoundNode | null | undefined) {
  const metadata = recordValue(node?.metadataJson)
  return Array.isArray(metadata.characterIds)
    ? metadata.characterIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : []
}

export function characterIdsMetadata(metadataJson: unknown, characterIds: string[]) {
  return {
    ...recordValue(metadataJson),
    characterIds: [...new Set(characterIds.filter(Boolean))],
  }
}

export function resolveNodeCharacters(
  node: CharacterBoundNode | null | undefined,
  characterBible: CharacterBible | null | undefined,
) {
  const characters = characterBible?.characters ?? []
  const characterIds = new Set(getNodeCharacterIds(node))
  return characters.filter((character) => characterIds.has(character.id))
}

export function loadCharacterBible(
  projectId: string,
  workflowMetadata?: unknown,
): CharacterBible {
  const workflowRecord = recordValue(workflowMetadata)
  if (workflowRecord.characterBible) {
    return normalizeCharacterBible(workflowRecord.characterBible)
  }
  if (typeof window === 'undefined' || !projectId) return EMPTY_CHARACTER_BIBLE
  try {
    const raw = window.localStorage.getItem(getCharacterBibleKey(projectId))
    return raw ? normalizeCharacterBible(JSON.parse(raw)) : EMPTY_CHARACTER_BIBLE
  } catch {
    return EMPTY_CHARACTER_BIBLE
  }
}

export function saveCharacterBible(
  projectId: string,
  bible: CharacterBible,
) {
  const nextBible = {
    characters: bible.characters,
    updatedAt: nowIso(),
  }
  if (typeof window !== 'undefined' && projectId) {
    try {
      window.localStorage.setItem(getCharacterBibleKey(projectId), JSON.stringify(nextBible))
    } catch {
      // The in-memory bible remains usable if localStorage is unavailable.
    }
  }
  return nextBible
}
