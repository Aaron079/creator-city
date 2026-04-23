'use client'

import { useMemo } from 'react'
import { PersonalCommandCenter } from '@/components/me/PersonalCommandCenter'
import { Nav } from '@/components/layout/Nav'
import { ProfileView } from '@/components/profile/ProfileView'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { RoleBadge } from '@/components/roles/RoleBadge'
import { InvitationInbox } from '@/components/team/InvitationInbox'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { getActionTarget } from '@/lib/routing/actions'
import { useApprovalStore } from '@/store/approval.store'
import { useAuthStore } from '@/store/auth.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useNotificationsStore } from '@/store/notifications.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'

export default function MePage() {
  const currentUserId = useProfileStore((s) => s.currentUserId)
  const authUser = useAuthStore((s) => s.user)
  const inboxProfileId = authUser?.id ?? currentUserId
  const assignments = useProjectRoleStore((s) => s.assignments)
  const approvals = useApprovalStore((s) => s.approvals)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const notificationItems = useNotificationsStore((s) => s.items)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const invitations = useTeamStore((s) => s.getInvitationsForProfile(inboxProfileId))
  const acceptInvitation = useTeamStore((s) => s.acceptInvitation)
  const declineInvitation = useTeamStore((s) => s.declineInvitation)
  const pendingInvitations = useMemo(
    () => invitations.filter((item) => item.status === 'pending'),
    [invitations],
  )
  const activeAssignments = useMemo(
    () => assignments.filter((item) => item.status === 'active' && (item.userId === (authUser?.id ?? null) || item.userId === currentUserId)),
    [assignments, authUser?.id, currentUserId],
  )
  const workQueue = useMemo(
    () => buildPersonalWorkQueue({
      userId: authUser?.id ?? currentUserId ?? 'user-me',
      profileId: inboxProfileId ?? authUser?.id ?? currentUserId ?? 'user-me',
      invitations,
      assignments,
      tasks,
      teams,
      approvals,
      deliveryPackages,
      notifications: notificationItems,
    }),
    [approvals, assignments, authUser?.id, currentUserId, deliveryPackages, inboxProfileId, invitations, notificationItems, tasks, teams],
  )
  const pendingInvitationAction = pendingInvitations[0]
    ? getActionTarget({
        actionType: 'invitation-inbox',
        projectId: pendingInvitations[0].projectId,
        actionLabel: '查看邀请',
      })
    : getActionTarget({
        actionType: 'me',
        actionLabel: '查看邀请',
      })

  return (
    <main className="min-h-screen bg-city-bg">
      <Nav />
      <div className="space-y-6 pt-14">
        <ProfileView userId={currentUserId} />
        <div className="mx-auto max-w-6xl px-4 pb-10">
          {pendingInvitations.length > 0 ? (
            <div className="mb-6">
              <AccessNotice
                title="你有待处理的项目邀请"
                message="在接受项目邀请之前，相关 create / dashboard 入口不会完全开放。先处理邀请，再进入对应项目页，权限会按你的项目角色自动生效。"
                details={pendingInvitations.slice(0, 3).map((invitation) => (
                  `${invitation.projectTitle ?? invitation.projectId} · ${invitation.role} · 邀请人 ${invitation.invitedByName ?? invitation.invitedByUserId}`
                ))}
                href={pendingInvitationAction.actionHref}
                ctaLabel={pendingInvitationAction.actionLabel}
              />
            </div>
          ) : null}
          <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Current Identity</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-white/45">当前账号</div>
                <div className="mt-1 text-sm font-semibold text-white">{authUser?.displayName ?? '未登录账号'}</div>
                <div className="mt-1 text-xs text-white/45">{authUser?.id ?? 'n/a'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-white/45">当前 Profile</div>
                <div className="mt-1 text-sm font-semibold text-white">{currentUserId}</div>
                <div className="mt-1 text-xs text-white/45">用于邀请收件箱与项目角色解析</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-white/45">Active Project Roles</div>
                <div className="mt-1 text-sm font-semibold text-white">{activeAssignments.length} 项</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeAssignments.length > 0 ? activeAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-2 rounded-xl border border-white/8 px-2 py-1">
                      <RoleBadge role={assignment.role} />
                      <span className="text-[11px] text-white/55">{assignment.projectId}</span>
                    </div>
                  )) : (
                    <span className="text-xs text-white/45">当前没有 active project role assignment。</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <PersonalCommandCenter queue={workQueue} />
          <InvitationInbox
            invitations={invitations}
            onAccept={acceptInvitation}
            onDecline={declineInvitation}
          />
        </div>
      </div>
    </main>
  )
}
