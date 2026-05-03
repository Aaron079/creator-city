'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'

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
  const [actionMsg, setActionMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)

  // direct grant form
  const [grantUserId, setGrantUserId] = useState('')
  const [grantAmount, setGrantAmount] = useState('')
  const [grantNote, setGrantNote] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  async function handleAction(orderId: string, action: 'approve' | 'reject', note?: string) {
    setActionMsg(null)
    const res = await fetch('/api/admin/credits/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderId, action, note }),
    })
    const data = await res.json() as { ok?: boolean; message?: string }
    if (res.ok) {
      setActionMsg({ id: orderId, ok: true, text: action === 'approve' ? '已批准，积分已到账' : '已拒绝' })
      void load()
    } else {
      setActionMsg({ id: orderId, ok: false, text: data.message ?? '操作失败' })
    }
  }

  async function handleDirectGrant(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(grantAmount, 10)
    if (!grantUserId.trim()) { setGrantMsg({ ok: false, text: '请输入用户 ID' }); return }
    if (!n || n < 1) { setGrantMsg({ ok: false, text: '请输入有效积分数量' }); return }
    setGranting(true)
    setGrantMsg(null)
    const res = await fetch('/api/admin/credits/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: grantUserId.trim(), amountCredits: n, note: grantNote.trim() || undefined }),
    })
    const data = await res.json() as { ok?: boolean; amountCredits?: number; message?: string }
    if (res.ok) {
      setGrantMsg({ ok: true, text: `已发放 ${data.amountCredits?.toLocaleString()} 积分` })
      setGrantUserId(''); setGrantAmount(''); setGrantNote('')
    } else {
      setGrantMsg({ ok: false, text: data.message ?? '发放失败' })
    }
    setGranting(false)
  }

  if (authError) return (
    <DashboardShell>
      <div className="p-8 text-sm text-red-400">{authError}</div>
    </DashboardShell>
  )

  const tabs: TabStatus[] = ['PENDING', 'PAID', 'CANCELLED']
  const tabLabels: Record<TabStatus, string> = { PENDING: '待审核', PAID: '已批准', CANCELLED: '已拒绝' }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">

        <div>
          <h1 className="text-2xl font-semibold text-white">积分管理</h1>
          <p className="mt-1 text-sm text-white/50">审核人工充值申请，直接发放积分。</p>
        </div>

        {/* Direct grant */}
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-base font-semibold text-white">直接发放积分</h2>
          <form onSubmit={(e) => void handleDirectGrant(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-white/50">用户 ID（UUID）</label>
              <input
                type="text" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)}
                placeholder="用户 ID"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
            <div className="w-32 shrink-0">
              <label className="mb-1 block text-xs text-white/50">积分数量</label>
              <input
                type="number" min={1} value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="1000"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-white/50">备注</label>
              <input
                type="text" value={grantNote} onChange={(e) => setGrantNote(e.target.value)}
                maxLength={200} placeholder="发放原因"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
            <button
              type="submit" disabled={granting}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:shrink-0"
            >
              {granting ? '发放中…' : '发放积分'}
            </button>
          </form>
          {grantMsg && (
            <p className={`mt-3 text-sm ${grantMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{grantMsg.text}</p>
          )}
        </section>

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
                    {tab === 'PENDING' && <th className="px-4 py-3">操作</th>}
                    {tab !== 'PENDING' && <th className="px-4 py-3">状态</th>}
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
                        {new Date(o.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      {tab === 'PENDING' && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => void handleAction(o.id, 'approve')}
                              className="rounded bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/30"
                            >批准</button>
                            <button
                              onClick={() => void handleAction(o.id, 'reject')}
                              className="rounded bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/30"
                            >拒绝</button>
                          </div>
                          {actionMsg?.id === o.id && (
                            <p className={`mt-1 text-xs ${actionMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                              {actionMsg.text}
                            </p>
                          )}
                        </td>
                      )}
                      {tab !== 'PENDING' && (
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${
                            o.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {o.status === 'PAID' ? '已批准' : '已拒绝'}
                          </span>
                        </td>
                      )}
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
