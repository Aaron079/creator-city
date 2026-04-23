import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPermissionsForRole, type RolePermission } from '@/lib/roles/permissions'
import type { ProjectRole, ProjectRoleAssignment } from '@/lib/roles/projectRoles'

interface ProjectRoleState {
  assignments: ProjectRoleAssignment[]
  setProjectRole: (projectId: string, userId: string, role: ProjectRole) => void
  getRoleForProject: (projectId: string, userId: string, fallbackRole?: ProjectRole) => ProjectRole
  getPermissions: (projectId: string, userId: string, fallbackRole?: ProjectRole) => RolePermission
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useProjectRoleStore = create<ProjectRoleState>()(
  persist(
    (set, get) => ({
      assignments: [],

      setProjectRole: (projectId, userId, role) => {
        set((state) => {
          const existing = state.assignments.find((item) => item.projectId === projectId && item.userId === userId)
          if (existing) {
            return {
              assignments: state.assignments.map((item) => (
                item.id === existing.id
                  ? { ...item, role, status: 'active' }
                  : item
              )),
            }
          }

          return {
            assignments: [
              {
                id: createId('project-role'),
                projectId,
                userId,
                role,
                status: 'active',
              },
              ...state.assignments,
            ],
          }
        })
      },

      getRoleForProject: (projectId, userId, fallbackRole = 'creator') => {
        const assignment = get().assignments.find((item) => (
          item.projectId === projectId
          && item.userId === userId
          && item.status === 'active'
        ))
        return assignment?.role ?? fallbackRole
      },

      getPermissions: (projectId, userId, fallbackRole = 'creator') => {
        const role = get().getRoleForProject(projectId, userId, fallbackRole)
        return getPermissionsForRole(role)
      },
    }),
    { name: 'cc:project-role-v1' },
  ),
)
