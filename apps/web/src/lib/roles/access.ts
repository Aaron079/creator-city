import type { ProjectRole, ProjectRoleAssignment } from '@/lib/roles/projectRoles'
import { isProjectRole } from '@/lib/roles/projectRoles'
import type { Team, TeamInvitation } from '@/store/team.store'

export type ProjectAccessState =
  | 'member'
  | 'invited'
  | 'outsider'
  | 'client-only'
  | 'creator-only'
  | 'producer-only'

export interface ProjectAccessInfo {
  projectId: string
  userId: string | null
  profileId: string | null
  state: ProjectAccessState
  role: ProjectRole | null
  assignmentStatus: ProjectRoleAssignment['status'] | 'none'
  invitationStatus: TeamInvitation['status'] | 'none'
}

function getPrincipalIds(userId?: string | null, profileId?: string | null) {
  return Array.from(new Set([userId, profileId].filter((value): value is string => Boolean(value))))
}

function mapRoleToAccessState(role: ProjectRole): ProjectAccessState {
  if (role === 'producer') return 'producer-only'
  if (role === 'client') return 'client-only'
  if (role === 'creator' || role === 'director' || role === 'editor' || role === 'cinematographer') {
    return 'creator-only'
  }
  return 'member'
}

function findAssignment(
  assignments: ProjectRoleAssignment[],
  projectId: string,
  principalIds: string[],
  status?: ProjectRoleAssignment['status'],
) {
  return assignments.find((item) => (
    item.projectId === projectId
    && principalIds.includes(item.userId)
    && (status ? item.status === status : true)
  )) ?? null
}

function findInvitation(
  invitations: TeamInvitation[],
  projectId: string,
  principalIds: string[],
) {
  return invitations.find((item) => (
    item.projectId === projectId
    && principalIds.includes(item.profileId)
    && item.status === 'pending'
  )) ?? null
}

function findTeamMember(
  teams: Team[],
  projectId: string,
  principalIds: string[],
  status?: 'joined' | 'invited',
) {
  const team = teams.find((item) => item.projectId === projectId)
  if (!team) return null
  return team.members.find((member) => (
    principalIds.includes(member.userId)
    && (status ? member.status === status : true)
  )) ?? null
}

export function getProjectAccessState(
  projectId: string,
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    teams?: Team[]
    invitations?: TeamInvitation[]
  },
): ProjectAccessInfo {
  const userId = options?.userId ?? null
  const profileId = options?.profileId ?? null
  const principalIds = getPrincipalIds(userId, profileId)
  const assignments = options?.assignments ?? []
  const teams = options?.teams ?? []
  const invitations = options?.invitations ?? []

  const activeAssignment = findAssignment(assignments, projectId, principalIds, 'active')
  if (activeAssignment) {
    return {
      projectId,
      userId,
      profileId,
      state: mapRoleToAccessState(activeAssignment.role),
      role: activeAssignment.role,
      assignmentStatus: 'active',
      invitationStatus: 'none',
    }
  }

  const joinedMember = findTeamMember(teams, projectId, principalIds, 'joined')
  if (joinedMember) {
    return {
      projectId,
      userId,
      profileId,
      state: isProjectRole(joinedMember.role) ? mapRoleToAccessState(joinedMember.role) : 'member',
      role: isProjectRole(joinedMember.role) ? joinedMember.role : null,
      assignmentStatus: 'none',
      invitationStatus: 'none',
    }
  }

  const invitedAssignment = findAssignment(assignments, projectId, principalIds, 'invited')
  const pendingInvitation = findInvitation(invitations, projectId, principalIds)
  const invitedMember = findTeamMember(teams, projectId, principalIds, 'invited')

  if (invitedAssignment || pendingInvitation || invitedMember) {
    return {
      projectId,
      userId,
      profileId,
      state: 'invited',
      role: invitedAssignment?.role ?? (pendingInvitation && isProjectRole(pendingInvitation.role) ? pendingInvitation.role : null),
      assignmentStatus: invitedAssignment?.status ?? 'none',
      invitationStatus: pendingInvitation?.status ?? 'none',
    }
  }

  return {
    projectId,
    userId,
    profileId,
    state: 'outsider',
    role: null,
    assignmentStatus: 'none',
    invitationStatus: 'none',
  }
}

export function isProjectMember(
  projectId: string,
  userId?: string | null,
  profileId?: string | null,
  options?: {
    assignments?: ProjectRoleAssignment[]
    teams?: Team[]
    invitations?: TeamInvitation[]
  },
) {
  const access = getProjectAccessState(projectId, {
    userId,
    profileId,
    assignments: options?.assignments,
    teams: options?.teams,
    invitations: options?.invitations,
  })

  return access.state !== 'invited' && access.state !== 'outsider'
}

export function canEnterCreate(
  projectId: string,
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    teams?: Team[]
    invitations?: TeamInvitation[]
  },
) {
  const access = getProjectAccessState(projectId, options)
  return access.state === 'producer-only' || access.state === 'creator-only'
}

export function canEnterReview(
  projectId: string,
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    teams?: Team[]
    invitations?: TeamInvitation[]
  },
) {
  const access = getProjectAccessState(projectId, options)
  return access.state !== 'outsider'
}

export function canEnterDashboard(
  projectId: string,
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    teams?: Team[]
    invitations?: TeamInvitation[]
    /** Project IDs owned by the current user in the DB (ownerId match). Owners always get access. */
    ownedProjectIds?: string[]
  },
) {
  if (options?.ownedProjectIds?.includes(projectId)) return true
  const access = getProjectAccessState(projectId, options)
  return access.state === 'producer-only' || access.state === 'creator-only'
}
