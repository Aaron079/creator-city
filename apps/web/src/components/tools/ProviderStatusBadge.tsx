'use client'

import type { ToolProviderStatus } from '@/lib/tools/provider-status'

export const STATUS_META: Record<ToolProviderStatus, { label: string; className: string }> = {
  available: {
    label: 'available',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  },
  mock: {
    label: 'mock',
    className: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  },
  'bridge-only': {
    label: 'bridge-only',
    className: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200',
  },
  'not-configured': {
    label: 'not-configured',
    className: 'border-white/12 bg-white/[0.04] text-white/52',
  },
  'coming-soon': {
    label: 'coming-soon',
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  },
}

export function ProviderStatusBadge({ status }: { status: ToolProviderStatus }) {
  const meta = STATUS_META[status]

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${meta.className}`}>
      {meta.label}
    </span>
  )
}
