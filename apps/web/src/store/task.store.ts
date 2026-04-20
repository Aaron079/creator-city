import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id:           string
  teamId:       string
  title:        string
  assignedTo:   string
  assignedName: string
  status:       TaskStatus
  createdAt:    number
}

interface TaskState {
  tasks:        Task[]
  createTask:   (teamId: string, title: string, assignedTo: string, assignedName: string) => Task
  updateStatus: (taskId: string, status: TaskStatus) => void
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

      createTask: (teamId, title, assignedTo, assignedName) => {
        const task: Task = {
          id:           uid(),
          teamId,
          title,
          assignedTo,
          assignedName,
          status:       'todo',
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
