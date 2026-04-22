'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useApprovalStore } from '@/store/approval.store'
import { useDeliveryPackageStore } from '@/store/delivery-package.store'
import { useDirectorNotesStore } from '@/store/director-notes.store'
import { useJobsStore } from '@/store/jobs.store'
import { useOrderStore } from '@/store/order.store'
import { useTaskStore } from '@/store/task.store'
import { useTeamStore } from '@/store/team.store'
import { useVersionHistoryStore } from '@/store/version-history.store'
import { aggregateProducerDashboard } from '@/lib/dashboard/aggregate'
import { ProducerDashboard } from '@/components/dashboard/ProducerDashboard'

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const approvals = useApprovalStore((s) => s.approvals)
  const approvalGates = useApprovalStore((s) => s.gates)
  const notes = useDirectorNotesStore((s) => s.notes)
  const deliveryPackages = useDeliveryPackageStore((s) => s.deliveryPackages)
  const jobs = useJobsStore((s) => s.jobs)
  const orders = useOrderStore((s) => s.orders)
  const tasks = useTaskStore((s) => s.tasks)
  const teams = useTeamStore((s) => s.teams)
  const versions = useVersionHistoryStore((s) => s.versions)
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

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

  if (!user) return null

  return (
    <DashboardShell>
      <ProducerDashboard data={dashboard} />
    </DashboardShell>
  )
}
