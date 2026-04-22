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

function PlanningAlertBadge({ severity }: { severity: 'strong' | 'warning' | 'info' }) {
  const meta = severity === 'strong'
    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    : severity === 'warning'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta}`}>{severity}</span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Production Planning</div>
          <div className="mt-1 text-sm text-white/55">
            只服务于 dashboard 内的制片排期与执行判断，不会扩散成平台全局设置。
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

      <div className="grid gap-3">
        {planning.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前没有可排期的项目。
          </div>
        ) : planning.projects.map((project) => (
          <div key={project.projectId} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">{project.title}</div>
                <div className="mt-1 text-sm text-white/55">
                  阶段 {project.currentStage} · Target Delivery {project.targetDeliveryAt}
                </div>
              </div>
              <div className="text-right text-sm text-white/55">
                <div>Owner: {project.primaryOwner}</div>
                <div>Buffer: {project.bufferDays} days</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/65">
              <span>Blockers {project.blockerCount}</span>
              <span>Pending approvals {project.pendingApprovalCount}</span>
              <span>Strong risks {project.strongRiskCount}</span>
              <span>Status {project.readinessStatus}</span>
            </div>
            <div className="mt-3 text-sm text-white/70">{project.nextFocus}</div>
          </div>
        ))}
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
              <PlanningAlertBadge severity={alert.severity} />
            </div>
            <div className="mt-2 text-sm text-white/65">{alert.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
