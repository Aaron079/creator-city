'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { PersonalCommandCenter } from '@/components/me/PersonalCommandCenter'
import { ProfileView } from '@/components/profile/ProfileView'
import { QuickActionsCard, RiskOrWaitingCard, StatusSummaryCard } from '@/components/projects/EntrySummaryCards'
import { UserProjectPortfolio } from '@/components/projects/UserProjectPortfolio'
import { WorkspaceSwitcher } from '@/components/projects/WorkspaceSwitcher'
import { AccessNotice } from '@/components/roles/AccessNotice'
import { RoleBadge } from '@/components/roles/RoleBadge'
import { InvitationInbox } from '@/components/team/InvitationInbox'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildCrossProjectEntryData } from '@/lib/projects/entry-layer'
import { buildWorkspacePortfolio } from '@/lib/projects/workspace'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { getActionTarget } from '@/lib/routing/actions'
import { useApprovalStore } from '@/store/approval.store'
import { useAuthStore } from '@/store/auth.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useNotificationsStore } from '@/store/notifications.store'
import { useOrderStore } from '@/store/order.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'

export default function MePage() {
  const router = useRouter()
  const currentUserId = useProfileStore((s) => s.currentUserId)
  const authUser = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const inboxProfileId = authUser?.id ?? currentUserId
  const assignments = useProjectRoleStore((s) => s.assignments)
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const notes = useDirectorNotesStore((s) => s.notes)
  const jobs = useJobsStore((s) => s.jobs)
  const notificationItems = useNotificationsStore((s) => s.items)
  const orders = useOrderStore((s) => s.orders)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const versions = useVersionHistoryStore((s) => s.versions)
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
  const dashboard = useMemo(
    () => aggregateProducerDashboard({
      teams,
      approvals,
      approvalGates,
      notes,
      tasks,
      orders,
      jobs,
      deliveryPackages,
      versions,
    }),
    [teams, approvals, approvalGates, notes, tasks, orders, jobs, deliveryPackages, versions],
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
  const portfolio = useMemo(
    () => buildWorkspacePortfolio({
      userId: authUser?.id ?? currentUserId ?? 'user-me',
      profileId: inboxProfileId ?? authUser?.id ?? currentUserId ?? 'user-me',
      assignments,
      teams,
      invitations,
      dashboard,
      workQueue,
      notifications: notificationItems,
      deliveryPackages,
      approvals,
    }),
    [approvals, assignments, authUser?.id, currentUserId, dashboard, deliveryPackages, inboxProfileId, invitations, notificationItems, teams, workQueue],
  )
  const entryData = useMemo(
    () => buildCrossProjectEntryData({
      portfolio,
      queue: workQueue,
      invitationCount: pendingInvitations.length,
      queueHref: '#personal-command-center',
    }),
    [pendingInvitations.length, portfolio, workQueue],
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
  const [projectSummary, setProjectSummary] = useState({
    ownedProjectsCount: 0,
    activeMembershipsCount: 0,
    currentProjectId: null as string | null,
    recentProjectTitle: null as string | null,
    loading: true,
    message: '',
  })

  useEffect(() => {
    if (!isAuthenticated || !authUser) return
    let cancelled = false
    fetch('/api/projects', { credentials: 'include' })
      .then((response) => response.json() as Promise<{
        projects?: Array<{ id: string; title?: string; ownerRole?: string | null; membershipRole?: string | null }>
        summary?: { ownedProjectsCount?: number; activeMembershipsCount?: number; currentProjectId?: string | null; recentProject?: { title?: string } | null }
        message?: string
      }>)
      .then((data) => {
        if (cancelled) return
        const projects = data.projects ?? []
        setProjectSummary({
          ownedProjectsCount: data.summary?.ownedProjectsCount ?? projects.filter((project) => project.ownerRole === 'OWNER').length,
          activeMembershipsCount: data.summary?.activeMembershipsCount ?? projects.filter((project) => project.membershipRole).length,
          currentProjectId: data.summary?.currentProjectId ?? projects[0]?.id ?? null,
          recentProjectTitle: data.summary?.recentProject?.title ?? projects[0]?.title ?? null,
          loading: false,
          message: data.message ?? '',
        })
      })
      .catch((error) => {
        if (!cancelled) {
          setProjectSummary((current) => ({
            ...current,
            loading: false,
            message: error instanceof Error ? error.message : '加载项目身份失败。',
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [authUser, isAuthenticated])

  async function handleEnsureProject() {
    const response = await fetch('/api/projects/ensure', { method: 'POST', credentials: 'include' })
    const data = await response.json().catch(() => ({})) as { project?: { id: string }; workflow?: { id: string }; message?: string }
    if (!response.ok || !data.project?.id) {
      setProjectSummary((current) => ({ ...current, message: data.message ?? '创建项目失败。' }))
      return
    }
    try {
      window.localStorage.setItem('creator-city:last-project-id', data.project.id)
      if (data.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', data.workflow.id)
    } catch {
      // Explicit URL still opens the project.
    }
    router.push(`/create?projectId=${encodeURIComponent(data.project.id)}`)
  }

  if (!isAuthenticated || !authUser) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">欢迎来到 Creator City</h1>
            <p className="mt-2 text-sm text-white/50">请登录或注册以访问你的工作台。</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              登录
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 px-6 py-2.5 text-sm text-white font-medium transition"
            >
              注册
            </Link>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <ProfileView userId={authUser.id} />
        <div className="px-4">
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
                <div className="mt-1 text-sm font-semibold text-white">{authUser.displayName}</div>
                <div className="mt-1 text-xs text-white/45">{authUser.email}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-white/45">账号 ID</div>
                <div className="mt-1 text-sm font-semibold text-white font-mono text-xs">{authUser.id.slice(0, 12)}…</div>
                <div className="mt-1 text-xs text-white/45">Role: {authUser.role}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-white/45">Project Identity</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  Owned {projectSummary.ownedProjectsCount} · Memberships {projectSummary.activeMembershipsCount}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  当前项目：{projectSummary.recentProjectTitle ?? projectSummary.currentProjectId ?? (projectSummary.loading ? '加载中...' : '无')}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projectSummary.ownedProjectsCount > 0 && projectSummary.activeMembershipsCount === 0 ? (
                    <span className="text-xs text-emerald-200/80">你是项目 Owner，可直接进入项目。</span>
                  ) : activeAssignments.length > 0 ? activeAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center gap-2 rounded-xl border border-white/8 px-2 py-1">
                      <RoleBadge role={assignment.role} />
                      <span className="text-[11px] text-white/55">{assignment.projectId}</span>
                    </div>
                  )) : projectSummary.ownedProjectsCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => { void handleEnsureProject() }}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85"
                    >
                      创建项目
                    </button>
                  ) : (
                    <span className="text-xs text-white/45">{projectSummary.message || '真实项目身份已加载。'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mb-6 space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <StatusSummaryCard
                title="Status Summary"
                subtitle="Me / Projects / Project Home 统一使用这套入口指标。"
                metrics={entryData.statusMetrics}
              />
              <QuickActionsCard
                title="Quick Actions"
                subtitle="把最常用的项目入口、待办入口和邀请入口放在一处。"
                actions={entryData.quickActions}
              />
            </div>
            <RiskOrWaitingCard
              title="Risk / Waiting"
              subtitle="当前最值得先切换、先处理的项目会统一出现在这里。"
              items={entryData.waitingItems}
            />
            <WorkspaceSwitcher
              recentProjects={portfolio.recentProjects}
              highPriorityProjects={portfolio.highPriorityProjects}
              waitingProjects={portfolio.waitingProjects}
            />
            <UserProjectPortfolio
              data={portfolio}
              title="Cross-project Summary"
              subtitle="在进入单个项目前，先看你当前参与项目里哪些正在等你、哪些风险最高、哪些最值得优先切换。"
            />
          </div>
          <PersonalCommandCenter queue={workQueue} />
          <InvitationInbox
            invitations={invitations}
            onAccept={acceptInvitation}
            onDecline={declineInvitation}
          />
          <MyAssetsBlock />
        </div>
      </div>
    </DashboardShell>
  )
}

// ─── Real assets block ────────────────────────────────────────────────────────

interface MiniAsset {
  id: string
  title?: string | null
  name: string
  type: string
  isPublic?: boolean | null
  providerId?: string | null
  resolvedUrl?: string | null
  thumbnailUrl?: string | null
  url?: string | null
  createdAt: string
}

function MyAssetsBlock() {
  const [assets, setAssets] = useState<MiniAsset[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/assets?limit=12&type=IMAGE', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as { assets?: MiniAsset[] }
      setAssets((data.assets ?? []).slice(0, 12))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return null
  if (assets.length === 0) return null

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">My Assets · 我的作品</p>
          <p className="mt-1 text-xs text-white/35">最近生成的图片资产 — 真实数据</p>
        </div>
        <Link href="/assets" className="text-xs text-white/40 hover:text-white/70 transition">查看全部 →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {assets.map((a) => {
          const thumb = a.resolvedUrl ?? a.thumbnailUrl ?? a.url ?? ''
          return (
            <Link
              key={a.id}
              href={`/assets/${a.id}`}
              className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.03] hover:border-white/20 transition"
              style={{ aspectRatio: '1' }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={a.title ?? a.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl opacity-20">🖼</div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition">
                <p className="truncate text-[9px] text-white/70">{a.title ?? a.name}</p>
              </div>
              <div className="absolute right-1 top-1">
                <span
                  className="rounded px-1 py-0.5 text-[8px] font-semibold"
                  style={{
                    background: a.isPublic ? 'rgba(52,211,153,0.2)' : 'rgba(0,0,0,0.5)',
                    color: a.isPublic ? '#6ee7b7' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {a.isPublic ? '🌐' : '🔒'}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
