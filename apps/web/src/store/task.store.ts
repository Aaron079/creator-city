import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useReviewResolutionStore } from '@/lib/review/resolution-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Task {
  id:           string
  teamId:       string
  description?: string
  priority?:    TaskPriority
  title:        string
  assignedTo:   string
  assignedName: string
  status:       TaskStatus
  relatedResolutionId?: string
  relatedProjectId?: string
  relatedResolutionStatusSnapshot?: string
  createdAt:    number
}

interface TaskState {
  tasks:        Task[]
  createTask:   (
    teamId: string,
    title: string,
    assignedTo: string,
    assignedName: string,
    options?: {
      description?: string
      priority?: TaskPriority
      relatedResolutionId?: string
      relatedProjectId?: string
      relatedResolutionStatusSnapshot?: string
    },
  ) => Task
  updateStatus: (taskId: string, status: TaskStatus) => void
  linkTaskResolution: (
    taskId: string,
    resolutionId: string,
    options?: {
      projectId?: string
      resolutionStatusSnapshot?: string
    },
  ) => void
  markLinkedResolutionInProgress: (taskId: string) => void
  markLinkedResolutionResolved: (taskId: string) => void
  getTeamTasks: (teamId: string) => Task[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_TASKS: Task[] = [
  {
    id:           'task-seed-1',
    teamId:       'team-seed-1',
    title:        '整理素材并按场景分类',
    assignedTo:   'city-creator-1',
    assignedName: '陈灵一',
    status:       'done',
    createdAt:    Date.now() - 48 * 3600_000,
  },
  {
    id:           'task-seed-2',
    teamId:       'team-seed-1',
    title:        '完成主镜头拍摄参考方案',
    assignedTo:   'user-me',
    assignedName: '我 (发布方)',
    status:       'doing',
    createdAt:    Date.now() - 24 * 3600_000,
  },
  {
    id:           'task-seed-3',
    teamId:       'team-seed-1',
    title:        '剪辑初版并导出样片',
    assignedTo:   'city-creator-3',
    assignedName: '林泽宇',
    status:       'todo',
    createdAt:    Date.now() - 12 * 3600_000,
  },
  {
    id:           'task-seed-4',
    teamId:       'team-seed-1',
    title:        '配乐选曲（参考清单整理）',
    assignedTo:   'user-me',
    assignedName: '我 (发布方)',
    status:       'todo',
    createdAt:    Date.now() - 6 * 3600_000,
  },
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: SEED_TASKS,

      createTask: (teamId, title, assignedTo, assignedName, options) => {
        const task: Task = {
          id:           uid(),
          teamId,
          description:  options?.description,
          priority:     options?.priority,
          title,
          assignedTo,
          assignedName,
          status:       'todo',
          relatedResolutionId: options?.relatedResolutionId,
          relatedProjectId: options?.relatedProjectId,
          relatedResolutionStatusSnapshot: options?.relatedResolutionStatusSnapshot,
          createdAt:    Date.now(),
        }
        set((s) => ({ tasks: [...s.tasks, task] }))
        return task
      },

      updateStatus: (taskId, status) => {
        set((s) => ({
          tasks: s.tasks.map((t) => t.id === taskId ? { ...t, status } : t),
        }))
      },

      linkTaskResolution: (taskId, resolutionId, options) => {
        set((s) => ({
          tasks: s.tasks.map((item) => item.id === taskId
            ? {
                ...item,
                relatedResolutionId: resolutionId,
                relatedProjectId: options?.projectId ?? item.relatedProjectId,
                relatedResolutionStatusSnapshot: options?.resolutionStatusSnapshot ?? item.relatedResolutionStatusSnapshot,
              }
            : item),
        }))
      },

      markLinkedResolutionInProgress: (taskId) => {
        const task = get().tasks.find((item) => item.id === taskId)
        if (!task?.relatedResolutionId) return
        useReviewResolutionStore.getState().markResolutionInProgress(task.relatedResolutionId)
        set((s) => ({
          tasks: s.tasks.map((item) => item.id === taskId
            ? { ...item, relatedResolutionStatusSnapshot: 'in-progress' }
            : item),
        }))
      },

      markLinkedResolutionResolved: (taskId) => {
        const task = get().tasks.find((item) => item.id === taskId)
        if (!task?.relatedResolutionId) return
        useReviewResolutionStore.getState().markResolutionResolved(task.relatedResolutionId)
        set((s) => ({
          tasks: s.tasks.map((item) => item.id === taskId
            ? { ...item, relatedResolutionStatusSnapshot: 'resolved' }
            : item),
        }))
      },

      getTeamTasks: (teamId) => get().tasks.filter((t) => t.teamId === teamId),
    }),
    { name: 'cc:tasks-v1' },
  ),
)

// ─── Status meta ──────────────────────────────────────────────────────────────

export const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string; bg: string; next?: TaskStatus; nextLabel?: string }> = {
  todo:  { label: '待处理', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)', next: 'doing', nextLabel: '开始' },
  doing: { label: '进行中', color: '#fbbf24',               bg: 'rgba(245,158,11,0.12)', next: 'done',  nextLabel: '完成' },
  done:  { label: '已完成', color: '#34d399',               bg: 'rgba(16,185,129,0.12)' },
}
