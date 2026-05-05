'use client'

import React from 'react'
import Link from 'next/link'
import { useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/command/CommandPalette'
import { WorkspaceSwitcher } from '@/components/projects/WorkspaceSwitcher'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildWorkspacePortfolio } from '@/lib/projects/workspace'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { buildNotificationSummary, useNotificationsStore } from '@/store/notifications.store'
import { useApprovalStore } from '@/store/approval.store'
import { useAuthStore } from '@/store/auth.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { getActionTarget } from '@/lib/routing/actions'
import { clientLogout } from '@/lib/auth/client'

const LINKS = [
  { href: '/', label: '首页' },
  { href: '/create', label: 'AI 画布' },
  { href: '/projects?new=1', label: '新建项目' },
  { href: '/templates', label: '模板库' },
  { href: '/projects', label: '工作空间' },
  { href: '/explore', label: '探索' },
  { href: '/community', label: '社群' },
  { href: '/tools', label: '工具 / API' },
  { href: '/billing', label: '购买积分' },
  { href: '/account/credits', label: '积分' },
  { href: '/me', label: '我的' },
]

export function TopNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isAuthenticated } = useAuthStore()
  const currentProfileId = useProfileStore((s) => s.currentUserId)
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const notes = useDirectorNotesStore((s) => s.notes)
  const jobs = useJobsStore((s) => s.jobs)
  const notifications = useNotificationsStore((s) => s.items)
  const orders = useOrderStore((s) => s.orders)
  const assignments = useProjectRoleStore((s) => s.assignments)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const invitations = useTeamStore((s) => s.invitations)
  const versions = useVersionHistoryStore((s) => s.versions)

  const currentUserId = user?.id ?? currentProfileId ?? 'user-me'
  const profileId = currentProfileId ?? currentUserId

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
      userId: currentUserId,
      profileId,
      invitations,
      assignments,
      tasks,
      teams,
      approvals,
      deliveryPackages,
      notifications,
    }),
    [approvals, assignments, currentUserId, deliveryPackages, invitations, notifications, profileId, tasks, teams],
  )

  const portfolio = useMemo(
    () => buildWorkspacePortfolio({
      userId: currentUserId,
      profileId,
      assignments,
      teams,
      invitations,
      dashboard,
      workQueue,
      notifications,
      deliveryPackages,
      approvals,
    }),
    [approvals, assignments, currentUserId, dashboard, deliveryPackages, invitations, notifications, profileId, teams, workQueue],
  )

  const notificationSummary = useMemo(
    () => buildNotificationSummary(notifications),
    [notifications],
  )

  const notificationHref = getActionTarget({ actionType: 'dashboard-notifications' }).actionHref

  const handleLogout = async () => {
    await clientLogout()
    logout()
    router.push('/')
  }

  // Navigate to last-opened canvas project, or fall back to /create (which auto-resolves)
  const handleCreateClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    let href = '/create'
    try {
      const lastId = window.localStorage.getItem('creator-city:last-project-id')
      if (lastId) href = `/create?projectId=${encodeURIComponent(lastId)}`
    } catch (_) { /* private mode — fall back to /create */ }
    router.push(href)
  }, [router])

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#0a0f1a]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs font-bold tracking-[0.02em] text-gradient">
            Creator City
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
              const navClass = `rounded-xl px-2.5 py-1.5 text-[12px] transition ${
                active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
              }`
              // The canvas link reads localStorage to reopen the last project directly
              if (link.href === '/create') {
                return (
                  <a key={link.href} href="/create" onClick={handleCreateClick} className={navClass}>
                    {link.label}
                  </a>
                )
              }
              return (
                <Link key={link.href} href={link.href} className={navClass}>
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/60 transition hover:border-white/20 hover:text-white lg:inline-flex"
          >
            ZH / EN
          </button>

          <CommandPalette
            portfolio={portfolio}
            workQueue={workQueue}
            notifications={notifications}
          />

          <div className="hidden xl:block">
            <WorkspaceSwitcher
              recentProjects={portfolio.recentProjects}
              highPriorityProjects={portfolio.highPriorityProjects}
              waitingProjects={portfolio.waitingProjects}
              compact
            />
          </div>

          <Link
            href={notificationHref}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white/75 transition hover:border-white/20 hover:text-white"
          >
            <span>Notifications</span>
            <span className="text-white/35">{notificationSummary.unreadCount}</span>
            {notificationSummary.strongCount > 0 ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-rose-300">
                {notificationSummary.strongCount} High
              </span>
            ) : null}
          </Link>

          {isAuthenticated && user ? (
            <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 md:flex">
              <div className="h-7 w-7 rounded-full bg-white/[0.08] text-center text-xs font-semibold leading-7 text-white shrink-0">
                {user.displayName[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium text-white">{user.displayName}</div>
                <div className="truncate text-[10px] text-white/40">{user.email}</div>
              </div>
              <Link href="/account" className="text-xs text-white/40 transition hover:text-white/70 px-1" title="账号设置">⚙</Link>
              <button
                onClick={() => void handleLogout()}
                className="text-xs text-white/40 transition hover:text-white/80"
                title="登出"
              >
                ↩
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/auth/login"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/20 hover:text-white"
              >
                登录
              </Link>
              <Link
                href="/auth/register"
                className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 px-3 py-1.5 text-[12px] text-white font-medium transition"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
