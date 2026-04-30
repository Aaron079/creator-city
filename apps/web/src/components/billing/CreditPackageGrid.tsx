'use client'

import type { BillingRegion, CreditPackage, PaymentProvider } from '@/lib/billing/types'
import { formatMoney } from '@/lib/billing/pricing'

export function CreditPackageGrid({
  packages,
  region,
  provider,
  buyingId,
  onBuy,
}: {
  packages: CreditPackage[]
  region: BillingRegion
  provider: PaymentProvider
  buyingId: string | null
  onBuy: (packageId: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {packages.map((pkg) => {
        const price = pkg.prices.find((item) => item.region === region && item.provider === provider)
        return (
          <article key={pkg.id} className="flex min-h-[190px] flex-col rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="text-sm font-semibold text-white">{pkg.name}</div>
            <div className="mt-3 text-3xl font-semibold text-cyan-200">{(pkg.credits + pkg.bonusCredits).toLocaleString()}</div>
            <div className="mt-1 text-xs text-white/40">
              {pkg.bonusCredits > 0 ? `${pkg.credits.toLocaleString()} + ${pkg.bonusCredits.toLocaleString()} bonus` : 'standard credits'}
            </div>
            <div className="mt-4 text-lg font-semibold text-white">{price ? formatMoney(price.amount, price.currency) : 'N/A'}</div>
            <button
              type="button"
              disabled={!price || buyingId === pkg.id}
              onClick={() => onBuy(pkg.id)}
              className="mt-auto rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
            >
              {buyingId === pkg.id ? '创建中...' : '购买'}
            </button>
          </article>
        )
      })}
    </div>
  )
}
