'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { BillingOverview } from '@/components/admin/BillingOverview'
import { PaymentStatusNotice } from '@/components/billing/PaymentStatusNotice'
import { useAuthStore } from '@/store/auth.store'

export default function AdminBillingPage() {
  const { token, user } = useAuthStore()
  const [overview, setOverview] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setMessage('请先登录管理员账户。')
      return
    }
    if (user?.role !== 'ADMIN') {
      setMessage('无权限：仅管理员可查看 billing 后台。')
      return
    }
    void (async () => {
      const res = await fetch('/api/admin/billing/overview', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        setMessage('Billing 后端暂不可用，页面仍可打开。')
        return
      }
      setOverview(await res.json())
    })()
  }, [token, user?.role])

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">Billing 管理后台</h1>
        <p className="mt-2 text-sm text-white/50">收入、用户钱包、支付订单与 Provider 成本统计。</p>
        {message ? <div className="mt-5"><PaymentStatusNotice type="info" message={message} /></div> : null}
        <div className="mt-6"><BillingOverview data={overview as Parameters<typeof BillingOverview>[0]['data']} /></div>
        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
          支付订单与用户钱包写入 server Prisma 表：PaymentOrder、UserCreditWallet、CreditLedger、ProviderCostLedger。管理员可通过 /api/admin/billing/orders 和 /api/admin/billing/wallets 查看 JSON 列表。
        </section>
      </main>
    </DashboardShell>
  )
}
