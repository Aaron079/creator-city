import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildActivityLogItems, summarizeActivity, type ActivityLogItem, type ActivitySummary } from '@/lib/activity/aggregate'
import { useApprovalStore } from '@/store/approval.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useNotificationsStore } from '@/store/notifications.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'

interface ActivityLogState {
  items: ActivityLogItem[]
  append: (item: ActivityLogItem) => void
  syncFromExistingSystems: (projectId: string) => void
  getByProject: (projectId?: string) => ActivityLogItem[]
  getRecent: (projectId?: string, limit?: number) => ActivityLogItem[]
  getSummary: (projectId?: string) => ActivitySummary
}

function sortItems(items: ActivityLogItem[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export const useActivityLogStore = create<ActivityLogState>()(
  persist(
    (set, get) => ({
      items: [],

      append: (item) => {
        set((state) => ({
          items: sortItems([
            item,
            ...state.items.filter((existing) => existing.id !== item.id),
          ]),
        }))
      },

      syncFromExistingSystems: (projectId) => {
        const nextItems = buildActivityLogItems({
          projectId,
          invitationActivities: useTeamStore.getState().activities,
          approvals: useApprovalStore.getState().approvals,
          notes: useDirectorNotesStore.getState().notes,
          versions: useVersionHistoryStore.getState().versions,
          deliveryPackages: useDeliveryPackageStore.getState().deliveryPackages,
          notifications: useNotificationsStore.getState().items,
        })

        set((state) => ({
          items: sortItems([
            ...state.items.filter((item) => item.projectId !== projectId),
            ...nextItems,
          ]),
        }))
      },

      getByProject: (projectId) => {
        const items = get().items
        return sortItems(projectId ? items.filter((item) => item.projectId === projectId) : items)
      },

      getRecent: (projectId, limit = 10) => get().getByProject(projectId).slice(0, limit),

      getSummary: (projectId) => summarizeActivity(get().getByProject(projectId)),
    }),
    { name: 'cc:activity-log-v1' },
  ),
)
