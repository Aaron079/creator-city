'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { formatAdminDate } from '@/lib/format/adminDate'

interface RechargeOrder {
  id: string
  userId: string
  user: { id: string; email: string; displayName: string } | null
  amountCredits: number
  status: string
  note: string | null
  adminNote: string | null
  createdAt: string
  paidAt: string | null
}

type TabStatus = 'PENDING' | 'PAID' | 'CANCELLED'

export default function AdminCreditsPage() {
  const [tab, setTab] = useState<TabStatus>('PENDING')
  const [orders, setOrders] = useState<RechargeOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/credits/orders?status=${tab}&limit=50`, { credentials: 'include' })
    if (res.status === 401) { setAuthError('请先登录管理员账户'); setLoading(false); return }
    if (res.status === 403) { setAuthError('无权限：仅管理员可访问'); setLoading(false); return }
    if (res.ok) {
      const d = await res.json() as { orders: RechargeOrder[]; total: number }
      setOrders(d.orders)
      setTotal(d.total)
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { void load() }, [load])

  if (authError) return (
    <DashboardShell>
      <div className="p-8 text-sm text-red-400">{authError}</div>
    </DashboardShell>
  )

  const tabs: TabStatus[] = ['PENDING', 'PAID', 'CANCELLED']
  const tabLabels: Record<TabStatus, string> = { PENDING: '待处理记录', PAID: '已完成记录', CANCELLED: '已取消记录' }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">

        <Link href="/admin" className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white">
          ← 管理员面板
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-white">历史账单管理</h1>
          <p className="mt-1 text-sm text-white/50">City 积分已永久停用。仅保留历史订单供核对，不再发放或审批。</p>
        </div>

        {/* Orders table */}
        <section>
          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white text-slate-950' : 'text-white/50 hover:text-white'
                }`}
              >
                {tabLabels[t]}
              </button>
            ))}
            {!loading && <span className="ml-auto text-xs text-white/30 self-center">{total} 条</span>}
          </div>

          {loading ? (
            <div className="py-8 text-sm text-white/40">加载中…</div>
          ) : orders.length === 0 ? (
            <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">暂无记录</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-4 py-3">用户</th>
                    <th className="px-4 py-3">积分</th>
                    <th className="px-4 py-3">备注</th>
                    <th className="px-4 py-3">时间</th>
                    <th className="px-4 py-3">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-white/80">{o.user?.displayName ?? o.userId.slice(0, 8)}</div>
                        <div className="text-xs text-white/40">{o.user?.email}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{o.amountCredits.toLocaleString()}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-white/50">{o.note ?? '—'}</td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap">
                        {formatAdminDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-white/50">{tabLabels[o.status as TabStatus] ?? o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </DashboardShell>
  )
}
