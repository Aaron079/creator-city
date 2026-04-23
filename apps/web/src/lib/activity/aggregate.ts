import type { ApprovalDecision, ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { NotificationItem } from '@/store/notifications.store'
import type { InvitationActivity, RoleChangeRecord } from '@/store/team.store'
import type { VersionRecord } from '@/store/version-history.store'
import type { ActionTargetType } from '@/lib/routing/actions'
import { getActionHref as resolveActionHref, getActionTarget } from '@/lib/routing/actions'

export type ActivityLogType =
  | 'invitation-sent'
  | 'invitation-accepted'
  | 'invitation-declined'
  | 'invitation-cancelled'
  | 'member-role-changed'
  | 'member-removed'
  | 'approval-requested'
  | 'approval-approved'
  | 'approval-changes-requested'
  | 'approval-rejected'
  | 'director-note-added'
  | 'version-created'
  | 'delivery-submitted'
  | 'delivery-approved'
  | 'delivery-needs-revision'
  | 'notification-dismissed'

export type ActivitySection =
  | 'team'
  | 'review'
  | 'approval'
  | 'delivery'
  | 'planning'
  | 'notifications'

export type ActivitySeverity = 'info' | 'warning' | 'strong'
export type ActivityFilter = 'all' | 'team' | 'approval' | 'delivery' | 'notifications' | 'review'

export interface ActivityLogItem {
  id: string
  projectId: string
  projectTitle: string
  type: ActivityLogType
  section: ActivitySection
  actorUserId: string
  actorName: string
  actorRole?: string
  relatedRole?: string
  targetType: string
  targetId: string
  message: string
  createdAt: string
  severity: ActivitySeverity
  actionType?: ActionTargetType
  actionLabel?: string
  actionHref?: string
  groupingKey?: string
  isImportant: boolean
}

export interface ActivitySummary {
  totalCount: number
  todayCount: number
  approvalCount: number
  deliveryCount: number
  teamCount: number
  warningCount: number
  strongCount: number
  invitationCount: number
  roleChangeCount: number
  approvalRequestedCount: number
  approvalDecisionCount: number
  deliverySubmittedCount: number
  notificationDismissedCount: number
}

export interface ActivityGroup {
  key: string
  section: ActivitySection
  projectId: string
  projectTitle: string
  items: ActivityLogItem[]
  latestAt: string
  isImportant: boolean
}

interface BuildActivityLogInput {
  projectId: string
  projectTitle?: string
  invitationActivities: InvitationActivity[]
  roleChanges: RoleChangeRecord[]
  approvals: ApprovalRequest[]
  notes: DirectorNote[]
  versions: VersionRecord[]
  deliveryPackages: DeliveryPackage[]
  notifications: NotificationItem[]
}

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function severityScore(severity: ActivitySeverity) {
  if (severity === 'strong') return 3
  if (severity === 'warning') return 2
  return 1
}

function sortItems(items: ActivityLogItem[]) {
  return [...items].sort((left, right) => {
    const importantDelta = Number(right.isImportant) - Number(left.isImportant)
    if (importantDelta !== 0) return importantDelta
    const severityDelta = severityScore(right.severity) - severityScore(left.severity)
    if (severityDelta !== 0) return severityDelta
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  })
}

function inferApprovalDecisionType(status: ApprovalDecision['status']): Extract<ActivityLogType, 'approval-approved' | 'approval-changes-requested' | 'approval-rejected'> {
  if (status === 'approved') return 'approval-approved'
  if (status === 'changes-requested') return 'approval-changes-requested'
  return 'approval-rejected'
}

function inferApprovalDecisionSeverity(status: ApprovalDecision['status']): ActivitySeverity {
  if (status === 'rejected' || status === 'changes-requested') return 'strong'
  return 'info'
}

function mapInvitationType(type: InvitationActivity['type']): ActivityLogType {
  switch (type) {
    case 'invited':
      return 'invitation-sent'
    case 'accepted':
      return 'invitation-accepted'
    case 'declined':
      return 'invitation-declined'
    case 'cancelled':
      return 'invitation-cancelled'
    case 'role-changed':
      return 'member-role-changed'
    case 'removed':
      return 'member-removed'
    default:
      return 'invitation-sent'
  }
}

function invitationSeverity(type: InvitationActivity['type']): ActivitySeverity {
  switch (type) {
    case 'declined':
    case 'cancelled':
      return 'warning'
    case 'removed':
      return 'strong'
    default:
      return 'info'
  }
}

function invitationImportant(type: InvitationActivity['type']) {
  return type === 'accepted' || type === 'declined' || type === 'cancelled' || type === 'role-changed'
}

function deliverySeverity(status: DeliveryPackage['status']): ActivitySeverity {
  switch (status) {
    case 'needs-revision':
      return 'strong'
    case 'submitted':
      return 'warning'
    case 'approved':
      return 'info'
    default:
      return 'info'
  }
}

function mapDeliveryStatus(status: DeliveryPackage['status']): Extract<ActivityLogType, 'delivery-submitted' | 'delivery-approved' | 'delivery-needs-revision'> | null {
  switch (status) {
    case 'submitted':
      return 'delivery-submitted'
    case 'approved':
      return 'delivery-approved'
    case 'needs-revision':
      return 'delivery-needs-revision'
    default:
      return null
  }
}

function defaultActionForType(projectId: string, type: ActivityLogType) {
  switch (type) {
    case 'invitation-sent':
    case 'invitation-accepted':
    case 'invitation-declined':
    case 'invitation-cancelled':
    case 'member-role-changed':
    case 'member-removed':
      return getActionTarget({
        actionType: 'project-team',
        projectId,
        actionLabel: '查看团队',
      })
    case 'approval-requested':
    case 'approval-approved':
    case 'approval-changes-requested':
    case 'approval-rejected':
    case 'director-note-added':
    case 'version-created':
      return getActionTarget({
        actionType: 'project-review',
        projectId,
        actionLabel: '查看审片',
      })
    case 'delivery-submitted':
    case 'delivery-approved':
    case 'delivery-needs-revision':
      return getActionTarget({
        actionType: 'project-delivery',
        projectId,
        actionLabel: '查看交付',
      })
    case 'notification-dismissed':
      return getActionTarget({
        actionType: 'dashboard-notifications',
        projectId,
        actionLabel: '查看提醒',
      })
    default:
      return getActionTarget({
        actionType: 'project-overview',
        projectId,
        actionLabel: '查看上下文',
      })
  }
}

function inferProjectTitle(projectId: string, fallback?: string) {
  return fallback ?? `项目 ${projectId}`
}

export function buildActivityLogItems(input: BuildActivityLogInput): ActivityLogItem[] {
  const projectTitle = inferProjectTitle(input.projectId, input.projectTitle)
  const relatedDeliveryPackages = input.deliveryPackages.filter((pkg) => pkg.projectId === input.projectId)
  const projectTargetIds = new Set<string>([
    input.projectId,
    ...relatedDeliveryPackages.map((pkg) => pkg.id),
    ...relatedDeliveryPackages.flatMap((pkg) => pkg.assets.map((asset) => asset.sourceId)),
  ])
  const roleChangeMap = new Map(
    input.roleChanges
      .filter((record) => record.projectId === input.projectId)
      .map((record) => [`${record.projectId}:${record.profileId}`, record] as const),
  )

  const invitationItems: ActivityLogItem[] = input.invitationActivities
    .filter((item) => item.projectId === input.projectId)
    .map((item) => {
      const relatedChange = roleChangeMap.get(`${item.projectId}:${item.profileId}`)
      const type = mapInvitationType(item.type)
      const action = defaultActionForType(item.projectId, type)
      return {
        id: `invite-${item.id}`,
        projectId: item.projectId,
        projectTitle,
        type,
        section: 'team',
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        actorRole: item.type === 'accepted' || item.type === 'declined' ? relatedChange?.toRole ?? undefined : 'producer',
        relatedRole: relatedChange?.toRole ?? relatedChange?.fromRole,
        targetType: 'team-member',
        targetId: item.profileId,
        message: item.message,
        createdAt: item.createdAt,
        severity: invitationSeverity(item.type),
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionHref: action.actionHref,
        groupingKey: `invitation:${item.projectId}:${item.profileId}`,
        isImportant: invitationImportant(item.type),
      } satisfies ActivityLogItem
    })

  const approvalItems: ActivityLogItem[] = input.approvals
    .filter((approval) => projectTargetIds.has(approval.targetId))
    .flatMap((approval) => {
      const requestAction = defaultActionForType(input.projectId, 'approval-requested')
      const requestItem: ActivityLogItem = {
        id: `approval-request-${approval.id}`,
        projectId: input.projectId,
        projectTitle,
        type: 'approval-requested',
        section: 'approval',
        actorUserId: approval.createdBy,
        actorName: approval.createdBy,
        actorRole: 'producer',
        targetType: approval.targetType,
        targetId: approval.targetId,
        message: `发起了「${approval.title}」审批请求。`,
        createdAt: approval.createdAt,
        severity: approval.requiredRoles.includes('client') ? 'warning' : 'info',
        actionType: requestAction.actionType,
        actionLabel: requestAction.actionLabel,
        actionHref: requestAction.actionHref,
        groupingKey: `approval:${approval.id}`,
        isImportant: approval.requiredRoles.includes('client'),
      }

      const decisionItems: ActivityLogItem[] = approval.decisions.map((decision) => {
        const type = inferApprovalDecisionType(decision.status)
        const action = defaultActionForType(input.projectId, type)
        return {
          id: `approval-decision-${decision.id}`,
          projectId: input.projectId,
          projectTitle,
          type,
          section: 'approval',
          actorUserId: decision.userId,
          actorName: decision.userId,
          actorRole: decision.role,
          targetType: approval.targetType,
          targetId: approval.targetId,
          message: `${decision.role} 对「${approval.title}」做出了 ${decision.status}。`,
          createdAt: decision.createdAt,
          severity: inferApprovalDecisionSeverity(decision.status),
          actionType: action.actionType,
          actionLabel: action.actionLabel,
          actionHref: action.actionHref,
          groupingKey: `approval:${approval.id}`,
          isImportant: decision.status === 'changes-requested' || decision.status === 'rejected',
        } satisfies ActivityLogItem
      })

      return [requestItem, ...decisionItems]
    })

  const noteItems: ActivityLogItem[] = input.notes
    .filter((note) => projectTargetIds.has(note.targetId))
    .map((note) => {
      const action = defaultActionForType(input.projectId, 'director-note-added')
      return {
        id: `note-${note.id}`,
        projectId: input.projectId,
        projectTitle,
        type: 'director-note-added',
        section: 'review',
        actorUserId: note.createdBy,
        actorName: note.createdBy,
        actorRole: 'director',
        targetType: note.targetType,
        targetId: note.targetId,
        message: `新增导演批注：${note.content}`,
        createdAt: note.createdAt,
        severity: note.priority === 'blocker' ? 'strong' : note.priority === 'high' ? 'warning' : 'info',
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionHref: action.actionHref,
        groupingKey: `note:${note.targetId}`,
        isImportant: note.priority === 'blocker',
      } satisfies ActivityLogItem
    })

  const versionItems: ActivityLogItem[] = input.versions
    .filter((version) => projectTargetIds.has(version.entityId))
    .map((version) => {
      const action = defaultActionForType(input.projectId, 'version-created')
      return {
        id: `version-${version.id}`,
        projectId: input.projectId,
        projectTitle,
        type: 'version-created',
        section: 'review',
        actorUserId: version.createdBy,
        actorName: version.createdBy,
        targetType: version.entityType,
        targetId: version.entityId,
        message: `创建了 ${version.label}：${version.summary}`,
        createdAt: version.createdAt,
        severity: 'info',
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionHref: action.actionHref,
        groupingKey: `version:${version.entityId}`,
        isImportant: false,
      } satisfies ActivityLogItem
    })

  const deliveryItems: ActivityLogItem[] = input.deliveryPackages
    .filter((pkg) => pkg.projectId === input.projectId)
    .flatMap((pkg) => {
      const type = mapDeliveryStatus(pkg.status)
      if (!type) return []
      const action = defaultActionForType(pkg.projectId, type)
      return [{
        id: `delivery-${pkg.id}-${pkg.status}`,
        projectId: pkg.projectId,
        projectTitle: inferProjectTitle(pkg.projectId, pkg.title || projectTitle),
        type,
        section: 'delivery',
        actorUserId: 'system-local',
        actorName: 'Delivery Workflow',
        actorRole: 'producer',
        targetType: 'delivery-package',
        targetId: pkg.id,
        message: `交付包「${pkg.title}」状态变为 ${pkg.status}。`,
        createdAt: pkg.updatedAt,
        severity: deliverySeverity(pkg.status),
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionHref: action.actionHref,
        groupingKey: `delivery:${pkg.id}`,
        isImportant: pkg.status === 'submitted' || pkg.status === 'needs-revision',
      } satisfies ActivityLogItem]
    })

  const notificationItems: ActivityLogItem[] = input.notifications
    .filter((item) => item.projectId === input.projectId && item.isDismissed)
    .map((item) => {
      const action = defaultActionForType(input.projectId, 'notification-dismissed')
      return {
        id: `notification-dismissed-${item.id}`,
        projectId: input.projectId,
        projectTitle,
        type: 'notification-dismissed',
        section: 'notifications',
        actorUserId: 'current-user',
        actorName: '当前用户',
        targetType: item.sourceType,
        targetId: item.sourceId,
        message: `忽略了提醒：${item.title}`,
        createdAt: item.createdAt,
        severity: item.severity,
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionHref: action.actionHref,
        groupingKey: `notification:${item.sourceId}`,
        isImportant: false,
      } satisfies ActivityLogItem
    })

  return sortItems([
    ...invitationItems,
    ...approvalItems,
    ...noteItems,
    ...versionItems,
    ...deliveryItems,
    ...notificationItems,
  ])
}

export function summarizeActivity(items: ActivityLogItem[]): ActivitySummary {
  const today = startOfToday()
  return {
    totalCount: items.length,
    todayCount: items.filter((item) => new Date(item.createdAt).getTime() >= today).length,
    approvalCount: items.filter((item) => item.section === 'approval').length,
    deliveryCount: items.filter((item) => item.section === 'delivery').length,
    teamCount: items.filter((item) => item.section === 'team').length,
    warningCount: items.filter((item) => item.severity === 'warning').length,
    strongCount: items.filter((item) => item.severity === 'strong').length,
    invitationCount: items.filter((item) => item.type.startsWith('invitation-')).length,
    roleChangeCount: items.filter((item) => item.type === 'member-role-changed').length,
    approvalRequestedCount: items.filter((item) => item.type === 'approval-requested').length,
    approvalDecisionCount: items.filter((item) => item.type === 'approval-approved' || item.type === 'approval-changes-requested' || item.type === 'approval-rejected').length,
    deliverySubmittedCount: items.filter((item) => item.type === 'delivery-submitted').length,
    notificationDismissedCount: items.filter((item) => item.type === 'notification-dismissed').length,
  }
}

export function buildActivityGroups(items: ActivityLogItem[], filter: ActivityFilter = 'all'): ActivityGroup[] {
  const filteredItems = filter === 'all'
    ? items
    : items.filter((item) => item.section === filter)

  const groups = new Map<string, ActivityGroup>()
  filteredItems.forEach((item) => {
    const key = item.groupingKey ?? item.id
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      existing.isImportant = existing.isImportant || item.isImportant
      if (new Date(item.createdAt).getTime() > new Date(existing.latestAt).getTime()) {
        existing.latestAt = item.createdAt
      }
      return
    }

    groups.set(key, {
      key,
      section: item.section,
      projectId: item.projectId,
      projectTitle: item.projectTitle,
      items: [item],
      latestAt: item.createdAt,
      isImportant: item.isImportant,
    })
  })

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: sortItems(group.items),
    }))
    .sort((left, right) => {
      const importantDelta = Number(right.isImportant) - Number(left.isImportant)
      if (importantDelta !== 0) return importantDelta
      return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime()
    })
}

export function getActivityHref(item: ActivityLogItem) {
  return resolveActionHref(item)
}

export function getActivityTypeLabel(type: ActivityLogType) {
  switch (type) {
    case 'invitation-sent':
      return '邀请已发送'
    case 'invitation-accepted':
      return '邀请已接受'
    case 'invitation-declined':
      return '邀请已拒绝'
    case 'invitation-cancelled':
      return '邀请已取消'
    case 'member-role-changed':
      return '成员角色调整'
    case 'member-removed':
      return '成员已移除'
    case 'approval-requested':
      return '审批已发起'
    case 'approval-approved':
      return '审批已通过'
    case 'approval-changes-requested':
      return '审批请求修改'
    case 'approval-rejected':
      return '审批已拒绝'
    case 'director-note-added':
      return '导演批注'
    case 'version-created':
      return '新版本'
    case 'delivery-submitted':
      return '交付已提交'
    case 'delivery-approved':
      return '交付已批准'
    case 'delivery-needs-revision':
      return '交付需修改'
    case 'notification-dismissed':
      return '提醒已忽略'
    default:
      return type
  }
}

export function getActivitySectionLabel(section: ActivityFilter) {
  switch (section) {
    case 'all':
      return '全部'
    case 'team':
      return '团队'
    case 'approval':
      return '审批'
    case 'delivery':
      return '交付'
    case 'notifications':
      return '通知'
    case 'review':
      return '审片'
    default:
      return section
  }
}
