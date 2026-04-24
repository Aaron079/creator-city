import type {
  ExternalAccessLink,
  ExternalAccessPermissions,
  ExternalAccessStatus,
  ExternalAccessType,
  ExternalRoleHint,
} from '@/store/external-access.store'
import {
  getExternalInviteHref,
  getExternalReviewHref,
  getSharedProjectHref,
} from '@/lib/routing/actions'

export function getExternalAccessTypeLabel(type: ExternalAccessType) {
  return {
    'client-review': 'Client Review',
    'delivery-preview': 'Delivery Preview',
    'creator-invite': 'Creator Invite',
    'project-overview': 'Project Overview',
  }[type]
}

export function getExternalRoleHintLabel(roleHint: ExternalRoleHint) {
  return {
    client: 'Client',
    creator: 'Creator',
    reviewer: 'Reviewer',
    viewer: 'Viewer',
  }[roleHint]
}

export function getExternalEffectiveStatus(link: ExternalAccessLink): ExternalAccessStatus {
  if (
    link.status === 'active'
    && link.expiresAt
    && new Date(link.expiresAt).getTime() <= Date.now()
  ) {
    return 'expired'
  }

  return link.status
}

export function isExternalLinkAvailable(link: ExternalAccessLink | null | undefined) {
  return Boolean(link) && getExternalEffectiveStatus(link as ExternalAccessLink) === 'active'
}

export function getExternalStatusTone(status: ExternalAccessStatus) {
  switch (status) {
    case 'revoked':
      return 'danger'
    case 'expired':
      return 'warning'
    case 'active':
    default:
      return 'ready'
  }
}

export function getExternalPermissionSummary(permissions: ExternalAccessPermissions) {
  const allowed = [
    permissions.canViewProject ? '查看项目摘要' : null,
    permissions.canViewDelivery ? '查看交付快照' : null,
    permissions.canSubmitReview ? '提交确认决定' : null,
    permissions.canRequestChanges ? '请求修改' : null,
    permissions.canJoinProject ? '提交加入意向' : null,
  ].filter((item): item is string => Boolean(item))

  const denied = [
    !permissions.canSubmitReview ? '不会开放内部审批入口' : null,
    !permissions.canJoinProject ? '不会自动加入团队' : null,
    !permissions.canViewDelivery ? '不会显示完整交付详情' : null,
  ].filter((item): item is string => Boolean(item))

  return { allowed, denied }
}

export function getExternalLinkHref(link: ExternalAccessLink) {
  if (link.accessType === 'client-review') return getExternalReviewHref(link.token)
  if (link.accessType === 'creator-invite') return getExternalInviteHref(link.token)
  return getSharedProjectHref(link.token)
}

export function getExternalLinkSuggestedSummary(link: ExternalAccessLink) {
  const typeLabel = getExternalAccessTypeLabel(link.accessType)
  const roleLabel = getExternalRoleHintLabel(link.roleHint)

  switch (link.accessType) {
    case 'client-review':
      return `${typeLabel} · 给 ${roleLabel} 的受控确认入口`
    case 'delivery-preview':
      return `${typeLabel} · 只读交付快照`
    case 'creator-invite':
      return `${typeLabel} · 外部创作者加入说明`
    case 'project-overview':
    default:
      return `${typeLabel} · 只读项目概览`
  }
}
