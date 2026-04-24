'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ExternalAccessLink } from '@/store/external-access.store'
import type { ClientProjectStatusFeedData } from '@/lib/projects/client-feed'
import { getExternalAccessTypeLabel, getExternalPermissionSummary, getExternalRoleHintLabel } from '@/lib/external/access'
import { getExternalReviewHref } from '@/lib/routing/actions'

function SummaryCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#07111d] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SharedProjectOverview({
  link,
  clientFeed,
  onSubmitCreatorIntent,
}: {
  link: ExternalAccessLink
  clientFeed: ClientProjectStatusFeedData
  onSubmitCreatorIntent?: (payload: {
    invitedName?: string
    invitedEmail?: string
    note?: string
  }) => void
}) {
  const [inviteDraft, setInviteDraft] = useState({
    invitedName: link.invitedName ?? '',
    invitedEmail: link.invitedEmail ?? '',
    note: '',
  })
  const [intentSubmitted, setIntentSubmitted] = useState(false)
  const permissionSummary = useMemo(
    () => getExternalPermissionSummary(link.permissions),
    [link.permissions],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <section className="rounded-[32px] border border-white/10 bg-[#07111d] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/70">
              External Project Access
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{link.projectTitle}</h1>
            <p className="mt-3 text-sm leading-[1.8] text-white/62">
              这是一个受限访问链接。当前入口类型为 {getExternalAccessTypeLabel(link.accessType)}，面向 {getExternalRoleHintLabel(link.roleHint)}。
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
            <div>Stage · {clientFeed.summary.stage}</div>
            <div className="mt-1 text-white/45">Latest version · {clientFeed.summary.latestVersion}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SummaryCard title="Status Summary">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                当前交付状态：{clientFeed.summary.deliveryStatus}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                当前是否等待外部动作：{clientFeed.summary.waitingForClientAction ? '是' : '否'}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                待处理修改项：{clientFeed.summary.openResolutions}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                已解决 / 已重提：{clientFeed.summary.resolvedResolutions}
              </div>
            </div>
          </SummaryCard>

          <SummaryCard title="Recent Changes">
            <div className="space-y-3">
              {clientFeed.activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/45">
                  当前没有新的外部可见项目变化。
                </div>
              ) : clientFeed.activities.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/58">{item.message}</div>
                  <div className="mt-2 text-xs text-white/38">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              ))}
            </div>
          </SummaryCard>
        </div>

        <div className="space-y-6">
          <SummaryCard title="Access Scope">
            <div className="space-y-3">
              {permissionSummary.allowed.map((item) => (
                <div key={item} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                  可以：{item}
                </div>
              ))}
              {permissionSummary.denied.map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/58">
                  不会：{item}
                </div>
              ))}
            </div>
          </SummaryCard>

          {link.accessType === 'client-review' ? (
            <SummaryCard title="Go To Review">
              <p className="text-sm leading-[1.8] text-white/62">
                这个链接主要用于外部客户确认当前版本。你可以继续进入受控 Review 页面查看交付快照、风险摘要，并提交 Confirm / Request Changes / Reject。
              </p>
              <Link
                href={getExternalReviewHref(link.token)}
                className="mt-4 inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              >
                打开 Guest Review
              </Link>
            </SummaryCard>
          ) : null}

          {link.accessType === 'creator-invite' ? (
            <SummaryCard title="Creator Invite">
              <p className="text-sm leading-[1.8] text-white/62">
                这是一个外部创作者加入入口。它只会记录你的加入意向，不会自动加入团队，也不会自动创建账号。提交后仍然需要 Producer 确认。
              </p>
              <div className="mt-4 space-y-3">
                <input
                  value={inviteDraft.invitedName}
                  onChange={(event) => setInviteDraft((current) => ({ ...current, invitedName: event.target.value }))}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                  placeholder="你的名字"
                />
                <input
                  value={inviteDraft.invitedEmail}
                  onChange={(event) => setInviteDraft((current) => ({ ...current, invitedEmail: event.target.value }))}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none"
                  placeholder="你的邮箱（可选）"
                />
                <textarea
                  value={inviteDraft.note}
                  onChange={(event) => setInviteDraft((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none resize-none"
                  placeholder="补充说明你的经验、可加入方式或希望承担的角色"
                />
                <button
                  onClick={() => {
                    onSubmitCreatorIntent?.(inviteDraft)
                    setIntentSubmitted(true)
                  }}
                  className="inline-flex rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100"
                >
                  申请加入 / 提交意向
                </button>
                {intentSubmitted ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200">
                    已记录你的外部加入意向，接下来需要 Producer 手动确认。
                  </div>
                ) : null}
              </div>
            </SummaryCard>
          ) : null}
        </div>
      </div>
    </div>
  )
}
