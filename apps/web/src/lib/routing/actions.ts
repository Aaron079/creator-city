import { getProjectAccessState, type ProjectAccessInfo } from '@/lib/roles/access'
import { getCurrentProfileId, getCurrentUserId } from '@/lib/roles/currentRole'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTeamStore } from '@/store/team.store'

export type ActionTargetType =
  | 'project-home'
  | 'project-overview'
  | 'project-review'
  | 'project-workspace'
  | 'project-delivery'
  | 'project-planning'
  | 'project-team'
  | 'dashboard-overview'
  | 'dashboard-project'
  | 'dashboard-action-queue'
  | 'dashboard-notifications'
  | 'dashboard-licensing'
  | 'invitation-inbox'
  | 'me'

export interface ResolvedActionTarget {
  actionType: ActionTargetType
  actionLabel: string
  actionHref: string
}

function encodeProjectId(projectId: string) {
  return encodeURIComponent(projectId)
}

function resolveAccess(projectId?: string): ProjectAccessInfo | null {
  if (!projectId) return null

  return getProjectAccessState(projectId, {
    userId: getCurrentUserId(),
    profileId: getCurrentProfileId(),
    assignments: useProjectRoleStore.getState().assignments,
    teams: useTeamStore.getState().teams,
    invitations: useTeamStore.getState().invitations,
  })
}

export function getInvitationInboxHref() {
  return '/me#invitation-inbox'
}

export function getMeHref() {
  return '/me'
}

export function getExternalReviewHref(token: string) {
  return `/guest/review/${encodeURIComponent(token)}`
}

export function getSharedProjectHref(token: string) {
  return `/share/${encodeURIComponent(token)}`
}

export function getExternalInviteHref(token: string) {
  return getSharedProjectHref(token)
}

export function getReviewHref(projectId: string) {
  return `/review/${encodeProjectId(projectId)}`
}

export function getDashboardHref(anchor?: string) {
  return anchor ? `/dashboard#${anchor}` : '/dashboard'
}

export function getDashboardProjectHref(projectId?: string) {
  if (!projectId) return getDashboardHref()

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return getReviewHref(projectId)
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardHref(`project-${projectId}`)
}

export function getProjectHref(projectId: string) {
  const access = resolveAccess(projectId)

  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return getReviewHref(projectId)
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardProjectHref(projectId)
}

export function getProjectHomeHref(projectId: string) {
  const access = resolveAccess(projectId)

  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'outsider') return getMeHref()

  return `/projects/${encodeProjectId(projectId)}`
}

export function getWorkspaceHref(projectId?: string) {
  if (!projectId) return '/create'

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return `${getReviewHref(projectId)}#delivery-snapshot`
  if (access?.state === 'outsider') return getMeHref()

  return '/create'
}

export function getDeliveryHref(projectId?: string) {
  if (!projectId) return '/create#delivery'

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only' || access?.state === 'outsider') {
    return `${getReviewHref(projectId)}#delivery-snapshot`
  }

  return '/create#delivery'
}

export function getPlanningHref(projectId?: string) {
  if (!projectId) return getDashboardHref('planning')

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return getReviewHref(projectId)
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardHref('planning')
}

export function getTeamManagementHref(projectId?: string) {
  if (!projectId) return getDashboardHref('team-match')

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return getReviewHref(projectId)
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardHref('team-match')
}

export function getNotificationsHref(projectId?: string) {
  if (!projectId) return getDashboardHref('notifications')

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return getReviewHref(projectId)
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardHref('notifications')
}

export function getLicensingHref(projectId?: string) {
  if (!projectId) return getDashboardHref('licensing')

  const access = resolveAccess(projectId)
  if (access?.state === 'invited') return getInvitationInboxHref()
  if (access?.state === 'client-only') return `${getReviewHref(projectId)}#delivery-snapshot`
  if (access?.state === 'outsider') return getMeHref()

  return getDashboardHref('licensing')
}

export function getActionTarget(input: {
  actionType: ActionTargetType
  projectId?: string
  actionLabel?: string
}): ResolvedActionTarget {
  const { actionType, projectId } = input

  switch (actionType) {
    case 'project-home':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看项目首页',
        actionHref: projectId ? getProjectHomeHref(projectId) : getDashboardHref(),
      }
    case 'invitation-inbox':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看邀请',
        actionHref: getInvitationInboxHref(),
      }
    case 'project-review':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '打开 Review',
        actionHref: projectId ? getReviewHref(projectId) : getMeHref(),
      }
    case 'project-delivery':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看交付',
        actionHref: getDeliveryHref(projectId),
      }
    case 'project-planning':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看排期',
        actionHref: getPlanningHref(projectId),
      }
    case 'project-team':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看团队',
        actionHref: getTeamManagementHref(projectId),
      }
    case 'project-workspace':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '打开工作区',
        actionHref: getWorkspaceHref(projectId),
      }
    case 'project-overview':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看项目概览',
        actionHref: projectId ? getProjectHref(projectId) : getDashboardHref(),
      }
    case 'dashboard-project':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看项目总览',
        actionHref: getDashboardProjectHref(projectId),
      }
    case 'dashboard-action-queue':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看动作队列',
        actionHref: getDashboardHref('action-queue'),
      }
    case 'dashboard-notifications':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看提醒',
        actionHref: getNotificationsHref(projectId),
      }
    case 'dashboard-licensing':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '查看授权中心',
        actionHref: getLicensingHref(projectId),
      }
    case 'dashboard-overview':
      return {
        actionType,
        actionLabel: input.actionLabel ?? '返回总览',
        actionHref: getDashboardHref('overview'),
      }
    case 'me':
    default:
      return {
        actionType: 'me',
        actionLabel: input.actionLabel ?? '查看我的页面',
        actionHref: getMeHref(),
      }
  }
}

export function getActionHref(input: {
  actionType?: ActionTargetType | null
  projectId?: string
  actionHref?: string
}) {
  if (input.actionType) {
    return getActionTarget({
      actionType: input.actionType,
      projectId: input.projectId,
    }).actionHref
  }

  if (input.actionHref) return input.actionHref
  if (input.projectId) return getProjectHref(input.projectId)
  return getMeHref()
}
