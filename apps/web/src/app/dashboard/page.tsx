'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useApprovalStore } from '@/store/approval.store'
import { useAudioDeskStore } from '@/store/audio-desk.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useLicensingStore } from '@/store/licensing.store'
import { useOrderStore } from '@/store/order.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { buildLicenseRecords } from '@/lib/licensing/aggregate'
import { ProducerDashboard } from '@/components/dashboard/ProducerDashboard'

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const voiceTakes = useAudioDeskStore((s) => s.voiceTakes)
  const musicCues = useAudioDeskStore((s) => s.musicCues)
  const soundEffectCues = useAudioDeskStore((s) => s.soundEffectCues)
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

  const licensingSummary = useMemo(() => getSummary(), [getSummary])
  const licensingIssues = useMemo(() => getIssues(), [getIssues])

  if (!user) return null

  return (
    <DashboardShell>
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
      />
    </DashboardShell>
  )
}
