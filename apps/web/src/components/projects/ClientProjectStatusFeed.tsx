'use client'

import Link from 'next/link'
import type { ClientProjectStatusFeedData } from '@/lib/projects/client-feed'

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'danger' | 'ready'
}) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : tone === 'ready'
        ? 'border-emerald-500/20 bg-emerald-500/8'
        : 'border-white/8 bg-black/10'
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

function ActivitySeverityBadge({ severity }: { severity: 'info' | 'warning' | 'strong' }) {
  const cls = severity === 'strong'
    ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
    : severity === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      : 'border-sky-500/25 bg-sky-500/10 text-sky-300'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{severity}</span>
}

export function ClientProjectStatusFeed({ data }: { data: ClientProjectStatusFeedData }) {
  return (
    <section className="space-y-6">
      <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">Client Project Status Feed</h2>
            <p className="mt-2 text-sm text-white/58">
              这里不会展示内部任务调度或团队管理动作，只保留对你有意义的项目阶段、交付状态、修改进度和是否等待你处理。
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            data.summary.waitingForClientAction
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          }`}>
            {data.summary.waitingForClientAction ? '需要你处理' : '团队处理中'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <Metric label="阶段" value={data.summary.stage} />
          <Metric label="最新版本" value={data.summary.latestVersion} />
          <Metric label="交付状态" value={data.summary.deliveryStatus} tone={data.summary.deliveryStatus === 'needs-revision' ? 'warning' : 'default'} />
          <Metric label="待处理修改" value={data.summary.openResolutions} tone={data.summary.openResolutions > 0 ? 'warning' : 'default'} />
          <Metric label="已解决 / 已重提" value={data.summary.resolvedResolutions} tone={data.summary.resolvedResolutions > 0 ? 'ready' : 'default'} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">Current Action</h3>
            <p className="mt-2 text-base font-semibold text-white">{data.currentAction?.title}</p>
            <p className="mt-2 text-sm text-white/60">{data.currentAction?.message}</p>
          </div>
          {data.currentAction ? (
            <Link
              href={data.currentAction.actionHref}
              className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
            >
              {data.currentAction.actionLabel}
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Open" value={data.resolutionSnapshot.open} tone={data.resolutionSnapshot.open > 0 ? 'warning' : 'default'} />
          <Metric label="In Progress" value={data.resolutionSnapshot.inProgress} />
          <Metric label="Resolved / Resubmitted" value={data.resolutionSnapshot.resolved + data.resolutionSnapshot.resubmitted} tone={data.resolutionSnapshot.resubmitted > 0 ? 'ready' : 'default'} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {data.activities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
              当前还没有新的客户可见项目变化。
            </div>
          ) : data.activities.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/55">{item.message}</div>
                  <div className="mt-2 text-xs text-white/40">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActivitySeverityBadge severity={item.severity} />
                  {item.actionHref && item.actionLabel ? (
                    <Link
                      href={item.actionHref}
                      className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                    >
                      {item.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">AI Summary</h3>
        <div className="mt-4 space-y-3 text-sm text-white/70">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">{data.aiSummary.currentState}</div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">{data.aiSummary.recentChanges}</div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">{data.aiSummary.nextActionHint}</div>
        </div>
      </section>
    </section>
  )
}
