'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProducerDashboardData } from '@/lib/dashboard/aggregate'
import {
  buildProducerPlanningData,
  DEFAULT_PLANNING_SETTINGS,
  loadPlanningSettings,
  savePlanningSettings,
  type PlanningSettings,
  type PlanningWeekday,
  type ProductionConflictSeverity,
  type ProductionMilestone,
  type ProductionScheduleItem,
} from '@/lib/dashboard/planning'

const WEEKDAYS: Array<{ id: PlanningWeekday; label: string }> = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
]

function AlertBadge({ severity }: { severity: ProductionConflictSeverity | 'warning' | 'strong' | 'info' }) {
  const meta = severity === 'strong'
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    : severity === 'warning'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta}`}>{severity}</span>
}

function milestoneStatusMeta(status: ProductionMilestone['status']) {
  switch (status) {
    case 'done':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    case 'blocked':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-300'
    case 'in-progress':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/5 text-white/60'
  }
}

function scheduleStatusMeta(status: ProductionScheduleItem['status']) {
  switch (status) {
    case 'done':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    case 'blocked':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-300'
    case 'at-risk':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
    default:
      return 'border-sky-500/25 bg-sky-500/10 text-sky-300'
  }
}

function findMilestone(milestones: ProductionMilestone[], milestoneId: string) {
  return milestones.find((item) => item.id === milestoneId) ?? null
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

export function PlanningPanel({ data }: { data: ProducerDashboardData }) {
  const [settings, setSettings] = useState<PlanningSettings>(DEFAULT_PLANNING_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    setSettings(loadPlanningSettings())
  }, [])

  useEffect(() => {
    savePlanningSettings(settings)
  }, [settings])

  const planning = useMemo(() => buildProducerPlanningData(data, settings), [data, settings])

  function toggleWorkday(day: PlanningWeekday) {
    setSettings((current) => {
      const workWeek = current.workWeek.includes(day)
        ? current.workWeek.filter((item) => item !== day)
        : [...current.workWeek, day]
      return {
        ...current,
        workWeek: workWeek.length > 0 ? workWeek : current.workWeek,
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Production Planning</div>
          <div className="mt-1 text-sm text-white/55">
            这里只做制片排期、依赖和执行风险聚合，不会自动重排、自动推进阶段或自动指派负责人。
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((value) => !value)}
          className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          {showSettings ? '收起 Settings' : 'Settings'}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
          <div className="text-sm font-medium text-white">AI Planning Summary</div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/8 px-4 py-3">
              <div className="text-xs text-white/45">建议优先处理</div>
              <div className="mt-1 text-sm text-white/75">{planning.aiSummary.nextMilestone}</div>
            </div>
            <div className="rounded-xl border border-white/8 px-4 py-3">
              <div className="text-xs text-white/45">最可能拖慢交付的依赖</div>
              <div className="mt-1 text-sm text-white/75">{planning.aiSummary.riskyDependency}</div>
            </div>
            <div className="rounded-xl border border-white/8 px-4 py-3">
              <div className="text-xs text-white/45">当前最危险的阶段</div>
              <div className="mt-1 text-sm text-white/75">{planning.aiSummary.mostDangerousStage}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
            <div className="text-xs text-white/45">Milestones</div>
            <div className="mt-2 text-2xl font-semibold text-white">{planning.milestones.length}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
            <div className="text-xs text-white/45">Upcoming</div>
            <div className="mt-2 text-2xl font-semibold text-white">{planning.upcoming.length}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
            <div className="text-xs text-white/45">Blocked</div>
            <div className="mt-2 text-2xl font-semibold text-white">{planning.blocked.length}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
            <div className="text-xs text-white/45">Conflicts</div>
            <div className="mt-2 text-2xl font-semibold text-white">{planning.conflicts.length}</div>
          </div>
        </div>
      </div>

      {showSettings ? (
        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Timezone</span>
              <input
                value={settings.timezone}
                onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Target Delivery</span>
              <input
                type="date"
                value={settings.targetDeliveryAt}
                onChange={(event) => setSettings((current) => ({ ...current, targetDeliveryAt: event.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Default Buffer Days</span>
              <input
                type="number"
                min={0}
                max={30}
                value={settings.defaultBufferDays}
                onChange={(event) => setSettings((current) => ({ ...current, defaultBufferDays: Number(event.target.value || 0) }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Pending Approval Alert Threshold</span>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.alertRules.pendingApprovalThreshold}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  alertRules: {
                    ...current.alertRules,
                    pendingApprovalThreshold: Number(event.target.value || 1),
                  },
                }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-sm text-white/65">Work Week</div>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = settings.workWeek.includes(day.id)
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWorkday(day.id)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'
                        : 'border-white/10 bg-black/10 text-white/65 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Default Owner · Production</span>
              <input
                value={settings.defaultOwners.production}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  defaultOwners: {
                    ...current.defaultOwners,
                    production: event.target.value,
                  },
                }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Default Owner · Approvals</span>
              <input
                value={settings.defaultOwners.approvals}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  defaultOwners: {
                    ...current.defaultOwners,
                    approvals: event.target.value,
                  },
                }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-white/65">Default Owner · Delivery</span>
              <input
                value={settings.defaultOwners.delivery}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  defaultOwners: {
                    ...current.defaultOwners,
                    delivery: event.target.value,
                  },
                }))}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">Milestones</div>
            <div className="text-xs text-white/45">默认依赖链：Brief → 分镜 → 视频 → 剪辑 → 声音 → 交付 → 客户确认</div>
          </div>

          <div className="mt-4 space-y-3">
            {planning.milestones.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                当前没有可排期的项目。
              </div>
            ) : planning.milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-xl border border-white/8 bg-black/15 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{milestone.title}</div>
                    <div className="mt-1 text-xs text-white/45">
                      项目 {milestone.projectId} · owner {milestone.ownerRole} · due {formatDate(milestone.dueAt)}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${milestoneStatusMeta(milestone.status)}`}>
                    {milestone.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-white/65">{milestone.description}</div>
                {milestone.dependsOn.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {milestone.dependsOn.map((dependencyId) => {
                      const dependency = findMilestone(planning.milestones, dependencyId)
                      return (
                        <span key={dependencyId} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                          依赖 {dependency?.title ?? dependencyId}
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">This Week / Upcoming</div>
            <div className="mt-4 space-y-3">
              {planning.upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有即将到期的排期项。
                </div>
              ) : planning.upcoming.map((item) => {
                const milestone = findMilestone(planning.milestones, item.milestoneId)
                if (!milestone) return null
                return (
                  <div key={item.id} className="rounded-xl border border-white/8 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{milestone.title}</div>
                        <div className="mt-1 text-xs text-white/45">
                          {milestone.projectId} · {formatDate(item.startAt)} - {formatDate(item.endAt)}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${scheduleStatusMeta(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-white/65">
                      priority {item.priority}{item.riskReason ? ` · ${item.riskReason}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">Blocked</div>
            <div className="mt-4 space-y-3">
              {planning.blocked.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有 blocked milestones。
                </div>
              ) : planning.blocked.map((item) => (
                <div key={item.id} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
                  <div className="text-sm font-medium text-rose-200">{item.title}</div>
                  <div className="mt-1 text-xs text-rose-100/70">
                    项目 {item.projectId} · owner {item.ownerRole} · due {formatDate(item.dueAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
        <div className="text-sm font-medium text-white">Conflicts</div>
        <div className="mt-4 space-y-3">
          {planning.conflicts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
              当前没有新的 planning conflicts。
            </div>
          ) : planning.conflicts.map((conflict) => {
            const milestone = findMilestone(planning.milestones, conflict.relatedMilestoneId)
            return (
              <div key={conflict.id} className="rounded-xl border border-white/8 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{milestone?.title ?? conflict.relatedMilestoneId}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {conflict.type} · 项目 {conflict.relatedProjectId}
                    </div>
                  </div>
                  <AlertBadge severity={conflict.severity} />
                </div>
                <div className="mt-2 text-sm text-white/65">{conflict.message}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-white">Planning Alerts</div>
        {planning.alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前排期观察项稳定，没有新的 planning alerts。
          </div>
        ) : planning.alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border border-white/8 bg-black/10 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">{alert.label}</div>
              <AlertBadge severity={alert.severity} />
            </div>
            <div className="mt-2 text-sm text-white/65">{alert.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
