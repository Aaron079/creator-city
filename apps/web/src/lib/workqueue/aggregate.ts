import type { ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { NotificationItem } from '@/store/notifications.store'
import { isActionableNotification, isSnoozedNotification } from '@/store/notifications.store'
import type { ProjectRoleAssignment } from '@/lib/roles/projectRoles'
import { getProjectRoleLabel, isProjectRole, type ProjectRole } from '@/lib/roles/projectRoles'
import type { Task } from '@/store/task.store'
import type { Team, TeamInvitation } from '@/store/team.store'

export type WorkQueueCategory =
  | 'invitation'
  | 'approval'
  | 'review'
  | 'delivery'
  | 'planning'
  | 'task'
  | 'licensing'

export interface WorkQueueItem {
  id: string
  userId: string
  projectId: string
  projectTitle: string
  category: WorkQueueCategory
  severity: 'info' | 'warning' | 'strong'
  title: string
  message: string
  sourceType: string
  sourceId: string
  dueAt?: string
  actionLabel: string
  actionHref: string
  isBlocking: boolean
  isDone: boolean
}

export interface WorkQueueSummary {
  totalCount: number
  dueSoonCount: number
  invitationCount: number
  approvalCount: number
  taskCount: number
  deliveryCount: number
  strongCount: number
  blockedCount: number
}

export interface WorkQueueAiSummary {
  topPriorities: string[]
  mostDangerousProject: string
  mostDelayedArea: string
}

export interface PersonalWorkQueueData {
  items: WorkQueueItem[]
  priorityQueue: WorkQueueItem[]
  summary: WorkQueueSummary
  aiSummary: WorkQueueAiSummary
}

interface BuildPersonalWorkQueueInput {
  userId: string
  profileId: string
  invitations: TeamInvitation[]
  assignments: ProjectRoleAssignment[]
  tasks: Task[]
  teams: Team[]
  approvals: ApprovalRequest[]
  deliveryPackages: DeliveryPackage[]
  notifications: NotificationItem[]
}

function severityRank(severity: WorkQueueItem['severity']) {
  if (severity === 'strong') return 3
  if (severity === 'warning') return 2
  return 1
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

  const member = teams
    .find((team) => team.projectId === projectId)
    ?.members.find((item) => item.userId === userId || item.userId === profileId)

  return member && isProjectRole(member.role) ? member.role : null
}

function projectTitleResolver(input: BuildPersonalWorkQueueInput) {
  const titleMap = new Map<string, string>()

  input.invitations.forEach((invitation) => {
    titleMap.set(invitation.projectId, invitation.projectTitle ?? invitation.projectId)
  })

  input.deliveryPackages.forEach((pkg) => {
    titleMap.set(pkg.projectId, pkg.title)
  })

  input.notifications.forEach((item) => {
    if (item.projectId) {
      titleMap.set(item.projectId, item.projectTitle ?? item.projectId)
    }
  })

  input.teams.forEach((team) => {
    if (!titleMap.has(team.projectId)) titleMap.set(team.projectId, team.projectId)
  })

  return (projectId: string) => titleMap.get(projectId) ?? projectId
}

function compareQueueItems(left: WorkQueueItem, right: WorkQueueItem) {
  const byBlocking = Number(right.isBlocking) - Number(left.isBlocking)
  if (byBlocking !== 0) return byBlocking
  const bySeverity = severityRank(right.severity) - severityRank(left.severity)
  if (bySeverity !== 0) return bySeverity
  const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER
  const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER
  if (leftDue !== rightDue) return leftDue - rightDue
  return left.title.localeCompare(right.title, 'zh-CN')
}

function buildSummary(items: WorkQueueItem[]): WorkQueueSummary {
  const active = items.filter((item) => !item.isDone)
  const now = Date.now()
  const dueSoonCount = active.filter((item) => item.dueAt && new Date(item.dueAt).getTime() - now <= 48 * 3600_000).length

  return {
    totalCount: active.length,
    dueSoonCount,
    invitationCount: active.filter((item) => item.category === 'invitation').length,
    approvalCount: active.filter((item) => item.category === 'approval' || item.category === 'review').length,
    taskCount: active.filter((item) => item.category === 'task').length,
    deliveryCount: active.filter((item) => item.category === 'delivery').length,
    strongCount: active.filter((item) => item.severity === 'strong').length,
    blockedCount: active.filter((item) => item.isBlocking).length,
  }
}

function buildAiSummary(items: WorkQueueItem[]): WorkQueueAiSummary {
  const active = items.filter((item) => !item.isDone).sort(compareQueueItems)
  const topPriorities = active.slice(0, 3).map((item) => `${item.projectTitle} · ${item.title}`)

  const projectScores = new Map<string, number>()
  const categoryScores = new Map<WorkQueueCategory, number>()

  active.forEach((item) => {
    projectScores.set(item.projectTitle, (projectScores.get(item.projectTitle) ?? 0) + severityRank(item.severity) + (item.isBlocking ? 1 : 0))
    categoryScores.set(item.category, (categoryScores.get(item.category) ?? 0) + severityRank(item.severity))
  })

  const mostDangerousProject = [...projectScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '当前没有明显高风险项目'
  const mostDelayedAreaRaw = [...categoryScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostDelayedArea = mostDelayedAreaRaw
    ? {
        invitation: '邀请响应',
        approval: '审批',
        review: '审片反馈',
        delivery: '交付准备',
        planning: '排期推进',
        task: '协作任务',
        licensing: '授权风险',
      }[mostDelayedAreaRaw]
    : '当前没有明显延误环节'

  return {
    topPriorities: topPriorities.length > 0 ? topPriorities : ['当前没有待处理事项。'],
    mostDangerousProject,
    mostDelayedArea,
  }
}

export function buildPersonalWorkQueue(input: BuildPersonalWorkQueueInput): PersonalWorkQueueData {
  const getProjectTitle = projectTitleResolver(input)
  const items: WorkQueueItem[] = []
  const seen = new Set<string>()
  const userAssignments = input.assignments.filter((assignment) => (
    assignment.status === 'active'
    && (assignment.userId === input.userId || assignment.userId === input.profileId)
  ))

  const pushItem = (item: WorkQueueItem) => {
    const dedupeKey = `${item.category}:${item.sourceType}:${item.sourceId}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    items.push(item)
  }

  input.invitations
    .filter((invitation) => invitation.profileId === input.profileId && invitation.status === 'pending')
    .forEach((invitation) => {
      const invitationRoleLabel = isProjectRole(invitation.role)
        ? getProjectRoleLabel(invitation.role)
        : invitation.role
      pushItem({
        id: `workqueue:invitation:${invitation.id}`,
        userId: input.userId,
        projectId: invitation.projectId,
        projectTitle: invitation.projectTitle ?? invitation.projectId,
        category: 'invitation',
        severity: 'warning',
        title: '待回应的项目邀请',
        message: `${invitation.invitedByName ?? invitation.invitedByUserId} 邀请你以 ${invitationRoleLabel} 身份加入项目。`,
        sourceType: 'invitation',
        sourceId: invitation.id,
        dueAt: invitation.createdAt,
        actionLabel: '处理邀请',
        actionHref: '/me#invitation-inbox',
        isBlocking: true,
        isDone: false,
      })
    })

  input.teams.forEach((team) => {
    const assignedTasks = input.tasks.filter((task) => (
      task.teamId === team.id
      && task.status !== 'done'
      && (task.assignedTo === input.userId || task.assignedTo === input.profileId)
    ))

    assignedTasks.forEach((task) => {
      pushItem({
        id: `workqueue:task:${task.id}`,
        userId: input.userId,
        projectId: team.projectId,
        projectTitle: getProjectTitle(team.projectId),
        category: 'task',
        severity: task.status === 'doing' ? 'warning' : 'info',
        title: task.title,
        message: `当前任务状态：${task.status === 'doing' ? '进行中' : '待处理'}。`,
        sourceType: 'task',
        sourceId: task.id,
        actionLabel: '查看项目概览',
        actionHref: '/dashboard#team-match',
        isBlocking: task.status === 'todo',
        isDone: false,
      })
    })
  })

  input.approvals
    .filter((approval) => approval.status === 'pending' || approval.status === 'stale' || approval.status === 'changes-requested')
    .forEach((approval) => {
      const projectId = approval.targetId
      const role = roleForProject(projectId, input.userId, input.profileId, input.assignments, input.teams)
      if (!role) return

      const isRelevant = role === 'producer'
        || (role === 'client' && approval.requiredRoles.includes('client'))
        || (role === 'creator' && approval.requiredRoles.includes('creator'))
        || (role === 'director' && approval.requiredRoles.includes('director'))
        || (role === 'editor' && approval.requiredRoles.includes('editor'))
        || (role === 'cinematographer' && approval.requiredRoles.includes('cinematographer'))
        || approval.status === 'changes-requested'

      if (!isRelevant) return

      pushItem({
        id: `workqueue:approval:${approval.id}`,
        userId: input.userId,
        projectId,
        projectTitle: getProjectTitle(projectId),
        category: approval.status === 'changes-requested' ? 'review' : 'approval',
        severity: approval.status === 'stale' || approval.status === 'changes-requested' ? 'strong' : 'warning',
        title: approval.title,
        message: approval.status === 'changes-requested'
          ? '该确认项收到 changes-requested，建议先回看修改意见。'
          : approval.status === 'stale'
            ? '该确认项已 stale，需要重新推进。'
            : '当前有待处理的确认项。',
        sourceType: approval.status,
        sourceId: approval.id,
        dueAt: approval.createdAt,
        actionLabel: '打开 Review',
        actionHref: `/review/${projectId}`,
        isBlocking: approval.status !== 'pending',
        isDone: false,
      })
    })

  input.deliveryPackages.forEach((pkg) => {
    const role = roleForProject(pkg.projectId, input.userId, input.profileId, input.assignments, input.teams)
    if (!role) return

    const isProducer = role === 'producer'
    const isClient = role === 'client'
    const strongRiskCount = pkg.riskSummary?.issues.filter((issue) => issue.severity === 'strong').length ?? 0

    if (isProducer && (strongRiskCount > 0 || !['ready', 'submitted', 'approved'].includes(pkg.status))) {
      pushItem({
        id: `workqueue:delivery:${pkg.id}:producer`,
        userId: input.userId,
        projectId: pkg.projectId,
        projectTitle: pkg.title,
        category: 'delivery',
        severity: strongRiskCount > 0 ? 'strong' : 'warning',
        title: '交付包需要继续推进',
        message: strongRiskCount > 0
          ? `当前交付包还有 ${strongRiskCount} 个高风险项。`
          : `当前交付状态为 ${pkg.status}，还没有进入 ready / submitted。`,
        sourceType: 'delivery',
        sourceId: pkg.id,
        dueAt: pkg.updatedAt,
        actionLabel: '查看交付状态',
        actionHref: '/dashboard#overview',
        isBlocking: strongRiskCount > 0,
        isDone: false,
      })
    }

    if (isClient && pkg.status === 'submitted') {
      pushItem({
        id: `workqueue:delivery:${pkg.id}:client`,
        userId: input.userId,
        projectId: pkg.projectId,
        projectTitle: pkg.title,
        category: 'delivery',
        severity: 'warning',
        title: '有待你确认的交付内容',
        message: '交付包已经提交，等待你在 review 中确认。',
        sourceType: 'delivery-submitted',
        sourceId: pkg.id,
        dueAt: pkg.updatedAt,
        actionLabel: '打开 Review',
        actionHref: `/review/${pkg.projectId}`,
        isBlocking: true,
        isDone: false,
      })
    }
  })

  input.notifications
    .filter((item) => !item.isDismissed && !isSnoozedNotification(item))
    .forEach((item) => {
      const isForUser = (
        item.relatedProfileId === input.profileId
        || item.roleScope === 'shared'
        || item.roleScope === undefined
        || (item.roleScope === 'producer' && userAssignments.some((assignment) => assignment.role === 'producer'))
        || (item.roleScope === 'creator' && userAssignments.some((assignment) => ['creator', 'director', 'editor', 'cinematographer'].includes(assignment.role)))
        || (item.roleScope === 'client' && userAssignments.some((assignment) => assignment.role === 'client'))
      )

      if (!isForUser) return
      if (!isActionableNotification(item) && item.severity !== 'strong') return

      const category: WorkQueueCategory = item.category === 'licensing'
        ? 'licensing'
        : item.category === 'planning'
          ? 'planning'
          : item.category === 'delivery'
            ? 'delivery'
            : item.category === 'review'
              ? 'review'
              : item.category === 'approval'
                ? 'approval'
                : item.category === 'team'
                  ? 'invitation'
                  : 'planning'

      pushItem({
        id: `workqueue:notification:${item.id}`,
        userId: input.userId,
        projectId: item.projectId ?? 'unscoped',
        projectTitle: item.projectTitle ?? item.projectId ?? '未映射项目',
        category,
        severity: item.severity,
        title: item.title,
        message: item.message,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        dueAt: item.dueAt ?? item.createdAt,
        actionLabel: item.actionLabel,
        actionHref: item.actionHref,
        isBlocking: item.severity === 'strong' || item.sourceType === 'invitation',
        isDone: item.isRead && !isActionableNotification(item),
      })
    })

  const sortedItems = items.sort(compareQueueItems)
  return {
    items: sortedItems,
    priorityQueue: sortedItems.slice(0, 6),
    summary: buildSummary(sortedItems),
    aiSummary: buildAiSummary(sortedItems),
  }
}
