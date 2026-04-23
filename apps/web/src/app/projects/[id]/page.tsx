'use client'

import { useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { RoleAwareProjectHome } from '@/components/projects/RoleAwareProjectHome'
import { buildActivityLogItems } from '@/lib/activity/aggregate'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildProducerPlanningData, loadPlanningSettings } from '@/lib/dashboard/planning'
import { buildClientProjectStatusFeed } from '@/lib/projects/client-feed'
import { buildRoleAwareProjectHome } from '@/lib/projects/home'
import { buildReviewResolutionSeeds } from '@/lib/review/resolution'
import { useReviewResolutionStore } from '@/lib/review/resolution-store'
import { getProjectAccessState } from '@/lib/roles/access'
import { resolveProjectRoleContext } from '@/lib/roles/currentRole'
import { buildPersonalWorkQueue } from '@/lib/workqueue/aggregate'
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

export default function ProjectHomePage() {
  const { isAuthenticated, user } = useAuthStore()
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
  const getProjectMembers = useTeamStore((s) => s.getProjectMembers)
  const getPendingInvitations = useTeamStore((s) => s.getPendingInvitations)
  const getInvitationActivity = useTeamStore((s) => s.getInvitationActivity)
  const roleChanges = useTeamStore((s) => s.roleChanges)
  const versions = useVersionHistoryStore((s) => s.versions)
  const resolutionItems = useReviewResolutionStore((s) => s.items)
  const syncResolutionItems = useReviewResolutionStore((s) => s.syncResolutionItems)
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

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

  const planning = useMemo(
    () => buildProducerPlanningData(dashboard, loadPlanningSettings()),
    [dashboard],
  )

  const currentUserId = user?.id ?? currentProfileId ?? 'user-me'
  const currentProfile = currentProfileId ?? currentUserId

  const workQueue = useMemo(
    () => buildPersonalWorkQueue({
      userId: currentUserId,
      profileId: currentProfile,
      invitations,
      assignments,
      tasks,
      teams,
      approvals,
      deliveryPackages,
      notifications,
    }),
    [currentProfile, currentUserId, invitations, assignments, tasks, teams, approvals, deliveryPackages, notifications],
  )

  const projectOverview = dashboard.overview.find((item) => item.projectId === projectId) ?? null
  const projectTitle = projectOverview?.title
    ?? deliveryPackages.find((pkg) => pkg.projectId === projectId)?.title
    ?? invitations.find((item) => item.projectId === projectId)?.projectTitle
    ?? `项目 ${projectId}`

  const access = useMemo(
    () => getProjectAccessState(projectId, {
      userId: currentUserId,
      profileId: currentProfile,
      assignments,
      teams,
      invitations,
    }),
    [assignments, currentProfile, currentUserId, invitations, projectId, teams],
  )

  const roleContext = useMemo(
    () => resolveProjectRoleContext(projectId, {
      userId: currentUserId,
      profileId: currentProfile,
      assignments,
    }),
    [assignments, currentProfile, currentUserId, projectId],
  )

  const activity = useMemo(
    () => buildActivityLogItems({
      projectId,
      projectTitle,
      invitationActivities: getInvitationActivity(projectId),
      roleChanges,
      approvals,
      notes,
      versions,
      deliveryPackages,
      notifications,
    }),
    [approvals, deliveryPackages, getInvitationActivity, notes, notifications, projectId, projectTitle, roleChanges, versions],
  )
  const resolutionSeeds = useMemo(
    () => buildReviewResolutionSeeds({
      projectId,
      approvals: approvals.filter((approval) => activity.some((item) => item.targetId === approval.targetId)),
      notes: notes.filter((note) => note.targetId === projectId || activity.some((item) => item.targetId === note.targetId)),
      versions,
    }),
    [activity, approvals, notes, projectId, versions],
  )
  const projectResolutions = useMemo(
    () => resolutionItems.filter((item) => item.projectId === projectId),
    [projectId, resolutionItems],
  )

  useEffect(() => {
    if (resolutionSeeds.length === 0) return
    syncResolutionItems(projectId, resolutionSeeds)
  }, [projectId, resolutionSeeds, syncResolutionItems])

  const clientFeed = useMemo(
    () => buildClientProjectStatusFeed({
      projectId,
      projectTitle,
      currentStage: projectOverview?.currentStage ?? 'idea',
      approvals,
      versions,
      deliveryPackage: deliveryPackages.find((pkg) => pkg.projectId === projectId) ?? null,
      activity,
      resolutions: projectResolutions,
    }),
    [activity, approvals, deliveryPackages, projectId, projectOverview?.currentStage, projectResolutions, projectTitle, versions],
  )

  const homeData = useMemo(
    () => buildRoleAwareProjectHome({
      projectId,
      access,
      roleContext,
      dashboard,
      planning,
      workQueue,
      notifications,
      activity,
      clientFeed,
      deliveryPackage: deliveryPackages.find((pkg) => pkg.projectId === projectId) ?? null,
      members: getProjectMembers(projectId),
      invitations: getPendingInvitations(projectId),
      invitationActivity: getInvitationActivity(projectId),
    }),
    [
      access,
      activity,
      clientFeed,
      dashboard,
      deliveryPackages,
      getInvitationActivity,
      getPendingInvitations,
      getProjectMembers,
      notifications,
      planning,
      projectId,
      roleContext,
      workQueue,
    ],
  )

  if (!isAuthenticated) return null

  return (
    <DashboardShell>
      <RoleAwareProjectHome data={homeData} />
    </DashboardShell>
  )
}
