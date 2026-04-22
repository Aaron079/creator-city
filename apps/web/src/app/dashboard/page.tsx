'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useApprovalStore } from '@/store/approval.store'
import { useAudioDeskStore } from '@/store/audio-desk.store'
import { useCaseStore } from '@/lib/case/caseStore'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { CREATORS } from '@/lib/data/creators'
import { useLicensingStore } from '@/store/licensing.store'
import { useOrderStore } from '@/store/order.store'
import { useCreatorStore } from '@/lib/user/creator'
import { aggregateTalentMatching, getRoleNeedLabel, type MatchCandidate, type RoleNeed } from '@/lib/matching/aggregate'
import { useMockRoleMode } from '@/lib/roles/view-mode'
import { useProfileStore } from '@/store/profile.store'
import { useReviewStore } from '@/store/review.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildLicenseRecords } from '@/lib/licensing/aggregate'
import { ProducerDashboard } from '@/components/dashboard/ProducerDashboard'
import { RoleViewSwitcher } from '@/components/roles/RoleViewSwitcher'

export default function DashboardPage() {
  const { role, setRole } = useMockRoleMode('producer')
  const { user, isAuthenticated } = useAuthStore()
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
  const versions = useVersionHistoryStore((s) => s.versions)
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

  const handleInviteCandidate = useCallback((projectId: string, need: RoleNeed, candidate: MatchCandidate) => {
    const team = createTeam(
      projectId,
      user?.id ?? 'user-me',
      user?.displayName ?? '我 (发布方)',
    )

    inviteMember(team.id, {
      userId: candidate.profileId,
      name: candidate.displayName,
      role: getRoleNeedLabel(need.role),
      split: 20,
    })
  }, [createTeam, inviteMember, user?.displayName, user?.id])

  const licensingSummary = useMemo(() => getSummary(), [getSummary])
  const licensingIssues = useMemo(() => getIssues(), [getIssues])

  if (!user) return null

  return (
    <DashboardShell>
      <div className="mb-6">
        <RoleViewSwitcher role={role} onChange={setRole} />
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
          onInvite: handleInviteCandidate,
        }}
        role={role}
      />
    </DashboardShell>
  )
}
