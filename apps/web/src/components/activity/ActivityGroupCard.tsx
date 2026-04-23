'use client'

import Link from 'next/link'
import { getActivityHref, getActivityTypeLabel, type ActivityGroup, type ActivityLogItem } from '@/lib/activity/aggregate'

function SeverityBadge({ severity }: { severity: ActivityLogItem['severity'] }) {
  const meta = severity === 'strong'
    ? { cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300', label: 'Strong' }
    : severity === 'warning'
      ? { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300', label: 'Warning' }
      : { cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300', label: 'Info' }

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>{meta.label}</span>
}

export function ActivityGroupCard({ group }: { group: ActivityGroup }) {
  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{
        borderColor: group.isImportant ? 'rgba(244,114,182,0.22)' : 'rgba(255,255,255,0.08)',
        background: group.isImportant ? 'rgba(244,114,182,0.05)' : 'rgba(0,0,0,0.10)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{group.projectTitle}</div>
          <div className="mt-1 text-xs text-white/45">
            {new Date(group.latestAt).toLocaleString('zh-CN')} · {group.items.length} 条活动
          </div>
        </div>
        {group.isImportant ? (
          <span className="inline-flex rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">
            Important
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-white">{getActivityTypeLabel(item.type)}</div>
                  <SeverityBadge severity={item.severity} />
                </div>
                <div className="mt-2 text-sm text-white/70">{item.message}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                  <span>{item.actorName}</span>
                  {item.actorRole ? <span>· {item.actorRole}</span> : null}
                  {item.relatedRole ? <span>· 关联角色 {item.relatedRole}</span> : null}
                  <span>· {new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
              {item.actionHref && item.actionLabel ? (
                <Link
                  href={getActivityHref(item)}
                  className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                >
                  {item.actionLabel}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
