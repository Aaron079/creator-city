'use client'

import Link from 'next/link'
import { memo } from 'react'
import type { UserProjectCard } from '@/lib/projects/workspace'

function SwitcherSection({
  title,
  items,
}: {
  title: string
  items: UserProjectCard[]
}) {
  if (items.length === 0) return null

  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${title}-${item.projectId}`}
            href={item.quickLinks.find((link) => link.kind === 'home')?.href ?? `/projects/${item.projectId}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-white/35">{item.roleLabel}</span>
            {item.waitingForMe ? <span className="text-amber-300/90">Waiting</span> : null}
          </Link>
        ))}
      </div>
    </div>
  )
}

function WorkspaceSwitcherComponent({
  recentProjects,
  highPriorityProjects,
  waitingProjects,
  compact = false,
}: {
  recentProjects: UserProjectCard[]
  highPriorityProjects: UserProjectCard[]
  waitingProjects: UserProjectCard[]
  compact?: boolean
}) {
  if (compact) {
    return (
      <details className="relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white">
          <span>Projects</span>
          <span className="text-white/35">切换</span>
        </summary>
        <div className="absolute right-0 z-50 mt-3 w-[22rem] rounded-2xl border border-white/10 bg-[#0b1220]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="space-y-4">
            <SwitcherSection title="Waiting For Me" items={waitingProjects.slice(0, 4)} />
            <SwitcherSection title="High Priority" items={highPriorityProjects.slice(0, 4)} />
            <SwitcherSection title="Recent Projects" items={recentProjects.slice(0, 4)} />
          </div>
        </div>
      </details>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Workspace Switcher</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">快速切换项目</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/55">
            把最近项目、高优先级项目和正在等你处理的项目放在同一个入口里，方便你快速切换，不需要再翻多个页面。
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <SwitcherSection title="Waiting For Me" items={waitingProjects} />
        <SwitcherSection title="High Priority" items={highPriorityProjects} />
        <SwitcherSection title="Recent Projects" items={recentProjects} />
      </div>
    </section>
  )
}

export const WorkspaceSwitcher = memo(WorkspaceSwitcherComponent)
