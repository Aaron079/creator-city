import type { ShotCard, StoryboardState } from './types'

const EMPTY_STATE: StoryboardState = { version: '1', shots: [], updatedAt: '' }

export function directorStorageKey(projectId?: string) {
  return `creator-city:storyboard:director:${projectId || 'local'}`
}

function isShotCard(value: unknown): value is ShotCard {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.index === 'number' &&
    typeof v.title === 'string' &&
    Array.isArray(v.nodeIds) &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  )
}

export function readDirectorState(projectId?: string): StoryboardState {
  if (typeof window === 'undefined') return EMPTY_STATE
  try {
    const raw = window.localStorage.getItem(directorStorageKey(projectId))
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<StoryboardState>
    if (!Array.isArray(parsed.shots)) return EMPTY_STATE
    return {
      version: typeof parsed.version === 'string' ? parsed.version : '1',
      shots: parsed.shots.filter(isShotCard),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return EMPTY_STATE
  }
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
