import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProjectTemplateSelection {
  projectId: string
  templateId: string
  selectedAt: string
}

interface ProjectTemplateState {
  selections: ProjectTemplateSelection[]
  setTemplateForProject: (projectId: string, templateId: string) => void
  getTemplateForProject: (projectId: string) => ProjectTemplateSelection | undefined
}

export const useProjectTemplateStore = create<ProjectTemplateState>()(
  persist(
    (set, get) => ({
      selections: [],

      setTemplateForProject: (projectId, templateId) => {
        set((state) => ({
          selections: state.selections.some((item) => item.projectId === projectId)
            ? state.selections.map((item) => (
                item.projectId === projectId
                  ? { ...item, templateId, selectedAt: new Date().toISOString() }
                  : item
              ))
            : [...state.selections, { projectId, templateId, selectedAt: new Date().toISOString() }],
        }))
      },

      getTemplateForProject: (projectId) => get().selections.find((item) => item.projectId === projectId),
    }),
    {
      name: 'creator-city-project-templates',
      partialize: (state) => ({
        selections: state.selections,
      }),
    },
  ),
)
