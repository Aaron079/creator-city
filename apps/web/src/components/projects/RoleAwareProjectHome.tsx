'use client'

import { DeliveryOrApprovalCard, PersonalQueueCard, QuickActionsCard, RecentActivityCard, RiskOrWaitingCard, StatusSummaryCard } from '@/components/projects/EntrySummaryCards'
import { buildProjectEntryData } from '@/lib/projects/entry-layer'
import type { RoleAwareProjectHomeData } from '@/lib/projects/home'
import { ClientProjectStatusFeed } from '@/components/projects/ClientProjectStatusFeed'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { getActionTarget } from '@/lib/routing/actions'
import type { EntryListItemModel } from '@/lib/projects/entry-layer'

function resolutionStatusLabel(status: 'open' | 'in-progress' | 'resolved' | 'resubmitted') {
  return {
    open: '待处理',
    'in-progress': '处理中',
    resolved: '已解决',
    resubmitted: '已重新提交',
  }[status]
}

function severityLabel(severity: 'info' | 'warning' | 'strong') {
  return {
    info: '一般',
    warning: '注意',
    strong: '高风险',
  }[severity]
}

function queueItemsFromWorkQueue(items: RoleAwareProjectHomeData['workQueue']): EntryListItemModel[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    meta: `${item.projectTitle} · ${item.message}`,
    href: item.actionHref,
    label: item.actionLabel,
  }))
}

function queueItemsFromNotifications(items: RoleAwareProjectHomeData['notifications']): EntryListItemModel[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    meta: item.message,
    href: item.actionHref,
    label: item.actionLabel,
  }))
}

function queueItemsFromResolutions(data: NonNullable<RoleAwareProjectHomeData['creatorHome']>): EntryListItemModel[] {
  return data.resolutionQueue.map((item) => ({
    id: item.id,
    title: item.title,
    meta: `${resolutionStatusLabel(item.status)} · ${severityLabel(item.severity)} · 负责人 ${item.assignedRole}`,
    href: `${getActionTarget({ actionType: 'project-review', projectId: item.projectId }).actionHref}#resolution-loop`,
    label: '查看修改项',
  }))
}

export function RoleAwareProjectHome({ data }: { data: RoleAwareProjectHomeData }) {
  const invitationInboxHref = getActionTarget({ actionType: 'invitation-inbox' }).actionHref
  const meHref = getActionTarget({ actionType: 'me' }).actionHref
  const entryData = buildProjectEntryData(data)
  const projectHomeHref = getActionTarget({ actionType: 'project-home', projectId: data.projectId }).actionHref
  const creatorQuickActions = data.creatorHome?.quickActions ?? (
    data.creatorHome?.nextAction
      ? [data.creatorHome.nextAction]
      : entryData.quickActions
  )

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
          {data.surface === 'producer' ? (
            <>
              <StatusSummaryCard
                title="Project Control Summary"
                subtitle="进入项目后的第一屏控制摘要，优先告诉 Producer 当前推进到哪、哪里最危险。"
                metrics={[
                  { label: 'Readiness', value: data.producerHome?.statusSummary.readiness ?? data.readinessStatus },
                  { label: 'Pending approvals', value: data.producerHome?.approvalsSummary.pendingCount ?? 0, tone: (data.producerHome?.approvalsSummary.pendingCount ?? 0) > 0 ? 'warning' : 'default' },
                  { label: 'Blockers', value: data.producerHome?.riskSummary.blockerCount ?? 0, tone: (data.producerHome?.riskSummary.blockerCount ?? 0) > 0 ? 'danger' : 'default' },
                  { label: 'Delivery risk', value: data.producerHome?.deliverySummary.strongRiskCount ?? 0, tone: (data.producerHome?.deliverySummary.strongRiskCount ?? 0) > 0 ? 'danger' : 'default' },
                  { label: 'Open resolutions', value: data.producerHome?.resolutionSummary.openCount ?? 0, tone: (data.producerHome?.resolutionSummary.openCount ?? 0) > 0 ? 'warning' : 'default' },
                  { label: 'Unread alerts', value: data.producerHome?.notificationsSummary.unreadCount ?? 0, tone: (data.producerHome?.notificationsSummary.strongCount ?? 0) > 0 ? 'warning' : 'default' },
                ]}
              />
              <QuickActionsCard
                title="Quick Actions"
                subtitle="把审批、交付、排期、团队、修改闭环和提醒入口统一摆在首页。"
                actions={data.producerHome?.quickActions ?? entryData.quickActions}
              />
              <RiskOrWaitingCard
                title="Risk / Blocker Summary"
                subtitle="先告诉你现在最危险的点，再决定优先推进哪一块。"
                items={[
                  ...((data.producerHome?.aiSummary.topItems ?? [])),
                  `最大风险：${data.producerHome?.aiSummary.mostDangerousArea ?? '暂无明显危险环节'}`,
                  `Readiness 说明：${data.readinessReason}`,
                ]}
                emptyMessage="当前没有显著 blocker 或高风险。"
              />
              <DeliveryOrApprovalCard
                title="Approvals Snapshot"
                subtitle="客户确认与审批等待情况。"
                items={[
                  `待确认：${data.producerHome?.approvalsSummary.pendingCount ?? 0}`,
                  `Stale approvals：${data.producerHome?.approvalsSummary.staleCount ?? 0}`,
                  `是否已提交给客户：${data.producerHome?.approvalsSummary.submittedForClient ? '是' : '否'}`,
                ]}
              />
              <DeliveryOrApprovalCard
                title="Delivery Snapshot"
                subtitle="交付包当前状态、版本和高风险项。"
                items={[
                  `交付状态：${data.producerHome?.deliverySummary.status ?? data.delivery.status}`,
                  `Included assets：${data.producerHome?.deliverySummary.includedAssetCount ?? data.delivery.includedAssetCount}`,
                  `Strong risks：${data.producerHome?.deliverySummary.strongRiskCount ?? data.delivery.strongRiskCount}`,
                  `Final version：${data.producerHome?.deliverySummary.finalVersion ?? data.delivery.finalVersion}`,
                ]}
              />
              <DeliveryOrApprovalCard
                title="Planning Snapshot"
                subtitle="排期冲突、blocked 项和下一步排期焦点。"
                items={[
                  `当前焦点：${data.producerHome?.planningSummary.nextFocus ?? '暂无特殊排期焦点'}`,
                  `Blocked milestones：${data.producerHome?.planningSummary.blockedCount ?? data.planning.blockedCount}`,
                  `Conflicts：${data.producerHome?.planningSummary.conflictCount ?? data.planning.conflicts.length}`,
                  `Upcoming：${data.producerHome?.planningSummary.upcomingCount ?? data.planning.upcoming.length}`,
                ]}
              />
              <DeliveryOrApprovalCard
                title="Team / Open Roles"
                subtitle="团队完整度、待响应邀请和当前 open roles。"
                items={[
                  `Active members：${data.producerHome?.teamSummary.memberCount ?? data.team.memberCount}`,
                  `Pending invitations：${data.producerHome?.teamSummary.pendingInvitationCount ?? data.team.pendingInvitationCount}`,
                  `Open roles：${data.producerHome?.teamSummary.openRolesCount ?? data.team.pendingInvitationCount}`,
                  ...((data.producerHome?.teamSummary.highlights ?? []).slice(0, 3)),
                ]}
              />
              <DeliveryOrApprovalCard
                title="Resolution Loop Summary"
                subtitle="修改闭环推进情况与是否已经重新提交。"
                items={[
                  `Open：${data.producerHome?.resolutionSummary.openCount ?? 0}`,
                  `In progress：${data.producerHome?.resolutionSummary.inProgressCount ?? 0}`,
                  `Resubmitted：${data.producerHome?.resolutionSummary.resubmittedCount ?? 0}`,
                  `Overdue：${data.producerHome?.resolutionSummary.overdueCount ?? 0}`,
                ]}
              />
              <DeliveryOrApprovalCard
                title="Notifications Summary"
                subtitle="项目级提醒中心摘要，帮助 Producer 判断是否要先回到提醒处理。"
                items={[
                  `Unread：${data.producerHome?.notificationsSummary.unreadCount ?? data.notifications.length}`,
                  `Strong：${data.producerHome?.notificationsSummary.strongCount ?? 0}`,
                  `Actionable：${data.producerHome?.notificationsSummary.actionableCount ?? 0}`,
                ]}
              />
              <RecentActivityCard
                title="Recent Activity"
                subtitle="最近发生了什么，以及当前回头看哪里最有价值。"
                items={data.producerHome?.recentActivity ?? entryData.recentActivity}
              />
              <RiskOrWaitingCard
                title="AI Summary"
                subtitle="只给摘要与优先级提示，不会替你执行任何动作。"
                items={[
                  ...((data.producerHome?.aiSummary.topItems ?? [])),
                  `当前最大风险：${data.producerHome?.aiSummary.mostDangerousArea ?? '暂无明显危险环节'}`,
                  `最该先做：${data.producerHome?.aiSummary.recommendedAction ?? '查看项目概览'}`,
                ]}
              />
            </>
          ) : null}

          {data.surface === 'creator' ? (
            <>
              <StatusSummaryCard
                title="Creator Work Summary"
                subtitle="先告诉你任务、修改闭环、review 和 delivery 哪一块最值得马上处理。"
                metrics={[
                  { label: 'Assigned tasks', value: data.creatorHome?.workSummary.assignedCount ?? 0 },
                  { label: 'Blocking tasks', value: data.creatorHome?.workSummary.blockingCount ?? 0, tone: (data.creatorHome?.workSummary.blockingCount ?? 0) > 0 ? 'warning' : 'default' },
                  { label: 'Open resolutions', value: data.creatorHome?.resolutionSummary.openCount ?? 0, tone: (data.creatorHome?.resolutionSummary.strongCount ?? 0) > 0 ? 'danger' : 'default' },
                  { label: 'Pending review', value: data.creatorHome?.workSummary.reviewCount ?? 0, tone: (data.creatorHome?.workSummary.reviewCount ?? 0) > 0 ? 'warning' : 'default' },
                  { label: 'Delivery reminders', value: data.creatorHome?.workSummary.deliveryReminderCount ?? 0, tone: (data.creatorHome?.deliveryReminderSummary.highestSeverity === 'strong') ? 'danger' : (data.creatorHome?.deliveryReminderSummary.highestSeverity === 'warning' ? 'warning' : 'default') },
                  { label: 'Current role', value: data.resolvedRoleLabel },
                ]}
              />
              <QuickActionsCard
                title="Next Suggested Action"
                subtitle="把 Creator 当前最短的处理路径直接摆出来。"
                actions={creatorQuickActions}
              />
              <PersonalQueueCard
                title="Current Assigned Tasks"
                subtitle="当前直接挂到你身上的任务与推进项。"
                items={data.creatorHome ? queueItemsFromWorkQueue(data.creatorHome.currentTasks) : []}
                emptyMessage="当前没有直接分配给你的任务。"
              />
              <PersonalQueueCard
                title="Resolution Queue"
                subtitle="修改项当前推进到哪一步，以及哪些还没有真正关掉。"
                items={data.creatorHome ? queueItemsFromResolutions(data.creatorHome) : []}
                emptyMessage="当前没有和你直接相关的修改闭环项。"
              />
              <DeliveryOrApprovalCard
                title="Review Feedback Snapshot"
                subtitle="最新反馈、待回看的 review，以及最近需要响应的修改方向。"
                items={[
                  `待回看反馈：${data.creatorHome?.reviewSummary.pendingReviewCount ?? 0}`,
                  `最新反馈：${data.creatorHome?.reviewSummary.latestFeedback ?? '当前没有新的 review 反馈。'}`,
                  ...(data.creatorHome?.reviewItems.slice(0, 2).map((item) => `${item.title} · ${item.message}`) ?? []),
                ]}
              />
              <DeliveryOrApprovalCard
                title="Delivery Reminder Snapshot"
                subtitle="和交付、授权、待提交项相关的提醒摘要。"
                items={[
                  `提醒数量：${data.creatorHome?.deliveryReminderSummary.reminderCount ?? 0}`,
                  `最高严重级别：${data.creatorHome?.deliveryReminderSummary.highestSeverity ?? 'info'}`,
                  ...(data.creatorHome?.deliveryReminders.slice(0, 2).map((item) => `${item.title} · ${item.message}`) ?? []),
                ]}
              />
              <PersonalQueueCard
                title="Personal Queue"
                subtitle="如果你想从个人视角直接处理项目项，可以从这里切进去。"
                items={data.creatorHome ? queueItemsFromWorkQueue(data.creatorHome.personalQueue.slice(0, 6)) : []}
                emptyMessage="当前没有直接指向你的项目待办。"
              />
              <RecentActivityCard
                title="Recent Activity"
                subtitle="最近版本、反馈和交付变化。"
                items={data.creatorHome?.recentActivity ?? entryData.recentActivity}
              />
              <RiskOrWaitingCard
                title="AI Summary"
                subtitle="只做摘要、危险提示和下一步建议。"
                items={[
                  ...((data.creatorHome?.aiSummary.topItems ?? [])),
                  `当前最大风险：${data.creatorHome?.aiSummary.mostDangerousArea ?? '暂无明显危险环节'}`,
                  `最该先做：${data.creatorHome?.aiSummary.recommendedAction ?? '查看项目概览'}`,
                ]}
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
            <>
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
              <RecentActivityCard
                title="Latest Activity / Changes"
                subtitle="不重建流程，只把最近需要回看的动作放在一处。"
                items={data.latestActivity}
              />
            </>
          ) : null}
        </div>

        <div className="space-y-6">
          <PersonalQueueCard
            title={data.surface === 'producer' ? 'Project Notifications' : data.surface === 'creator' ? 'Role-Aware Notifications' : 'Role-Aware Summary'}
            subtitle={data.surface === 'producer'
              ? 'Producer 从这里快速看项目提醒、风险和待处理数。'
              : data.surface === 'creator'
                ? 'Creator 只看和自己相关、并且能直接推进的提醒。'
                : '通知、提醒和当前项目上的个人待办统一用这套入口卡表达。'}
            items={queueItemsFromNotifications(data.notifications)}
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
            title={data.surface === 'producer' ? 'Project Action Queue' : 'Personal Action Queue'}
            subtitle={data.surface === 'producer'
              ? '如果当前项目上有需要 Producer 直接推进的动作，它们会在这里聚一下。'
              : '如果这项目上有直接轮到你的动作，它们会在这里聚一下。'}
            items={queueItemsFromWorkQueue(data.workQueue.slice(0, 6))}
            emptyMessage={data.surface === 'producer'
              ? '当前没有直接指向 Producer 的项目动作。'
              : '当前没有直接指向你自己的项目待办。'}
          />

          {data.surface === 'producer' ? (
            <QuickActionsCard
              title="Open Project"
              subtitle="需要切回完整项目首页时，从这里进入统一入口。"
              actions={[
                {
                  id: 'producer-open-project-home',
                  label: '打开项目首页',
                  href: projectHomeHref,
                  detail: '回到 role-aware project home 顶部概览',
                },
              ]}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
