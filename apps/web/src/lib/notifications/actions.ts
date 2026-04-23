import type { NotificationItem, NotificationSection, NotificationSnoozePreset } from '@/store/notifications.store'
import { isActionableNotification } from '@/store/notifications.store'

export interface NotificationActionGroup {
  id: string
  label: string
  count: number
  href: string
  severity: NotificationItem['severity']
}

export function buildNotificationActionGroups(items: NotificationItem[]): NotificationActionGroup[] {
  const groups = new Map<string, NotificationActionGroup>()

  items
    .filter(isActionableNotification)
    .forEach((item) => {
      const key = item.section ?? 'risk'
      const current = groups.get(key)
      const nextSeverity = current
        ? severityRank(item.severity) > severityRank(current.severity) ? item.severity : current.severity
        : item.severity

      groups.set(key, {
        id: key,
        label: labelForSection(key),
        count: (current?.count ?? 0) + 1,
        href: current?.href ?? item.actionHref,
        severity: nextSeverity,
      })
    })

  return Array.from(groups.values()).sort((left, right) => {
    const bySeverity = severityRank(right.severity) - severityRank(left.severity)
    if (bySeverity !== 0) return bySeverity
    return right.count - left.count
  })
}

export function resolveSnoozeUntil(preset: NotificationSnoozePreset) {
  const date = new Date()

  if (preset === 'later-today') {
    date.setHours(date.getHours() + 4)
    return date.toISOString()
  }

  if (preset === 'tomorrow') {
    date.setDate(date.getDate() + 1)
    date.setHours(9, 0, 0, 0)
    return date.toISOString()
  }

  const day = date.getDay()
  const daysUntilSunday = (7 - day) % 7 || 7
  date.setDate(date.getDate() + daysUntilSunday)
  date.setHours(18, 0, 0, 0)
  return date.toISOString()
}

function severityRank(severity: NotificationItem['severity']) {
  if (severity === 'strong') return 3
  if (severity === 'warning') return 2
  return 1
}

function labelForSection(section: NotificationSection | 'risk') {
  switch (section) {
    case 'approval':
      return '审批处理'
    case 'delivery':
      return '交付风险'
    case 'planning':
      return '排期事项'
    case 'invitation':
      return '邀请响应'
    case 'risk':
    default:
      return '风险处理'
  }
}
