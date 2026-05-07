'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { BreadcrumbHeader } from '@/components/layout/BreadcrumbHeader'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildWorkspacePortfolio } from '@/lib/projects/workspace'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { getProjectRoleLabel } from '@/lib/roles/projectRoles'
import { resolveDashboardRoleContext, resolveProjectRoleContext } from '@/lib/roles/currentRole'
import { getActionTarget } from '@/lib/routing/actions'
import { isPlaceholderProjectId } from '@/lib/routing/placeholders'
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

function sectionFromPath(pathname: string) {
  if (pathname.startsWith('/projects/')) return 'project-home'
  if (pathname.startsWith('/projects')) return 'projects'
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/review/')) return 'review'
  if (pathname.startsWith('/create')) return 'create'
  if (pathname.startsWith('/me')) return 'me'
  return 'workspace'
}

function projectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/)
  return match?.[1] ?? null
}

export function CurrentContextBar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
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
  const section = sectionFromPath(pathname)
  const rawProjectId = projectIdFromPath(pathname)
  const projectId = isPlaceholderProjectId(rawProjectId) ? null : rawProjectId

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

  const overview = projectId ? dashboard.overview.find((item) => item.projectId === projectId) ?? null : null
  const roleContext = projectId
    ? resolveProjectRoleContext(projectId, { userId: currentUserId, profileId, assignments })
    : resolveDashboardRoleContext(portfolio.cards.map((item) => item.projectId), { userId: currentUserId, profileId, assignments })
  const roleLabel = getProjectRoleLabel(roleContext.role)
  const waitingCount = projectId
    ? workQueue.items.filter((item) => item.projectId === projectId && !item.isDone).length
    : portfolio.summary.waitingForMeCount

  const quickActions = projectId
    ? (() => {
        if (roleContext.role === 'producer') {
          return [
            getActionTarget({ actionType: 'dashboard-project', projectId, actionLabel: 'Dashboard' }),
            getActionTarget({ actionType: 'project-team', projectId, actionLabel: 'Team' }),
            getActionTarget({ actionType: 'project-delivery', projectId, actionLabel: 'Delivery' }),
            getActionTarget({ actionType: 'project-planning', projectId, actionLabel: 'Planning' }),
          ]
        }
        if (roleContext.role === 'client') {
          return [
            getActionTarget({ actionType: 'project-review', projectId, actionLabel: 'Review' }),
            getActionTarget({ actionType: 'project-delivery', projectId, actionLabel: 'Delivery Snapshot' }),
          ]
        }
        return [
          getActionTarget({ actionType: 'project-review', projectId, actionLabel: 'Review' }),
          getActionTarget({ actionType: 'project-workspace', projectId, actionLabel: 'Workspace' }),
          getActionTarget({ actionType: 'project-delivery', projectId, actionLabel: 'Delivery' }),
          getActionTarget({ actionType: 'me', actionLabel: 'My Tasks' }),
        ]
      })()
    : [
        getActionTarget({ actionType: 'project-overview', projectId: portfolio.recentProjects[0]?.projectId, actionLabel: 'Open Project' }),
        getActionTarget({ actionType: 'dashboard-notifications', actionLabel: 'Notifications' }),
        getActionTarget({ actionType: 'me', actionLabel: 'My Work' }),
      ]

  const breadcrumbItems = projectId
    ? [
        { label: section === 'project-home' ? 'Projects' : section, href: section === 'project-home' ? '/projects' : undefined },
        { label: overview?.title ?? projectId },
      ]
    : [
        { label: section === 'me' ? 'My Work' : section === 'projects' ? 'Projects' : section === 'dashboard' ? 'Dashboard' : 'Workspace' },
      ]

  return (
    <div className="sticky top-16 z-40 border-b border-white/[0.06] bg-[#0b1220]/82 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <BreadcrumbHeader items={breadcrumbItems} />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold text-white">
                {projectId ? (overview?.title ?? `项目 ${projectId}`) : section === 'me' ? 'My Work' : section === 'projects' ? 'Projects' : 'Dashboard'}
              </h1>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">
                {roleLabel}
              </span>
              {overview?.currentStage ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/50">
                  Stage {overview.currentStage}
                </span>
              ) : null}
              <span className={`rounded-full border px-2.5 py-1 text-xs ${waitingCount > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-white/[0.04] text-white/50'}`}>
                {waitingCount > 0 ? `${waitingCount} waiting` : 'No urgent items'}
              </span>
            </div>
            <div className="mt-2 text-sm text-white/45">
              {projectId
                ? `当前项目入口已统一到同一壳层，先看角色、阶段、待处理事项，再进入 review / delivery / team。`
                : `当前 section：${section}。这里会统一展示你的项目、身份和最重要入口。`}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={`${section}-${action.actionLabel}`}
                href={action.actionHref}
                className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
              >
                {action.actionLabel}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
