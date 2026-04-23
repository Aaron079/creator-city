'use client'

import { useMemo } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { DiscoveryExplorer } from '@/components/explore/DiscoveryExplorer'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { aggregateDiscoveryData } from '@/lib/discovery/aggregate'
import { getActionTarget } from '@/lib/routing/actions'
import { useCaseStore } from '@/lib/case/caseStore'
import { CREATORS } from '@/lib/data/creators'
import { useCreatorStore } from '@/lib/user/creator'
import { useApprovalStore } from '@/store/approval.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useReviewStore } from '@/store/review.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'

export default function ExplorePage() {
  const profiles = useProfileStore((s) => s.profiles)
  const currentProfileId = useProfileStore((s) => s.currentUserId)
  const reviews = useReviewStore((s) => s.reviews)
  const jobs = useJobsStore((s) => s.jobs)
  const orders = useOrderStore((s) => s.orders)
  const cases = useCaseStore((s) => s.cases)
  const creators = useCreatorStore((s) => s.creators)
  const teams = useTeamStore((s) => s.teams)
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const notes = useDirectorNotesStore((s) => s.notes)
  const tasks = useTaskStore((s) => s.tasks)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const versions = useVersionHistoryStore((s) => s.versions)
  const assignments = useProjectRoleStore((s) => s.assignments)

  const dashboard = useMemo(() => aggregateProducerDashboard({
    teams,
    approvals,
    approvalGates,
    notes,
    tasks,
    orders,
    jobs,
    deliveryPackages,
    versions,
  }), [approvalGates, approvals, deliveryPackages, jobs, notes, orders, tasks, teams, versions])

  const canInviteCreators = useMemo(
    () => assignments.some((assignment) => (
      assignment.userId === currentProfileId
      && assignment.role === 'producer'
      && assignment.status === 'active'
    )),
    [assignments, currentProfileId],
  )

  const discovery = useMemo(() => aggregateDiscoveryData({
    overview: dashboard.overview,
    profiles,
    reviews,
    jobs,
    orders,
    cases,
    creators,
    creatorPool: CREATORS,
    teams,
    getProjectHref: (projectId) => `/projects/${encodeURIComponent(projectId)}`,
    getProjectRolesHref: (projectId) => getActionTarget({ actionType: 'project-team', projectId, actionLabel: '查看 open roles' }).actionHref,
    getProjectInviteHref: (projectId) => getActionTarget({ actionType: 'project-team', projectId, actionLabel: '进入匹配/邀请流程' }).actionHref,
    getProfileHref: (profileId) => `/profile/${encodeURIComponent(profileId)}`,
    getCaseHref: (caseId) => `/case/${encodeURIComponent(caseId)}`,
    canInviteCreators,
  }), [canInviteCreators, cases, creators, dashboard.overview, jobs, orders, profiles, reviews, teams])

  return (
    <DashboardShell>
      <DiscoveryExplorer data={discovery} />
    </DashboardShell>
  )
}
