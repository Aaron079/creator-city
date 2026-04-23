import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { ProducerDashboardData, DashboardProjectOverview } from '@/lib/dashboard/aggregate'
import type { ProducerPlanningData, PlanningProjectRow, ProductionConflict, ProductionScheduleItem } from '@/lib/dashboard/planning'
import type { ClientProjectStatusFeedData } from '@/lib/projects/client-feed'
import type { CreatorProjectHomeData } from '@/lib/projects/creator-home'
import type { ProducerProjectHomeData } from '@/lib/projects/producer-home'
import type { ProjectAccessInfo } from '@/lib/roles/access'
import type { CurrentProjectRoleContext } from '@/lib/roles/currentRole'
import { getProjectRoleLabel } from '@/lib/roles/projectRoles'
import type { PersonalWorkQueueData, WorkQueueItem } from '@/lib/workqueue/aggregate'
import { getActionTarget } from '@/lib/routing/actions'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { NotificationItem } from '@/store/notifications.store'
import type { InvitationActivity, TeamInvitation, TeamMemberSummary } from '@/store/team.store'

export type ProjectHomeSurface = 'producer' | 'creator' | 'client' | 'invited' | 'outsider'

export interface ProjectHomeAction {
  id: string
  label: string
  href: string
  detail?: string
}

export interface RoleAwareProjectHomeData {
  projectId: string
  title: string
  currentStage: string
  readinessStatus: DashboardProjectOverview['readinessStatus']
  readinessReason: string
  access: ProjectAccessInfo
  resolvedRole: CurrentProjectRoleContext['role'] | null
  resolvedRoleLabel: string
  surface: ProjectHomeSurface
  overview: DashboardProjectOverview | null
  quickActions: ProjectHomeAction[]
  latestActivity: ActivityLogItem[]
  latestChanges: ActivityLogItem[]
  clientFeed: ClientProjectStatusFeedData | null
  producerHome: ProducerProjectHomeData | null
  creatorHome: CreatorProjectHomeData | null
  notifications: NotificationItem[]
  workQueue: WorkQueueItem[]
  delivery: {
    exists: boolean
    status: DeliveryPackage['status'] | 'missing'
    includedAssetCount: number
    strongRiskCount: number
    finalVersion: string
  }
  team: {
    memberCount: number
    pendingInvitationCount: number
    members: TeamMemberSummary[]
    invitations: TeamInvitation[]
    activity: InvitationActivity[]
  }
  planning: {
    project: PlanningProjectRow | null
    upcoming: ProductionScheduleItem[]
    conflicts: ProductionConflict[]
    blockedCount: number
  }
  producer: {
    blockerCount: number
    pendingApprovalCount: number
    deliveryStatus: string
    teamStatus: string
  }
  creator: {
    currentTasks: WorkQueueItem[]
    pendingReviewItems: WorkQueueItem[]
    deliveryReminders: WorkQueueItem[]
  }
  client: {
    latestVersion: string
    pendingConfirmations: number
    latestChanges: ActivityLogItem[]
    actionButtons: ProjectHomeAction[]
  }
}

function mapSurface(access: ProjectAccessInfo, role: CurrentProjectRoleContext['role'] | null): ProjectHomeSurface {
  if (access.state === 'outsider') return 'outsider'
  if (access.state === 'invited') return 'invited'
  if (access.state === 'client-only' || role === 'client') return 'client'
  if (access.state === 'producer-only' || role === 'producer') return 'producer'
  return 'creator'
}

function sortByTime<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function isRoleVisibleNotification(
  item: NotificationItem,
  surface: ProjectHomeSurface,
) {
  if (surface === 'producer') {
    return item.roleScope !== 'client'
  }

  if (surface === 'creator') {
    return item.roleScope === 'creator' || item.roleScope === 'shared' || item.roleScope === undefined
  }

  if (surface === 'client') {
    return item.roleScope === 'client'
      || item.roleScope === 'shared'
      || item.sourceType.startsWith('invitation')
      || item.category === 'delivery'
      || item.category === 'review'
  }

  return false
}

function buildFallbackOverview(projectId: string): DashboardProjectOverview {
  return {
    projectId,
    title: `项目 ${projectId}`,
    currentStage: 'idea',
    nextStage: null,
    readinessStatus: 'needs-review',
    readinessReason: '当前项目还没有完整聚合数据。',
    blockerCount: 0,
    pendingApprovalCount: 0,
    staleApprovalCount: 0,
    deliveryStatus: 'missing',
    orderStatus: 'missing',
    submittedForClient: false,
    strongRiskCount: 0,
    unknownLicenseCount: 0,
    strongLicensingRiskCount: 0,
    canAdvance: false,
    links: {
      review: getActionTarget({ actionType: 'project-review', projectId }).actionHref,
      create: getActionTarget({ actionType: 'project-workspace', projectId }).actionHref,
      delivery: getActionTarget({ actionType: 'project-delivery', projectId }).actionHref,
      detail: getActionTarget({ actionType: 'dashboard-project', projectId }).actionHref,
    },
  }
}

export function buildRoleAwareProjectHome(input: {
  projectId: string
  access: ProjectAccessInfo
  roleContext: CurrentProjectRoleContext | null
  dashboard: ProducerDashboardData
  planning: ProducerPlanningData
  workQueue: PersonalWorkQueueData
  notifications: NotificationItem[]
  activity: ActivityLogItem[]
  clientFeed: ClientProjectStatusFeedData | null
  producerHome: ProducerProjectHomeData | null
  creatorHome: CreatorProjectHomeData | null
  deliveryPackage: DeliveryPackage | null
  members: TeamMemberSummary[]
  invitations: TeamInvitation[]
  invitationActivity: InvitationActivity[]
}): RoleAwareProjectHomeData {
  const overview = input.dashboard.overview.find((item) => item.projectId === input.projectId) ?? null
  const header = overview ?? buildFallbackOverview(input.projectId)
  const resolvedRole = input.access.state === 'outsider' || input.access.state === 'invited'
    ? null
    : (input.roleContext?.role ?? input.access.role)
  const surface = mapSurface(input.access, resolvedRole)
  const workQueue = input.workQueue.items.filter((item) => item.projectId === input.projectId)
  const notifications = sortByTime(
    input.notifications.filter((item) => (
      item.projectId === input.projectId
      && !item.isDismissed
      && isRoleVisibleNotification(item, surface)
    )),
  ).slice(0, 8)
  const latestActivity = sortByTime(
    input.activity.filter((item) => item.projectId === input.projectId),
  ).slice(0, 8)
  const latestChanges = latestActivity.filter((item) => (
    item.type === 'version-created'
    || item.type === 'director-note-added'
    || item.type === 'approval-changes-requested'
    || item.type === 'delivery-needs-revision'
  )).slice(0, 4)
  const projectPlanning = input.planning.projects.find((item) => item.projectId === input.projectId) ?? null
  const planningUpcoming = input.planning.upcoming.filter((item) => item.milestoneId.startsWith(`${input.projectId}:`)).slice(0, 4)
  const planningConflicts = input.planning.conflicts.filter((item) => item.relatedProjectId === input.projectId).slice(0, 4)
  const deliveryStatus: RoleAwareProjectHomeData['delivery']['status'] = input.deliveryPackage?.status ?? 'missing'
  const delivery: RoleAwareProjectHomeData['delivery'] = {
    exists: Boolean(input.deliveryPackage),
    status: deliveryStatus,
    includedAssetCount: input.deliveryPackage?.assets.filter((asset) => asset.included).length ?? 0,
    strongRiskCount: input.deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0,
    finalVersion: input.deliveryPackage?.manifest?.finalVersion ?? '未记录版本',
  }

  const quickActions = (() => {
    const actionQueue = input.dashboard.actionQueue
      .filter((action) => action.projectId === input.projectId)
      .slice(0, 4)
      .map((action) => ({
        id: action.id,
        label: action.ctaLabel,
        href: action.href,
        detail: action.title,
      }))

    if (actionQueue.length > 0) return actionQueue

    if (surface === 'client') {
      return [
        {
          id: 'client-review-now',
          label: '立即审片',
          href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
          detail: '查看待确认内容与交付快照',
        },
      ]
    }

    return [
      {
        id: 'project-overview-fallback',
        label: '查看项目概览',
        href: getActionTarget({ actionType: 'dashboard-project', projectId: input.projectId }).actionHref,
        detail: '返回项目总览定位当前状态',
      },
    ]
  })()

  const producerTeamStatus = input.invitations.length > 0
    ? `${input.members.length} 位 active 成员，${input.invitations.length} 条待响应邀请`
    : `${input.members.length} 位 active 成员`

  const creatorTasks = workQueue.filter((item) => item.category === 'task' || item.category === 'planning').slice(0, 4)
  const creatorReviewItems = workQueue.filter((item) => item.category === 'approval' || item.category === 'review').slice(0, 4)
  const creatorDeliveryReminders = workQueue.filter((item) => item.category === 'delivery' || item.category === 'licensing').slice(0, 4)
  const clientPendingConfirmations = workQueue.filter((item) => item.category === 'approval' || item.category === 'review' || item.category === 'delivery').length

  return {
    projectId: input.projectId,
    title: header.title,
    currentStage: header.currentStage,
    readinessStatus: header.readinessStatus,
    readinessReason: header.readinessReason,
    access: input.access,
    resolvedRole,
    resolvedRoleLabel: resolvedRole ? getProjectRoleLabel(resolvedRole) : '未绑定项目角色',
    surface,
    overview,
    quickActions,
    latestActivity,
    latestChanges,
    clientFeed: input.clientFeed,
    producerHome: input.producerHome,
    creatorHome: input.creatorHome,
    notifications,
    workQueue,
    delivery,
    team: {
      memberCount: input.members.length,
      pendingInvitationCount: input.invitations.filter((item) => item.status === 'pending').length,
      members: input.members,
      invitations: input.invitations,
      activity: sortByTime(input.invitationActivity).slice(0, 5),
    },
    planning: {
      project: projectPlanning,
      upcoming: planningUpcoming,
      conflicts: planningConflicts,
      blockedCount: input.planning.blocked.filter((item) => item.projectId === input.projectId).length,
    },
    producer: {
      blockerCount: header.blockerCount,
      pendingApprovalCount: header.pendingApprovalCount,
      deliveryStatus: delivery.status,
      teamStatus: producerTeamStatus,
    },
    creator: {
      currentTasks: creatorTasks,
      pendingReviewItems: creatorReviewItems,
      deliveryReminders: creatorDeliveryReminders,
    },
    client: {
      latestVersion: delivery.finalVersion,
      pendingConfirmations: clientPendingConfirmations,
      latestChanges: latestChanges.slice(0, 3),
      actionButtons: [
        {
          id: 'client-review-now',
          label: 'Review Now',
          href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
          detail: '查看待确认内容',
        },
        {
          id: 'client-confirm',
          label: '确认交付',
          href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
          detail: '进入 Review 后手动确认',
        },
        {
          id: 'client-request-changes',
          label: 'Request Changes',
          href: getActionTarget({ actionType: 'project-review', projectId: input.projectId }).actionHref,
          detail: '进入 Review 后提交修改意见',
        },
      ],
    },
  }
}
