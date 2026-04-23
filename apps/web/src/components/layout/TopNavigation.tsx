'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
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

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/explore', label: 'Explore' },
  { href: '/me', label: 'My Work' },
]

export function TopNavigation() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
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

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#0a0f1a]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold tracking-wide text-gradient">
            Creator City
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <WorkspaceSwitcher
            recentProjects={portfolio.recentProjects}
            highPriorityProjects={portfolio.highPriorityProjects}
            waitingProjects={portfolio.waitingProjects}
            compact
          />

          <Link
            href={notificationHref}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
          >
            <span>Notifications</span>
            <span className="text-white/35">{notificationSummary.unreadCount}</span>
            {notificationSummary.strongCount > 0 ? (
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-rose-300">
                {notificationSummary.strongCount} High
              </span>
            ) : null}
          </Link>

          <Link
            href="/me"
            className="hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white md:inline-flex"
          >
            My Work
          </Link>

          <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 md:flex">
            <div className="h-8 w-8 rounded-full bg-white/[0.08] text-center text-sm font-semibold leading-8 text-white">
              {user?.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.displayName ?? 'Guest'}</div>
              <div className="truncate text-[11px] text-white/40">{profileId}</div>
            </div>
            <button
              onClick={logout}
              className="text-xs text-white/40 transition hover:text-white/80"
              title="Sign out"
            >
              ↩
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
