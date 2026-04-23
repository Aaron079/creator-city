'use client'

import { useMemo, useState } from 'react'
import { buildActivityGroups, type ActivityFilter, type ActivityLogItem, type ActivitySummary } from '@/lib/activity/aggregate'
import { ActivityFilterBar } from '@/components/activity/ActivityFilterBar'
import { ActivityGroupCard } from '@/components/activity/ActivityGroupCard'
import { ActivitySummaryBar } from '@/components/activity/ActivitySummaryBar'

export function ActivityTimeline({
  items,
  summary,
}: {
  items: ActivityLogItem[]
  summary: ActivitySummary
}) {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const groups = useMemo(
    () => buildActivityGroups(items, filter),
    [filter, items],
  )

  return (
    <div className="space-y-4">
      <ActivitySummaryBar summary={summary} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">时间线筛选</div>
          <div className="mt-1 text-xs text-white/45">按团队、审批、交付、通知等 section 快速查看活动链路。</div>
        </div>
        <ActivityFilterBar value={filter} onChange={setFilter} />
      </div>

      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
            当前筛选条件下还没有可展示的活动记录。
          </div>
        ) : groups.map((group) => (
          <ActivityGroupCard key={group.key} group={group} />
        ))}
      </div>
    </div>
  )
}
