import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DirectorNoteTargetType =
  | 'project'
  | 'project-brief'
  | 'sequence'
  | 'shot'
  | 'storyboard-frame'
  | 'video-shot'
  | 'editor-clip'
  | 'editor-timeline'
  | 'audio-timeline'
  | 'delivery'
  | 'role-bible'
  | 'clip-review'

export type DirectorNoteCategory =
  | 'creative'
  | 'camera'
  | 'casting'
  | 'lighting'
  | 'color'
  | 'rhythm'
  | 'editing'
  | 'continuity'
  | 'client-feedback'
  | 'production'

export type DirectorNotePriority = 'low' | 'medium' | 'high' | 'blocker'
export type DirectorNoteStatus = 'open' | 'in-progress' | 'resolved' | 'dismissed'

export interface DirectorNoteReply {
  id: string
  noteId: string
  authorId: string
  content: string
  createdAt: string
}

export interface DirectorNote {
  id: string
  targetType: DirectorNoteTargetType
  targetId: string
  category: DirectorNoteCategory
  priority: DirectorNotePriority
  status: DirectorNoteStatus
  content: string
  createdBy: string
  assignedTo?: string
  createdAt: string
  resolvedAt?: string
  replies: DirectorNoteReply[]
  aiSummary?: string
}

export interface DirectorTaskDraft {
  title: string
  assignedTo?: string
}

interface DirectorNotesState {
  notes: DirectorNote[]
  addNote: (note: Omit<DirectorNote, 'id' | 'createdAt' | 'resolvedAt' | 'replies' | 'aiSummary'> & { aiSummary?: string }) => DirectorNote
  updateNoteStatus: (noteId: string, status: DirectorNoteStatus) => void
  addReply: (noteId: string, reply: Omit<DirectorNoteReply, 'id' | 'createdAt' | 'noteId'>) => void
  getNotesForTarget: (targetType: DirectorNoteTargetType, targetId: string) => DirectorNote[]
  getOpenBlockers: () => DirectorNote[]
  convertNoteToTask: (noteId: string) => DirectorTaskDraft | null
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useDirectorNotesStore = create<DirectorNotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      addNote: (note) => {
        const next: DirectorNote = {
          ...note,
          id: uid('note'),
          createdAt: new Date().toISOString(),
          replies: [],
          aiSummary: note.aiSummary,
        }
        set((state) => ({ notes: [next, ...state.notes] }))
        return next
      },

      updateNoteStatus: (noteId, status) => {
        set((state) => ({
          notes: state.notes.map((note) => (
            note.id === noteId
              ? {
                  ...note,
                  status,
                  resolvedAt: status === 'resolved' ? new Date().toISOString() : note.resolvedAt,
                }
              : note
          )),
        }))
      },

      addReply: (noteId, reply) => {
        set((state) => ({
          notes: state.notes.map((note) => (
            note.id === noteId
              ? {
                  ...note,
                  replies: [
                    ...note.replies,
                    {
                      ...reply,
                      id: uid('reply'),
                      noteId,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : note
          )),
        }))
      },

      getNotesForTarget: (targetType, targetId) => get().notes.filter((note) => note.targetType === targetType && note.targetId === targetId),

      getOpenBlockers: () => get().notes.filter((note) => note.priority === 'blocker' && (note.status === 'open' || note.status === 'in-progress')),

      convertNoteToTask: (noteId) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return null
        return {
          title: `[${note.category}] ${note.content.slice(0, 48)}`,
          assignedTo: note.assignedTo,
        }
      },
    }),
    { name: 'cc:director-notes-v1' },
  ),
)
