import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProjectTemplateSelection {
  projectId: string
  templateId: string
  selectedAt: string
}

export interface ProjectStartChecklistCompletion {
  projectId: string
  templateId?: string
  doneItemIds: string[]
  updatedAt: string
}

interface ProjectTemplateState {
  selections: ProjectTemplateSelection[]
  checklistCompletions: ProjectStartChecklistCompletion[]
  setTemplateForProject: (projectId: string, templateId: string) => void
  getTemplateForProject: (projectId: string) => ProjectTemplateSelection | undefined
  setChecklistItemDone: (projectId: string, itemId: string, done: boolean, templateId?: string) => void
  getChecklistCompletionForProject: (projectId: string) => ProjectStartChecklistCompletion | undefined
}

export const useProjectTemplateStore = create<ProjectTemplateState>()(
  persist(
    (set, get) => ({
      selections: [],
      checklistCompletions: [],

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

      setChecklistItemDone: (projectId, itemId, done, templateId) => {
        set((state) => {
          const existing = state.checklistCompletions.find((item) => item.projectId === projectId)
          const nextDoneIds = done
            ? Array.from(new Set([...(existing?.doneItemIds ?? []), itemId]))
            : (existing?.doneItemIds ?? []).filter((id) => id !== itemId)

          const nextRecord: ProjectStartChecklistCompletion = {
            projectId,
            templateId,
            doneItemIds: nextDoneIds,
            updatedAt: new Date().toISOString(),
          }

          return {
            checklistCompletions: existing
              ? state.checklistCompletions.map((item) => item.projectId === projectId ? nextRecord : item)
              : [...state.checklistCompletions, nextRecord],
          }
        })
      },

      getChecklistCompletionForProject: (projectId) => get().checklistCompletions.find((item) => item.projectId === projectId),
    }),
    {
      name: 'creator-city-project-templates',
      partialize: (state) => ({
        selections: state.selections,
        checklistCompletions: state.checklistCompletions,
      }),
    },
  ),
)
