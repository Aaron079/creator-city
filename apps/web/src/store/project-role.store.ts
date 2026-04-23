import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPermissionsForRole, type RolePermission } from '@/lib/roles/permissions'
import type { ProjectRole, ProjectRoleAssignment, ProjectRoleAssignmentStatus } from '@/lib/roles/projectRoles'

interface ProjectRoleState {
  assignments: ProjectRoleAssignment[]
  setProjectRole: (projectId: string, userId: string, role: ProjectRole) => void
  assignProjectRole: (projectId: string, userId: string, role: ProjectRole, status?: ProjectRoleAssignmentStatus) => void
  updateAssignmentStatus: (projectId: string, userId: string, status: ProjectRoleAssignmentStatus) => void
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
        get().assignProjectRole(projectId, userId, role, 'active')
      },

      assignProjectRole: (projectId, userId, role, status = 'active') => {
        set((state) => {
          const existing = state.assignments.find((item) => item.projectId === projectId && item.userId === userId)
          if (existing) {
            return {
              assignments: state.assignments.map((item) => (
                item.id === existing.id
                  ? { ...item, role, status }
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
                status,
              },
              ...state.assignments,
            ],
          }
        })
      },

      updateAssignmentStatus: (projectId, userId, status) => {
        set((state) => ({
          assignments: state.assignments.map((item) => (
            item.projectId === projectId && item.userId === userId
              ? { ...item, status }
              : item
          )),
        }))
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
