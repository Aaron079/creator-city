'use client'

import Link from 'next/link'
import type { ProducerDashboardData } from '@/lib/dashboard/aggregate'
import type { DashboardActionSeverity } from '@/lib/dashboard/actions'
import { PlanningPanel } from '@/components/dashboard/PlanningPanel'

function Card({
  title,
  id,
  children,
}: {
  title: string
  id?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-city-border bg-city-surface/60 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: 'blocked' | 'needs-review' | 'ready' }) {
  const meta = status === 'ready'
    ? { label: 'Ready', cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20' }
    : status === 'blocked'
      ? { label: 'Blocked', cls: 'bg-rose-500/12 text-rose-300 border-rose-500/20' }
      : { label: 'Needs Review', cls: 'bg-amber-500/12 text-amber-300 border-amber-500/20' }
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
}

function ActionSeverityBadge({ severity }: { severity: DashboardActionSeverity }) {
  const meta = severity === 'strong'
    ? { label: 'High', cls: 'border-rose-500/30 bg-rose-500/10 text-rose-300' }
    : severity === 'warning'
      ? { label: 'Watch', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' }
      : { label: 'Info', cls: 'border-sky-500/30 bg-sky-500/10 text-sky-300' }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.cls}`}>{meta.label}</span>
}

function MetricTile({ label, value, tone = 'default' }: { label: string; value: number | string; tone?: 'default' | 'danger' | 'warning' }) {
  const cls = tone === 'danger'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/2'
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

export function ProducerDashboard({ data }: { data: ProducerDashboardData }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-city-accent-glow/70">Producer Command Center</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Producer Dashboard v2</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            这里是总控台，只聚合现有工作流状态、风险与优先级，不会自动推进项目、自动确认或自动交付。
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Overview</div>
          <div className="mt-1 text-2xl font-semibold text-white">{data.totalProjects}</div>
          <div className="text-sm text-white/55">当前纳入监控的项目</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card title="Overview" id="overview">
          <div className="space-y-3">
            {data.overview.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                当前还没有可以展示的项目。
              </div>
            ) : data.overview.map((project) => (
              <div key={project.projectId} id={`project-${project.projectId}`} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">{project.title}</div>
                    <div className="mt-1 text-sm text-white/55">
                      阶段 {project.currentStage} {project.nextStage ? `· 下一阶段 ${project.nextStage}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={project.readinessStatus} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <MetricTile label="Blockers" value={project.blockerCount} tone={project.blockerCount > 0 ? 'danger' : 'default'} />
                  <MetricTile label="Pending approvals" value={project.pendingApprovalCount} tone={project.pendingApprovalCount > 0 ? 'warning' : 'default'} />
                  <MetricTile label="Delivery" value={project.deliveryStatus} tone={project.strongRiskCount > 0 ? 'warning' : 'default'} />
                  <MetricTile label="Order" value={project.orderStatus} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/65">
                  <span>可推进：{project.canAdvance ? '是' : '否'}</span>
                  <span>Strong risks：{project.strongRiskCount}</span>
                  <span>Unknown licenses：{project.unknownLicenseCount}</span>
                  <span>客户确认：{project.submittedForClient ? '已提交' : '未提交'}</span>
                </div>
                <p className="mt-3 text-sm text-white/65">{project.readinessReason}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={project.links.review} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white">
                    打开审片页
                  </Link>
                  <Link href={project.links.create} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white">
                    打开工作区
                  </Link>
                  <Link href={project.links.delivery} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white">
                    交付工作区
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="AI Summary">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500">当前最需要处理的 3 个问题</div>
                <ul className="mt-2 space-y-2 text-sm text-white/75">
                  {data.aiSummary.topIssues.map((issue) => (
                    <li key={issue} className="rounded-xl border border-white/6 px-3 py-2">{issue}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-white/6 px-3 py-2 text-sm text-white/70">
                <div className="text-xs text-gray-500">最接近阻塞的环节</div>
                <div className="mt-1">{data.aiSummary.nearestBlocker}</div>
              </div>
              <div className="rounded-xl border border-white/6 px-3 py-2 text-sm text-white/70">
                <div className="text-xs text-gray-500">最适合推进的动作</div>
                <div className="mt-1">{data.aiSummary.recommendedAction}</div>
              </div>
            </div>
          </Card>

          <Card title="Quick Actions" id="quick-actions">
            <div className="space-y-3">
              {data.quickActions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有需要立刻处理的动作。
                </div>
              ) : data.quickActions.map((action) => (
                <Link
                  key={action.id}
                  href={action.href}
                  className="block rounded-xl border border-white/8 bg-black/10 px-4 py-3 transition hover:border-white/18 hover:bg-black/20"
                >
                  <div className="text-sm font-medium text-white">{action.label}</div>
                  <div className="mt-1 text-sm text-white/55">{action.description}</div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card title="Action Queue" id="action-queue">
          <div className="space-y-3">
            {data.actionQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                当前没有需要优先处理的动作队列。
              </div>
            ) : data.actionQueue.map((action) => (
              <div key={action.id} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-white/45">{action.projectTitle}</div>
                    <div className="mt-1 text-base font-semibold text-white">{action.title}</div>
                  </div>
                  <ActionSeverityBadge severity={action.severity} />
                </div>
                <p className="mt-3 text-sm text-white/65">{action.detail}</p>
                <div className="mt-4">
                  <Link
                    href={action.href}
                    className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                  >
                    {action.ctaLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Risk Radar" id="risk-radar">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Stale approvals" value={data.riskRadar.staleApprovals} tone={data.riskRadar.staleApprovals > 0 ? 'warning' : 'default'} />
            <MetricTile label="Unknown licenses" value={data.riskRadar.unknownLicenses} tone={data.riskRadar.unknownLicenses > 0 ? 'danger' : 'default'} />
            <MetricTile label="Open blocker notes" value={data.riskRadar.openBlockerNotes} tone={data.riskRadar.openBlockerNotes > 0 ? 'danger' : 'default'} />
            <MetricTile label="Strong audio risk" value={data.riskRadar.strongAudioRisk} tone={data.riskRadar.strongAudioRisk > 0 ? 'warning' : 'default'} />
            <MetricTile label="Strong clip risk" value={data.riskRadar.strongClipRisk} tone={data.riskRadar.strongClipRisk > 0 ? 'warning' : 'default'} />
          </div>
          <div className="mt-4 rounded-xl border border-white/8 bg-black/10 px-4 py-4 text-sm text-white/65">
            Risk Radar 只做风险归并与优先级提醒，不会自动替你推进阶段、提交客户确认或交付项目。
          </div>
        </Card>
      </div>

      <Card title="Production Planning" id="planning">
        <PlanningPanel data={data} />
      </Card>

      <Card title="Recent Activity">
        <div className="space-y-3">
          {data.activity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">当前还没有可展示的活动摘要。</div>
          ) : data.activity.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/6 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">{item.title}</div>
                <div className="text-[11px] text-gray-500">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
              </div>
              <div className="mt-1 text-sm text-white/60">{item.detail}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
