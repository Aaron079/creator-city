import type {
  CharacterBible,
  CharacterBoundNode,
  CharacterProfile,
  CharacterReferenceAsset,
  CharacterReferenceKind,
} from './types'

export const EMPTY_CHARACTER_BIBLE: CharacterBible = { characters: [] }

export const CHARACTER_REFERENCE_KIND_LABELS: Record<CharacterReferenceKind, string> = {
  'hero': '主参考',
  'full-body': '全身',
  'medium-shot': '中景',
  'close-up': '近景',
  'extreme-close-up': '特写',
  'front': '正面',
  'side': '侧面',
  'back': '背面',
  'three-quarter': '3/4',
  'expression': '表情',
  'costume': '服装',
  'prop': '道具',
  'pose': '动作',
  'other': '其他',
}

export const CHARACTER_REFERENCE_KINDS: CharacterReferenceKind[] = [
  'hero',
  'full-body',
  'medium-shot',
  'close-up',
  'extreme-close-up',
  'front',
  'side',
  'back',
  'three-quarter',
  'expression',
  'costume',
  'prop',
  'pose',
  'other',
]

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
  return `id-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeReferenceAsset(input: unknown, characterId: string): CharacterReferenceAsset | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const imageUrl = stringValue(record.imageUrl)
  if (!id || !imageUrl) return null
  const rawKind = stringValue(record.kind)
  const validKinds: CharacterReferenceKind[] = CHARACTER_REFERENCE_KINDS
  const kind: CharacterReferenceKind = rawKind && validKinds.includes(rawKind as CharacterReferenceKind)
    ? rawKind as CharacterReferenceKind
    : 'other'
  return {
    id,
    characterId: (stringValue(record.characterId) ?? characterId),
    kind,
    label: stringValue(record.label) ?? CHARACTER_REFERENCE_KIND_LABELS[kind],
    imageUrl,
    sourceNodeId: stringValue(record.sourceNodeId),
    sourcePrompt: stringValue(record.sourcePrompt),
    providerId: stringValue(record.providerId),
    model: stringValue(record.model),
    isHero: record.isHero === true,
    notes: stringValue(record.notes),
    createdAt: stringValue(record.createdAt) ?? nowIso(),
    updatedAt: stringValue(record.updatedAt),
  }
}

export function normalizeCharacterProfile(input: unknown): CharacterProfile | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const name = stringValue(record.name)
  if (!id || !name) return null
  const referencePack = Array.isArray(record.referencePack)
    ? record.referencePack
        .map((item) => normalizeReferenceAsset(item, id))
        .filter((item): item is CharacterReferenceAsset => Boolean(item))
    : undefined
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
    referencePack: referencePack?.length ? referencePack : undefined,
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
  const nodeReferenceBindingsRaw = recordValue(record.nodeReferenceBindings)
  const nodeReferenceBindings: Record<string, string[]> = {}
  for (const [nodeId, ids] of Object.entries(nodeReferenceBindingsRaw)) {
    if (Array.isArray(ids)) {
      const validIds = ids.filter((id): id is string => typeof id === 'string' && Boolean(id))
      if (validIds.length) nodeReferenceBindings[nodeId] = validIds
    }
  }
  return {
    characters,
    nodeReferenceBindings: Object.keys(nodeReferenceBindings).length ? nodeReferenceBindings : undefined,
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
    referencePack: input.referencePack,
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
    ...bible,
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
  const nextBindings = bible.nodeReferenceBindings ? { ...bible.nodeReferenceBindings } : undefined
  return {
    ...bible,
    characters: bible.characters.filter((character) => character.id !== characterId),
    nodeReferenceBindings: nextBindings,
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

// ─── Reference pack helpers ───────────────────────────────────────────────────

export function createReferenceAsset(
  input: Omit<CharacterReferenceAsset, 'id' | 'createdAt'> & Partial<Pick<CharacterReferenceAsset, 'id' | 'createdAt'>>,
): CharacterReferenceAsset {
  return {
    ...input,
    id: input.id ?? createId(),
    createdAt: input.createdAt ?? nowIso(),
  }
}

export function addReferenceToCharacter(
  bible: CharacterBible,
  characterId: string,
  asset: CharacterReferenceAsset,
): CharacterBible {
  return {
    ...bible,
    characters: bible.characters.map((character) => {
      if (character.id !== characterId) return character
      const existing = character.referencePack ?? []
      return {
        ...character,
        referencePack: [...existing, asset],
        updatedAt: nowIso(),
      }
    }),
    updatedAt: nowIso(),
  }
}

export function removeReferenceFromCharacter(
  bible: CharacterBible,
  characterId: string,
  referenceId: string,
): CharacterBible {
  const nextBindings: Record<string, string[]> = {}
  if (bible.nodeReferenceBindings) {
    for (const [nodeId, ids] of Object.entries(bible.nodeReferenceBindings)) {
      const filtered = ids.filter((id) => id !== referenceId)
      if (filtered.length) nextBindings[nodeId] = filtered
    }
  }
  return {
    ...bible,
    characters: bible.characters.map((character) => {
      if (character.id !== characterId) return character
      return {
        ...character,
        referencePack: (character.referencePack ?? []).filter((ref) => ref.id !== referenceId),
        updatedAt: nowIso(),
      }
    }),
    nodeReferenceBindings: Object.keys(nextBindings).length ? nextBindings : undefined,
    updatedAt: nowIso(),
  }
}

export function setHeroReference(
  bible: CharacterBible,
  characterId: string,
  referenceId: string,
): CharacterBible {
  return {
    ...bible,
    characters: bible.characters.map((character) => {
      if (character.id !== characterId) return character
      return {
        ...character,
        referencePack: (character.referencePack ?? []).map((ref) => ({
          ...ref,
          isHero: ref.id === referenceId,
          kind: ref.id === referenceId ? 'hero' as CharacterReferenceKind : (ref.kind === 'hero' ? 'other' as CharacterReferenceKind : ref.kind),
          updatedAt: nowIso(),
        })),
        updatedAt: nowIso(),
      }
    }),
    updatedAt: nowIso(),
  }
}

export function getReferencesByKind(
  character: CharacterProfile,
  kind: CharacterReferenceKind,
): CharacterReferenceAsset[] {
  return (character.referencePack ?? []).filter((ref) => ref.kind === kind)
}

export function getHeroReference(character: CharacterProfile): CharacterReferenceAsset | null {
  const pack = character.referencePack ?? []
  return pack.find((ref) => ref.isHero || ref.kind === 'hero') ?? pack[0] ?? null
}

export function getBestReferenceForShotScale(
  character: CharacterProfile,
  shotHint?: string,
): CharacterReferenceAsset | null {
  const pack = character.referencePack ?? []
  if (!pack.length) return null
  if (!shotHint) return getHeroReference(character)

  const hint = shotHint.toLowerCase()
  let preferredKind: CharacterReferenceKind = 'hero'
  if (hint.includes('全身') || hint.includes('full')) preferredKind = 'full-body'
  else if (hint.includes('中景') || hint.includes('medium')) preferredKind = 'medium-shot'
  else if (hint.includes('近景') || hint.includes('close')) preferredKind = 'close-up'
  else if (hint.includes('特写') || hint.includes('extreme')) preferredKind = 'extreme-close-up'

  const byKind = pack.find((ref) => ref.kind === preferredKind)
  return byKind ?? getHeroReference(character)
}

// ─── Node reference binding helpers ──────────────────────────────────────────

export function getNodeReferenceIds(
  bible: CharacterBible | null | undefined,
  nodeId: string,
): string[] {
  return bible?.nodeReferenceBindings?.[nodeId] ?? []
}

export function bindReferenceToNode(
  bible: CharacterBible,
  nodeId: string,
  referenceId: string,
): CharacterBible {
  const existing = bible.nodeReferenceBindings?.[nodeId] ?? []
  if (existing.includes(referenceId)) return bible
  return {
    ...bible,
    nodeReferenceBindings: {
      ...bible.nodeReferenceBindings,
      [nodeId]: [...existing, referenceId],
    },
    updatedAt: nowIso(),
  }
}

export function unbindReferenceFromNode(
  bible: CharacterBible,
  nodeId: string,
  referenceId: string,
): CharacterBible {
  const existing = bible.nodeReferenceBindings?.[nodeId] ?? []
  const next = existing.filter((id) => id !== referenceId)
  const nextBindings = { ...bible.nodeReferenceBindings }
  if (next.length) {
    nextBindings[nodeId] = next
  } else {
    delete nextBindings[nodeId]
  }
  return {
    ...bible,
    nodeReferenceBindings: Object.keys(nextBindings).length ? nextBindings : undefined,
    updatedAt: nowIso(),
  }
}

export function resolveNodeCharacterReferences(
  bible: CharacterBible | null | undefined,
  nodeId: string,
): CharacterReferenceAsset[] {
  if (!bible) return []
  const boundIds = new Set(getNodeReferenceIds(bible, nodeId))
  if (!boundIds.size) return []
  return bible.characters.flatMap((character) =>
    (character.referencePack ?? []).filter((ref) => boundIds.has(ref.id)),
  )
}

// ─── Persistence ─────────────────────────────────────────────────────────────

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
  const nextBible: CharacterBible = {
    characters: bible.characters,
    nodeReferenceBindings: bible.nodeReferenceBindings,
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
