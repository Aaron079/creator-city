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

// ── Key helpers ──────────────────────────────────────────────────────────────

function getKey(projectId: string) {
  return `creator-city:shot-sequence:${projectId}`
}

function getDraftKey(projectId: string) {
  return `creator-city:shot-sequence-draft:${projectId}`
}

// ── Item validation ───────────────────────────────────────────────────────────

function isValidItem(item: unknown): item is ShotSequenceItem {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as ShotSequenceItem).nodeId === 'string' &&
    (item as ShotSequenceItem).nodeId.length > 0
  )
}

function defaultState(projectId: string): ShotSequenceState {
  return { version: 1, projectId, items: [], updatedAt: new Date().toISOString() }
}

// ── Legacy local-only persistence (was MVP source of truth) ──────────────────

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

export function saveShotSequence(projectId: string, items: ShotSequenceItem[]): void {
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

// Alias for migration: clear the old local-only saved key after migrating to cloud.
export function clearLegacyShotSequence(projectId: string): void {
  clearShotSequence(projectId)
}

// ── Draft persistence (unsaved edits, survives panel close via Escape) ────────

export function getShotSequenceDraft(projectId: string): ShotSequenceState | null {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(getDraftKey(projectId))
      : null
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ShotSequenceState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return null
    return {
      version: 1,
      projectId,
      items: parsed.items.filter(isValidItem).map((item, i) => ({ ...item, order: i + 1 })),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function saveShotSequenceDraft(projectId: string, items: ShotSequenceItem[]): void {
  try {
    const state: ShotSequenceState = {
      version: 1,
      projectId,
      items: items.map((item, i) => ({ ...item, order: i + 1 })),
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(getDraftKey(projectId), JSON.stringify(state))
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function clearShotSequenceDraft(projectId: string): void {
  try {
    window.localStorage.removeItem(getDraftKey(projectId))
  } catch {
    // ignore
  }
}

// ── Cloud parsing: extract shotSequence from canvasWorkflow.metadataJson ──────

export function parseShotSequenceFromWorkflowMetadata(metadataJson: unknown): ShotSequenceState | null {
  try {
    if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
    const meta = metadataJson as Record<string, unknown>
    const seq = meta.shotSequence
    if (!seq || typeof seq !== 'object' || Array.isArray(seq)) return null
    const s = seq as Partial<ShotSequenceState>
    if (s.version !== 1 || !Array.isArray(s.items)) return null
    return {
      version: 1,
      projectId: typeof s.projectId === 'string' ? s.projectId : '',
      items: s.items.filter(isValidItem).map((item, i) => ({ ...item, order: i + 1 })),
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

// ── Item normalization: dedup by nodeId, re-index order ──────────────────────

export function normalizeShotSequenceItems(items: ShotSequenceItem[]): ShotSequenceItem[] {
  const seen = new Set<string>()
  return items
    .filter((item) => {
      if (seen.has(item.nodeId)) return false
      seen.add(item.nodeId)
      return true
    })
    .map((item, i) => ({ ...item, order: i + 1 }))
}

// ── Duration formatting ───────────────────────────────────────────────────────

export function formatSequenceDuration(totalSec: number): string {
  if (totalSec <= 0) return '0s'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `${s}s`
}
