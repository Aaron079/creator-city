'use client'

import { useMemo, useState } from 'react'
import type { CanvasGenerationTask } from '@/lib/canvas/generation-tasks'

type GenerationTasksPanelProps = {
  open: boolean
  tasks: CanvasGenerationTask[]
  onClose: () => void
  onQueryTask: (task: CanvasGenerationTask) => Promise<string | void>
}

const STATUS_LABEL: Record<CanvasGenerationTask['status'], string> = {
  running: '生成中',
  done: '已完成',
  error: '失败',
}

const GROUPS: Array<{ status: CanvasGenerationTask['status']; title: string }> = [
  { status: 'running', title: '生成中' },
  { status: 'done', title: '已完成' },
  { status: 'error', title: '失败' },
]

function formatDate(value?: string) {
  if (!value) return '未记录'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function shortTaskId(taskId: string) {
  return taskId.length > 18 ? `${taskId.slice(0, 8)}...${taskId.slice(-6)}` : taskId
}

export function GenerationTasksPanel({
  open,
  tasks,
  onClose,
  onQueryTask,
}: GenerationTasksPanelProps) {
  const [queryingIds, setQueryingIds] = useState<Set<string>>(new Set())
  const [noticeById, setNoticeById] = useState<Record<string, string>>({})
  const runningTasks = useMemo(() => tasks.filter((task) => task.status === 'running'), [tasks])

  if (!open) return null

  const runQuery = async (task: CanvasGenerationTask) => {
    setQueryingIds((current) => new Set(current).add(task.taskId))
    try {
      const message = await onQueryTask(task)
      setNoticeById((current) => ({
        ...current,
        [task.taskId]: message || '已查询任务状态。',
      }))
    } catch (error) {
      setNoticeById((current) => ({
        ...current,
        [task.taskId]: error instanceof Error ? error.message : '查询任务失败。',
      }))
    } finally {
      setQueryingIds((current) => {
        const next = new Set(current)
        next.delete(task.taskId)
        return next
      })
    }
  }

  const queryAllRunning = async () => {
    await Promise.all(runningTasks.map((task) => runQuery(task)))
  }

  return (
    <div
      className="canvas-generation-tasks-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        className="canvas-generation-tasks-panel"
        role="dialog"
        aria-modal="true"
        aria-label="生成任务"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="canvas-generation-tasks-head">
          <div>
            <h2>生成任务</h2>
            <p>{tasks.length > 0 ? `当前画布 ${tasks.length} 个异步任务` : '当前画布还没有异步生成任务。'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭生成任务面板">×</button>
        </header>

        <div className="canvas-generation-tasks-actions">
          <button
            type="button"
            disabled={runningTasks.length === 0 || queryingIds.size > 0}
            onClick={() => { void queryAllRunning() }}
          >
            {queryingIds.size > 0 ? '查询中...' : `查询全部运行中任务${runningTasks.length ? ` (${runningTasks.length})` : ''}`}
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="canvas-generation-tasks-empty">当前画布还没有异步生成任务。</div>
        ) : (
          <div className="canvas-generation-tasks-groups">
            {GROUPS.map((group) => {
              const groupTasks = tasks.filter((task) => task.status === group.status)
              if (!groupTasks.length) return null
              return (
                <section key={group.status} className="canvas-generation-tasks-group">
                  <h3>{group.title}</h3>
                  <div className="canvas-generation-task-list">
                    {groupTasks.map((task) => {
                      const querying = queryingIds.has(task.taskId)
                      return (
                        <article key={`${task.nodeId}-${task.taskId}`} className={`canvas-generation-task-card status-${task.status}`}>
                          <div className="canvas-generation-task-topline">
                            <span>{task.nodeTitle}</span>
                            <strong>{STATUS_LABEL[task.status]}</strong>
                          </div>
                          <dl>
                            <div><dt>Provider</dt><dd>{task.providerId || 'unknown'}</dd></div>
                            <div><dt>Model</dt><dd>{task.model || '未记录'}</dd></div>
                            <div>
                              <dt>Task ID</dt>
                              <dd>
                                <code title={task.taskId}>{shortTaskId(task.taskId)}</code>
                                <button
                                  type="button"
                                  onClick={() => { void navigator.clipboard?.writeText(task.taskId) }}
                                  aria-label="复制 taskId"
                                >
                                  复制
                                </button>
                              </dd>
                            </div>
                            <div><dt>提交时间</dt><dd>{formatDate(task.submittedAt)}</dd></div>
                            {task.completedAt ? <div><dt>完成时间</dt><dd>{formatDate(task.completedAt)}</dd></div> : null}
                            {task.lastCheckedAt ? <div><dt>上次查询</dt><dd>{formatDate(task.lastCheckedAt)}</dd></div> : null}
                          </dl>
                          {task.errorMessage ? <p className="canvas-generation-task-error">{task.errorMessage}</p> : null}
                          {task.resultUrl ? <a className="canvas-generation-task-link" href={task.resultUrl} target="_blank" rel="noreferrer">打开结果</a> : null}
                          {noticeById[task.taskId] ? <p className="canvas-generation-task-notice">{noticeById[task.taskId]}</p> : null}
                          {task.status === 'running' ? (
                            <button
                              type="button"
                              className="canvas-generation-task-query"
                              disabled={querying}
                              onClick={() => { void runQuery(task) }}
                            >
                              {querying ? '查询中...' : '查询结果'}
                            </button>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </aside>
    </div>
  )
}
