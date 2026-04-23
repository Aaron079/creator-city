'use client'

import type { ActivitySummary } from '@/lib/activity/aggregate'

function SummaryTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning' | 'strong'
}) {
  const cls = tone === 'strong'
    ? 'border-rose-500/20 bg-rose-500/8'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/8'
      : 'border-white/6 bg-white/2'

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

export function ActivitySummaryBar({ summary }: { summary: ActivitySummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <SummaryTile label="Today" value={summary.todayCount} />
      <SummaryTile label="Invitations" value={summary.invitationCount} />
      <SummaryTile label="Role Changes" value={summary.roleChangeCount} />
      <SummaryTile label="Approval Requests" value={summary.approvalRequestedCount} />
      <SummaryTile label="Approval Decisions" value={summary.approvalDecisionCount} tone={summary.approvalDecisionCount > 0 ? 'warning' : 'default'} />
      <SummaryTile label="Delivery Submitted" value={summary.deliverySubmittedCount} tone={summary.deliverySubmittedCount > 0 ? 'strong' : 'default'} />
    </div>
  )
}
