import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProjectRole } from '@/lib/roles/projectRoles'

export type ReviewResolutionSourceType = 'client-review' | 'approval-decision' | 'director-note'
export type ReviewResolutionSeverity = 'info' | 'warning' | 'strong'
export type ReviewResolutionStatus = 'open' | 'in-progress' | 'resolved' | 'resubmitted'

export interface ReviewResolutionItem {
  id: string
  projectId: string
  sourceType: ReviewResolutionSourceType
  sourceId: string
  title: string
  description: string
  severity: ReviewResolutionSeverity
  status: ReviewResolutionStatus
  assignedRole: ProjectRole
  assignedUserId?: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resubmittedAt?: string
  relatedTaskId?: string
  relatedVersionId?: string
}

export interface ReviewResolutionSummary {
  openCount: number
  inProgressCount: number
  resolvedCount: number
  strongCount: number
  resubmittedCount: number
}

export interface ReviewResolutionSeed {
  projectId: string
  sourceType: ReviewResolutionSourceType
  sourceId: string
  title: string
  description: string
  severity: ReviewResolutionSeverity
  assignedRole: ProjectRole
  assignedUserId?: string
  createdAt?: string
  relatedTaskId?: string
  relatedVersionId?: string
}

interface ReviewResolutionState {
  items: ReviewResolutionItem[]
  createResolutionItem: (seed: ReviewResolutionSeed) => ReviewResolutionItem
  syncResolutionItems: (projectId: string, seeds: ReviewResolutionSeed[]) => void
  assignResolution: (id: string, assignedRole: ProjectRole, assignedUserId?: string) => void
  markResolutionInProgress: (id: string) => void
  markResolutionResolved: (id: string) => void
  markResolutionResubmitted: (id: string, relatedVersionId?: string) => void
  linkResolutionTask: (id: string, relatedTaskId: string) => void
  getByProject: (projectId: string) => ReviewResolutionItem[]
  getSummary: (projectId?: string) => ReviewResolutionSummary
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function matchesSource(item: ReviewResolutionItem, seed: Pick<ReviewResolutionSeed, 'projectId' | 'sourceType' | 'sourceId'>) {
  return item.projectId === seed.projectId && item.sourceType === seed.sourceType && item.sourceId === seed.sourceId
}

function upsertFromSeed(items: ReviewResolutionItem[], seed: ReviewResolutionSeed) {
  const existing = items.find((item) => matchesSource(item, seed))
  if (!existing) {
    const next: ReviewResolutionItem = {
      id: uid('resolution'),
      projectId: seed.projectId,
      sourceType: seed.sourceType,
      sourceId: seed.sourceId,
      title: seed.title,
      description: seed.description,
      severity: seed.severity,
      status: 'open',
      assignedRole: seed.assignedRole,
      assignedUserId: seed.assignedUserId,
      createdAt: seed.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      relatedTaskId: seed.relatedTaskId,
      relatedVersionId: seed.relatedVersionId,
    }
    return [...items, next]
  }

  return items.map((item) => {
    if (item.id !== existing.id) return item
    return {
      ...item,
      title: seed.title,
      description: seed.description,
      severity: seed.severity,
      assignedRole: item.assignedRole ?? seed.assignedRole,
      assignedUserId: item.assignedUserId ?? seed.assignedUserId,
      relatedTaskId: item.relatedTaskId ?? seed.relatedTaskId,
      relatedVersionId: seed.relatedVersionId ?? item.relatedVersionId,
      updatedAt: nowIso(),
    }
  })
}

export function buildResolutionSummary(items: ReviewResolutionItem[]): ReviewResolutionSummary {
  return {
    openCount: items.filter((item) => item.status === 'open').length,
    inProgressCount: items.filter((item) => item.status === 'in-progress').length,
    resolvedCount: items.filter((item) => item.status === 'resolved').length,
    strongCount: items.filter((item) => item.severity === 'strong').length,
    resubmittedCount: items.filter((item) => item.status === 'resubmitted').length,
  }
}

export function isResolutionOverdue(item: ReviewResolutionItem) {
  if (item.status === 'resolved' || item.status === 'resubmitted') return false
  return Date.now() - new Date(item.updatedAt).getTime() > 72 * 3600_000
}

export const useReviewResolutionStore = create<ReviewResolutionState>()(
  persist(
    (set, get) => ({
      items: [],

      createResolutionItem: (seed) => {
        let nextItem: ReviewResolutionItem | null = null
        set((state) => {
          const nextItems = upsertFromSeed(state.items, seed)
          nextItem = nextItems.find((item) => matchesSource(item, seed)) ?? null
          return { items: nextItems }
        })

        return nextItem ?? {
          id: uid('resolution-fallback'),
          projectId: seed.projectId,
          sourceType: seed.sourceType,
          sourceId: seed.sourceId,
          title: seed.title,
          description: seed.description,
          severity: seed.severity,
          status: 'open',
          assignedRole: seed.assignedRole,
          assignedUserId: seed.assignedUserId,
          createdAt: seed.createdAt ?? nowIso(),
          updatedAt: nowIso(),
          relatedTaskId: seed.relatedTaskId,
          relatedVersionId: seed.relatedVersionId,
        }
      },

      syncResolutionItems: (_projectId, seeds) => {
        set((state) => ({
          items: seeds.reduce((acc, seed) => upsertFromSeed(acc, seed), state.items),
        }))
      },

      assignResolution: (id, assignedRole, assignedUserId) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id
            ? {
                ...item,
                assignedRole,
                assignedUserId: assignedUserId || undefined,
                updatedAt: nowIso(),
              }
            : item),
        }))
      },

      markResolutionInProgress: (id) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id
            ? {
                ...item,
                status: 'in-progress',
                updatedAt: nowIso(),
              }
            : item),
        }))
      },

      markResolutionResolved: (id) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id
            ? {
                ...item,
                status: 'resolved',
                updatedAt: nowIso(),
                resolvedAt: nowIso(),
              }
            : item),
        }))
      },

      markResolutionResubmitted: (id, relatedVersionId) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id
            ? {
                ...item,
                status: 'resubmitted',
                updatedAt: nowIso(),
                resubmittedAt: nowIso(),
                relatedVersionId: relatedVersionId ?? item.relatedVersionId,
              }
            : item),
        }))
      },

      linkResolutionTask: (id, relatedTaskId) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id
            ? {
                ...item,
                relatedTaskId,
                updatedAt: nowIso(),
              }
            : item),
        }))
      },

      getByProject: (projectId) => get().items
        .filter((item) => item.projectId === projectId)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),

      getSummary: (projectId) => buildResolutionSummary(
        projectId ? get().items.filter((item) => item.projectId === projectId) : get().items,
      ),
    }),
    { name: 'cc:review-resolution-v1' },
  ),
)
