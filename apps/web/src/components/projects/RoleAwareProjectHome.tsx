'use client'

import { DeliveryOrApprovalCard, PersonalQueueCard, QuickActionsCard, RecentActivityCard, RiskOrWaitingCard, StatusSummaryCard } from '@/components/projects/EntrySummaryCards'
import { buildProjectEntryData } from '@/lib/projects/entry-layer'
import type { RoleAwareProjectHomeData } from '@/lib/projects/home'
import { ClientProjectStatusFeed } from '@/components/projects/ClientProjectStatusFeed'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { getActionTarget } from '@/lib/routing/actions'

export function RoleAwareProjectHome({ data }: { data: RoleAwareProjectHomeData }) {
  const invitationInboxHref = getActionTarget({ actionType: 'invitation-inbox' }).actionHref
  const meHref = getActionTarget({ actionType: 'me' }).actionHref
  const entryData = buildProjectEntryData(data)

  if (data.surface === 'outsider') {
    return (
      <AccessNotice
        title="当前账号还不是这个项目的成员"
        message="你现在没有这个项目的 active membership，所以不会直接看到完整项目首页。可以先回到我的页面确认身份，或者联系 Producer 完成项目绑定。"
        details={[
          `当前项目：${data.title}`,
          `当前身份状态：${data.access.state}`,
          `项目角色：${data.resolvedRoleLabel}`,
        ]}
        href={meHref}
        ctaLabel="查看我的身份"
      />
    )
  }

  if (data.surface === 'invited') {
    return (
      <AccessNotice
        title="你已经收到项目邀请"
        message="在你接受邀请前，项目首页不会开放完整工作区视图。先去 Invitation Inbox 响应，接受后这里会自动切换到对应角色首页。"
        details={[
          `当前项目：${data.title}`,
          `邀请状态：${data.access.invitationStatus}`,
          `待生效角色：${data.resolvedRoleLabel}`,
        ]}
        href={invitationInboxHref}
        ctaLabel="前往 Invitation Inbox"
        secondaryHref={data.overview?.links.review}
        secondaryLabel="先看 Review 概览"
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Role-Aware Project Home</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{data.title}</h1>
            <p className="mt-2 text-sm text-white/60">
              当前阶段 {data.currentStage} · 你的项目角色是 {data.resolvedRoleLabel}。这里优先展示你进入项目后最该先看的内容。
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
            <div className="text-xs text-white/45">Readiness</div>
            <div className="mt-1 text-lg font-semibold text-white">{data.readinessStatus}</div>
            <div className="mt-1 text-xs text-white/45">{data.readinessReason}</div>
          </div>
        </div>

      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <StatusSummaryCard
            title="Status Summary"
            subtitle="项目首页、Projects、Me 统一用这套状态指标做第一屏摘要。"
            metrics={entryData.statusMetrics}
          />

          <QuickActionsCard
            title="Quick Actions"
            subtitle="把最短的处理路径直接摆在项目入口。"
            actions={entryData.quickActions}
          />

          {data.surface === 'producer' ? (
            <>
              <RiskOrWaitingCard
                title="Risk / Planning / Team"
                subtitle="Producer 首页统一用这类卡片表达风险、排期和团队焦点。"
                items={entryData.riskOrWaitingItems}
              />
              <DeliveryOrApprovalCard
                title="Delivery / Approval"
                subtitle="把交付和审批状态统一收在一张快照卡里。"
                items={entryData.deliveryOrApprovalItems}
              />
              <RecentActivityCard
                title="Recent Activity"
                subtitle="最近发生了什么，以及下一步最应该点哪里。"
                items={entryData.recentActivity}
              />
            </>
          ) : null}

          {data.surface === 'creator' ? (
            <>
              <RiskOrWaitingCard
                title="Risk / Waiting"
                subtitle="Creator 首页统一把当前最该先看的反馈、修改闭环和角色提示放在一处。"
                items={entryData.riskOrWaitingItems}
              />
              <PersonalQueueCard
                title="Personal Queue"
                subtitle="任务、review 和交付提醒统一用同一套队列卡表达。"
                items={entryData.queueItems}
                emptyMessage="当前没有直接指向你的项目待办。"
              />
              <DeliveryOrApprovalCard
                title="Delivery / Review Snapshot"
                subtitle="把 review / resolution / delivery 的关键信息收在同一张入口卡。"
                items={entryData.deliveryOrApprovalItems}
              />
              <RecentActivityCard
                title="Recent Activity"
                subtitle="最近版本、交付和修改闭环变化。"
                items={entryData.recentActivity}
              />
            </>
          ) : null}

          {data.surface === 'client' ? (
            <>
              <DeliveryOrApprovalCard
                title="Delivery / Approval Snapshot"
                subtitle="Client 也复用统一入口卡表达待确认、版本和交付状态。"
                items={entryData.deliveryOrApprovalItems}
              />
              {data.clientFeed ? <ClientProjectStatusFeed data={data.clientFeed} /> : null}
            </>
          ) : null}

          {data.surface !== 'client' && !data.producerHome && !data.creatorHome ? (
            <RecentActivityCard
              title="Latest Activity / Changes"
              subtitle="不重建流程，只把最近需要回看的动作放在一处。"
              items={data.latestActivity}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <PersonalQueueCard
            title="Role-Aware Summary"
            subtitle="通知、提醒和当前项目上的个人待办统一用这套入口卡表达。"
            items={data.notifications.map((item) => ({
              id: item.id,
              title: item.title,
              meta: item.message,
              href: item.actionHref,
              label: item.actionLabel,
            }))}
            emptyMessage="当前没有直接挂到这个项目上的提醒。"
          />

          <DeliveryOrApprovalCard
            title="Delivery Snapshot"
            subtitle="交付状态、资产规模和当前风险统一收在一张卡里。"
            items={[
              `状态：${data.delivery.status}`,
              `Included assets：${data.delivery.includedAssetCount}`,
              `Strong risks：${data.delivery.strongRiskCount}`,
              `Final version：${data.delivery.finalVersion}`,
            ]}
          />

          <PersonalQueueCard
            title="Personal Action Queue"
            subtitle="如果这项目上有直接轮到你的动作，它们会在这里聚一下。"
            items={data.workQueue.slice(0, 6).map((item) => ({
              id: item.id,
              title: item.title,
              meta: `${item.projectTitle} · ${item.message}`,
              href: item.actionHref,
              label: item.actionLabel,
            }))}
            emptyMessage="当前没有直接指向你自己的项目待办。"
          />
        </div>
      </div>
    </div>
  )
}
