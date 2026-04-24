import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { ProjectHomeAction } from '@/lib/projects/home'
import { getActionTarget } from '@/lib/routing/actions'
import type { ReviewResolutionItem } from '@/lib/review/resolution-store'
import { filterResolutionItemsForRole } from '@/lib/review/resolution'
import type { WorkQueueItem } from '@/lib/workqueue/aggregate'
import type { NotificationItem } from '@/store/notifications.store'
import type { ProjectRole } from '@/lib/roles/projectRoles'

export interface CreatorProjectHomeData {
  workSummary: {
    assignedCount: number
    blockingCount: number
    reviewCount: number
    deliveryReminderCount: number
  }
  taskSummary: {
    assignedCount: number
    blockingCount: number
  }
  resolutionSummary: {
    openCount: number
    inProgressCount: number
    strongCount: number
  }
  reviewSummary: {
    pendingReviewCount: number
    latestFeedback: string
  }
  deliveryReminderSummary: {
    reminderCount: number
    highestSeverity: 'info' | 'warning' | 'strong'
  }
  currentTasks: WorkQueueItem[]
  resolutionQueue: ReviewResolutionItem[]
  reviewItems: WorkQueueItem[]
  deliveryReminders: WorkQueueItem[]
  personalQueue: WorkQueueItem[]
  recentActivity: ActivityLogItem[]
  quickActions: ProjectHomeAction[]
  nextAction: ProjectHomeAction
  aiSummary: {
    topItems: string[]
    mostDangerousArea: string
    recommendedAction: string
  }
}

function severityScore(severity: WorkQueueItem['severity']) {
  if (severity === 'strong') return 3
  if (severity === 'warning') return 2
  return 1
}

export function buildCreatorProjectHomeData(input: {
  projectId: string
  role: ProjectRole
  userId?: string | null
  profileId?: string | null
  workQueue: WorkQueueItem[]
  notifications: NotificationItem[]
  activity: ActivityLogItem[]
  resolutions: ReviewResolutionItem[]
}): CreatorProjectHomeData {
  const personalQueue = input.workQueue.slice(0, 8)
  const taskItems = input.workQueue.filter((item) => item.category === 'task' || item.category === 'planning').slice(0, 6)
  const reviewItems = input.workQueue.filter((item) => item.category === 'approval' || item.category === 'review').slice(0, 6)
  const deliveryItems = input.workQueue.filter((item) => item.category === 'delivery' || item.category === 'licensing').slice(0, 6)
  const visibleResolutions = filterResolutionItemsForRole({
    items: input.resolutions.filter((item) => item.projectId === input.projectId),
    role: input.role,
    userId: input.userId,
    profileId: input.profileId,
  })
  const openResolutions = visibleResolutions.filter((item) => item.status === 'open')
  const inProgressResolutions = visibleResolutions.filter((item) => item.status === 'in-progress')
  const highestDeliverySeverity = deliveryItems.sort((left, right) => severityScore(right.severity) - severityScore(left.severity))[0]?.severity ?? 'info'
  const fallbackAction = {
    id: 'creator-review',
    label: '去 Review',
    href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
    detail: '查看反馈与修改项',
  }
  const nextAction = personalQueue[0]
    ? {
        id: `creator-next-${personalQueue[0].id}`,
        label: personalQueue[0].actionLabel,
        href: personalQueue[0].actionHref,
        detail: personalQueue[0].title,
      }
    : openResolutions[0]
      ? {
          id: `creator-resolution-${openResolutions[0].id}`,
          label: '去 Resolution Loop',
          href: `${getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref}#resolution-loop`,
          detail: openResolutions[0].title,
        }
      : fallbackAction

  const latestFeedback = reviewItems[0]?.message
    ?? input.notifications.find((item) => item.projectId === input.projectId && (item.category === 'review' || item.category === 'approval'))?.message
    ?? '当前没有新的 review 反馈。'

  const quickActions: ProjectHomeAction[] = [
    nextAction,
    {
      id: 'creator-review-feedback',
      label: '去 Review 反馈',
      href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
      detail: latestFeedback,
    },
    {
      id: 'creator-resolution-loop',
      label: '去 Resolution Loop',
      href: `${getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref}#resolution-loop`,
      detail: `${openResolutions.length + inProgressResolutions.length} 个修改项等待推进`,
    },
    {
      id: 'creator-delivery',
      label: '去 Delivery 相关项',
      href: getActionTarget({ actionType: 'project-delivery', projectId: input.projectId }).actionHref,
      detail: `${deliveryItems.length} 条交付相关提醒`,
    },
    {
      id: 'creator-recent-version',
      label: '去最近版本',
      href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
      detail: '查看最近版本与最新变更',
    },
  ].filter((action, index, list) => (
    list.findIndex((candidate) => candidate.label === action.label && candidate.href === action.href) === index
  ))

  return {
    workSummary: {
      assignedCount: taskItems.length,
      blockingCount: taskItems.filter((item) => item.isBlocking).length,
      reviewCount: reviewItems.length,
      deliveryReminderCount: deliveryItems.length,
    },
    taskSummary: {
      assignedCount: taskItems.length,
      blockingCount: taskItems.filter((item) => item.isBlocking).length,
    },
    resolutionSummary: {
      openCount: openResolutions.length,
      inProgressCount: inProgressResolutions.length,
      strongCount: visibleResolutions.filter((item) => item.severity === 'strong').length,
    },
    reviewSummary: {
      pendingReviewCount: reviewItems.length,
      latestFeedback,
    },
    deliveryReminderSummary: {
      reminderCount: deliveryItems.length,
      highestSeverity: highestDeliverySeverity,
    },
    currentTasks: taskItems,
    resolutionQueue: visibleResolutions.slice(0, 6),
    reviewItems,
    deliveryReminders: deliveryItems,
    personalQueue,
    recentActivity: input.activity.slice(0, 5),
    quickActions,
    nextAction,
    aiSummary: {
      topItems: [
        taskItems[0] ? `当前最直接的任务是：${taskItems[0].title}` : null,
        openResolutions[0] ? `还有修改项待处理：${openResolutions[0].title}` : null,
        deliveryItems[0] ? `交付相关提醒：${deliveryItems[0].title}` : null,
      ].filter((item): item is string => Boolean(item)),
      mostDangerousArea: visibleResolutions.some((item) => item.severity === 'strong')
        ? '修改闭环'
        : deliveryItems.some((item) => item.severity === 'strong')
          ? '交付提醒'
          : reviewItems.length > 0
            ? 'Review 反馈'
            : '暂无明显危险环节',
      recommendedAction: nextAction.label,
    },
  }
}
