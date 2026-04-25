'use client'

import type { ToolProviderGroup } from '@/lib/tools/provider-status'

interface ProviderCategoryRailProps {
  groups: ToolProviderGroup[]
  activeId: string
  onSelect: (id: string) => void
}

export function ProviderCategoryRail({ groups, activeId, onSelect }: ProviderCategoryRailProps) {
  return (
    <nav className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const active = group.id === activeId
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelect(group.id)}
            className={`rounded-full border px-3 py-2 text-[11px] transition ${
              active
                ? 'border-white/18 bg-white/[0.09] text-white'
                : 'border-white/10 bg-white/[0.035] text-white/54 hover:border-white/18 hover:text-white/76'
            }`}
          >
            {group.title}
            <span className="ml-2 text-white/36">{group.entries.length}</span>
          </button>
        )
      })}
    </nav>
  )
}
