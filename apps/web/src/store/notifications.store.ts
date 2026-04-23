import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActionTargetType } from '@/lib/routing/actions'

export type NotificationCategory = 'approval' | 'blocker' | 'delivery' | 'planning' | 'review' | 'audio' | 'video' | 'order' | 'team' | 'licensing'
export type NotificationSeverity = 'info' | 'warning' | 'strong'
export type NotificationRoleScope = 'producer' | 'creator' | 'client' | 'shared'
export type NotificationSection = 'invitation' | 'approval' | 'delivery' | 'planning' | 'risk'
export type NotificationSnoozePreset = 'later-today' | 'tomorrow' | 'this-week'

export interface NotificationItem {
  id: string
  projectId?: string
  projectTitle?: string
  category: NotificationCategory
  severity: NotificationSeverity
  roleScope?: NotificationRoleScope
  section?: NotificationSection
  title: string
  message: string
  sourceType: string
  sourceId: string
  actionType?: ActionTargetType
  actionLabel: string
  actionHref: string
  isPinned?: boolean
  isRead: boolean
  isDismissed: boolean
  createdAt: string
  dueAt?: string
  snoozeUntil?: string
  relatedProfileId?: string
  relatedRole?: string
}

export interface NotificationSummary {
  unreadCount: number
  strongCount: number
  warningCount: number
  blockedCount: number
  approvalsPendingCount: number
  deliveryRiskCount: number
  staleApprovalCount: number
  invitationPendingCount: number
  actionableCount: number
  snoozedCount: number
  groupedActionCount: number
}

export interface ReminderRule {
  id: string
  type: 'stale-approval' | 'blocker-open' | 'delivery-risk' | 'milestone-due' | 'client-pending' | 'missing-license'
  enabled: boolean
  thresholdDays: number
  severity: 'info' | 'warning' | 'strong'
}

interface NotificationsState {
  items: NotificationItem[]
  rules: ReminderRule[]
  syncNotifications: (items: NotificationItem[]) => void
  upsertNotification: (item: NotificationItem) => void
  markSourceHandled: (sourceType: string, sourceId: string) => void
  markRead: (id: string) => void
  markAllRead: () => void
  markSectionRead: (section: NotificationSection) => void
  markProjectRead: (projectId: string) => void
  dismissNotification: (id: string) => void
  dismissAllInSection: (section: NotificationSection) => void
  dismissAllInProject: (projectId: string) => void
  snoozeNotification: (id: string, until: string) => void
  unsnoozeExpired: () => void
  getUnread: () => NotificationItem[]
  getSummary: () => NotificationSummary
  upsertRule: (rule: ReminderRule) => void
}

const DEFAULT_RULES: ReminderRule[] = [
  { id: 'rule-stale-approval', type: 'stale-approval', enabled: true, thresholdDays: 2, severity: 'warning' },
  { id: 'rule-blocker-open', type: 'blocker-open', enabled: true, thresholdDays: 0, severity: 'strong' },
  { id: 'rule-delivery-risk', type: 'delivery-risk', enabled: true, thresholdDays: 0, severity: 'strong' },
  { id: 'rule-milestone-due', type: 'milestone-due', enabled: true, thresholdDays: 2, severity: 'warning' },
  { id: 'rule-client-pending', type: 'client-pending', enabled: true, thresholdDays: 2, severity: 'warning' },
  { id: 'rule-missing-license', type: 'missing-license', enabled: true, thresholdDays: 0, severity: 'strong' },
]

function isVisibleNotification(item: NotificationItem) {
  return !item.isDismissed && (!item.snoozeUntil || new Date(item.snoozeUntil).getTime() <= Date.now())
}

export function isSnoozedNotification(item: NotificationItem) {
  return !item.isDismissed && Boolean(item.snoozeUntil) && new Date(item.snoozeUntil as string).getTime() > Date.now()
}

export function isActionableNotification(item: NotificationItem) {
  if (item.isDismissed) return false
  if (isSnoozedNotification(item)) return false
  return (
    item.sourceType === 'invitation'
    || item.sourceType === 'pending-approval'
    || item.sourceType === 'stale-approval'
    || item.sourceType === 'delivery-risk'
    || item.sourceType === 'delivery-status'
    || item.sourceType === 'director-note'
    || item.sourceType === 'changes-requested'
    || item.sourceType === 'missing-license'
    || item.sourceType === 'audio-risk'
    || item.sourceType === 'clip-review-risk'
    || item.sourceType === 'milestone-due'
    || item.severity === 'strong'
  )
}

export function buildNotificationSummary(items: NotificationItem[]): NotificationSummary {
  const active = items.filter(isVisibleNotification)
  const snoozed = items.filter(isSnoozedNotification)
  const groupedActionCount = new Set(
    active
      .filter(isActionableNotification)
      .map((item) => item.section ?? item.category),
  ).size
  return {
    unreadCount: active.filter((item) => !item.isRead).length,
    strongCount: active.filter((item) => item.severity === 'strong').length,
    warningCount: active.filter((item) => item.severity === 'warning').length,
    blockedCount: active.filter((item) => item.category === 'blocker').length,
    approvalsPendingCount: active.filter((item) => item.category === 'approval' && item.sourceType === 'pending-approval').length,
    deliveryRiskCount: active.filter((item) => item.category === 'delivery').length,
    staleApprovalCount: active.filter((item) => item.category === 'approval' && item.sourceType === 'stale-approval').length,
    invitationPendingCount: active.filter((item) => item.category === 'team' && item.sourceType === 'invitation').length,
    actionableCount: active.filter(isActionableNotification).length,
    snoozedCount: snoozed.length,
    groupedActionCount,
  }
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      rules: DEFAULT_RULES,

      syncNotifications: (nextItems) => {
        const previous = new Map(get().items.map((item) => [item.id, item]))
        const preserved = get().items.filter((item) => (
          item.sourceType === 'invitation'
          || item.sourceType === 'invitation-accepted'
          || item.sourceType === 'invitation-declined'
          || item.sourceType === 'invitation-cancelled'
        ))
        set({
          items: [
            ...nextItems.map((item) => {
              const existing = previous.get(item.id)
              return existing
                ? {
                    ...item,
                    isRead: existing.isRead,
                    isDismissed: existing.isDismissed,
                    snoozeUntil: existing.snoozeUntil,
                  }
                : item
            }),
            ...preserved.filter((item) => !nextItems.some((candidate) => candidate.id === item.id)),
          ],
        })
      },

      upsertNotification: (item) => {
        set((state) => ({
          items: state.items.some((existing) => existing.id === item.id)
            ? state.items.map((existing) => (
                existing.id === item.id
                  ? {
                      ...item,
                      isRead: existing.isRead,
                      isDismissed: existing.isDismissed,
                      snoozeUntil: existing.snoozeUntil,
                    }
                  : existing
              ))
            : [item, ...state.items],
        }))
      },

      markSourceHandled: (sourceType, sourceId) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.sourceType === sourceType && item.sourceId === sourceId
              ? { ...item, isRead: true, isDismissed: true }
              : item
          )),
        }))
      },

      markRead: (id) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id ? { ...item, isRead: true } : item),
        }))
      },

      markAllRead: () => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, isRead: true })),
        }))
      },

      markSectionRead: (section) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.section === section ? { ...item, isRead: true } : item
          )),
        }))
      },

      markProjectRead: (projectId) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.projectId === projectId ? { ...item, isRead: true } : item
          )),
        }))
      },

      dismissNotification: (id) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id ? { ...item, isDismissed: true, isRead: true } : item),
        }))
      },

      dismissAllInSection: (section) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.section === section ? { ...item, isDismissed: true, isRead: true } : item
          )),
        }))
      },

      dismissAllInProject: (projectId) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.projectId === projectId ? { ...item, isDismissed: true, isRead: true } : item
          )),
        }))
      },

      snoozeNotification: (id, until) => {
        set((state) => ({
          items: state.items.map((item) => (
            item.id === id ? { ...item, snoozeUntil: until, isRead: true } : item
          )),
        }))
      },

      unsnoozeExpired: () => {
        set((state) => ({
          items: state.items.map((item) => (
            item.snoozeUntil && new Date(item.snoozeUntil).getTime() <= Date.now()
              ? { ...item, snoozeUntil: undefined }
              : item
          )),
        }))
      },

      getUnread: () => get().items.filter((item) => isVisibleNotification(item) && !item.isRead),

      getSummary: () => buildNotificationSummary(get().items),

      upsertRule: (rule) => {
        set((state) => ({
          rules: state.rules.some((item) => item.id === rule.id)
            ? state.rules.map((item) => item.id === rule.id ? rule : item)
            : [...state.rules, rule],
        }))
      },
    }),
    { name: 'cc:notifications-v2' },
  ),
)
