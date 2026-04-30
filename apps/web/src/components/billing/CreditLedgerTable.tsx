'use client'

import type { CreditLedgerEntry } from '@/lib/billing/types'

export function CreditLedgerTable({ items }: { items: CreditLedgerEntry[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      {items.length === 0 ? (
        <div className="p-4 text-sm text-white/45">暂无账本记录</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-white/40">
            <tr>
              <th className="px-4 py-3">类型</th>
              <th className="px-4 py-3">积分</th>
              <th className="px-4 py-3">余额</th>
              <th className="px-4 py-3">说明</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-white/70">{item.type}</td>
                <td className="px-4 py-3 font-semibold text-white">{item.amountCredits}</td>
                <td className="px-4 py-3 text-white/70">{item.balanceAfter}</td>
                <td className="px-4 py-3 text-white/45">{item.description ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
