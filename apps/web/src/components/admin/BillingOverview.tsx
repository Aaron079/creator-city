'use client'

interface BillingOverviewData {
  revenue?: { totalUSD?: number }
  credits?: { totalSold?: number; totalConsumed?: number }
  cost?: { estimatedUSD?: number }
  activeWallets?: number
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs text-white/40">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

export function BillingOverview({ data }: { data: BillingOverviewData | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="总收入" value={`$${(data?.revenue?.totalUSD ?? 0).toFixed(2)}`} />
      <Stat label="今日发放 Credits" value={(data?.credits?.totalSold ?? 0).toLocaleString()} />
      <Stat label="今日消耗 Credits" value={(data?.credits?.totalConsumed ?? 0).toLocaleString()} />
      <Stat label="Provider 成本" value={`$${(data?.cost?.estimatedUSD ?? 0).toFixed(2)}`} />
    </div>
  )
}
