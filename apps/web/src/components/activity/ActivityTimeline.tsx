'use client'

import Link from 'next/link'
import { getActivityHref, getActivityTypeLabel, type ActivityLogItem, type ActivitySummary } from '@/lib/activity/aggregate'

function SummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning' | 'strong'
}) {
  const cls = tone === 'strong'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/2'

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: ActivityLogItem['severity'] }) {
  const meta = severity === 'strong'
    ? { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300', label: 'Strong' }
    : severity === 'warning'
      ? { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: 'Warning' }
      : { cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300', label: 'Info' }

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>{meta.label}</span>
}

export function ActivityTimeline({
  items,
  summary,
}: {
  items: ActivityLogItem[]
  summary: ActivitySummary
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryTile label="Total" value={summary.totalCount} />
        <SummaryTile label="Today" value={summary.todayCount} />
        <SummaryTile label="Approvals" value={summary.approvalCount} />
        <SummaryTile label="Delivery" value={summary.deliveryCount} />
        <SummaryTile label="Warnings" value={summary.warningCount} tone={summary.warningCount > 0 ? 'warning' : 'default'} />
        <SummaryTile label="Strong" value={summary.strongCount} tone={summary.strongCount > 0 ? 'strong' : 'default'} />
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前还没有可展示的审计与活动记录。
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-medium text-white">{getActivityTypeLabel(item.type)}</div>
                  <SeverityBadge severity={item.severity} />
                </div>
                <div className="mt-2 text-sm text-white/70">{item.message}</div>
                <div className="mt-2 text-xs text-white/45">
                  {item.actorName} · 项目 {item.projectId}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
                <Link
                  href={getActivityHref(item)}
                  className="mt-3 inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                >
                  查看上下文
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
