import type { NotificationItem } from '@/store/notifications.store'
import type { TeamInvitation } from '@/store/team.store'
import { getActionTarget } from '@/lib/routing/actions'

function nowIso() {
  return new Date().toISOString()
}

export function buildInvitationNotification(invitation: TeamInvitation): NotificationItem {
  const action = getActionTarget({
    actionType: 'invitation-inbox',
    projectId: invitation.projectId,
    actionLabel: '查看邀请',
  })

  return {
    id: `notification:invitation:${invitation.id}`,
    projectId: invitation.projectId,
    projectTitle: invitation.projectTitle,
    category: 'team',
    severity: 'warning',
    roleScope: 'shared',
    section: 'invitation',
    title: '你收到一个项目邀请',
    message: `${invitation.projectTitle ?? invitation.projectId} 邀请你以 ${invitation.role} 角色加入项目，邀请人：${invitation.invitedByName ?? invitation.invitedByUserId}。`,
    sourceType: 'invitation',
    sourceId: invitation.id,
    actionType: action.actionType,
    actionLabel: action.actionLabel,
    actionHref: action.actionHref,
    isPinned: true,
    isRead: false,
    isDismissed: false,
    createdAt: invitation.createdAt,
    relatedProfileId: invitation.profileId,
    relatedRole: invitation.role,
  }
}

export function buildInvitationResolvedNotification(params: {
  invitation: TeamInvitation
  type: 'accepted' | 'declined' | 'cancelled'
}): NotificationItem {
  const { invitation, type } = params

  const meta = type === 'accepted'
    ? {
        severity: 'info' as const,
        title: '你已加入项目',
        message: `你已加入 ${invitation.projectTitle ?? invitation.projectId}，当前角色：${invitation.role}。`,
        sourceType: 'invitation-accepted',
      }
    : type === 'declined'
      ? {
          severity: 'info' as const,
          title: '你已拒绝项目邀请',
          message: `你已拒绝 ${invitation.projectTitle ?? invitation.projectId} 的 ${invitation.role} 邀请。`,
          sourceType: 'invitation-declined',
        }
      : {
          severity: 'info' as const,
          title: '项目邀请已取消',
          message: `${invitation.projectTitle ?? invitation.projectId} 的 ${invitation.role} 邀请已被取消。`,
          sourceType: 'invitation-cancelled',
      }

  const action = getActionTarget({
    actionType: 'invitation-inbox',
    projectId: invitation.projectId,
    actionLabel: '查看邀请页',
  })

  return {
    id: `notification:invitation:${invitation.id}:${type}`,
    projectId: invitation.projectId,
    projectTitle: invitation.projectTitle,
    category: 'team',
    severity: meta.severity,
    roleScope: 'shared',
    section: 'invitation',
    title: meta.title,
    message: meta.message,
    sourceType: meta.sourceType,
    sourceId: invitation.id,
    actionType: action.actionType,
    actionLabel: action.actionLabel,
    actionHref: action.actionHref,
    isPinned: false,
    isRead: false,
    isDismissed: false,
    createdAt: invitation.respondedAt ?? nowIso(),
    relatedProfileId: invitation.profileId,
    relatedRole: invitation.role,
  }
}
