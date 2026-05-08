import type { SceneBible, SceneBoundNode, SceneProfile } from './types'

export const EMPTY_SCENE_BIBLE: SceneBible = { scenes: [] }

export function getSceneBibleKey(projectId: string) {
  return `creator-city:scene-bible:${projectId}`
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
  return `scene-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeSceneProfile(input: unknown): SceneProfile | null {
  const record = recordValue(input)
  const id = stringValue(record.id)
  const name = stringValue(record.name)
  if (!id || !name) return null
  return {
    id,
    name,
    logline: stringValue(record.logline),
    location: stringValue(record.location),
    era: stringValue(record.era),
    atmosphere: stringValue(record.atmosphere),
    architecture: stringValue(record.architecture),
    lighting: stringValue(record.lighting),
    weather: stringValue(record.weather),
    colorRules: stringValue(record.colorRules),
    keyObjects: stringValue(record.keyObjects),
    continuityRules: stringValue(record.continuityRules),
    negativeRules: stringValue(record.negativeRules),
    referenceKeywords: stringList(record.referenceKeywords),
    createdAt: stringValue(record.createdAt),
    updatedAt: stringValue(record.updatedAt),
  }
}

export function normalizeSceneBible(input: unknown): SceneBible {
  const record = recordValue(input)
  const scenes = Array.isArray(record.scenes)
    ? record.scenes
        .map((item) => normalizeSceneProfile(item))
        .filter((item): item is SceneProfile => Boolean(item))
    : []
  return {
    scenes,
    updatedAt: stringValue(record.updatedAt),
  }
}

export function createSceneProfile(input: Partial<SceneProfile> = {}): SceneProfile {
  const timestamp = nowIso()
  return {
    id: input.id || createId(),
    name: input.name || '未来雨夜城市街区',
    logline: input.logline || '霓虹灯照亮的高密度未来城市街道，雨水反射蓝紫色光。',
    location: input.location || '未来城市商业区',
    era: input.era || '近未来',
    atmosphere: input.atmosphere || '孤独、潮湿、冷峻、电影感',
    architecture: input.architecture || '高楼、玻璃幕墙、窄街、发光广告牌',
    lighting: input.lighting || '霓虹蓝紫，高反差，湿地反光',
    weather: input.weather || '雨夜',
    colorRules: input.colorRules,
    keyObjects: input.keyObjects || '悬浮车、广告屏、雨伞、湿润街道',
    continuityRules: input.continuityRules || '始终保持雨夜、霓虹、湿润反光和高楼压迫感',
    negativeRules: input.negativeRules || '不要变成白天，不要乡村，不要暖色阳光，不要卡通化',
    referenceKeywords: input.referenceKeywords,
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  }
}

export function updateSceneProfile(
  bible: SceneBible,
  sceneId: string,
  patch: Partial<SceneProfile>,
): SceneBible {
  return {
    scenes: bible.scenes.map((scene) => (
      scene.id === sceneId
        ? { ...scene, ...patch, id: scene.id, updatedAt: nowIso() }
        : scene
    )),
    updatedAt: nowIso(),
  }
}

export function deleteSceneProfile(
  bible: SceneBible,
  sceneId: string,
): SceneBible {
  return {
    scenes: bible.scenes.filter((scene) => scene.id !== sceneId),
    updatedAt: nowIso(),
  }
}

export function getSceneById(
  bible: SceneBible | null | undefined,
  sceneId: string,
) {
  return bible?.scenes.find((scene) => scene.id === sceneId) ?? null
}

export function getNodeSceneIds(node: SceneBoundNode | null | undefined) {
  const metadata = recordValue(node?.metadataJson)
  return Array.isArray(metadata.sceneIds)
    ? metadata.sceneIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : []
}

export function sceneIdsMetadata(metadataJson: unknown, sceneIds: string[]) {
  return {
    ...recordValue(metadataJson),
    sceneIds: [...new Set(sceneIds.filter(Boolean))],
  }
}

export function resolveNodeScenes(
  node: SceneBoundNode | null | undefined,
  sceneBible: SceneBible | null | undefined,
) {
  const scenes = sceneBible?.scenes ?? []
  const sceneIds = new Set(getNodeSceneIds(node))
  return scenes.filter((scene) => sceneIds.has(scene.id))
}

export function loadSceneBible(
  projectId: string,
  workflowMetadata?: unknown,
): SceneBible {
  const workflowRecord = recordValue(workflowMetadata)
  if (workflowRecord.sceneBible) {
    return normalizeSceneBible(workflowRecord.sceneBible)
  }
  if (typeof window === 'undefined' || !projectId) return EMPTY_SCENE_BIBLE
  try {
    const raw = window.localStorage.getItem(getSceneBibleKey(projectId))
    return raw ? normalizeSceneBible(JSON.parse(raw)) : EMPTY_SCENE_BIBLE
  } catch {
    return EMPTY_SCENE_BIBLE
  }
}

export function saveSceneBible(
  projectId: string,
  bible: SceneBible,
) {
  const nextBible = {
    scenes: bible.scenes,
    updatedAt: nowIso(),
  }
  if (typeof window !== 'undefined' && projectId) {
    try {
      window.localStorage.setItem(getSceneBibleKey(projectId), JSON.stringify(nextBible))
    } catch {
      // The in-memory bible remains usable if localStorage is unavailable.
    }
  }
  return nextBible
}
