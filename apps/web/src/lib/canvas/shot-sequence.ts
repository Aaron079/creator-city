export type ShotSequenceItem = {
  nodeId: string
  order: number
  durationSec?: number
  addedAt?: string
}

export type ShotSequenceState = {
  version: 1
  projectId: string
  items: ShotSequenceItem[]
  updatedAt: string
}

function getKey(projectId: string) {
  return `creator-city:shot-sequence:${projectId}`
}

function defaultState(projectId: string): ShotSequenceState {
  return { version: 1, projectId, items: [], updatedAt: new Date().toISOString() }
}

function isValidItem(item: unknown): item is ShotSequenceItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as ShotSequenceItem).nodeId === 'string' &&
    (item as ShotSequenceItem).nodeId.length > 0
  )
}

export function getShotSequence(projectId: string): ShotSequenceState {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(getKey(projectId))
      : null
    if (!raw) return defaultState(projectId)
    const parsed = JSON.parse(raw) as Partial<ShotSequenceState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return defaultState(projectId)
    return {
      version: 1,
      projectId,
      items: parsed.items
        .filter(isValidItem)
        .map((item, i) => ({ ...item, order: i + 1 })),
      updatedAt: typeof parsed.updatedAt === 'string'
        ? parsed.updatedAt
        : new Date(0).toISOString(),
    }
  } catch {
    return defaultState(projectId)
  }
}

export function saveShotSequence(
  projectId: string,
  items: ShotSequenceItem[],
): void {
  try {
    const state: ShotSequenceState = {
      version: 1,
      projectId,
      items: items.map((item, i) => ({ ...item, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(getKey(projectId), JSON.stringify(state))
  } catch {
    // localStorage unavailable — fail silently
  }
}

export function clearShotSequence(projectId: string): void {
  try {
    window.localStorage.removeItem(getKey(projectId))
  } catch {
    // ignore
  }
}

export function formatSequenceDuration(totalSec: number): string {
  if (totalSec <= 0) return '0s'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
