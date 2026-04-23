'use client'

import Link from 'next/link'
import type { PersonalWorkQueueData, WorkQueueCategory, WorkQueueItem } from '@/lib/workqueue/aggregate'

function severityMeta(severity: WorkQueueItem['severity']) {
  if (severity === 'strong') {
    return {
      label: 'High',
      cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    }
  }

  if (severity === 'warning') {
    return {
      label: 'Watch',
      cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    }
  }

  return {
    label: 'Info',
    cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  }
}

function categoryLabel(category: WorkQueueCategory) {
  switch (category) {
    case 'invitation':
      return '邀请'
    case 'approval':
      return '审批'
    case 'review':
      return '审片'
    case 'delivery':
      return '交付'
    case 'planning':
      return '排期'
    case 'task':
      return '任务'
    case 'licensing':
      return '授权'
    default:
      return category
  }
}

function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number | string
  tone?: 'default' | 'warning' | 'danger'
}) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/[0.03]'

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function QueueCard({ item }: { item: WorkQueueItem }) {
  const meta = severityMeta(item.severity)
  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-white/45">{categoryLabel(item.category)}</span>
            <span className="text-xs text-white/35">{item.projectTitle}</span>
            {item.isBlocking ? <span className="text-xs text-rose-300/90">阻塞</span> : null}
          </div>
          <div className="mt-1 text-base font-semibold text-white">{item.title}</div>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>
          {meta.label}
        </span>
      </div>
      <p className="mt-3 text-sm text-white/65">{item.message}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
        <span>{item.isDone ? '已完成' : '待处理'}</span>
        {item.dueAt ? <span>处理建议前 {new Date(item.dueAt).toLocaleString('zh-CN')}</span> : null}
      </div>
      <div className="mt-4">
        <Link
          href={item.actionHref}
          className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          {item.actionLabel}
        </Link>
      </div>
    </div>
  )
}

export function PersonalCommandCenter({
  queue,
}: {
  queue: PersonalWorkQueueData
}) {
  const categorySections: WorkQueueCategory[] = ['invitation', 'approval', 'task', 'delivery', 'planning', 'licensing', 'review']

  return (
    <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Personal Command Center</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">我的工作台</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/55">
            这里把你最该处理的邀请、审批、任务、交付与风险收成一个个人执行入口。系统只做排序和摘要，不会替你点任何按钮。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-6">
        <MetricTile label="总待处理" value={queue.summary.totalCount} tone={queue.summary.totalCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="邀请" value={queue.summary.invitationCount} tone={queue.summary.invitationCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="待审批" value={queue.summary.approvalCount} tone={queue.summary.approvalCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="任务" value={queue.summary.taskCount} />
        <MetricTile label="交付相关" value={queue.summary.deliveryCount} tone={queue.summary.deliveryCount > 0 ? 'warning' : 'default'} />
        <MetricTile label="高风险" value={queue.summary.strongCount} tone={queue.summary.strongCount > 0 ? 'danger' : 'default'} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-white">Priority Queue</div>
              <div className="text-xs text-white/40">最需要优先处理的若干项</div>
            </div>
            <div className="mt-4 space-y-3">
              {queue.priorityQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有待处理事项。
                </div>
              ) : queue.priorityQueue.map((item) => (
                <QueueCard key={item.id} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">分类清单</div>
            <div className="mt-4 space-y-5">
              {categorySections.map((category) => {
                const items = queue.items.filter((item) => item.category === category)
                if (items.length === 0) return null

                return (
                  <div key={category}>
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/35">
                      {categoryLabel(category)} · {items.length}
                    </div>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <QueueCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
            <div className="text-sm font-medium text-white">AI Priority Summary</div>
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {queue.aiSummary.topPriorities.map((item) => (
                <li key={item} className="rounded-xl border border-white/6 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-white/70">
            <div className="text-xs text-white/40">最危险的项目</div>
            <div className="mt-2 text-white">{queue.aiSummary.mostDangerousProject}</div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-white/70">
            <div className="text-xs text-white/40">最容易延误的环节</div>
            <div className="mt-2 text-white">{queue.aiSummary.mostDelayedArea}</div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/10 p-4 text-sm text-white/60">
            <div className="text-xs text-white/40">执行提醒</div>
            <div className="mt-2">
              这里不会替你接受邀请、批准交付或推进审批。它只负责把需要你处理的事排好顺序。
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
