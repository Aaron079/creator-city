import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Relationship {
  userId:       string  // always 'user-me' in current mock
  creatorId:    string
  totalJobs:    number
  totalSpent:   number  // cumulative yuan
  lastWorkedAt: number  // unix ms
  rating:       number  // average rating given
}

interface RelationshipState {
  relationships: Relationship[]
  upsert:        (userId: string, creatorId: string, spent: number) => void
  get:           (userId: string, creatorId: string) => Relationship | undefined
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: Relationship[] = [
  {
    userId:       'user-me',
    creatorId:    'city-creator-1',    // 陈灵一 · Tokyo
    totalJobs:    3,
    totalSpent:   12800,
    lastWorkedAt: Date.now() - 5 * 24 * 3600_000,
    rating:       4.9,
  },
  {
    userId:       'user-me',
    creatorId:    'city-creator-5',    // 魏思源 · Shanghai
    totalJobs:    1,
    totalSpent:   6200,
    lastWorkedAt: Date.now() - 30 * 24 * 3600_000,
    rating:       4.8,
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRelationshipStore = create<RelationshipState>()(
  persist(
    (set, get) => ({
      relationships: SEED,

      upsert: (userId, creatorId, spent) => {
        set((s) => {
          const idx = s.relationships.findIndex(
            (r) => r.userId === userId && r.creatorId === creatorId
          )
          if (idx >= 0) {
            const updated = [...s.relationships]
            const prev    = updated[idx]!
            updated[idx]  = {
              ...prev,
              totalJobs:    prev.totalJobs + 1,
              totalSpent:   prev.totalSpent + spent,
              lastWorkedAt: Date.now(),
            }
            return { relationships: updated }
          }
          return {
            relationships: [
              ...s.relationships,
              { userId, creatorId, totalJobs: 1, totalSpent: spent, lastWorkedAt: Date.now(), rating: 5 },
            ],
          }
        })
      },

      get: (userId, creatorId) =>
        get().relationships.find((r) => r.userId === userId && r.creatorId === creatorId),
    }),
    { name: 'cc:relationships-v1' },
  ),
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function daysAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / (24 * 3600_000))
  if (d === 0) return '今天'
  if (d === 1) return '昨天'
  return `${d} 天前`
}

export function isReturningClient(rel: Relationship): boolean {
  return rel.totalJobs >= 2
}
