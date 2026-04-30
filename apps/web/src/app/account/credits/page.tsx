'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CreditLedgerTable } from '@/components/billing/CreditLedgerTable'
import { WalletBalanceCard } from '@/components/billing/WalletBalanceCard'
import { PaymentStatusNotice } from '@/components/billing/PaymentStatusNotice'
import { useAuthStore } from '@/store/auth.store'
import type { CreditLedgerEntry, UserWallet } from '@/lib/billing/types'

export default function AccountCreditsPage() {
  const { token } = useAuthStore()
  const [wallet, setWallet] = useState<UserWallet | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setMessage('请先登录查看积分钱包。')
      return
    }
    void (async () => {
      const [walletRes, ledgerRes] = await Promise.all([
        fetch('/api/billing/wallet', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/ledger', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (walletRes.ok) setWallet(await walletRes.json() as UserWallet)
      else setMessage('钱包后端暂不可用。需要 DATABASE_URL 与 server API 才能真实持久化钱包和订单。')
      if (ledgerRes.ok) {
        const data = await ledgerRes.json() as { items: CreditLedgerEntry[] }
        setLedger(data.items)
      }
    })()
  }, [token])

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">我的积分</h1>
            <p className="mt-2 text-sm text-white/50">余额、冻结积分、订单入账与生成消耗记录。</p>
          </div>
          <a href="/billing" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">购买积分</a>
        </div>
        {message ? <div className="mb-5"><PaymentStatusNotice type="info" message={message} /></div> : null}
        <div className="mb-6"><WalletBalanceCard wallet={wallet} /></div>
        <h2 className="mb-3 text-lg font-semibold text-white">消耗记录</h2>
        <CreditLedgerTable items={ledger} />
      </main>
    </DashboardShell>
  )
}
