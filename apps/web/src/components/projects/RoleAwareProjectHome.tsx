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
              <Card title="Producer Summary" subtitle="总控视角下的项目风险、团队和排期快照。">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="Blocker notes" value={data.producer.blockerCount} tone={data.producer.blockerCount > 0 ? 'danger' : 'default'} />
                  <Metric label="Pending approvals" value={data.producer.pendingApprovalCount} tone={data.producer.pendingApprovalCount > 0 ? 'warning' : 'default'} />
                  <Metric label="Team status" value={data.producer.teamStatus} />
                </div>
              </Card>

              <Card title="Planning Snapshot" subtitle="当前项目的排期、blocked 项和依赖冲突。">
                <div className="space-y-3">
                  {data.planning.project ? (
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

              <Card title="Team Status" subtitle="成员、待响应邀请和最近团队动作。">
                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Active members" value={data.team.memberCount} />
                  <Metric label="Pending invites" value={data.team.pendingInvitationCount} tone={data.team.pendingInvitationCount > 0 ? 'warning' : 'default'} />
                </div>
                <div className="mt-4 space-y-3">
                  {data.team.members.slice(0, 4).map((member) => (
                    <div key={member.profileId} className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                      <div className="font-medium text-white">{member.displayName}</div>
                      <div className="mt-1">{member.role} · {member.status} · {member.city ?? 'Remote'}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}

          {data.surface === 'creator' ? (
            <>
              <Card title="Current Task Summary" subtitle="创作者视角下当前最该推进的事项。">
                <div className="space-y-3">
                  {data.creator.currentTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/8 px-4 py-4 text-sm text-white/45">
                      当前没有直接指派给你的任务。
                    </div>
                  ) : data.creator.currentTasks.map((item) => (
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

              <Card title="Pending Review & Delivery" subtitle="需要你回看的确认项、修改请求和交付提醒。">
                <div className="space-y-3">
                  {[...data.creator.pendingReviewItems, ...data.creator.deliveryReminders].slice(0, 6).map((item) => (
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
            </>
          ) : null}

          {data.surface === 'client' ? (
            <>
              {data.clientFeed ? <ClientProjectStatusFeed data={data.clientFeed} /> : null}
            </>
          ) : null}

          {data.surface !== 'client' ? (
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
