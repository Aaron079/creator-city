import type { ProducerDashboardData } from '@/lib/dashboard/aggregate'
import type { ProjectRoleAssignment, ProjectRole } from '@/lib/roles/projectRoles'
import { getProjectRoleLabel } from '@/lib/roles/projectRoles'
import { getDeliveryHref, getMeHref, getProjectHref, getReviewHref, getTeamManagementHref } from '@/lib/routing/actions'
import type { PersonalWorkQueueData } from '@/lib/workqueue/aggregate'
import type { ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { NotificationItem } from '@/store/notifications.store'
import type { Team, TeamInvitation } from '@/store/team.store'

export interface ProjectQuickLink {
  label: string
  href: string
  kind: 'home' | 'review' | 'delivery' | 'tasks' | 'team'
}

export interface UserProjectCard {
  projectId: string
  title: string
  role: ProjectRole
  roleLabel: string
  stage: string
  readiness: string
  riskLevel: 'info' | 'warning' | 'strong'
  pendingCount: number
  deliveryStatus: string
  waitingForMe: boolean
  recentActivityAt?: string
  quickLinks: ProjectQuickLink[]
  highlights: string[]
  latestVersion?: string
}

export interface CrossProjectSummary {
  totalProjects: number
  waitingForMeCount: number
  highRiskCount: number
  approvalsPendingCount: number
  deliveryPendingCount: number
}

export interface WorkspacePortfolioData {
  summary: CrossProjectSummary
  cards: UserProjectCard[]
  recentProjects: UserProjectCard[]
  highPriorityProjects: UserProjectCard[]
  waitingProjects: UserProjectCard[]
  aiSummary: {
    bestProjectToOpen: string
    mostDangerousProject: string
    recommendedFocus: string
  }
}

function roleForProject(
  projectId: string,
  userId: string,
  profileId: string,
  assignments: ProjectRoleAssignment[],
  teams: Team[],
): ProjectRole | null {
  const assignment = assignments.find((item) => (
    item.projectId === projectId
    && item.status === 'active'
    && (item.userId === userId || item.userId === profileId)
  ))
  if (assignment) return assignment.role

  const member = teams.find((team) => team.projectId === projectId)?.members.find((item) => (
    item.status === 'joined' && (item.userId === userId || item.userId === profileId)
  ))

  if (!member) return null
  if (member.role === 'producer' || member.role === 'creator' || member.role === 'client' || member.role === 'director' || member.role === 'editor' || member.role === 'cinematographer') {
    return member.role
  }
  return 'creator'
}

function riskRank(level: UserProjectCard['riskLevel']) {
  if (level === 'strong') return 3
  if (level === 'warning') return 2
  return 1
}

function deriveRiskLevel(input: {
  blockerCount: number
  strongRiskCount: number
  pendingCount: number
  deliveryStatus: string
  notifications: NotificationItem[]
}) {
  if (
    input.blockerCount > 0
    || input.strongRiskCount > 0
    || input.deliveryStatus === 'needs-revision'
    || input.notifications.some((item) => item.severity === 'strong')
  ) {
    return 'strong' as const
  }

  if (
    input.pendingCount > 0
    || input.deliveryStatus === 'submitted'
    || input.deliveryStatus === 'ready'
    || input.notifications.some((item) => item.severity === 'warning')
  ) {
    return 'warning' as const
  }

  return 'info' as const
}

function deriveRecentActivityAt(input: {
  notifications: NotificationItem[]
  invitations: TeamInvitation[]
  approvals: ApprovalRequest[]
  deliveryPackage: DeliveryPackage | null
}) {
  const timestamps = [
    ...input.notifications.map((item) => item.createdAt),
    ...input.invitations.map((item) => item.createdAt),
    ...input.approvals.map((item) => item.resolvedAt ?? item.createdAt),
    input.deliveryPackage?.updatedAt,
  ].filter((value): value is string => Boolean(value))

  return timestamps.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]
}

function buildHighlights(input: {
  role: ProjectRole
  pendingCount: number
  deliveryStatus: string
  latestVersion?: string
  waitingReviewCount: number
  taskCount: number
  reviewCount: number
  deliveryReminderCount: number
  memberCount: number
  pendingInvitationCount: number
  strongRiskCount: number
}) {
  if (input.role === 'producer') {
    return [
      `审批 ${input.waitingReviewCount}`,
      `交付 ${input.deliveryStatus}`,
      `团队 ${input.memberCount}`,
      `待邀 ${input.pendingInvitationCount}`,
      `风险 ${input.strongRiskCount}`,
    ]
  }

  if (input.role === 'client') {
    return [
      `待确认 ${input.waitingReviewCount}`,
      `版本 ${input.latestVersion ?? '未记录版本'}`,
      `交付 ${input.deliveryStatus}`,
    ]
  }

  return [
    `任务 ${input.taskCount}`,
    `反馈 ${input.reviewCount}`,
    `交付提醒 ${input.deliveryReminderCount}`,
    `待处理 ${input.pendingCount}`,
  ]
}

function buildQuickLinks(projectId: string, role: ProjectRole): ProjectQuickLink[] {
  const links: ProjectQuickLink[] = [
    { label: '查看项目首页', href: getProjectHref(projectId), kind: 'home' },
    { label: '去 Review', href: getReviewHref(projectId), kind: 'review' },
    { label: '去 Delivery', href: getDeliveryHref(projectId), kind: 'delivery' },
    { label: '去我的待办', href: `${getMeHref()}#personal-command-center`, kind: 'tasks' },
  ]

  if (role === 'producer') {
    links.push({ label: '去团队', href: getTeamManagementHref(projectId), kind: 'team' })
  }

  return links
}

function compareCards(left: UserProjectCard, right: UserProjectCard) {
  const waitingDelta = Number(right.waitingForMe) - Number(left.waitingForMe)
  if (waitingDelta !== 0) return waitingDelta

  const riskDelta = riskRank(right.riskLevel) - riskRank(left.riskLevel)
  if (riskDelta !== 0) return riskDelta

  const leftRecent = left.recentActivityAt ? new Date(left.recentActivityAt).getTime() : 0
  const rightRecent = right.recentActivityAt ? new Date(right.recentActivityAt).getTime() : 0
  if (leftRecent !== rightRecent) return rightRecent - leftRecent

  return left.title.localeCompare(right.title, 'zh-CN')
}

export function buildWorkspacePortfolio(input: {
  userId: string
  profileId: string
  assignments: ProjectRoleAssignment[]
  teams: Team[]
  invitations: TeamInvitation[]
  dashboard: ProducerDashboardData
  workQueue: PersonalWorkQueueData
  notifications: NotificationItem[]
  deliveryPackages: DeliveryPackage[]
  approvals: ApprovalRequest[]
}): WorkspacePortfolioData {
  const projectIds = Array.from(new Set([
    ...input.assignments
      .filter((assignment) => assignment.status === 'active' && (assignment.userId === input.userId || assignment.userId === input.profileId))
      .map((assignment) => assignment.projectId),
    ...input.teams
      .filter((team) => team.members.some((member) => member.status === 'joined' && (member.userId === input.userId || member.userId === input.profileId)))
      .map((team) => team.projectId),
  ]))

  const cards = projectIds.map<UserProjectCard | null>((projectId) => {
    const role = roleForProject(projectId, input.userId, input.profileId, input.assignments, input.teams)
    if (!role) return null

    const overview = input.dashboard.overview.find((item) => item.projectId === projectId) ?? null
    const deliveryPackage = input.deliveryPackages.find((item) => item.projectId === projectId) ?? null
    const projectNotifications = input.notifications.filter((item) => item.projectId === projectId && !item.isDismissed)
    const projectQueue = input.workQueue.items.filter((item) => item.projectId === projectId && !item.isDone)
    const projectApprovals = input.approvals.filter((item) => item.targetId === projectId || item.targetId === deliveryPackage?.id)
    const projectInvitations = input.invitations.filter((item) => item.projectId === projectId)
    const projectTeam = input.teams.find((item) => item.projectId === projectId)
    const taskCount = projectQueue.filter((item) => item.category === 'task' || item.category === 'planning').length
    const reviewCount = projectQueue.filter((item) => item.category === 'approval' || item.category === 'review').length
    const deliveryReminderCount = projectQueue.filter((item) => item.category === 'delivery' || item.category === 'licensing').length
    const pendingApprovalCount = overview?.pendingApprovalCount ?? reviewCount
    const readiness = overview?.readinessStatus ?? 'needs-review'
    const stage = overview?.currentStage ?? deliveryPackage?.manifest?.projectStage ?? projectTeam?.stage ?? 'idea'
    const title = overview?.title ?? deliveryPackage?.title ?? projectInvitations[0]?.projectTitle ?? projectId
    const deliveryStatus = deliveryPackage?.status ?? overview?.deliveryStatus ?? 'missing'
    const waitingForMe = projectQueue.length > 0
    const recentActivityAt = deriveRecentActivityAt({
      notifications: projectNotifications,
      invitations: projectInvitations,
      approvals: projectApprovals,
      deliveryPackage,
    })
    const riskLevel = deriveRiskLevel({
      blockerCount: overview?.blockerCount ?? 0,
      strongRiskCount: overview?.strongRiskCount ?? deliveryPackage?.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0,
      pendingCount: pendingApprovalCount,
      deliveryStatus,
      notifications: projectNotifications,
    })

    return {
      projectId,
      title,
      role,
      roleLabel: getProjectRoleLabel(role),
      stage,
      readiness,
      riskLevel,
      pendingCount: projectQueue.length,
      deliveryStatus,
      waitingForMe,
      recentActivityAt,
      quickLinks: buildQuickLinks(projectId, role),
      highlights: buildHighlights({
        role,
        pendingCount: projectQueue.length,
        deliveryStatus,
        latestVersion: deliveryPackage?.manifest?.finalVersion,
        waitingReviewCount: pendingApprovalCount,
        taskCount,
        reviewCount,
        deliveryReminderCount,
        memberCount: projectTeam?.members.filter((member) => member.status === 'joined').length ?? 0,
        pendingInvitationCount: projectInvitations.filter((item) => item.status === 'pending').length,
        strongRiskCount: overview?.strongRiskCount ?? 0,
      }),
      latestVersion: deliveryPackage?.manifest?.finalVersion,
    }
  }).filter((item): item is UserProjectCard => Boolean(item)).sort(compareCards)

  const waitingProjects = cards.filter((card) => card.waitingForMe)
  const highPriorityProjects = [...cards].sort(compareCards).slice(0, 5)
  const recentProjects = [...cards].sort((left, right) => {
    const leftTime = left.recentActivityAt ? new Date(left.recentActivityAt).getTime() : 0
    const rightTime = right.recentActivityAt ? new Date(right.recentActivityAt).getTime() : 0
    return rightTime - leftTime
  }).slice(0, 5)

  const summary: CrossProjectSummary = {
    totalProjects: cards.length,
    waitingForMeCount: waitingProjects.length,
    highRiskCount: cards.filter((card) => card.riskLevel === 'strong').length,
    approvalsPendingCount: cards.filter((card) => card.highlights.some((item) => item.startsWith('审批 ') || item.startsWith('待确认 '))).length,
    deliveryPendingCount: cards.filter((card) => card.deliveryStatus === 'submitted' || card.deliveryStatus === 'ready' || card.deliveryStatus === 'needs-revision').length,
  }

  return {
    summary,
    cards,
    recentProjects,
    highPriorityProjects,
    waitingProjects,
    aiSummary: {
      bestProjectToOpen: waitingProjects[0]?.title ?? recentProjects[0]?.title ?? '当前没有需要立即切换的项目',
      mostDangerousProject: highPriorityProjects.find((card) => card.riskLevel === 'strong')?.title ?? '当前没有明显高风险项目',
      recommendedFocus: waitingProjects[0]
        ? `${waitingProjects[0].title} 正在等待你处理`
        : highPriorityProjects[0]
          ? `优先查看 ${highPriorityProjects[0].title}`
          : '当前可以先回看最近项目',
    },
  }
}
