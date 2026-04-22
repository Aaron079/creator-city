// ─── Types ────────────────────────────────────────────────────────────────────

export type DirectorSessionSource = 'generate' | 'director' | 'auto' | 'commercial'

export interface DirectorShotRecord {
  label:      string
  idea:       string
  shotType?:  string
  mood?:      string
  style?:     string
}

export interface DirectorRecord {
  id:          string
  source:      DirectorSessionSource
  idea:        string
  style:       string
  shots:       DirectorShotRecord[]
  prompts:     string[]
  resultScore?: number
  createdAt:   number
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cc:director_history'
const MAX_RECORDS = 200

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `dr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function readAll(): DirectorRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DirectorRecord[]) : []
  } catch {
    return []
  }
}

function writeAll(records: DirectorRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Quota exceeded — drop oldest half
    const trimmed = records.slice(Math.floor(records.length / 2))
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* no-op */ }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a director session record to local history.
 * Safe to call on every generate/director trigger — fire-and-forget.
 */
export function recordDirectorSession(
  input: Omit<DirectorRecord, 'id' | 'createdAt'>
): DirectorRecord {
  const record: DirectorRecord = {
    ...input,
    id:        generateId(),
    createdAt: Date.now(),
  }
  const existing = readAll()
  // Keep newest MAX_RECORDS entries
  const updated = [record, ...existing].slice(0, MAX_RECORDS)
  writeAll(updated)
  return record
}

/**
 * Return all recorded director sessions, newest first.
 */
export function getDirectorHistory(): DirectorRecord[] {
  return readAll()
}

/**
 * Return the N most recent records for a given source.
 */
export function getHistoryBySource(
  source: DirectorSessionSource,
  limit = 20,
): DirectorRecord[] {
  return readAll()
    .filter((r) => r.source === source)
    .slice(0, limit)
}

/**
 * Update the resultScore of an existing record (e.g. after user feedback).
 */
export function scoreDirectorSession(id: string, score: number): void {
  const records = readAll()
  const idx     = records.findIndex((r) => r.id === id)
  if (idx === -1) return
  records[idx] = { ...records[idx]!, resultScore: Math.max(0, Math.min(10, score)) }
  writeAll(records)
}

/**
 * Clear all history (used in tests / dev resets).
 */
export function clearDirectorHistory(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}
