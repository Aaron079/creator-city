'use client'

import Link from 'next/link'
import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { EntryActionModel, EntryListItemModel, EntryMetricModel } from '@/lib/projects/entry-layer'

function EntryPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">{title}</h2>
        {subtitle ? <p className="mt-2 text-sm text-white/55">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function MetricTile({ metric }: { metric: EntryMetricModel }) {
  const tone = metric.tone ?? 'default'
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/[0.03]'

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-white/45">{metric.label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{metric.value}</div>
    </div>
  )
}

function ActionRow({ action }: { action: EntryActionModel }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{action.label}</div>
          {action.detail ? <div className="mt-1 text-sm text-white/55">{action.detail}</div> : null}
        </div>
        <Link
          href={action.href}
          className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          去处理
        </Link>
      </div>
    </div>
  )
}

function QueueRow({ item }: { item: EntryListItemModel }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{item.title}</div>
          <div className="mt-1 text-sm text-white/55">{item.meta}</div>
        </div>
        <Link
          href={item.href}
          className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          {item.label}
        </Link>
      </div>
    </div>
  )
}

export function StatusSummaryCard({
  title,
  subtitle,
  metrics,
}: {
  title: string
  subtitle?: string
  metrics: EntryMetricModel[]
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricTile key={`${metric.label}-${metric.value}`} metric={metric} />
        ))}
      </div>
    </EntryPanel>
  )
}

export function QuickActionsCard({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions: EntryActionModel[]
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} />
        ))}
      </div>
    </EntryPanel>
  )
}

export function RiskOrWaitingCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string
  subtitle?: string
  items: string[]
  emptyMessage?: string
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            {emptyMessage ?? '当前没有额外提醒。'}
          </div>
        ) : items.map((item) => (
          <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
            {item}
          </div>
        ))}
      </div>
    </EntryPanel>
  )
}

export function PersonalQueueCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string
  subtitle?: string
  items: EntryListItemModel[]
  emptyMessage?: string
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            {emptyMessage ?? '当前没有待处理项。'}
          </div>
        ) : items.map((item) => (
          <QueueRow key={item.id} item={item} />
        ))}
      </div>
    </EntryPanel>
  )
}

export function DeliveryOrApprovalCard({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle?: string
  items: string[]
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
            {item}
          </div>
        ))}
      </div>
    </EntryPanel>
  )
}

export function RecentActivityCard({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle?: string
  items: ActivityLogItem[]
}) {
  return (
    <EntryPanel title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前还没有新的活动。
          </div>
        ) : items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">{item.message}</div>
                <div className="mt-1 text-xs text-white/45">
                  {item.actorName}
                  {item.actorRole ? ` · ${item.actorRole}` : ''}
                  {' · '}
                  {new Date(item.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
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
        ))}
      </div>
    </EntryPanel>
  )
}
