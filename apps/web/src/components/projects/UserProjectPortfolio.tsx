'use client'

import Link from 'next/link'
import type { CrossProjectSummary, UserProjectCard, WorkspacePortfolioData } from '@/lib/projects/workspace'

function SummaryTile({
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

function summaryTone(summary: CrossProjectSummary, label: keyof CrossProjectSummary) {
  if (label === 'highRiskCount' && summary.highRiskCount > 0) return 'danger' as const
  if ((label === 'waitingForMeCount' && summary.waitingForMeCount > 0) || (label === 'approvalsPendingCount' && summary.approvalsPendingCount > 0) || (label === 'deliveryPendingCount' && summary.deliveryPendingCount > 0)) {
    return 'warning' as const
  }
  return 'default' as const
}

function riskMeta(level: UserProjectCard['riskLevel']) {
  if (level === 'strong') {
    return { label: 'High Risk', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' }
  }
  if (level === 'warning') {
    return { label: 'Watch', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' }
  }
  return { label: 'Stable', cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300' }
}

function ProjectCard({ item }: { item: UserProjectCard }) {
  const risk = riskMeta(item.riskLevel)

  return (
    <div className="rounded-2xl border border-white/8 bg-black/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
            <span>{item.roleLabel}</span>
            <span>·</span>
            <span>{item.stage}</span>
            {item.waitingForMe ? <span className="text-amber-300/90">Waiting for me</span> : null}
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{item.title}</div>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${risk.cls}`}>
          {risk.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SummaryTile label="Stage" value={item.stage} />
        <SummaryTile label="Readiness" value={item.readiness} tone={item.riskLevel === 'strong' ? 'danger' : item.riskLevel === 'warning' ? 'warning' : 'default'} />
        <SummaryTile label="Pending" value={item.pendingCount} tone={item.pendingCount > 0 ? 'warning' : 'default'} />
        <SummaryTile label="Delivery" value={item.deliveryStatus} tone={item.deliveryStatus === 'needs-revision' ? 'danger' : item.deliveryStatus === 'submitted' || item.deliveryStatus === 'ready' ? 'warning' : 'default'} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.highlights.map((highlight) => (
          <span key={`${item.projectId}-${highlight}`} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55">
            {highlight}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.quickLinks.map((link) => (
          <Link
            key={`${item.projectId}-${link.kind}`}
            href={link.href}
            className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 text-xs text-white/35">
        最近活动：{item.recentActivityAt ? new Date(item.recentActivityAt).toLocaleString('zh-CN') : '暂无记录'}
      </div>
    </div>
  )
}

export function UserProjectPortfolio({
  data,
  title,
  subtitle,
}: {
  data: WorkspacePortfolioData
  title?: string
  subtitle?: string
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Cross-Project Overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title ?? 'My Projects / My Portfolio'}</h2>
          <p className="mt-2 max-w-3xl text-sm text-white/55">
            {subtitle ?? '按你当前在项目中的角色，把跨项目风险、待处理项和快捷入口收成一个统一总览。'}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <SummaryTile label="项目数" value={data.summary.totalProjects} tone={summaryTone(data.summary, 'totalProjects')} />
        <SummaryTile label="等待我处理" value={data.summary.waitingForMeCount} tone={summaryTone(data.summary, 'waitingForMeCount')} />
        <SummaryTile label="高风险项目" value={data.summary.highRiskCount} tone={summaryTone(data.summary, 'highRiskCount')} />
        <SummaryTile label="待审批项目" value={data.summary.approvalsPendingCount} tone={summaryTone(data.summary, 'approvalsPendingCount')} />
        <SummaryTile label="待交付项目" value={data.summary.deliveryPendingCount} tone={summaryTone(data.summary, 'deliveryPendingCount')} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/8 bg-black/10 p-4">
        <div className="text-sm font-medium text-white">AI Priority Summary</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-white/70">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-white/45">最值得先切换</div>
            <div className="mt-1 text-white">{data.aiSummary.bestProjectToOpen}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-white/45">最危险项目</div>
            <div className="mt-1 text-white">{data.aiSummary.mostDangerousProject}</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div className="text-white/45">推荐优先处理</div>
            <div className="mt-1 text-white">{data.aiSummary.recommendedFocus}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {data.cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/8 px-4 py-5 text-sm text-white/45">
            当前还没有 active 项目。你可以先从 Explore、Invitation Inbox 或 Producer 邀请流程进入新项目。
          </div>
        ) : data.cards.map((item) => (
          <ProjectCard key={item.projectId} item={item} />
        ))}
      </div>
    </section>
  )
}
