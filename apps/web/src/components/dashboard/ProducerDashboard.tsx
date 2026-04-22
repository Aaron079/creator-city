'use client'

import type { ProducerDashboardData } from '@/lib/dashboard/aggregate'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-city-border bg-city-surface/60 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatusBadge({ status }: { status: ProducerDashboardData['readinessStatus'] }) {
  const meta = status === 'ready'
    ? { label: 'Ready', cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20' }
    : status === 'blocked'
      ? { label: 'Blocked', cls: 'bg-rose-500/12 text-rose-300 border-rose-500/20' }
      : { label: 'Needs Review', cls: 'bg-amber-500/12 text-amber-300 border-amber-500/20' }
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
}

function ApprovalRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2 text-sm">
      <span className="text-white/75">{label}</span>
      <span className="text-white/45">{status}</span>
    </div>
  )
}

export function ProducerDashboard({ data }: { data: ProducerDashboardData }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-city-accent-glow/70">Producer Dashboard</p>
        <h1 className="mt-2 text-3xl font-bold text-white">{data.projectTitle}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          总控台只聚合现有系统状态，帮助你判断当前最需要处理的问题，不会自动推进项目、自动确认或自动交付。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="总体状态">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-400">当前阶段</div>
              <div className="text-2xl font-semibold text-white">{data.currentStage}</div>
              <div className="text-sm text-gray-400">下一阶段：{data.nextStage ?? 'completed'}</div>
            </div>
            <div className="space-y-2 text-right">
              <StatusBadge status={data.readinessStatus} />
              <div className="text-sm text-gray-400">{data.canAdvance ? '可进入下一阶段' : '建议先处理风险项'}</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/70">{data.readinessReason}</p>
        </Card>

        <Card title="AI 摘要">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500">当前最需要处理的 3 个问题</p>
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
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="风险概览">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Blocker notes</span><span>{data.riskOverview.blockerNotes}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Stale approvals</span><span>{data.riskOverview.staleApprovals}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Pending approvals</span><span>{data.riskOverview.pendingApprovals}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Strong clip/audio risk</span><span>{data.riskOverview.strongDeliveryRisks}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Unknown license</span><span>{data.riskOverview.unknownLicenses}</span></div>
          </div>
        </Card>

        <Card title="审批状态">
          <div className="space-y-3">
            <ApprovalRow label={data.approvals.director.label} status={data.approvals.director.status} />
            <ApprovalRow label={data.approvals.client.label} status={data.approvals.client.status} />
            <ApprovalRow label={data.approvals.producer.label} status={data.approvals.producer.status} />
            <ApprovalRow label={data.approvals.editor.label} status={data.approvals.editor.status} />
            <div className="rounded-xl border border-white/6 px-3 py-2 text-sm text-white/70">
              <div className="text-xs text-gray-500">最近一次 changes-requested</div>
              <div className="mt-1">{data.approvals.latestChangesRequested?.title ?? '暂无'}</div>
            </div>
          </div>
        </Card>

        <Card title="交付状态">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">DeliveryPackage</span><span>{data.delivery.exists ? '已存在' : '缺失'}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Package 状态</span><span>{data.delivery.status}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Included assets</span><span>{data.delivery.includedAssetCount}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Strong risks</span><span>{data.delivery.strongRiskCount}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">客户确认提交</span><span>{data.delivery.submittedForClient ? '已提交' : '未提交'}</span></div>
          </div>
        </Card>

        <Card title="任务 / 协作">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Open tasks</span><span>{data.tasks.open}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">In progress</span><span>{data.tasks.inProgress}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Done</span><span>{data.tasks.done}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Blocker / overdue</span><span>{data.tasks.blockerLike}</span></div>
          </div>
        </Card>

        <Card title="订单 / 商业">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Order 状态</span><span>{data.order.status}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">支付状态</span><span>{data.order.paymentStatus}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">Quote</span><span>{data.order.quoteId ?? '暂无'}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">交付状态</span><span>{data.order.deliveryStatus ?? '暂无'}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-white/6 px-3 py-2"><span className="text-white/70">价格</span><span>{typeof data.order.price === 'number' ? `¥${data.order.price}` : '暂无'}</span></div>
          </div>
        </Card>

        <Card title="最近活动">
          <div className="space-y-3">
            {data.activity.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/8 px-3 py-3 text-sm text-white/45">当前还没有可展示的活动摘要。</div>
            ) : data.activity.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/6 px-3 py-3">
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
    </div>
  )
}
