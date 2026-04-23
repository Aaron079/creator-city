import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NotificationItem {
  id: string
  projectId?: string
  category: 'approval' | 'blocker' | 'delivery' | 'planning' | 'review' | 'audio' | 'video' | 'order' | 'team' | 'licensing'
  severity: 'info' | 'warning' | 'strong'
  title: string
  message: string
  sourceType: string
  sourceId: string
  actionLabel: string
  actionHref: string
  isRead: boolean
  isDismissed: boolean
  createdAt: string
  dueAt?: string
}

export interface NotificationSummary {
  unreadCount: number
  strongCount: number
  warningCount: number
  blockedCount: number
  approvalsPendingCount: number
  deliveryRiskCount: number
  staleApprovalCount: number
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
  markRead: (id: string) => void
  markAllRead: () => void
  dismissNotification: (id: string) => void
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

function buildSummary(items: NotificationItem[]): NotificationSummary {
  const active = items.filter((item) => !item.isDismissed)
  return {
    unreadCount: active.filter((item) => !item.isRead).length,
    strongCount: active.filter((item) => item.severity === 'strong').length,
    warningCount: active.filter((item) => item.severity === 'warning').length,
    blockedCount: active.filter((item) => item.category === 'blocker').length,
    approvalsPendingCount: active.filter((item) => item.category === 'approval' && item.sourceType === 'pending-approval').length,
    deliveryRiskCount: active.filter((item) => item.category === 'delivery').length,
    staleApprovalCount: active.filter((item) => item.category === 'approval' && item.sourceType === 'stale-approval').length,
  }
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      rules: DEFAULT_RULES,

      syncNotifications: (nextItems) => {
        const previous = new Map(get().items.map((item) => [item.id, item]))
        set({
          items: nextItems.map((item) => {
            const existing = previous.get(item.id)
            return existing
              ? {
                  ...item,
                  isRead: existing.isRead,
                  isDismissed: existing.isDismissed,
                }
              : item
          }),
        })
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

      dismissNotification: (id) => {
        set((state) => ({
          items: state.items.map((item) => item.id === id ? { ...item, isDismissed: true, isRead: true } : item),
        }))
      },

      getUnread: () => get().items.filter((item) => !item.isDismissed && !item.isRead),

      getSummary: () => buildSummary(get().items),

      upsertRule: (rule) => {
        set((state) => ({
          rules: state.rules.some((item) => item.id === rule.id)
            ? state.rules.map((item) => item.id === rule.id ? rule : item)
            : [...state.rules, rule],
        }))
      },
    }),
    { name: 'cc:notifications-v1' },
  ),
)
