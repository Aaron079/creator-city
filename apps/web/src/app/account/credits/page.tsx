'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CreditLedgerTable } from '@/components/billing/CreditLedgerTable'
import type { CreditLedgerEntry } from '@/lib/billing/types'

interface ManualOrder {
  id: string
  amountCredits: number
  status: string
  note: string | null
  createdAt: string
}

export default function AccountCreditsPage() {
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [orders, setOrders] = useState<ManualOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unauthenticated, setUnauthenticated] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const options = { credentials: 'include' as const, cache: 'no-store' as const, signal: controller.signal }
        const [ledgerRes, ordersRes] = await Promise.all([
          fetch('/api/credits/ledger?limit=50', options),
          fetch('/api/credits/my-orders', options),
        ])
        if (ledgerRes.status === 401 || ordersRes.status === 401) {
          setUnauthenticated(true)
          return
        }
        if (!ledgerRes.ok || !ordersRes.ok) throw new Error('历史记录加载失败，请稍后刷新重试。')
        const ledgerData = await ledgerRes.json() as { items: CreditLedgerEntry[] }
        const orderData = await ordersRes.json() as { orders: ManualOrder[] }
        setLedger(ledgerData.items)
        setOrders(orderData.orders)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '历史记录加载失败。')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [])

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">历史账单</h1>
            <p className="mt-1 text-sm text-white/50">City 积分已永久停用。历史记录仅供核对，不再提供购买、发放或消耗。</p>
          </div>
          <Link href="/account" className="text-sm text-white/70 hover:text-white">返回账号设置</Link>
        </div>
        {unauthenticated ? (
          <p className="text-sm text-red-400">请先 <Link href="/auth/login?next=/account/credits" className="underline">登录</Link> 后查看历史账单。</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-400">{error}</p>
        ) : loading ? (
          <p className="text-sm text-white/50">加载中…</p>
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-lg font-semibold text-white">历史流水</h2>
              <div className="overflow-x-auto"><CreditLedgerTable items={ledger} /></div>
            </section>
            <section>
              <h2 className="mb-3 text-lg font-semibold text-white">历史人工订单</h2>
              {orders.length === 0 ? <p className="text-sm text-white/45">暂无记录</p> : (
                <ul className="divide-y divide-white/10">
                  {orders.map((order) => (
                    <li key={order.id} className="flex flex-wrap gap-3 py-3 text-sm text-white/60">
                      <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                      <span>历史数量：{order.amountCredits.toLocaleString()}</span>
                      <span>{order.status}</span>
                      {order.note && <span className="break-all">{order.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  )
}
