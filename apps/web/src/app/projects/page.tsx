'use client'

import { useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { UserProjectPortfolio } from '@/components/projects/UserProjectPortfolio'
import { WorkspaceSwitcher } from '@/components/projects/WorkspaceSwitcher'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildWorkspacePortfolio } from '@/lib/projects/workspace'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
import { useApprovalStore } from '@/store/approval.store'
import { useAuthStore } from '@/store/auth.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useNotificationsStore } from '@/store/notifications.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useVersionHistoryStore } from '@/store/version-history.store'

export default function ProjectsPage() {
  const authUser = useAuthStore((s) => s.user)
  const currentProfileId = useProfileStore((s) => s.currentUserId)
  const approvals = useApprovalStore((s) => s.approvals)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const notifications = useNotificationsStore((s) => s.items)
  const assignments = useProjectRoleStore((s) => s.assignments)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const invitations = useTeamStore((s) => s.invitations)
  const notes = useDirectorNotesStore((s) => s.notes)
  const jobs = useJobsStore((s) => s.jobs)
  const orders = useOrderStore((s) => s.orders)
  const versions = useVersionHistoryStore((s) => s.versions)
  const approvalGates = useApprovalStore((s) => s.gates)

  const currentUserId = authUser?.id ?? currentProfileId ?? 'user-me'
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

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="mt-1 text-gray-400">Your productions and collaborations.</p>
          </div>
        </div>
        <WorkspaceSwitcher
          recentProjects={portfolio.recentProjects}
          highPriorityProjects={portfolio.highPriorityProjects}
          waitingProjects={portfolio.waitingProjects}
        />
        <UserProjectPortfolio
          data={portfolio}
          title="My Projects / My Portfolio"
          subtitle="这里按你在每个项目中的角色给出不同摘要，并把最常用的跨项目入口统一收口。"
        />
      </div>
    </DashboardShell>
  )
}
