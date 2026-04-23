import { useAuthStore } from '@/store/auth.store'
import { useProfileStore } from '@/store/profile.store'
import type { RolePermission } from '@/lib/roles/permissions'
import { getPermissionsForRole } from '@/lib/roles/permissions'
import type { ProjectRole, ProjectRoleAssignment } from '@/lib/roles/projectRoles'

export const DEV_ROLE_OVERRIDE_KEY = 'cc:mock-view-role'

export type CurrentRoleSource = 'assignment' | 'fallback' | 'dev-override'

export interface CurrentProjectRoleContext {
  userId: string | null
  profileId: string | null
  projectId: string
  role: ProjectRole
  permissions: RolePermission
  source: CurrentRoleSource
}

function normalizeFallbackRole(role: string | undefined | null): ProjectRole {
  if (role === 'producer' || role === 'client' || role === 'director' || role === 'editor' || role === 'cinematographer') {
    return role
  }
  return 'creator'
}

export function getCurrentUserId() {
  return useAuthStore.getState().user?.id ?? null
}

export function getCurrentProfileId() {
  return useProfileStore.getState().currentUserId ?? getCurrentUserId()
}

export function shouldUseDevRoleOverride() {
  return process.env.NODE_ENV !== 'production'
}

export function getDevRoleOverride() {
  if (!shouldUseDevRoleOverride() || typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(DEV_ROLE_OVERRIDE_KEY)
  return stored === 'producer'
    || stored === 'creator'
    || stored === 'client'
    || stored === 'director'
    || stored === 'editor'
    || stored === 'cinematographer'
    ? stored
    : null
}

function findAssignment(assignments: ProjectRoleAssignment[], projectId: string, principalId: string | null | undefined) {
  if (!principalId) return null
  return assignments.find((item) => (
    item.projectId === projectId
    && item.userId === principalId
    && item.status === 'active'
  )) ?? null
}

export function resolveProjectRole(
  projectId: string,
  userId?: string | null,
  profileId?: string | null,
  options?: {
    assignments?: ProjectRoleAssignment[]
    fallbackRole?: ProjectRole
    overrideRole?: ProjectRole | null
  },
) {
  const assignments = options?.assignments ?? []
  const overrideRole = options?.overrideRole ?? null
  const fallbackRole = options?.fallbackRole ?? 'creator'

  if (overrideRole && shouldUseDevRoleOverride()) {
    return {
      role: overrideRole,
      source: 'dev-override' as const,
    }
  }

  const matchedAssignment = findAssignment(assignments, projectId, userId) ?? findAssignment(assignments, projectId, profileId)
  if (matchedAssignment) {
    return {
      role: matchedAssignment.role,
      source: 'assignment' as const,
    }
  }

  return {
    role: fallbackRole,
    source: 'fallback' as const,
  }
}

export function resolveProjectRoleContext(
  projectId: string,
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    fallbackRole?: ProjectRole
    overrideRole?: ProjectRole | null
  },
): CurrentProjectRoleContext {
  const userId = options?.userId ?? getCurrentUserId()
  const profileId = options?.profileId ?? getCurrentProfileId()
  const fallbackRole = options?.fallbackRole ?? normalizeFallbackRole(useAuthStore.getState().user?.role)
  const resolved = resolveProjectRole(projectId, userId, profileId, {
    assignments: options?.assignments ?? [],
    fallbackRole,
    overrideRole: options?.overrideRole ?? getDevRoleOverride(),
  })

  return {
    userId,
    profileId,
    projectId,
    role: resolved.role,
    permissions: getPermissionsForRole(resolved.role),
    source: resolved.source,
  }
}

export function resolveDashboardRoleContext(
  projectIds: string[],
  options?: {
    userId?: string | null
    profileId?: string | null
    assignments?: ProjectRoleAssignment[]
    fallbackRole?: ProjectRole
    overrideRole?: ProjectRole | null
  },
): CurrentProjectRoleContext {
  const userId = options?.userId ?? getCurrentUserId()
  const profileId = options?.profileId ?? getCurrentProfileId()
  const assignments = options?.assignments ?? []
  const overrideRole = options?.overrideRole ?? getDevRoleOverride()
  const fallbackRole = options?.fallbackRole ?? normalizeFallbackRole(useAuthStore.getState().user?.role)

  if (overrideRole && shouldUseDevRoleOverride()) {
    return {
      userId,
      profileId,
      projectId: projectIds[0] ?? 'dashboard',
      role: overrideRole,
      permissions: getPermissionsForRole(overrideRole),
      source: 'dev-override',
    }
  }

  const relevantAssignments = assignments.filter((item) => (
    item.status === 'active'
    && projectIds.includes(item.projectId)
    && (item.userId === userId || item.userId === profileId)
  ))

  const prioritizedRole = relevantAssignments.some((item) => item.role === 'producer')
    ? 'producer'
    : relevantAssignments.find((item) => item.role === 'director' || item.role === 'editor' || item.role === 'cinematographer')?.role
      ?? relevantAssignments.find((item) => item.role === 'creator')?.role
      ?? relevantAssignments.find((item) => item.role === 'client')?.role
      ?? null

  if (prioritizedRole) {
    return {
      userId,
      profileId,
      projectId: relevantAssignments[0]?.projectId ?? projectIds[0] ?? 'dashboard',
      role: prioritizedRole,
      permissions: getPermissionsForRole(prioritizedRole),
      source: 'assignment',
    }
  }

  return {
    userId,
    profileId,
    projectId: projectIds[0] ?? 'dashboard',
    role: fallbackRole,
    permissions: getPermissionsForRole(fallbackRole),
    source: 'fallback',
  }
}
