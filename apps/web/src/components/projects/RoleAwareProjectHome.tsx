'use client'

import Link from 'next/link'
import type { ActivityLogItem } from '@/lib/activity/aggregate'
import type { RoleAwareProjectHomeData } from '@/lib/projects/home'
import { ClientProjectStatusFeed } from '@/components/projects/ClientProjectStatusFeed'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { getActionTarget } from '@/lib/routing/actions'

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-black/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-white/55">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
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
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  )
}

function QueueItemRow({
  title,
  meta,
  href,
  label,
}: {
  title: string
  meta: string
  href: string
  label: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="mt-1 text-sm text-white/55">{meta}</div>
        </div>
        <Link
          href={href}
          className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
        >
          {label}
        </Link>
      </div>
    </div>
  )
}

function ActivityList({ items }: { items: ActivityLogItem[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
          当前还没有新的项目活动。
        </div>
      ) : items.map((item) => (
        <div key={item.id} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{item.message}</div>
              <div className="mt-1 text-xs text-white/45">
                {item.actorName}
                {item.actorRole ? ` · ${item.actorRole}` : ''}
                {' · '}
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
            {item.actionHref && item.actionLabel ? (
              <Link
                href={item.actionHref}
                className="inline-flex rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
              >
                {item.actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RoleAwareProjectHome({ data }: { data: RoleAwareProjectHomeData }) {
  const invitationInboxHref = getActionTarget({ actionType: 'invitation-inbox' }).actionHref
  const meHref = getActionTarget({ actionType: 'me' }).actionHref
  const planningHref = getActionTarget({ actionType: 'project-planning', projectId: data.projectId }).actionHref
  const producerHome = data.producerHome
  const creatorHome = data.creatorHome

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

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Pending approvals" value={data.overview?.pendingApprovalCount ?? 0} tone={(data.overview?.pendingApprovalCount ?? 0) > 0 ? 'warning' : 'default'} />
          <Metric label="Blockers" value={data.overview?.blockerCount ?? 0} tone={(data.overview?.blockerCount ?? 0) > 0 ? 'danger' : 'default'} />
          <Metric label="Delivery" value={data.delivery.status} tone={data.delivery.strongRiskCount > 0 ? 'warning' : 'default'} />
          <Metric label="Quick actions" value={data.quickActions.length} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card title="Quick Actions" subtitle="把最短的处理路径直接摆在项目入口。">
            <div className="space-y-3">
              {data.quickActions.map((action) => (
                <QueueItemRow
                  key={action.id}
                  title={action.label}
                  meta={action.detail ?? '进入对应处理位置'}
                  href={action.href}
                  label="去处理"
                />
              ))}
            </div>
          </Card>

          {data.surface === 'producer' ? (
            <>
              <Card title="Producer Control Summary" subtitle="进入项目后先看 readiness、审批、交付、风险和修改闭环。">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="Readiness" value={producerHome?.statusSummary.readiness ?? data.readinessStatus} />
                  <Metric label="Blocker notes" value={producerHome?.statusSummary.blockerCount ?? data.producer.blockerCount} tone={(producerHome?.statusSummary.blockerCount ?? data.producer.blockerCount) > 0 ? 'danger' : 'default'} />
                  <Metric label="Pending approvals" value={producerHome?.statusSummary.pendingApprovalCount ?? data.producer.pendingApprovalCount} tone={(producerHome?.statusSummary.pendingApprovalCount ?? data.producer.pendingApprovalCount) > 0 ? 'warning' : 'default'} />
                  <Metric label="Delivery status" value={producerHome?.statusSummary.deliveryStatus ?? data.producer.deliveryStatus} tone={data.delivery.strongRiskCount > 0 ? 'warning' : 'default'} />
                  <Metric label="Open resolutions" value={producerHome?.statusSummary.openResolutionCount ?? 0} tone={(producerHome?.statusSummary.openResolutionCount ?? 0) > 0 ? 'warning' : 'default'} />
                  <Metric label="Notifications" value={producerHome?.notificationsSummary.unreadCount ?? data.notifications.length} tone={(producerHome?.notificationsSummary.strongCount ?? 0) > 0 ? 'warning' : 'default'} />
                </div>
              </Card>

              <Card title="Planning Snapshot" subtitle="当前项目的排期焦点、blocked 项和依赖冲突。">
                <div className="space-y-3">
                  {producerHome ? (
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                      <div className="font-medium text-white">{producerHome.planningSummary.nextFocus}</div>
                      <div className="mt-1">
                        Blocked {producerHome.planningSummary.blockedCount} · Conflicts {producerHome.planningSummary.conflictCount} · Upcoming {producerHome.planningSummary.upcomingCount}
                      </div>
                    </div>
                  ) : data.planning.project ? (
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                      <div className="font-medium text-white">{data.planning.project.nextFocus}</div>
                      <div className="mt-1">
                        Buffer {data.planning.project.bufferDays} 天 · Blockers {data.planning.project.blockerCount} · Strong risks {data.planning.project.strongRiskCount}
                      </div>
                    </div>
                  ) : null}
                  {data.planning.upcoming.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      title={`即将到期 · ${item.milestoneId.split(':').at(-1) ?? item.milestoneId}`}
                      meta={`${new Date(item.endAt).toLocaleString('zh-CN')} · ${item.status}`}
                      href={data.quickActions[0]?.href ?? planningHref}
                      label="查看排期"
                    />
                  ))}
                  {data.planning.conflicts.length > 0 ? (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100/85">
                      当前有 {data.planning.conflicts.length} 条 planning conflict，建议先处理依赖或确认问题。
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card title="Team / Risk Snapshot" subtitle="团队状态、开放角色与最危险的环节。">
                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Active members" value={producerHome?.teamSummary.memberCount ?? data.team.memberCount} />
                  <Metric label="Pending invites" value={producerHome?.teamSummary.pendingInvitationCount ?? data.team.pendingInvitationCount} tone={(producerHome?.teamSummary.pendingInvitationCount ?? data.team.pendingInvitationCount) > 0 ? 'warning' : 'default'} />
                  <Metric label="Open roles" value={producerHome?.teamSummary.openRolesCount ?? 0} />
                  <Metric label="Strong risks" value={producerHome?.riskSummary.strongRiskCount ?? data.delivery.strongRiskCount} tone={(producerHome?.riskSummary.strongRiskCount ?? data.delivery.strongRiskCount) > 0 ? 'danger' : 'default'} />
                </div>
                <div className="mt-4 space-y-3">
                  {(producerHome?.teamSummary.highlights ?? data.team.members.slice(0, 4).map((member) => `${member.displayName} · ${member.role}`)).map((highlight) => (
                    <div key={highlight} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                      <div className="font-medium text-white">{highlight}</div>
                    </div>
                  ))}
                  {data.team.members.slice(0, 3).map((member) => (
                    <div key={member.profileId} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                      <div className="font-medium text-white">{member.displayName}</div>
                      <div className="mt-1">{member.role} · {member.status} · {member.city ?? 'Remote'}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Recent Activity" subtitle="最近发生了什么，以及下一步最应该点哪里。">
                <ActivityList items={producerHome?.recentActivity ?? data.latestActivity} />
              </Card>
            </>
          ) : null}

          {data.surface === 'creator' ? (
            <>
              <Card title="Creator Work Summary" subtitle="进入项目后先看自己的任务、修改项和最新反馈。">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="Assigned tasks" value={creatorHome?.taskSummary.assignedCount ?? data.creator.currentTasks.length} />
                  <Metric label="Blocking tasks" value={creatorHome?.taskSummary.blockingCount ?? data.creator.currentTasks.filter((item) => item.isBlocking).length} tone={(creatorHome?.taskSummary.blockingCount ?? data.creator.currentTasks.filter((item) => item.isBlocking).length) > 0 ? 'warning' : 'default'} />
                  <Metric label="Open resolutions" value={creatorHome?.resolutionSummary.openCount ?? 0} tone={(creatorHome?.resolutionSummary.strongCount ?? 0) > 0 ? 'danger' : 'default'} />
                </div>
              </Card>

              <Card title="Next Suggested Action" subtitle="优先把当前最可能推进项目的一步放在最上面。">
                <QueueItemRow
                  title={creatorHome?.nextAction.label ?? '去 Review'}
                  meta={creatorHome?.nextAction.detail ?? '查看最新反馈与任务'}
                  href={creatorHome?.nextAction.href ?? getActionTarget({ actionType: 'project-review', projectId: data.projectId }).actionHref}
                  label="现在处理"
                />
              </Card>

              <Card title="Current Task Summary" subtitle="创作者视角下当前最该推进的事项。">
                <div className="space-y-3">
                  {(creatorHome?.personalQueue.length ?? data.creator.currentTasks.length) === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                      当前没有直接指派给你的任务。
                    </div>
                  ) : (creatorHome?.personalQueue.slice(0, 4) ?? data.creator.currentTasks).map((item) => (
                    <QueueItemRow
                      key={item.id}
                      title={item.title}
                      meta={item.message}
                      href={item.actionHref}
                      label={item.actionLabel}
                    />
                  ))}
                </div>
              </Card>

              <Card title="Review / Resolution / Delivery" subtitle="需要你回看的反馈、修改闭环和交付提醒。">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <Metric label="Pending review" value={creatorHome?.reviewSummary.pendingReviewCount ?? data.creator.pendingReviewItems.length} tone={(creatorHome?.reviewSummary.pendingReviewCount ?? data.creator.pendingReviewItems.length) > 0 ? 'warning' : 'default'} />
                  <Metric label="In progress" value={creatorHome?.resolutionSummary.inProgressCount ?? 0} />
                  <Metric label="Delivery reminders" value={creatorHome?.deliveryReminderSummary.reminderCount ?? data.creator.deliveryReminders.length} tone={(creatorHome?.deliveryReminderSummary.highestSeverity ?? 'info') === 'strong' ? 'danger' : (creatorHome?.deliveryReminderSummary.highestSeverity ?? 'info') === 'warning' ? 'warning' : 'default'} />
                </div>
                <div className="space-y-3">
                  {[...(data.creator.pendingReviewItems ?? []), ...(data.creator.deliveryReminders ?? []), ...(creatorHome?.personalQueue.filter((item) => item.category === 'review' || item.category === 'approval' || item.category === 'delivery' || item.category === 'licensing').slice(0, 4) ?? [])].slice(0, 6).map((item) => (
                    <QueueItemRow
                      key={item.id}
                      title={item.title}
                      meta={item.message}
                      href={item.actionHref}
                      label={item.actionLabel}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
                  最新反馈：{creatorHome?.reviewSummary.latestFeedback ?? '当前没有新的 review 反馈。'}
                </div>
              </Card>

              <Card title="Recent Activity" subtitle="最近版本、交付和修改闭环变化。">
                <ActivityList items={creatorHome?.recentActivity ?? data.latestActivity} />
              </Card>
            </>
          ) : null}

          {data.surface === 'client' ? (
            <>
              {data.clientFeed ? <ClientProjectStatusFeed data={data.clientFeed} /> : null}
            </>
          ) : null}

          {data.surface !== 'client' && !producerHome && !creatorHome ? (
            <Card title="Latest Activity / Changes" subtitle="不重建流程，只把最近需要回看的动作放在一处。">
              <ActivityList items={data.latestActivity} />
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="Role-Aware Summary" subtitle="按当前项目角色裁剪的提醒与快照。">
            <div className="space-y-3">
              {data.notifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有直接挂到这个项目上的提醒。
                </div>
              ) : data.notifications.map((item) => (
                <QueueItemRow
                  key={item.id}
                  title={item.title}
                  meta={item.message}
                  href={item.actionHref}
                  label={item.actionLabel}
                />
              ))}
            </div>
          </Card>

          {data.surface === 'producer' && producerHome ? (
            <Card title="Producer AI Summary" subtitle="只做摘要与优先级提示，不替你执行。">
              <div className="space-y-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="font-medium text-white">最危险环节</div>
                  <div className="mt-1">{producerHome.aiSummary.mostDangerousArea}</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="font-medium text-white">推荐先做</div>
                  <div className="mt-1">{producerHome.aiSummary.recommendedAction}</div>
                </div>
                {producerHome.aiSummary.topItems.map((item) => (
                  <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {data.surface === 'creator' && creatorHome ? (
            <Card title="Creator AI Summary" subtitle="只提示最应该先看的环节，不代替你处理。">
              <div className="space-y-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="font-medium text-white">当前角色</div>
                  <div className="mt-1">{data.resolvedRoleLabel}</div>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  <div className="font-medium text-white">最危险环节</div>
                  <div className="mt-1">{creatorHome.aiSummary.mostDangerousArea}</div>
                </div>
                {creatorHome.aiSummary.topItems.map((item) => (
                  <div key={item} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Delivery Snapshot" subtitle="交付状态、资产规模和当前风险。">
            <div className="grid gap-3 md:grid-cols-2">
              <Metric label="Status" value={data.delivery.status} tone={data.delivery.strongRiskCount > 0 ? 'warning' : 'default'} />
              <Metric label="Included assets" value={data.delivery.includedAssetCount} />
              <Metric label="Strong risks" value={data.delivery.strongRiskCount} tone={data.delivery.strongRiskCount > 0 ? 'danger' : 'default'} />
              <Metric label="Final version" value={data.delivery.finalVersion} />
            </div>
          </Card>

          <Card title="Personal Action Queue" subtitle="如果这项目上有直接轮到你的动作，它们会在这里聚一下。">
            <div className="space-y-3">
              {data.workQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                  当前没有直接指向你自己的项目待办。
                </div>
              ) : data.workQueue.slice(0, 6).map((item) => (
                <QueueItemRow
                  key={item.id}
                  title={item.title}
                  meta={`${item.projectTitle} · ${item.message}`}
                  href={item.actionHref}
                  label={item.actionLabel}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
