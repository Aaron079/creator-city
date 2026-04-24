'use client'

import Link from 'next/link'
import type { ProjectStartChecklist } from '@/lib/projects/start-checklist'

function statusMeta(status: ProjectStartChecklist['items'][number]['status']) {
  switch (status) {
    case 'done':
      return {
        label: 'Done',
        cls: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
      }
    case 'ready':
      return {
        label: 'Ready',
        cls: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
      }
    case 'todo':
    default:
      return {
        label: 'Todo',
        cls: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
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
  return (
    <section id="project-start-checklist" className="px-5 pt-3">
      <div
        className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5"
        style={{ boxShadow: '0 18px 46px rgba(0,0,0,0.18)', backdropFilter: 'blur(18px)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Start Checklist</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">项目启动检查单</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              系统会自动判断哪些条件已经具备，但不会替你打勾。只有你手动确认后，检查项才会进入 Done。
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
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
                <div key={item.id} className="rounded-[24px] border border-white/8 bg-black/15 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${meta.cls}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">{item.category}</span>
                        {item.isBlocking ? <span className="text-[11px] text-rose-300/90">Blocking</span> : null}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">{item.label}</div>
                      <div className="mt-1 text-sm leading-[1.7] text-white/60">{item.description}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleDone(item.id, item.status !== 'done')}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/72 transition hover:border-white/20 hover:text-white"
                    >
                      {item.status === 'done' ? '撤销完成' : '标记完成'}
                    </button>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={item.actionHref}
                      className="inline-flex rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                    >
                      {item.actionLabel}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Next Required Step</div>
              <div className="mt-2 text-lg font-semibold text-white">{checklist.summary.nextRequiredStep}</div>
              <div className="mt-3 text-sm leading-[1.8] text-white/60">{checklist.summary.aiSummary}</div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
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
