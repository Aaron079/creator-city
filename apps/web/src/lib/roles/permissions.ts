import type { ProjectRole } from '@/lib/roles/projectRoles'

export interface RolePermission {
  role: ProjectRole
  canViewDashboard: boolean
  canEditCreateWorkspace: boolean
  canViewReview: boolean
  canSubmitApproval: boolean
  canApproveAsClient: boolean
  canManageDelivery: boolean
  canManagePlanning: boolean
  canInviteTeam: boolean
  canViewCommercialStatus: boolean
}

export type PermissionSection =
  | 'dashboard'
  | 'dashboard-commercial'
  | 'dashboard-planning'
  | 'dashboard-team-invite'
  | 'create-workspace'
  | 'review'
  | 'review-client-actions'
  | 'delivery-management'

export type PermissionAction =
  | 'open-dashboard'
  | 'edit-create-workspace'
  | 'submit-approval'
  | 'approve-as-client'
  | 'manage-delivery'
  | 'manage-planning'
  | 'invite-team'
  | 'view-commercial-status'

const CREATOR_LIKE: Omit<RolePermission, 'role'> = {
  canViewDashboard: true,
  canEditCreateWorkspace: true,
  canViewReview: true,
  canSubmitApproval: true,
  canApproveAsClient: false,
  canManageDelivery: false,
  canManagePlanning: false,
  canInviteTeam: false,
  canViewCommercialStatus: false,
}

const PERMISSIONS: Record<ProjectRole, RolePermission> = {
  producer: {
    role: 'producer',
    canViewDashboard: true,
    canEditCreateWorkspace: false,
    canViewReview: true,
    canSubmitApproval: true,
    canApproveAsClient: false,
    canManageDelivery: true,
    canManagePlanning: true,
    canInviteTeam: true,
    canViewCommercialStatus: true,
  },
  creator: {
    role: 'creator',
    ...CREATOR_LIKE,
  },
  client: {
    role: 'client',
    canViewDashboard: false,
    canEditCreateWorkspace: false,
    canViewReview: true,
    canSubmitApproval: false,
    canApproveAsClient: true,
    canManageDelivery: false,
    canManagePlanning: false,
    canInviteTeam: false,
    canViewCommercialStatus: false,
  },
  director: {
    role: 'director',
    ...CREATOR_LIKE,
  },
  editor: {
    role: 'editor',
    ...CREATOR_LIKE,
  },
  cinematographer: {
    role: 'cinematographer',
    ...CREATOR_LIKE,
  },
}

export function getPermissionsForRole(role: ProjectRole): RolePermission {
  return PERMISSIONS[role]
}

export function canAccessSection(role: ProjectRole, section: PermissionSection) {
  const permissions = getPermissionsForRole(role)

  switch (section) {
    case 'dashboard':
      return permissions.canViewDashboard
    case 'dashboard-commercial':
      return permissions.canViewCommercialStatus
    case 'dashboard-planning':
      return permissions.canManagePlanning
    case 'dashboard-team-invite':
      return permissions.canInviteTeam
    case 'create-workspace':
      return permissions.canEditCreateWorkspace
    case 'review':
      return permissions.canViewReview
    case 'review-client-actions':
      return permissions.canApproveAsClient
    case 'delivery-management':
      return permissions.canManageDelivery
    default:
      return false
  }
}

export function canPerformAction(role: ProjectRole, action: PermissionAction) {
  const permissions = getPermissionsForRole(role)

  switch (action) {
    case 'open-dashboard':
      return permissions.canViewDashboard
    case 'edit-create-workspace':
      return permissions.canEditCreateWorkspace
    case 'submit-approval':
      return permissions.canSubmitApproval
    case 'approve-as-client':
      return permissions.canApproveAsClient
    case 'manage-delivery':
      return permissions.canManageDelivery
    case 'manage-planning':
      return permissions.canManagePlanning
    case 'invite-team':
      return permissions.canInviteTeam
    case 'view-commercial-status':
      return permissions.canViewCommercialStatus
    default:
      return false
  }
}
