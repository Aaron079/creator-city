import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type VersionedEntityType =
  | 'project-brief'
  | 'shot'
  | 'sequence'
  | 'storyboard-frame'
  | 'video-shot'
  | 'editor-clip'
  | 'role-bible'
  | 'director-note'
  | 'editor-timeline'
  | 'delivery'

export type VersionChangeType =
  | 'manual-edit'
  | 'ai-suggestion-applied'
  | 'clip-review-action'
  | 'director-note-action'
  | 'storyboard-selection'
  | 'editor-reorder'
  | 'restore'

export interface VersionRecord {
  id: string
  entityType: VersionedEntityType
  entityId: string
  versionNumber: number
  label: string
  changeType: VersionChangeType
  summary: string
  snapshot: Record<string, unknown>
  changedFields: string[]
  createdBy: string
  createdAt: string
  parentVersionId?: string
}

export interface VersionCompareResult {
  entityType: VersionedEntityType
  entityId: string
  fromVersionId: string
  toVersionId: string
  changes: Array<{
    field: string
    before: unknown
    after: unknown
  }>
}

interface VersionHistoryState {
  versions: VersionRecord[]
  createVersion: (input: {
    entityType: VersionedEntityType
    entityId: string
    snapshot: Record<string, unknown>
    changeType: VersionChangeType
    summary: string
    changedFields?: string[]
    createdBy: string
    label?: string
    parentVersionId?: string
  }) => VersionRecord
  getVersions: (entityType: VersionedEntityType, entityId: string) => VersionRecord[]
  getLatestVersion: (entityType: VersionedEntityType, entityId: string) => VersionRecord | null
  compareVersions: (fromVersionId: string, toVersionId: string) => VersionCompareResult | null
  restoreVersion: (versionId: string, createdBy: string) => VersionRecord | null
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeSnapshot(snapshot: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>
}

function collectPrimitiveChanges(before: Record<string, unknown>, after: Record<string, unknown>) {
  const priorityFields = [
    'intent',
    'shotType',
    'movement',
    'lighting',
    'colorGrade',
    'imagePrompt',
    'videoPrompt',
    'status',
    'transition',
    'pacing',
    'note',
  ]
  const keys = Array.from(new Set([...priorityFields, ...Object.keys(before), ...Object.keys(after)]))
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({
      field: key,
      before: before[key],
      after: after[key],
    }))
}

export const useVersionHistoryStore = create<VersionHistoryState>()(
  persist(
    (set, get) => ({
      versions: [],

      createVersion: (input) => {
        const existing = get().versions.filter((version) => version.entityType === input.entityType && version.entityId === input.entityId)
        const nextVersionNumber = existing.length + 1
        const version: VersionRecord = {
          id: uid('version'),
          entityType: input.entityType,
          entityId: input.entityId,
          versionNumber: nextVersionNumber,
          label: input.label ?? `v${nextVersionNumber}`,
          changeType: input.changeType,
          summary: input.summary,
          snapshot: normalizeSnapshot(input.snapshot),
          changedFields: input.changedFields ?? [],
          createdBy: input.createdBy,
          createdAt: new Date().toISOString(),
          parentVersionId: input.parentVersionId,
        }
        set((state) => ({ versions: [version, ...state.versions] }))
        return version
      },

      getVersions: (entityType, entityId) =>
        get()
          .versions
          .filter((version) => version.entityType === entityType && version.entityId === entityId)
          .sort((a, b) => b.versionNumber - a.versionNumber),

      getLatestVersion: (entityType, entityId) =>
        get()
          .versions
          .filter((version) => version.entityType === entityType && version.entityId === entityId)
          .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null,

      compareVersions: (fromVersionId, toVersionId) => {
        const from = get().versions.find((version) => version.id === fromVersionId)
        const to = get().versions.find((version) => version.id === toVersionId)
        if (!from || !to || from.entityType !== to.entityType || from.entityId !== to.entityId) return null
        return {
          entityType: from.entityType,
          entityId: from.entityId,
          fromVersionId,
          toVersionId,
          changes: collectPrimitiveChanges(from.snapshot, to.snapshot),
        }
      },

      restoreVersion: (versionId, createdBy) => {
        const source = get().versions.find((version) => version.id === versionId)
        if (!source) return null
        return get().createVersion({
          entityType: source.entityType,
          entityId: source.entityId,
          snapshot: source.snapshot,
          changeType: 'restore',
          summary: `从 v${source.versionNumber} 恢复`,
          changedFields: Object.keys(source.snapshot),
          createdBy,
          label: `v${get().versions.filter((version) => version.entityType === source.entityType && version.entityId === source.entityId).length + 1}`,
          parentVersionId: source.id,
        })
      },
    }),
    { name: 'cc:version-history-v1' },
  ),
)
