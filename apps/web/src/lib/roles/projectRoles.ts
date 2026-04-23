export type ProjectRole =
  | 'producer'
  | 'creator'
  | 'client'
  | 'director'
  | 'editor'
  | 'cinematographer'

export type ProjectRoleAssignmentStatus = 'active' | 'invited' | 'removed'

export interface ProjectRoleAssignment {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  status: ProjectRoleAssignmentStatus
}

export const PROJECT_ROLES: ProjectRole[] = [
  'producer',
  'creator',
  'client',
  'director',
  'editor',
  'cinematographer',
]

export function isProjectRole(role: string): role is ProjectRole {
  return PROJECT_ROLES.includes(role as ProjectRole)
}

export function getProjectRoleLabel(role: ProjectRole) {
  switch (role) {
    case 'producer':
      return 'Producer'
    case 'creator':
      return 'Creator'
    case 'client':
      return 'Client'
    case 'director':
      return 'Director'
    case 'editor':
      return 'Editor'
    case 'cinematographer':
      return 'Cinematographer'
    default:
      return role
  }
}
