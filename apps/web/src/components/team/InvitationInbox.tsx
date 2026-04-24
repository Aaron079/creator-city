'use client'

import Link from 'next/link'
import type { TeamInvitation } from '@/store/team.store'
import { getProjectHref, getReviewHref } from '@/lib/routing/actions'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useFeedback } from '@/lib/feedback/useFeedback'

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InvitationInbox({
  invitations,
  onAccept,
  onDecline,
}: {
  invitations: TeamInvitation[]
  onAccept: (projectId: string, profileId: string) => void
  onDecline: (projectId: string, profileId: string) => void
}) {
  const feedback = useFeedback()
  const pendingCount = invitations.filter((item) => item.status === 'pending').length

  return (
    <section id="invitation-inbox" className="rounded-2xl border border-white/8 bg-black/10 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow="Invitation Inbox"
          title="项目邀请收件箱"
          description="这里展示你作为被邀请人收到的项目协作邀请。是否接受、拒绝，完全由你自己决定。"
        />
        <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-right">
          <div className="text-xs text-white/45">Pending</div>
          <div className="mt-1 text-2xl font-semibold text-white">{pendingCount}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {invitations.length === 0 ? (
          <EmptyState
            title="暂无新邀请"
            message="当前没有收到新的项目邀请。"
          />
        ) : invitations.map((invitation) => (
          <div key={invitation.id} className="rounded-xl border border-white/8 bg-white/5 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{invitation.projectTitle ?? invitation.projectId}</div>
                <div className="mt-1 text-sm text-white/60">
                  邀请角色：{invitation.role} · 邀请人：{invitation.invitedByName ?? invitation.invitedByUserId}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  邀请时间：{formatDate(invitation.createdAt)}
                  {invitation.respondedAt ? ` · 响应时间：${formatDate(invitation.respondedAt)}` : ''}
                </div>
              </div>
              <StatusBadge
                label={invitation.status}
                tone={invitation.status === 'pending'
                  ? 'warning'
                  : invitation.status === 'accepted'
                    ? 'success'
                    : invitation.status === 'declined'
                      ? 'danger'
                      : 'neutral'}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {invitation.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onAccept(invitation.projectId, invitation.profileId)
                      feedback.success('邀请已接受，项目角色会自动生效')
                    }}
                    className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
                  >
                    接受加入
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDecline(invitation.projectId, invitation.profileId)
                      feedback.info('邀请已拒绝')
                    }}
                    className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                  >
                    拒绝邀请
                  </button>
                </>
              ) : null}
              <Link
                href={getProjectHref(invitation.projectId)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
              >
                查看项目概览
              </Link>
              <Link
                href={getReviewHref(invitation.projectId)}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
              >
                打开 Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
