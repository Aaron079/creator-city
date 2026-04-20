'use client'

import type { ApprovalRequest } from '@/store/approval.store'

const STATUS_META: Record<ApprovalRequest['status'], { label: string; color: string; background: string; border: string }> = {
  pending: { label: '待确认', color: '#c7d2fe', background: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.24)' },
  approved: { label: '已确认', color: '#a7f3d0', background: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.24)' },
  'changes-requested': { label: '需修改', color: '#fde68a', background: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.24)' },
  rejected: { label: '已拒绝', color: '#fda4af', background: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.24)' },
  stale: { label: '已过期', color: '#fdba74', background: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.24)' },
}

export function ReviewStatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="px-2 py-1 rounded-lg text-[9px]"
      style={{ background: meta.background, color: meta.color, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  )
}
