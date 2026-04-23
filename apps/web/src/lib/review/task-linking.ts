import type { Task, TaskPriority } from '@/store/task.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import type { ReviewResolutionItem } from '@/lib/review/resolution-store'
import { useReviewResolutionStore } from '@/lib/review/resolution-store'

export interface ResolutionTaskConsistency {
  type: 'resolution-resolved-task-open' | 'task-done-resolution-open' | 'resubmitted-task-stale'
  message: string
  severity: 'warning' | 'strong'
}

function mapSeverityToPriority(severity: ReviewResolutionItem['severity']): TaskPriority {
  switch (severity) {
    case 'strong':
      return 'critical'
    case 'warning':
      return 'high'
    default:
      return 'medium'
  }
}

function buildTaskTitle(item: ReviewResolutionItem) {
  return `[修改闭环] ${item.title}`
}

function buildTaskDescription(item: ReviewResolutionItem) {
  return [
    `来源：${item.sourceType}`,
    `状态：${item.status}`,
    item.description,
  ].join(' · ')
}

export function createTaskFromResolution(resolutionId: string) {
  const resolution = useReviewResolutionStore.getState().items.find((item) => item.id === resolutionId)
  if (!resolution || resolution.relatedTaskId) return null

  const team = useTeamStore.getState().teams.find((item) => item.projectId === resolution.projectId)
  if (!team) return null

  const assignee = team.members.find((member) => member.userId === resolution.assignedUserId)
    ?? team.members.find((member) => member.role === resolution.assignedRole)
    ?? team.members[0]

  if (!assignee) return null

  const task = useTaskStore.getState().createTask(
    team.id,
    buildTaskTitle(resolution),
    assignee.userId,
    assignee.name,
    {
      description: buildTaskDescription(resolution),
      priority: mapSeverityToPriority(resolution.severity),
      relatedResolutionId: resolution.id,
      relatedProjectId: resolution.projectId,
      relatedResolutionStatusSnapshot: resolution.status,
    },
  )

  useReviewResolutionStore.getState().linkResolutionTask(resolution.id, task.id)
  return task
}

export function getResolutionTaskConsistency(item: ReviewResolutionItem, task?: Task | null): ResolutionTaskConsistency[] {
  if (!task) return []

  const issues: ResolutionTaskConsistency[] = []

  if (item.status === 'resolved' && task.status !== 'done') {
    issues.push({
      type: 'resolution-resolved-task-open',
      message: '修改项已标记为已解决，但关联任务仍未完成。',
      severity: 'warning',
    })
  }

  if ((item.status === 'open' || item.status === 'in-progress') && task.status === 'done') {
    issues.push({
      type: 'task-done-resolution-open',
      message: '关联任务已完成，但修改项仍未关闭或重新提交。',
      severity: 'warning',
    })
  }

  if (item.status === 'resubmitted' && task.status !== 'done') {
    issues.push({
      type: 'resubmitted-task-stale',
      message: '修改项已重新提交，但旧任务仍未处理完成，建议复核是否需要关闭或拆分。',
      severity: 'strong',
    })
  }

  return issues
}
