'use client'

import type { ActivityFilter } from '@/lib/activity/aggregate'
import { getActivitySectionLabel } from '@/lib/activity/aggregate'

export function ActivityFilterBar({
  value,
  onChange,
}: {
  value: ActivityFilter
  onChange: (value: ActivityFilter) => void
}) {
  const filters: ActivityFilter[] = ['all', 'team', 'approval', 'delivery', 'notifications']

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className="rounded-xl border px-3 py-2 text-sm transition"
          style={{
            borderColor: value === filter ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.08)',
            background: value === filter ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.03)',
            color: value === filter ? '#c7d2fe' : 'rgba(255,255,255,0.72)',
          }}
        >
          {getActivitySectionLabel(filter)}
        </button>
      ))}
    </div>
  )
}
