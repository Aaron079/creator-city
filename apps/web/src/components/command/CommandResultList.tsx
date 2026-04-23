'use client'

import Link from 'next/link'
import type { CommandResult } from '@/lib/command/palette'

function kindMeta(kind: CommandResult['kind']) {
  switch (kind) {
    case 'project':
      return 'Project'
    case 'page':
      return 'Page'
    case 'notification':
      return 'Notice'
    case 'action':
    default:
      return 'Action'
  }
}

export function CommandResultList({
  results,
  selectedIndex,
  onHover,
  onSelect,
}: {
  results: CommandResult[]
  selectedIndex: number
  onHover: (index: number) => void
  onSelect: (result: CommandResult) => void
}) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-white/45">
        没找到匹配入口。试试项目名、角色、阶段、review、delivery 或 invitation。
      </div>
    )
  }

  return (
    <div className="max-h-[28rem] overflow-y-auto px-3 py-3">
      <div className="space-y-2">
        {results.map((result, index) => {
          const active = index === selectedIndex
          return (
            <Link
              key={result.id}
              href={result.href}
              onMouseEnter={() => onHover(index)}
              onClick={() => onSelect(result)}
              className={`flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 transition ${
                active
                  ? 'border-white/20 bg-white/[0.08]'
                  : 'border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {kindMeta(result.kind)}
                  </span>
                  {result.role ? <span className="text-[11px] text-white/35">{result.role}</span> : null}
                </div>
                <div className="mt-2 truncate text-sm font-medium text-white">{result.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-white/45">{result.subtitle}</div>
              </div>
              <div className="shrink-0 text-[11px] text-white/30">↵</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
