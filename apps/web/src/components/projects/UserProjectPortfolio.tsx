'use client'

import Link from 'next/link'
import { buildCrossProjectEntryData } from '@/lib/projects/entry-layer'
import type { UserProjectCard, WorkspacePortfolioData } from '@/lib/projects/workspace'
import { PersonalQueueCard, RiskOrWaitingCard, StatusSummaryCard } from '@/components/projects/EntrySummaryCards'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'

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
        {[
          { label: 'Stage', value: item.stage },
          { label: 'Readiness', value: item.readiness },
          { label: 'Pending', value: item.pendingCount },
          { label: 'Delivery', value: item.deliveryStatus },
        ].map((metric) => (
          <div key={`${item.projectId}-${metric.label}`} className="rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
            <div className="text-xs text-white/45">{metric.label}</div>
            <div className="mt-2 text-lg font-semibold text-white">{metric.value}</div>
          </div>
        ))}
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
  const entryData = buildCrossProjectEntryData({
    portfolio: data,
    queue: {
      items: [],
      priorityQueue: [],
      summary: {
        totalCount: 0,
        dueSoonCount: 0,
        invitationCount: 0,
        approvalCount: 0,
        taskCount: 0,
        deliveryCount: 0,
        strongCount: 0,
        blockedCount: 0,
      },
      aiSummary: {
        topPriorities: [],
        mostDangerousProject: '',
        mostDelayedArea: '',
      },
    },
    invitationCount: 0,
    queueHref: '/me#personal-command-center',
  })

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <SectionHeader
        eyebrow="Cross-Project Overview"
        title={title ?? 'My Projects / My Portfolio'}
        description={subtitle ?? '按你当前在项目中的角色，把跨项目风险、待处理项和快捷入口收成一个统一总览。'}
      />

      <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <StatusSummaryCard
            title="Status Summary"
            subtitle="跨项目用同一套指标看等待我处理、高风险、审批和交付状态。"
            metrics={entryData.statusMetrics}
          />
          <RiskOrWaitingCard
            title="Risk / Waiting"
            subtitle="先看最值得切换去处理的项目。"
            items={entryData.waitingItems}
          />
        </div>
        <PersonalQueueCard
          title="Recent Projects"
          subtitle="最近项目也统一用同一套入口行表达方式。"
          items={entryData.recentItems}
        />
      </div>

      <div className="mt-6 space-y-4">
        {data.cards.length === 0 ? (
          <EmptyState
            title="暂无项目"
            message="当前没有可进入的 active 项目。你可以先从邀请页、项目列表或 Producer 邀请流程进入新项目。"
            actionHref="/me#invitation-inbox"
            actionLabel="查看邀请页"
          />
        ) : data.cards.map((item) => (
          <ProjectCard key={item.projectId} item={item} />
        ))}
      </div>
    </section>
  )
}
