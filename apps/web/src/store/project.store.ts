import { create } from 'zustand'

export interface Project {
  id: string
  title: string
  description: string
  type: string
  status: string
  visibility: string
  ownerId: string
  tags: string[]
  genre: string[]
  views: number
  likes: number
  createdAt: string
  updatedAt: string
  owner?: {
    id: string
    username: string
    displayName: string
    avatarUrl?: string
  }
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  isLoading: boolean
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  setLoading: (loading: boolean) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}))
