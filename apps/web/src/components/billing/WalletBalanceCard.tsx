'use client'

import type { UserWallet } from '@/lib/billing/types'

export function WalletBalanceCard({ wallet }: { wallet: UserWallet | null }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Creator City Credits</div>
      <div className="mt-3 grid gap-4 sm:grid-cols-4">
        <div>
          <div className="text-sm text-white/50">可用积分</div>
          <div className="mt-1 text-3xl font-semibold text-white">{wallet?.availableCredits.toLocaleString() ?? '0'}</div>
        </div>
        <div>
          <div className="text-sm text-white/50">冻结积分</div>
          <div className="mt-1 text-2xl font-semibold text-amber-300">{wallet?.reservedCredits.toLocaleString() ?? '0'}</div>
        </div>
        <div>
          <div className="text-sm text-white/50">累计购买</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-300">{wallet?.lifetimePurchasedCredits.toLocaleString() ?? '0'}</div>
        </div>
        <div>
          <div className="text-sm text-white/50">累计消耗</div>
          <div className="mt-1 text-2xl font-semibold text-sky-300">{wallet?.lifetimeSpentCredits.toLocaleString() ?? '0'}</div>
        </div>
      </div>
    </section>
  )
}
