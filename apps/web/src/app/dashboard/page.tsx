'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useApprovalStore } from '@/store/approval.store'
import { useAudioDeskStore } from '@/store/audio-desk.store'
import { useCaseStore } from '@/lib/case/caseStore'
import { buildProducerPlanningData, loadPlanningSettings } from '@/lib/dashboard/planning'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { CREATORS } from '@/lib/data/creators'
import { useLicensingStore } from '@/store/licensing.store'
import { buildNotificationAiSummary, buildNotifications } from '@/lib/notifications/aggregate'
import { useNotificationsStore } from '@/store/notifications.store'
import { useOrderStore } from '@/store/order.store'
import { useCreatorStore } from '@/lib/user/creator'
import { aggregateTalentMatching, type MatchCandidate, type RoleNeed } from '@/lib/matching/aggregate'
import { summarizeActivity } from '@/lib/activity/aggregate'
import { resolveDashboardRoleContext } from '@/lib/roles/currentRole'
import { useMockRoleMode } from '@/lib/roles/view-mode'
import { useActivityLogStore } from '@/store/activity-log.store'
import { useProfileStore } from '@/store/profile.store'
import { useProjectRoleStore } from '@/store/project-role.store'
import { useReviewStore } from '@/store/review.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildLicenseRecords } from '@/lib/licensing/aggregate'
import { ProducerDashboard } from '@/components/dashboard/ProducerDashboard'
import { RoleViewSwitcher } from '@/components/roles/RoleViewSwitcher'

export default function DashboardPage() {
  const { roleOverride, setRoleOverride, clearRoleOverride } = useMockRoleMode('producer')
  const { user, isAuthenticated } = useAuthStore()
  const currentProfileId = useProfileStore((s) => s.currentUserId)
  const projectRoleAssignments = useProjectRoleStore((s) => s.assignments)
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const voiceTakes = useAudioDeskStore((s) => s.voiceTakes)
  const musicCues = useAudioDeskStore((s) => s.musicCues)
  const soundEffectCues = useAudioDeskStore((s) => s.soundEffectCues)
  const cases = useCaseStore((s) => s.cases)
  const creatorProfiles = useProfileStore((s) => s.profiles)
  const creatorReviews = useReviewStore((s) => s.reviews)
  const creatorStats = useCreatorStore((s) => s.creators)
  const notes = useDirectorNotesStore((s) => s.notes)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const generateDeliveryRiskSummary = useDeliveryPackageStore((s) => s.generateDeliveryRiskSummary)
  const jobs = useJobsStore((s) => s.jobs)
  const records = useLicensingStore((s) => s.records)
  const syncLicenseRecords = useLicensingStore((s) => s.syncLicenseRecords)
  const getSummary = useLicensingStore((s) => s.getSummary)
  const getIssues = useLicensingStore((s) => s.getIssues)
  const markCommercialCleared = useLicensingStore((s) => s.markCommercialCleared)
  const markRestricted = useLicensingStore((s) => s.markRestricted)
  const attachProof = useLicensingStore((s) => s.attachProof)
  const setUsageScope = useLicensingStore((s) => s.setUsageScope)
  const orders = useOrderStore((s) => s.orders)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const createTeam = useTeamStore((s) => s.createTeam)
  const inviteMember = useTeamStore((s) => s.inviteMember)
  const cancelInvitation = useTeamStore((s) => s.cancelInvitation)
  const changeMemberRole = useTeamStore((s) => s.changeMemberRole)
  const removeMember = useTeamStore((s) => s.removeMember)
  const getProjectMembers = useTeamStore((s) => s.getProjectMembers)
  const getPendingInvitations = useTeamStore((s) => s.getPendingInvitations)
  const getInvitationActivity = useTeamStore((s) => s.getInvitationActivity)
  const versions = useVersionHistoryStore((s) => s.versions)
  const notificationItems = useNotificationsStore((s) => s.items)
  const notificationRules = useNotificationsStore((s) => s.rules)
  const syncNotifications = useNotificationsStore((s) => s.syncNotifications)
  const markNotificationRead = useNotificationsStore((s) => s.markRead)
  const markAllNotificationsRead = useNotificationsStore((s) => s.markAllRead)
  const dismissNotification = useNotificationsStore((s) => s.dismissNotification)
  const getNotificationSummary = useNotificationsStore((s) => s.getSummary)
  const upsertNotificationRule = useNotificationsStore((s) => s.upsertRule)
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

  const syncedLicenseRecords = useMemo(() => buildLicenseRecords({
    voiceTakes,
    musicCues,
    soundEffectCues,
    deliveryPackages,
  }), [deliveryPackages, musicCues, soundEffectCues, voiceTakes])

  useEffect(() => {
    syncLicenseRecords(syncedLicenseRecords)
  }, [syncLicenseRecords, syncedLicenseRecords])

  const licensingSignature = useMemo(
    () => records
      .map((record) => `${record.id}:${record.licenseStatus}:${record.usageScope}:${record.proofUrl ?? ''}:${record.expiresAt ?? ''}`)
      .join('|'),
    [records],
  )

  const deliveryPackageIds = useMemo(
    () => deliveryPackages.map((pkg) => pkg.id),
    [deliveryPackages],
  )

  useEffect(() => {
    deliveryPackageIds.forEach((packageId) => {
      generateDeliveryRiskSummary(packageId)
    })
  }, [deliveryPackageIds, generateDeliveryRiskSummary, licensingSignature])

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
  }), [teams, approvals, approvalGates, notes, tasks, orders, jobs, deliveryPackages, versions])

  const planningSettings = useMemo(() => loadPlanningSettings(), [])
  const planning = useMemo(
    () => buildProducerPlanningData(dashboard, planningSettings),
    [dashboard, planningSettings],
  )

  const generatedNotifications = useMemo(() => buildNotifications({
    dashboard,
    planning,
    approvals,
    notes,
    deliveryPackages,
    orders,
    jobs,
    teams,
    rules: notificationRules,
  }), [dashboard, planning, approvals, notes, deliveryPackages, orders, jobs, teams, notificationRules])

  useEffect(() => {
    syncNotifications(generatedNotifications)
  }, [generatedNotifications, syncNotifications])

  const matching = useMemo(() => aggregateTalentMatching({
    overview: dashboard.overview,
    teams,
    orders,
    jobs,
    profiles: creatorProfiles,
    reviews: creatorReviews,
    creators: creatorStats,
    cases,
    creatorPool: CREATORS,
  }), [cases, creatorProfiles, creatorReviews, creatorStats, dashboard.overview, jobs, orders, teams])

  const handleInviteCandidate = useCallback((projectId: string, need: RoleNeed, candidate: MatchCandidate, role: string) => {
    const project = matching.projects.find((item) => item.projectId === projectId)
    createTeam(
      projectId,
      user?.id ?? 'user-me',
      user?.displayName ?? '我 (发布方)',
    )

    inviteMember(
      projectId,
      candidate.profileId,
      role,
      user?.id ?? 'user-me',
      {
        projectTitle: project?.title ?? projectId,
        displayName: candidate.displayName,
        invitedByName: user?.displayName ?? '我 (发布方)',
        city: candidate.city,
        ratingSummary: candidate.ratingSummary,
        matchedCaseIds: candidate.matchedCaseIds,
      },
    )
  }, [createTeam, inviteMember, matching.projects, user?.displayName, user?.id])

  const licensingSummary = useMemo(() => getSummary(), [getSummary])
  const licensingIssues = useMemo(() => getIssues(), [getIssues])
  const notificationSummary = useMemo(() => getNotificationSummary(), [getNotificationSummary])
  const notificationAiSummary = useMemo(
    () => buildNotificationAiSummary(notificationItems),
    [notificationItems],
  )
  const activityItems = useActivityLogStore((s) => s.items)
  const syncActivityLog = useActivityLogStore((s) => s.syncFromExistingSystems)
  const activityProjectIds = useMemo(
    () => Array.from(new Set(dashboard.overview.map((item) => item.projectId))),
    [dashboard.overview],
  )
  useEffect(() => {
    activityProjectIds.forEach((projectId) => {
      syncActivityLog(projectId)
    })
  }, [
    activityProjectIds,
    syncActivityLog,
    approvals,
    notes,
    deliveryPackages,
    versions,
    teams,
    notificationItems,
  ])
  const activityTimelineItems = useMemo(
    () => activityItems
      .filter((item) => activityProjectIds.includes(item.projectId))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 12),
    [activityItems, activityProjectIds],
  )
  const activitySummary = useMemo(
    () => summarizeActivity(activityItems.filter((item) => activityProjectIds.includes(item.projectId))),
    [activityItems, activityProjectIds],
  )
  const roleContext = useMemo(
    () => resolveDashboardRoleContext(
      dashboard.overview.map((item) => item.projectId),
      {
        userId: user?.id ?? null,
        profileId: currentProfileId ?? null,
        assignments: projectRoleAssignments,
        fallbackRole: 'producer',
        overrideRole: roleOverride,
      },
    ),
    [currentProfileId, dashboard.overview, projectRoleAssignments, roleOverride, user?.id],
  )
  const dashboardRole = roleContext.source === 'fallback' ? 'client' : roleContext.role
  const dashboardPermissions = useMemo(
    () => roleContext.source === 'fallback'
      ? {
          ...roleContext.permissions,
          canViewDashboard: false,
          canManagePlanning: false,
          canManageDelivery: false,
          canInviteTeam: false,
          canViewCommercialStatus: false,
        }
      : roleContext.permissions,
    [roleContext],
  )

  if (!user) return null

  return (
    <DashboardShell>
      <div className="mb-6">
        <RoleViewSwitcher
          resolvedRole={roleContext.role}
          overrideRole={roleOverride}
          onChange={setRoleOverride}
          onClear={clearRoleOverride}
        />
      </div>
      <ProducerDashboard
        data={dashboard}
        licensing={{
          records,
          summary: licensingSummary,
          issues: licensingIssues,
          deliveryPackages,
          onMarkCommercialCleared: markCommercialCleared,
          onMarkRestricted: markRestricted,
          onSetUsageScope: setUsageScope,
          onAttachProof: attachProof,
        }}
        matching={{
          data: matching,
          getProjectMembers,
          getPendingInvitations,
          getInvitationActivity,
          onInvite: handleInviteCandidate,
          onCancelInvitation: cancelInvitation,
          onChangeMemberRole: changeMemberRole,
          onRemoveMember: removeMember,
        }}
        notifications={{
          items: notificationItems,
          summary: notificationSummary,
          rules: notificationRules,
          aiSummary: notificationAiSummary,
          onMarkRead: markNotificationRead,
          onMarkAllRead: markAllNotificationsRead,
          onDismiss: dismissNotification,
          onToggleRule: upsertNotificationRule,
        }}
        activity={{
          items: activityTimelineItems,
          summary: activitySummary,
        }}
        permissions={dashboardPermissions}
        role={dashboardRole}
      />
    </DashboardShell>
  )
}
