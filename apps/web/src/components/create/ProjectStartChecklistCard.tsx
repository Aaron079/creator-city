'use client'

import Link from 'next/link'
import type { ProjectStartChecklist } from '@/lib/projects/start-checklist'
import { useFeedback } from '@/lib/feedback/useFeedback'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'

function statusMeta(status: ProjectStartChecklist['items'][number]['status']) {
  switch (status) {
    case 'done':
      return {
        label: 'Done',
        tone: 'success' as const,
      }
    case 'ready':
      return {
        label: 'Ready',
        tone: 'info' as const,
      }
    case 'todo':
    default:
      return {
        label: 'Todo',
        tone: 'warning' as const,
      }
  }
}

export function ProjectStartChecklistCard({
  checklist,
  onToggleDone,
}: {
  checklist: ProjectStartChecklist
  onToggleDone: (itemId: string, nextDone: boolean) => void
}) {
  const feedback = useFeedback()

  return (
    <section id="project-start-checklist" className="px-5 pt-3">
      <div
        className="rounded-[32px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-3xl"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 28px 70px rgba(0,0,0,0.3)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            eyebrow="Start Checklist"
            title="项目启动检查单"
            description="系统会自动判断哪些条件已经具备，但不会替你打勾。只有你手动确认后，检查项才会进入 Done。"
          />
          <div className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-3 backdrop-blur-2xl">
            <div className="text-[11px] text-white/45">准备度摘要</div>
            <div className="mt-2 text-sm text-white/75">
              Ready {checklist.summary.readyCount} / Done {checklist.summary.doneCount}
            </div>
            <div className="mt-1 text-xs text-white/45">
              Blocking {checklist.summary.blockingCount} · 共 {checklist.summary.totalCount} 项
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-3">
            {checklist.items.map((item) => {
              const meta = statusMeta(item.status)
              return (
                <div key={item.id} className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={meta.label} tone={meta.tone} className="px-2 py-0.5 text-[10px]" />
                        <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">{item.category}</span>
                        {item.isBlocking ? <span className="text-[11px] text-rose-300/90">Blocking</span> : null}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">{item.label}</div>
                      <div className="mt-1 text-sm leading-[1.7] text-white/60">{item.description}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextDone = item.status !== 'done'
                        onToggleDone(item.id, nextDone)
                        feedback.success(nextDone ? '启动检查项已标记完成' : '启动检查项已恢复为未完成')
                      }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/72 backdrop-blur-2xl transition hover:border-white/20 hover:text-white"
                    >
                      {item.status === 'done' ? '撤销完成' : '标记完成'}
                    </button>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={item.actionHref}
                      className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 backdrop-blur-2xl transition hover:border-white/20 hover:text-white"
                    >
                      {item.actionLabel}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Next Required Step</div>
              <div className="mt-2 text-lg font-semibold text-white">{checklist.summary.nextRequiredStep}</div>
              <div className="mt-3 text-sm leading-[1.8] text-white/60">{checklist.summary.aiSummary}</div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-black/20 p-4 backdrop-blur-2xl">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Checklist Notes</div>
              <div className="mt-3 space-y-2 text-sm text-white/65">
                <div>• `todo` 代表当前条件还不够。</div>
                <div>• `ready` 代表系统判断它已经具备条件，但还没经过你手动确认。</div>
                <div>• `done` 只会在你自己点击后出现。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
