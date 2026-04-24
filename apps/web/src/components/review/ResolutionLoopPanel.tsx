'use client'

import { useMemo, useState } from 'react'
import type { ProjectRole } from '@/lib/roles/projectRoles'
import { getProjectRoleLabel } from '@/lib/roles/projectRoles'
import { getResolutionTaskConsistency } from '@/lib/review/task-linking'
import type { ReviewResolutionItem, ReviewResolutionSummary, ReviewResolutionStatus } from '@/lib/review/resolution-store'
import type { Task, TaskStatus } from '@/store/task.store'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useFeedback } from '@/lib/feedback/useFeedback'

function sourceLabel(sourceType: ReviewResolutionItem['sourceType']) {
  switch (sourceType) {
    case 'client-review':
      return '客户修改'
    case 'approval-decision':
      return '审批反馈'
    case 'director-note':
      return '导演阻塞批注'
    default:
      return sourceType
  }
}

function severityMeta(severity: ReviewResolutionItem['severity']) {
  if (severity === 'strong') return { label: 'High', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' }
  if (severity === 'warning') return { label: 'Watch', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' }
  return { label: 'Info', cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300' }
}

function statusMeta(status: ReviewResolutionStatus) {
  switch (status) {
    case 'in-progress':
      return { label: '处理中', cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300' }
    case 'resolved':
      return { label: '已解决', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' }
    case 'resubmitted':
      return { label: '已重新提交', cls: 'border-sky-500/25 bg-sky-500/10 text-sky-300' }
    default:
      return { label: '待处理', cls: 'border-white/10 bg-white/5 text-white/70' }
  }
}

function SummaryTile({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/8 bg-black/10'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

const ASSIGNABLE_ROLES: ProjectRole[] = ['producer', 'creator', 'director', 'editor', 'cinematographer', 'client']

function taskStatusMeta(status: TaskStatus) {
  switch (status) {
    case 'doing':
      return { label: '任务进行中', cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300' }
    case 'done':
      return { label: '任务已完成', cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' }
    default:
      return { label: '任务待处理', cls: 'border-white/10 bg-white/5 text-white/70' }
  }
}

export function ResolutionLoopPanel({
  items,
  summary,
  canAssign,
  canManageResubmission,
  canUpdateResolution,
  assigneeOptions,
  tasksById,
  canCreateTask,
  onAssign,
  onCreateTask,
  onMarkInProgress,
  onMarkResolved,
  onMarkResubmitted,
  onMarkLinkedResolutionInProgress,
  onMarkLinkedResolutionResolved,
}: {
  items: ReviewResolutionItem[]
  summary: ReviewResolutionSummary
  canAssign: boolean
  canManageResubmission: boolean
  canUpdateResolution: (item: ReviewResolutionItem) => boolean
  assigneeOptions: Array<{ id: string; label: string }>
  tasksById: Record<string, Task | undefined>
  canCreateTask: boolean
  onAssign: (id: string, assignedRole: ProjectRole, assignedUserId?: string) => void
  onCreateTask: (id: string) => void
  onMarkInProgress: (id: string) => void
  onMarkResolved: (id: string) => void
  onMarkResubmitted: (id: string) => void
  onMarkLinkedResolutionInProgress: (taskId: string) => void
  onMarkLinkedResolutionResolved: (taskId: string) => void
}) {
  const feedback = useFeedback()
  const [drafts, setDrafts] = useState<Record<string, { assignedRole: ProjectRole; assignedUserId: string }>>({})

  const sortedItems = useMemo(
    () => items.slice().sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    [items],
  )

  return (
    <section id="resolution-loop" className="mt-8 rounded-[28px] p-6" style={{ background: 'rgba(9,14,24,0.82)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          eyebrow="Resolution Loop"
          title="待处理修改闭环"
          description="这里把客户 changes requested、reject 和导演 blocker note 收成统一修改项。系统只做摘要、状态聚合和负责人提示，不会自动关闭、自动重提或自动代客户确认。"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <SummaryTile label="Open" value={summary.openCount} tone={summary.openCount > 0 ? 'warning' : 'default'} />
        <SummaryTile label="In Progress" value={summary.inProgressCount} tone={summary.inProgressCount > 0 ? 'warning' : 'default'} />
        <SummaryTile label="Resolved" value={summary.resolvedCount} />
        <SummaryTile label="Strong" value={summary.strongCount} tone={summary.strongCount > 0 ? 'danger' : 'default'} />
        <SummaryTile label="Resubmitted" value={summary.resubmittedCount} />
      </div>

      <div className="mt-5 space-y-4">
        {sortedItems.length === 0 ? (
          <EmptyState
            title="暂无修改项"
            message="当前没有待处理修改项。"
          />
        ) : sortedItems.map((item) => {
          const severity = severityMeta(item.severity)
          const status = statusMeta(item.status)
          const linkedTask = item.relatedTaskId ? tasksById[item.relatedTaskId] : undefined
          const linkedTaskMeta = linkedTask ? taskStatusMeta(linkedTask.status) : null
          const consistencyIssues = getResolutionTaskConsistency(item, linkedTask)
          const draft = drafts[item.id] ?? {
            assignedRole: item.assignedRole,
            assignedUserId: item.assignedUserId ?? '',
          }

          return (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                    <span>{sourceLabel(item.sourceType)}</span>
                    <span>·</span>
                    <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">{item.title}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={severity.label} tone={item.severity === 'strong' ? 'danger' : item.severity === 'warning' ? 'warning' : 'info'} />
                  <StatusBadge label={status.label} tone={item.status === 'resolved' ? 'success' : item.status === 'resubmitted' ? 'info' : item.status === 'in-progress' ? 'warning' : 'default'} className="normal-case tracking-normal" />
                </div>
              </div>

              <p className="mt-3 text-sm text-white/65">{item.description}</p>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45">
                <span>负责人角色：{getProjectRoleLabel(item.assignedRole)}</span>
                <span>负责人：{item.assignedUserId || '待分配'}</span>
                {item.relatedTaskId ? <span>关联任务：{item.relatedTaskId}</span> : <span>尚未创建任务</span>}
                {item.relatedVersionId ? <span>关联版本：{item.relatedVersionId}</span> : null}
                {item.resubmittedAt ? <span>重新提交：{new Date(item.resubmittedAt).toLocaleString('zh-CN')}</span> : null}
              </div>

              {linkedTaskMeta ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${linkedTaskMeta.cls}`}>
                    {linkedTaskMeta.label}
                  </span>
                  <span className="text-xs text-white/45">{linkedTask?.title}</span>
                </div>
              ) : null}

              {consistencyIssues.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {consistencyIssues.map((issue) => (
                    <div
                      key={`${item.id}-${issue.type}`}
                      className={`rounded-xl border px-3 py-2 text-[11px] ${
                        issue.severity === 'strong'
                          ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
                          : 'border-amber-500/25 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              ) : null}

              {canAssign ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1fr_auto]">
                  <select
                    value={draft.assignedRole}
                    onChange={(event) => setDrafts((prev) => ({
                      ...prev,
                      [item.id]: {
                        ...draft,
                        assignedRole: event.target.value as ProjectRole,
                      },
                    }))}
                    className="rounded-xl px-3 py-2 text-[11px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.76)' }}
                  >
                    {ASSIGNABLE_ROLES.map((role) => (
                      <option key={role} value={role}>{getProjectRoleLabel(role)}</option>
                    ))}
                  </select>
                  <select
                    value={draft.assignedUserId}
                    onChange={(event) => setDrafts((prev) => ({
                      ...prev,
                      [item.id]: {
                        ...draft,
                        assignedUserId: event.target.value,
                      },
                    }))}
                    className="rounded-xl px-3 py-2 text-[11px] outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.76)' }}
                  >
                    <option value="">未指定负责人</option>
                    {assigneeOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      onAssign(item.id, draft.assignedRole, draft.assignedUserId || undefined)
                      feedback.success('负责人已更新')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    分配负责人
                  </button>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {canCreateTask && !item.relatedTaskId ? (
                  <button
                    onClick={() => {
                      onCreateTask(item.id)
                      feedback.success('已创建关联任务')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.22)', color: '#d8b4fe' }}
                  >
                    创建任务
                  </button>
                ) : null}
                {linkedTask ? (
                  <a
                    href="/me#personal-command-center"
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    查看任务
                  </a>
                ) : null}
                {canUpdateResolution(item) && item.status === 'open' ? (
                  <button
                    onClick={() => {
                      onMarkInProgress(item.id)
                      feedback.info('修改项已标记为处理中')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)', color: '#fcd34d' }}
                  >
                    标记处理中
                  </button>
                ) : null}
                {linkedTask && canUpdateResolution(item) && linkedTask.status !== 'done' ? (
                  <button
                    onClick={() => {
                      onMarkLinkedResolutionInProgress(linkedTask.id)
                      feedback.info('已按任务状态回写为处理中')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.16)', color: '#fde68a' }}
                  >
                    按任务回写处理中
                  </button>
                ) : null}
                {canUpdateResolution(item) && item.status !== 'resolved' && item.status !== 'resubmitted' ? (
                  <button
                    onClick={() => {
                      onMarkResolved(item.id)
                      feedback.success('修改项已标记为已解决')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)', color: '#6ee7b7' }}
                  >
                    标记已解决
                  </button>
                ) : null}
                {linkedTask && canUpdateResolution(item) ? (
                  <button
                    onClick={() => {
                      onMarkLinkedResolutionResolved(linkedTask.id)
                      feedback.success('已按任务状态回写为已解决')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.16)', color: '#a7f3d0' }}
                  >
                    按任务回写已解决
                  </button>
                ) : null}
                {canManageResubmission && item.status !== 'resubmitted' ? (
                  <button
                    onClick={() => {
                      onMarkResubmitted(item.id)
                      feedback.success('修改项已标记为已重新提交')
                    }}
                    className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                    style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.22)', color: '#93c5fd' }}
                  >
                    标记已重新提交
                  </button>
                ) : null}
                {!canAssign && !canUpdateResolution(item) && !canManageResubmission ? (
                  <span className="rounded-xl border border-white/8 px-3 py-2 text-[11px] text-white/45">
                    当前角色仅查看进展，不直接管理内部修改闭环。
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
