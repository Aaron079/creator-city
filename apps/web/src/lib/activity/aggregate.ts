import type { ApprovalDecision, ApprovalRequest } from '@/store/approval.store'
import type { DeliveryPackage } from '@/store/delivery-package.store'
import type { DirectorNote } from '@/store/director-notes.store'
import type { NotificationItem } from '@/store/notifications.store'
import type { InvitationActivity } from '@/store/team.store'
import type { VersionRecord } from '@/store/version-history.store'

export type ActivityLogType =
  | 'invitation-sent'
  | 'invitation-accepted'
  | 'invitation-declined'
  | 'member-role-changed'
  | 'member-removed'
  | 'approval-requested'
  | 'approval-decision'
  | 'director-note-added'
  | 'version-created'
  | 'delivery-submitted'
  | 'delivery-approved'
  | 'delivery-needs-revision'
  | 'notification-dismissed'

export interface ActivityLogItem {
  id: string
  projectId: string
  type: ActivityLogType
  actorUserId: string
  actorName: string
  targetType: string
  targetId: string
  message: string
  createdAt: string
  severity: 'info' | 'warning' | 'strong'
}

export interface ActivitySummary {
  totalCount: number
  todayCount: number
  approvalCount: number
  deliveryCount: number
  teamCount: number
  warningCount: number
  strongCount: number
}

interface BuildActivityLogInput {
  projectId: string
  invitationActivities: InvitationActivity[]
  approvals: ApprovalRequest[]
  notes: DirectorNote[]
  versions: VersionRecord[]
  deliveryPackages: DeliveryPackage[]
  notifications: NotificationItem[]
}

function toSeverity(level: 'info' | 'warning' | 'strong') {
  return level
}

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function inferActorFromApproval(approval: ApprovalRequest) {
  return {
    actorUserId: approval.createdBy,
    actorName: approval.createdBy,
  }
}

function inferActorFromDecision(decision: ApprovalDecision) {
  return {
    actorUserId: decision.userId,
    actorName: decision.userId,
  }
}

function mapInvitationType(type: InvitationActivity['type']): ActivityLogType {
  switch (type) {
    case 'invited':
      return 'invitation-sent'
    case 'accepted':
      return 'invitation-accepted'
    case 'declined':
      return 'invitation-declined'
    case 'role-changed':
      return 'member-role-changed'
    case 'removed':
      return 'member-removed'
    case 'cancelled':
      return 'invitation-declined'
    default:
      return 'invitation-sent'
  }
}

function invitationSeverity(type: InvitationActivity['type']): ActivityLogItem['severity'] {
  switch (type) {
    case 'declined':
    case 'cancelled':
    case 'removed':
      return 'warning'
    default:
      return 'info'
  }
}

function deliverySeverity(status: DeliveryPackage['status']): ActivityLogItem['severity'] {
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

function mapDeliveryStatus(status: DeliveryPackage['status']): ActivityLogType | null {
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

export function buildActivityLogItems(input: BuildActivityLogInput): ActivityLogItem[] {
  const invitationItems: ActivityLogItem[] = input.invitationActivities
    .filter((item) => item.projectId === input.projectId)
    .map((item) => ({
      id: `invite-${item.id}`,
      projectId: item.projectId,
      type: mapInvitationType(item.type),
      actorUserId: item.actorUserId,
      actorName: item.actorName,
      targetType: 'team-member',
      targetId: item.profileId,
      message: item.message,
      createdAt: item.createdAt,
      severity: invitationSeverity(item.type),
    }))

  const approvalItems: ActivityLogItem[] = input.approvals
    .filter((approval) => approval.targetId === input.projectId)
    .flatMap((approval) => {
      const requestItem: ActivityLogItem = {
        id: `approval-request-${approval.id}`,
        projectId: input.projectId,
        type: 'approval-requested',
        ...inferActorFromApproval(approval),
        targetType: approval.targetType,
        targetId: approval.targetId,
        message: `发起了「${approval.title}」审批请求。`,
        createdAt: approval.createdAt,
        severity: approval.requiredRoles.includes('client') ? 'warning' : 'info',
      }

      const decisionItems: ActivityLogItem[] = approval.decisions.map((decision) => ({
        id: `approval-decision-${decision.id}`,
        projectId: input.projectId,
        type: 'approval-decision' as const,
        ...inferActorFromDecision(decision),
        targetType: approval.targetType,
        targetId: approval.targetId,
        message: `${decision.role} 对「${approval.title}」做出了 ${decision.status}。`,
        createdAt: decision.createdAt,
        severity: decision.status === 'rejected' || decision.status === 'changes-requested' ? 'warning' : 'info',
      }))

      return [requestItem, ...decisionItems]
    })

  const noteItems: ActivityLogItem[] = input.notes
    .filter((note) => note.targetId === input.projectId)
    .map((note) => ({
      id: `note-${note.id}`,
      projectId: input.projectId,
      type: 'director-note-added',
      actorUserId: note.createdBy,
      actorName: note.createdBy,
      targetType: note.targetType,
      targetId: note.targetId,
      message: `新增导演批注：${note.content}`,
      createdAt: note.createdAt,
      severity: note.priority === 'blocker' ? 'strong' : note.priority === 'high' ? 'warning' : 'info',
    }))

  const versionItems: ActivityLogItem[] = input.versions
    .filter((version) => version.entityId === input.projectId)
    .map((version) => ({
      id: `version-${version.id}`,
      projectId: input.projectId,
      type: 'version-created',
      actorUserId: version.createdBy,
      actorName: version.createdBy,
      targetType: version.entityType,
      targetId: version.entityId,
      message: `创建了 ${version.label}：${version.summary}`,
      createdAt: version.createdAt,
      severity: 'info',
    }))

  const deliveryItems: ActivityLogItem[] = input.deliveryPackages
    .filter((pkg) => pkg.projectId === input.projectId)
    .flatMap((pkg) => {
      const type = mapDeliveryStatus(pkg.status)
      if (!type) return []
      return [{
        id: `delivery-${pkg.id}-${pkg.status}`,
        projectId: pkg.projectId,
        type,
        actorUserId: 'system-local',
        actorName: 'Delivery Workflow',
        targetType: 'delivery-package',
        targetId: pkg.id,
        message: `交付包「${pkg.title}」状态变为 ${pkg.status}。`,
        createdAt: pkg.updatedAt,
        severity: deliverySeverity(pkg.status),
      }]
    })

  const notificationItems: ActivityLogItem[] = input.notifications
    .filter((item) => item.projectId === input.projectId && item.isDismissed)
    .map((item) => ({
      id: `notification-dismissed-${item.id}`,
      projectId: input.projectId,
      type: 'notification-dismissed',
      actorUserId: 'current-user',
      actorName: '当前用户',
      targetType: item.sourceType,
      targetId: item.sourceId,
      message: `忽略了提醒：${item.title}`,
      createdAt: item.createdAt,
      severity: item.severity,
    }))

  return [
    ...invitationItems,
    ...approvalItems,
    ...noteItems,
    ...versionItems,
    ...deliveryItems,
    ...notificationItems,
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function summarizeActivity(items: ActivityLogItem[]): ActivitySummary {
  const today = startOfToday()
  return {
    totalCount: items.length,
    todayCount: items.filter((item) => new Date(item.createdAt).getTime() >= today).length,
    approvalCount: items.filter((item) => item.type === 'approval-requested' || item.type === 'approval-decision').length,
    deliveryCount: items.filter((item) => item.type === 'delivery-submitted' || item.type === 'delivery-approved' || item.type === 'delivery-needs-revision').length,
    teamCount: items.filter((item) => item.type.startsWith('invitation-') || item.type === 'member-role-changed' || item.type === 'member-removed').length,
    warningCount: items.filter((item) => item.severity === 'warning').length,
    strongCount: items.filter((item) => item.severity === 'strong').length,
  }
}

export function getActivityHref(item: ActivityLogItem) {
  switch (item.type) {
    case 'invitation-sent':
    case 'invitation-accepted':
    case 'invitation-declined':
    case 'member-role-changed':
    case 'member-removed':
      return '/dashboard#team-match'
    case 'approval-requested':
    case 'approval-decision':
    case 'director-note-added':
    case 'version-created':
      return `/review/${encodeURIComponent(item.projectId)}`
    case 'delivery-submitted':
    case 'delivery-approved':
    case 'delivery-needs-revision':
      return '/create'
    case 'notification-dismissed':
      return '/dashboard'
    default:
      return '/dashboard'
  }
}

export function getActivityTypeLabel(type: ActivityLogType) {
  switch (type) {
    case 'invitation-sent':
      return '邀请已发送'
    case 'invitation-accepted':
      return '邀请已接受'
    case 'invitation-declined':
      return '邀请已拒绝'
    case 'member-role-changed':
      return '成员角色调整'
    case 'member-removed':
      return '成员已移除'
    case 'approval-requested':
      return '审批已发起'
    case 'approval-decision':
      return '审批已反馈'
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

export function getSeverityTone(severity: ActivityLogItem['severity']) {
  return toSeverity(severity)
}
