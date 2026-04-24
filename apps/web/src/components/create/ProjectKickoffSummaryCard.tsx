'use client'

import Link from 'next/link'
import type { ProjectKickoffSummary } from '@/lib/projects/kickoff'

export function ProjectKickoffSummaryCard({
  summary,
}: {
  summary: ProjectKickoffSummary
}) {
  return (
    <section id="project-kickoff-summary" className="px-5 pt-3">
      <div
        className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5"
        style={{ boxShadow: '0 18px 46px rgba(0,0,0,0.18)', backdropFilter: 'blur(18px)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Kickoff Summary</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">这项目建议先这样起步</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/55">
              这是一张项目启动建议单，只帮你把模板、角色、先做什么和风险重点收清楚，不会替你自动生成任务或审批流。
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
            <div className="text-[11px] text-white/45">当前模板</div>
            <div className="mt-1 text-sm font-semibold text-white">{summary.templateName}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/40">{summary.templateCategory}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Project Summary</div>
              <div className="mt-2 text-lg font-semibold text-white">{summary.projectTitle}</div>
              <p className="mt-3 text-sm leading-[1.8] text-white/60">{summary.summary}</p>
              <div className="mt-4 rounded-2xl border border-indigo-500/18 bg-indigo-500/8 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-indigo-300/90">AI 启动摘要</div>
                <div className="mt-2 text-sm text-white/80">{summary.aiSummary}</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">推荐先做的 3 步</div>
              <div className="mt-3 space-y-3">
                {summary.recommendedFirstSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[11px] text-white/55">
                      {index + 1}
                    </div>
                    <div className="text-sm leading-[1.7] text-white/72">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">推荐角色</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.recommendedRoles.map((role) => (
                  <span key={role} className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/15 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">推荐交付形式</div>
              <div className="mt-3 space-y-2 text-sm text-white/68">
                {summary.recommendedOutputs.map((item) => <div key={item}>• {item}</div>)}
              </div>
            </div>

            <div className="rounded-[24px] border border-amber-500/18 bg-amber-500/8 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300/90">风险重点</div>
              <div className="mt-3 space-y-2 text-sm text-amber-100/85">
                {summary.riskFocus.map((item) => <div key={item}>• {item}</div>)}
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Next Suggested Action</div>
                <div className="mt-2 text-sm text-white/78">{summary.nextSuggestedAction}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {summary.quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
            >
              <div className="font-medium text-white">{action.label}</div>
              <div className="mt-1 text-xs text-white/45">{action.detail}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
