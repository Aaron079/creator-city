import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { DashboardProjectOverview, ProducerDashboardData } from '@/lib/dashboard/aggregate'
import type { ProducerPlanningData } from '@/lib/dashboard/planning'
import type { ProjectHomeAction } from '@/lib/projects/home'
import { getActionTarget } from '@/lib/routing/actions'
import type { ReviewResolutionItem } from '@/lib/review/resolution-store'
import type { NotificationItem } from '@/store/notifications.store'
import type { TeamInvitation, TeamMemberSummary } from '@/store/team.store'

export interface ProducerProjectHomeData {
  statusSummary: {
    readiness: string
    blockerCount: number
    pendingApprovalCount: number
    deliveryStatus: string
    openResolutionCount: number
  }
  approvalsSummary: {
    pendingCount: number
    staleCount: number
    submittedForClient: boolean
  }
  deliverySummary: {
    status: string
    includedAssetCount: number
    strongRiskCount: number
    finalVersion: string
  }
  planningSummary: {
    nextFocus: string
    blockedCount: number
    conflictCount: number
    upcomingCount: number
  }
  teamSummary: {
    memberCount: number
    pendingInvitationCount: number
    openRolesCount: number
    highlights: string[]
  }
  riskSummary: {
    strongRiskCount: number
    blockerCount: number
    unknownLicenseCount: number
    strongLicensingRiskCount: number
  }
  notificationsSummary: {
    unreadCount: number
    strongCount: number
  }
  recentActivity: ActivityLogItem[]
  quickActions: ProjectHomeAction[]
  aiSummary: {
    topItems: string[]
    mostDangerousArea: string
    recommendedAction: string
  }
}

export function buildProducerProjectHomeData(input: {
  projectId: string
  overview: DashboardProjectOverview
  dashboard: ProducerDashboardData
  planning: ProducerPlanningData
  notifications: NotificationItem[]
  members: TeamMemberSummary[]
  invitations: TeamInvitation[]
  activity: ActivityLogItem[]
  resolutions: ReviewResolutionItem[]
  delivery: {
    status: string
    includedAssetCount: number
    strongRiskCount: number
    finalVersion: string
  }
}): ProducerProjectHomeData {
  const planningProject = input.planning.projects.find((item) => item.projectId === input.projectId) ?? null
  const blockedCount = input.planning.blocked.filter((item) => item.projectId === input.projectId).length
  const conflicts = input.planning.conflicts.filter((item) => item.relatedProjectId === input.projectId)
  const upcoming = input.planning.upcoming.filter((item) => item.milestoneId.startsWith(`${input.projectId}:`))
  const openResolutionCount = input.resolutions.filter((item) => item.status === 'open' || item.status === 'in-progress').length
  const unreadNotifications = input.notifications.filter((item) => !item.isRead && !item.isDismissed)
  const projectActions = input.dashboard.actionQueue
    .filter((action) => action.projectId === input.projectId)
    .slice(0, 5)
    .map((action) => ({
      id: action.id,
      label: action.ctaLabel,
      href: action.href,
      detail: action.title,
    }))

  const fallbackActions: ProjectHomeAction[] = [
    {
      id: 'producer-review',
      label: '去审批',
      href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
      detail: '查看待确认项与客户反馈',
    },
    {
      id: 'producer-delivery',
      label: '去 Delivery',
      href: getActionTarget({ actionType: 'project-delivery', projectId: input.projectId }).actionHref,
      detail: '检查交付包与风险',
    },
    {
      id: 'producer-planning',
      label: '去 Planning',
      href: getActionTarget({ actionType: 'project-planning', projectId: input.projectId }).actionHref,
      detail: '查看排期与依赖',
    },
    {
      id: 'producer-team',
      label: '去 Team',
      href: getActionTarget({ actionType: 'project-team', projectId: input.projectId }).actionHref,
      detail: '查看团队与邀请状态',
    },
    {
      id: 'producer-resolution',
      label: '去 Resolution',
      href: `${getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref}#resolution-loop`,
      detail: '查看修改闭环',
    },
  ]

  const topItems = [
    input.overview.blockerCount > 0 ? `当前有 ${input.overview.blockerCount} 条 blocker，需要先处理。` : null,
    input.overview.pendingApprovalCount > 0 ? `当前仍有 ${input.overview.pendingApprovalCount} 个待确认项。` : null,
    input.delivery.strongRiskCount > 0 ? `交付包仍有 ${input.delivery.strongRiskCount} 个高风险项。` : null,
    openResolutionCount > 0 ? `还有 ${openResolutionCount} 个修改闭环项未关掉。` : null,
  ].filter((item): item is string => Boolean(item))

  return {
    statusSummary: {
      readiness: input.overview.readinessStatus,
      blockerCount: input.overview.blockerCount,
      pendingApprovalCount: input.overview.pendingApprovalCount,
      deliveryStatus: input.delivery.status,
      openResolutionCount,
    },
    approvalsSummary: {
      pendingCount: input.overview.pendingApprovalCount,
      staleCount: input.overview.staleApprovalCount,
      submittedForClient: input.overview.submittedForClient,
    },
    deliverySummary: input.delivery,
    planningSummary: {
      nextFocus: planningProject?.nextFocus ?? '当前没有额外排期提醒。',
      blockedCount,
      conflictCount: conflicts.length,
      upcomingCount: upcoming.length,
    },
    teamSummary: {
      memberCount: input.members.length,
      pendingInvitationCount: input.invitations.filter((item) => item.status === 'pending').length,
      openRolesCount: input.invitations.filter((item) => item.status === 'pending').length,
      highlights: input.members.slice(0, 3).map((member) => `${member.displayName} · ${member.role}`),
    },
    riskSummary: {
      strongRiskCount: input.overview.strongRiskCount,
      blockerCount: input.overview.blockerCount,
      unknownLicenseCount: input.overview.unknownLicenseCount,
      strongLicensingRiskCount: input.overview.strongLicensingRiskCount,
    },
    notificationsSummary: {
      unreadCount: unreadNotifications.length,
      strongCount: unreadNotifications.filter((item) => item.severity === 'strong').length,
    },
    recentActivity: input.activity.slice(0, 5),
    quickActions: projectActions.length > 0 ? projectActions : fallbackActions,
    aiSummary: {
      topItems: topItems.length > 0 ? topItems.slice(0, 3) : ['当前项目没有明显阻塞。'],
      mostDangerousArea: input.delivery.strongRiskCount > 0
        ? '交付风险'
        : input.overview.blockerCount > 0
          ? 'Blocker 批注'
          : input.overview.pendingApprovalCount > 0
            ? '审批等待'
            : '暂无明显危险环节',
      recommendedAction: projectActions[0]?.label ?? fallbackActions[0]?.label ?? '查看项目概览',
    },
  }
}
