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
import { canEnterDashboard, getProjectAccessState } from '@/lib/roles/access'
import { getActionTarget, getMeHref } from '@/lib/routing/actions'
import { AccessFallback } from '@/components/ui/AccessFallback'
import { LoadingState } from '@/components/ui/LoadingState'
import { useFeedback } from '@/lib/feedback/useFeedback'

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
  const invitations = useTeamStore((s) => s.invitations)
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
  const markNotificationSectionRead = useNotificationsStore((s) => s.markSectionRead)
  const markNotificationProjectRead = useNotificationsStore((s) => s.markProjectRead)
  const dismissNotification = useNotificationsStore((s) => s.dismissNotification)
  const dismissNotificationSection = useNotificationsStore((s) => s.dismissAllInSection)
  const dismissNotificationProject = useNotificationsStore((s) => s.dismissAllInProject)
  const snoozeNotification = useNotificationsStore((s) => s.snoozeNotification)
  const unsnoozeExpired = useNotificationsStore((s) => s.unsnoozeExpired)
  const getNotificationSummary = useNotificationsStore((s) => s.getSummary)
  const upsertNotificationRule = useNotificationsStore((s) => s.upsertRule)
  const router = useRouter()
  const feedback = useFeedback()

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

  useEffect(() => {
    unsnoozeExpired()
  }, [unsnoozeExpired])

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

  const allProjectIds = useMemo(
    () => Array.from(new Set([
      ...teams.map((team) => team.projectId),
      ...orders.map((order) => order.id),
      ...deliveryPackages.map((pkg) => pkg.projectId),
      ...projectRoleAssignments.map((assignment) => assignment.projectId),
      ...invitations.map((invitation) => invitation.projectId),
    ].filter(Boolean))),
    [deliveryPackages, invitations, orders, projectRoleAssignments, teams],
  )
  const accessByProject = useMemo(
    () => allProjectIds.map((projectId) => getProjectAccessState(projectId, {
      userId: user?.id ?? null,
      profileId: currentProfileId ?? null,
      assignments: projectRoleAssignments,
      teams,
      invitations,
    })),
    [allProjectIds, currentProfileId, invitations, projectRoleAssignments, teams, user?.id],
  )
  const accessibleProjectIds = useMemo(
    () => accessByProject
      .filter((item) => canEnterDashboard(item.projectId, {
        userId: item.userId,
        profileId: item.profileId,
        assignments: projectRoleAssignments,
        teams,
        invitations,
      }))
      .map((item) => item.projectId),
    [accessByProject, invitations, projectRoleAssignments, teams],
  )
  const invitedProjectIds = useMemo(
    () => accessByProject.filter((item) => item.state === 'invited').map((item) => item.projectId),
    [accessByProject],
  )
  const clientOnlyProjectIds = useMemo(
    () => accessByProject.filter((item) => item.state === 'client-only').map((item) => item.projectId),
    [accessByProject],
  )
  const filteredTeams = useMemo(
    () => teams.filter((team) => accessibleProjectIds.includes(team.projectId)),
    [accessibleProjectIds, teams],
  )
  const filteredOrders = useMemo(
    () => orders.filter((order) => accessibleProjectIds.includes(order.id) || accessibleProjectIds.includes(order.chatId)),
    [accessibleProjectIds, orders],
  )
  const allowedJobIds = useMemo(
    () => new Set([
      ...accessibleProjectIds,
      ...filteredOrders.map((order) => order.chatId),
    ].filter(Boolean)),
    [accessibleProjectIds, filteredOrders],
  )
  const filteredJobs = useMemo(
    () => jobs.filter((job) => allowedJobIds.has(job.id)),
    [allowedJobIds, jobs],
  )
  const allowedTargetIds = useMemo(
    () => new Set([
      ...accessibleProjectIds,
      ...filteredJobs.map((job) => job.id),
      ...filteredOrders.map((order) => order.id),
      ...filteredOrders.map((order) => order.chatId),
    ].filter(Boolean)),
    [accessibleProjectIds, filteredJobs, filteredOrders],
  )
  const filteredApprovals = useMemo(
    () => approvals.filter((approval) => allowedTargetIds.has(approval.targetId)),
    [allowedTargetIds, approvals],
  )
  const filteredNotes = useMemo(
    () => notes.filter((note) => allowedTargetIds.has(note.targetId)),
    [allowedTargetIds, notes],
  )
  const filteredDeliveryPackages = useMemo(
    () => deliveryPackages.filter((pkg) => accessibleProjectIds.includes(pkg.projectId)),
    [accessibleProjectIds, deliveryPackages],
  )
  const filteredVersions = useMemo(
    () => versions.filter((version) => allowedTargetIds.has(version.entityId)),
    [allowedTargetIds, versions],
  )
  const allowedTeamIds = useMemo(
    () => new Set(filteredTeams.map((team) => team.id)),
    [filteredTeams],
  )
  const filteredTasks = useMemo(
    () => tasks.filter((task) => allowedTeamIds.has(task.teamId)),
    [allowedTeamIds, tasks],
  )

  const dashboard = useMemo(() => aggregateProducerDashboard({
    teams: filteredTeams,
    approvals: filteredApprovals,
    approvalGates,
    notes: filteredNotes,
    tasks: filteredTasks,
    orders: filteredOrders,
    jobs: filteredJobs,
    deliveryPackages: filteredDeliveryPackages,
    versions: filteredVersions,
  }), [approvalGates, filteredApprovals, filteredDeliveryPackages, filteredJobs, filteredNotes, filteredOrders, filteredTasks, filteredTeams, filteredVersions])

  const planningSettings = useMemo(() => loadPlanningSettings(), [])
  const planning = useMemo(
    () => buildProducerPlanningData(dashboard, planningSettings),
    [dashboard, planningSettings],
  )

  const generatedNotifications = useMemo(() => buildNotifications({
    dashboard,
    planning,
    approvals: filteredApprovals,
    notes: filteredNotes,
    deliveryPackages: filteredDeliveryPackages,
    orders: filteredOrders,
    jobs: filteredJobs,
    teams: filteredTeams,
    rules: notificationRules,
  }), [dashboard, planning, filteredApprovals, filteredNotes, filteredDeliveryPackages, filteredOrders, filteredJobs, filteredTeams, notificationRules])

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
    feedback.success(`已向 ${candidate.displayName} 发出 ${role} 邀请`)
  }, [createTeam, feedback, inviteMember, matching.projects, user?.displayName, user?.id])

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
      const project = dashboard.overview.find((item) => item.projectId === projectId)
      syncActivityLog(projectId, {
        projectTitle: project?.title,
      })
    })
  }, [
    activityProjectIds,
    dashboard.overview,
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
  const hasDashboardAccess = accessibleProjectIds.length > 0
  const dashboardFallbackAction = invitedProjectIds.length > 0
    ? getActionTarget({ actionType: 'invitation-inbox', actionLabel: '前往我的邀请页' })
    : clientOnlyProjectIds.length > 0
      ? getActionTarget({
          actionType: 'project-review',
          projectId: clientOnlyProjectIds[0],
          actionLabel: '前往 Review Portal',
        })
      : getActionTarget({
          actionType: 'me',
          actionLabel: '查看当前身份',
        })

  if (!user) {
    return (
      <DashboardShell>
        <LoadingState title="正在加载 Dashboard" message="正在验证当前账号与项目权限。" count={3} />
      </DashboardShell>
    )
  }

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
      {!hasDashboardAccess ? (
        <AccessFallback
          title={invitedProjectIds.length > 0
            ? '你已收到项目邀请，接受后可进入 Dashboard'
            : clientOnlyProjectIds.length > 0
              ? '当前账号以 Client 角色绑定到项目'
              : '当前账号还不能进入项目 Dashboard'}
          message={invitedProjectIds.length > 0
            ? '这些项目已经邀请你加入，但在你接受邀请之前，Dashboard 不会开放完整的项目总控视图。先去我的邀请页确认加入，之后项目级视图和动作权限会自动生效。'
            : clientOnlyProjectIds.length > 0
              ? 'Client 角色不会进入完整 Producer Dashboard。你可以继续通过 Review Portal 查看待确认内容和交付快照。'
              : '当前账号没有 active project membership，因此暂时不能进入项目 Dashboard。你可以先查看我的身份概览，或联系 Producer 完成项目成员绑定。'}
          details={[
            `当前账号：${user.displayName ?? user.id}`,
            `当前 Profile：${currentProfileId ?? '未解析'}`,
            invitedProjectIds.length > 0 ? `待接受邀请：${invitedProjectIds.length} 个项目` : `Client-only 项目：${clientOnlyProjectIds.length} 个`,
          ]}
          actionHref={dashboardFallbackAction.actionHref}
          actionLabel={dashboardFallbackAction.actionLabel}
          secondaryHref={clientOnlyProjectIds.length > 0 ? getMeHref() : undefined}
          secondaryLabel={clientOnlyProjectIds.length > 0 ? '查看我的项目身份' : undefined}
        />
      ) : (
        <ProducerDashboard
          data={dashboard}
          licensing={{
            records,
            summary: licensingSummary,
            issues: licensingIssues,
            deliveryPackages: filteredDeliveryPackages,
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
        onMarkSectionRead: markNotificationSectionRead,
        onMarkProjectRead: markNotificationProjectRead,
        onDismiss: dismissNotification,
        onDismissSection: dismissNotificationSection,
        onDismissProject: dismissNotificationProject,
        onSnooze: snoozeNotification,
        onToggleRule: upsertNotificationRule,
      }}
          activity={{
            items: activityTimelineItems,
            summary: activitySummary,
          }}
          permissions={dashboardPermissions}
          role={dashboardRole}
        />
      )}
    </DashboardShell>
  )
}
