import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { RoleAwareProjectHomeData, ProjectHomeAction } from '@/lib/projects/home'
import type { WorkspacePortfolioData } from '@/lib/projects/workspace'
import type { PersonalWorkQueueData } from '@/lib/workqueue/aggregate'
import { getActionTarget } from '@/lib/routing/actions'

export interface EntryMetricModel {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'danger'
}

export interface EntryActionModel {
  id: string
  label: string
  href: string
  detail?: string
}

export interface EntryListItemModel {
  id: string
  title: string
  meta: string
  href: string
  label: string
}

export interface CrossProjectEntryData {
  statusMetrics: EntryMetricModel[]
  quickActions: EntryActionModel[]
  waitingItems: string[]
  recentItems: EntryListItemModel[]
}

export interface ProjectEntryData {
  statusMetrics: EntryMetricModel[]
  quickActions: EntryActionModel[]
  riskOrWaitingItems: string[]
  queueItems: EntryListItemModel[]
  deliveryOrApprovalItems: string[]
  recentActivity: ActivityLogItem[]
}

function actionFromProjectHomeAction(action: ProjectHomeAction): EntryActionModel {
  return {
    id: action.id,
    label: action.label,
    href: action.href,
    detail: action.detail,
  }
}

function toQueueItemModel(input: {
  id: string
  title: string
  meta: string
  href: string
  label?: string
}): EntryListItemModel {
  return {
    id: input.id,
    title: input.title,
    meta: input.meta,
    href: input.href,
    label: input.label ?? '去处理',
  }
}

export function buildCrossProjectEntryData(input: {
  portfolio: WorkspacePortfolioData
  queue: PersonalWorkQueueData
  invitationCount: number
  queueHref?: string
}): CrossProjectEntryData {
  const firstWaiting = input.portfolio.waitingProjects[0]
  const firstRecent = input.portfolio.recentProjects[0]

  return {
    statusMetrics: [
      {
        label: 'Projects',
        value: input.portfolio.summary.totalProjects,
      },
      {
        label: 'Waiting for me',
        value: input.portfolio.summary.waitingForMeCount,
        tone: input.portfolio.summary.waitingForMeCount > 0 ? 'warning' : 'default',
      },
      {
        label: 'High risk',
        value: input.portfolio.summary.highRiskCount,
        tone: input.portfolio.summary.highRiskCount > 0 ? 'danger' : 'default',
      },
      {
        label: 'Invitations',
        value: input.invitationCount,
        tone: input.invitationCount > 0 ? 'warning' : 'default',
      },
      {
        label: 'Pending approvals',
        value: input.portfolio.summary.approvalsPendingCount,
        tone: input.portfolio.summary.approvalsPendingCount > 0 ? 'warning' : 'default',
      },
      {
        label: 'Delivery pending',
        value: input.portfolio.summary.deliveryPendingCount,
        tone: input.portfolio.summary.deliveryPendingCount > 0 ? 'warning' : 'default',
      },
    ],
    quickActions: [
      {
        id: 'entry-projects',
        label: '去项目总览',
        href: '/projects',
        detail: '查看所有参与项目',
      },
      {
        id: 'entry-queue',
        label: '去我的待办',
        href: input.queueHref ?? '/me#personal-command-center',
        detail: '查看个人优先级队列',
      },
      {
        id: 'entry-invitations',
        label: '去邀请收件箱',
        href: getActionTarget({ actionType: 'invitation-inbox' }).actionHref,
        detail: '处理待响应邀请',
      },
      {
        id: 'entry-top-project',
        label: firstWaiting ? `打开 ${firstWaiting.title}` : '打开最近项目',
        href: firstWaiting?.quickLinks.find((link) => link.kind === 'home')?.href
          ?? firstRecent?.quickLinks.find((link) => link.kind === 'home')?.href
          ?? '/projects',
        detail: input.portfolio.aiSummary.recommendedFocus,
      },
    ],
    waitingItems: [
      `${input.portfolio.aiSummary.bestProjectToOpen}`,
      `${input.portfolio.aiSummary.mostDangerousProject}`,
      `${input.portfolio.aiSummary.recommendedFocus}`,
    ].filter(Boolean),
    recentItems: input.portfolio.recentProjects.slice(0, 5).map((project) => (
      toQueueItemModel({
        id: `recent-${project.projectId}`,
        title: project.title,
        meta: `${project.roleLabel} · ${project.stage} · ${project.deliveryStatus}`,
        href: project.quickLinks.find((link) => link.kind === 'home')?.href ?? '/projects',
        label: '打开项目',
      })
    )),
  }
}

export function buildProjectEntryData(data: RoleAwareProjectHomeData): ProjectEntryData {
  if (data.surface === 'producer' && data.producerHome) {
    return {
      statusMetrics: [
        { label: 'Readiness', value: data.producerHome.statusSummary.readiness },
        { label: 'Pending approvals', value: data.producerHome.statusSummary.pendingApprovalCount, tone: data.producerHome.statusSummary.pendingApprovalCount > 0 ? 'warning' : 'default' },
        { label: 'Blockers', value: data.producerHome.statusSummary.blockerCount, tone: data.producerHome.statusSummary.blockerCount > 0 ? 'danger' : 'default' },
        { label: 'Delivery', value: data.producerHome.statusSummary.deliveryStatus, tone: data.producerHome.deliverySummary.strongRiskCount > 0 ? 'warning' : 'default' },
        { label: 'Open resolutions', value: data.producerHome.statusSummary.openResolutionCount, tone: data.producerHome.statusSummary.openResolutionCount > 0 ? 'warning' : 'default' },
        { label: 'Notifications', value: data.producerHome.notificationsSummary.unreadCount, tone: data.producerHome.notificationsSummary.strongCount > 0 ? 'warning' : 'default' },
      ],
      quickActions: data.producerHome.quickActions.map(actionFromProjectHomeAction),
      riskOrWaitingItems: [
        ...data.producerHome.aiSummary.topItems,
        `最危险环节：${data.producerHome.aiSummary.mostDangerousArea}`,
        `排期焦点：${data.producerHome.planningSummary.nextFocus}`,
        `团队状态：${data.producerHome.teamSummary.memberCount} 位成员 / ${data.producerHome.teamSummary.pendingInvitationCount} 条邀请`,
      ],
      queueItems: data.notifications.slice(0, 6).map((item) => (
        toQueueItemModel({
          id: item.id,
          title: item.title,
          meta: item.message,
          href: item.actionHref,
          label: item.actionLabel,
        })
      )),
      deliveryOrApprovalItems: [
        `交付状态：${data.producerHome.deliverySummary.status}`,
        `高风险项：${data.producerHome.deliverySummary.strongRiskCount}`,
        `待确认：${data.producerHome.approvalsSummary.pendingCount}`,
        `Stale approvals：${data.producerHome.approvalsSummary.staleCount}`,
      ],
      recentActivity: data.producerHome.recentActivity,
    }
  }

  if (data.surface === 'creator' && data.creatorHome) {
    return {
      statusMetrics: [
        { label: 'Assigned tasks', value: data.creatorHome.taskSummary.assignedCount },
        { label: 'Blocking tasks', value: data.creatorHome.taskSummary.blockingCount, tone: data.creatorHome.taskSummary.blockingCount > 0 ? 'warning' : 'default' },
        { label: 'Open resolutions', value: data.creatorHome.resolutionSummary.openCount, tone: data.creatorHome.resolutionSummary.strongCount > 0 ? 'danger' : 'default' },
        { label: 'In progress', value: data.creatorHome.resolutionSummary.inProgressCount },
        { label: 'Pending review', value: data.creatorHome.reviewSummary.pendingReviewCount, tone: data.creatorHome.reviewSummary.pendingReviewCount > 0 ? 'warning' : 'default' },
        { label: 'Delivery reminders', value: data.creatorHome.deliveryReminderSummary.reminderCount, tone: data.creatorHome.deliveryReminderSummary.highestSeverity === 'strong' ? 'danger' : data.creatorHome.deliveryReminderSummary.highestSeverity === 'warning' ? 'warning' : 'default' },
      ],
      quickActions: [
        actionFromProjectHomeAction(data.creatorHome.nextAction),
        ...data.quickActions.slice(0, 3).map(actionFromProjectHomeAction),
      ],
      riskOrWaitingItems: [
        ...data.creatorHome.aiSummary.topItems,
        `最危险环节：${data.creatorHome.aiSummary.mostDangerousArea}`,
        `当前角色：${data.resolvedRoleLabel}`,
      ],
      queueItems: data.creatorHome.personalQueue.slice(0, 6).map((item) => (
        toQueueItemModel({
          id: item.id,
          title: item.title,
          meta: item.message,
          href: item.actionHref,
          label: item.actionLabel,
        })
      )),
      deliveryOrApprovalItems: [
        `最新反馈：${data.creatorHome.reviewSummary.latestFeedback}`,
        `Delivery reminders：${data.creatorHome.deliveryReminderSummary.reminderCount}`,
        `Recommended action：${data.creatorHome.aiSummary.recommendedAction}`,
      ],
      recentActivity: data.creatorHome.recentActivity,
    }
  }

  return {
    statusMetrics: [
      { label: 'Pending confirmations', value: data.client.pendingConfirmations, tone: data.client.pendingConfirmations > 0 ? 'warning' : 'default' },
      { label: 'Latest version', value: data.client.latestVersion },
      { label: 'Delivery', value: data.delivery.status, tone: data.delivery.strongRiskCount > 0 ? 'warning' : 'default' },
    ],
    quickActions: data.client.actionButtons.map(actionFromProjectHomeAction),
    riskOrWaitingItems: [
      `当前版本：${data.client.latestVersion}`,
      `待确认项：${data.client.pendingConfirmations}`,
      `交付状态：${data.delivery.status}`,
    ],
    queueItems: data.client.actionButtons.map((action) => ({
      id: action.id,
      title: action.label,
      meta: action.detail ?? '进入对应确认入口',
      href: action.href,
      label: '打开',
    })),
    deliveryOrApprovalItems: [
      `当前版本：${data.client.latestVersion}`,
      `交付状态：${data.delivery.status}`,
      `风险项：${data.delivery.strongRiskCount}`,
    ],
    recentActivity: data.latestChanges,
  }
}
