'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface OrderUser {
  id: string
  email: string
  displayName: string
  username: string | null
}

interface MembershipOrder {
  id: string
  userId: string
  user: OrderUser
  status: string
  planCode: string
  amountCny: number
  periodMonths: number
  voucherNote: string | null
  adminUserId: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_FILTER_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL'] as const
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]

const STATUS_LABEL: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  APPROVED: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  REJECTED: 'border-red-400/30 bg-red-400/10 text-red-300',
  CANCELLED: 'border-white/10 bg-white/5 text-white/35',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminMembershipPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [orders, setOrders] = useState<MembershipOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [msgs, setMsgs] = useState<Record<string, { ok: boolean; text: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/membership/orders?status=${statusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  async function handleApprove(order: MembershipOrder) {
    const ok = window.confirm(
      `确认已收到 ¥${(order.amountCny / 100).toFixed(2)} 会员费？\n\n确认后将为 ${order.user.email} 开通/续期 ${order.periodMonths} 个月会员。`,
    )
    if (!ok) return

    setActionLoading(order.id)
    setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: '' } }))
    try {
      const res = await fetch(`/api/admin/membership/orders/${order.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: adminNotes[order.id] ?? '' }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgs((p) => ({ ...p, [order.id]: { ok: true, text: '已审批通过，会员已开通/续期。' } }))
        await load()
      } else {
        setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: data.message ?? '操作失败。' } }))
      }
    } catch {
      setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: '网络错误，请重试。' } }))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(order: MembershipOrder) {
    const note = adminNotes[order.id]?.trim() ?? ''
    if (!note) {
      setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: '请先填写拒绝备注再操作。' } }))
      return
    }
    setActionLoading(order.id)
    try {
      const res = await fetch(`/api/admin/membership/orders/${order.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: note }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgs((p) => ({ ...p, [order.id]: { ok: true, text: '已拒绝申请，用户会员状态不变。' } }))
        await load()
      } else {
        setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: data.message ?? '操作失败。' } }))
      }
    } catch {
      setMsgs((p) => ({ ...p, [order.id]: { ok: false, text: '网络错误，请重试。' } }))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Admin / 会员管理</p>
            <h1 className="mt-2 text-2xl font-light tracking-tight text-white">会员订单审核</h1>
            <p className="mt-1 text-xs text-white/35">审核 100 元/月会员开通与续费申请</p>
          </div>
          <Link href="/admin" className="text-xs text-white/35 hover:text-white/55 underline underline-offset-2">
            ← 返回 Admin
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? 'border-violet-400/40 bg-violet-400/15 text-violet-200'
                  : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
              }`}
            >
              {s === 'ALL' ? '全部' : STATUS_LABEL[s]}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40 hover:border-white/20 disabled:opacity-50"
          >
            {loading ? '加载中…' : '刷新'}
          </button>
        </div>

        {/* Orders */}
        {loading ? (
          <p className="text-sm text-white/30 py-4">加载中…</p>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-white/30">暂无{statusFilter !== 'ALL' ? `「${STATUS_LABEL[statusFilter] ?? statusFilter}」` : ''}订单。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4"
              >
                {/* Order meta */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[order.status] ?? 'text-white/40'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      <span className="font-mono text-xs text-white/25">{order.id.slice(0, 12)}…</span>
                    </div>
                    <p className="text-sm text-white/70 font-medium truncate">{order.user.email}</p>
                    <p className="text-xs text-white/35">{order.user.displayName}{order.user.username ? ` · @${order.user.username}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-light text-white">¥{(order.amountCny / 100).toFixed(2)}</p>
                    <p className="text-xs text-white/35">{order.periodMonths} 个月 · {order.planCode}</p>
                  </div>
                </div>

                {/* Detail fields */}
                <div className="rounded-lg border border-white/[0.06] bg-black/15 p-3 text-xs space-y-1.5 text-white/40">
                  <p>提交时间：{fmt(order.createdAt)}</p>
                  {order.voucherNote ? (
                    <p>付款备注：<span className="text-white/65">{order.voucherNote}</span></p>
                  ) : (
                    <p className="text-white/20">用户未填写付款备注</p>
                  )}
                  {order.adminNote && <p>管理员备注：<span className="text-white/55">{order.adminNote}</span></p>}
                </div>

                {/* Admin actions for PENDING orders */}
                {order.status === 'PENDING' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={adminNotes[order.id] ?? ''}
                      onChange={(e) => setAdminNotes((p) => ({ ...p, [order.id]: e.target.value }))}
                      maxLength={500}
                      placeholder="管理员备注（拒绝时必填）"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 placeholder-white/25 focus:border-violet-400/40 focus:outline-none"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleApprove(order)}
                        disabled={actionLoading === order.id}
                        className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === order.id ? '处理中…' : '✓ 审批通过'}
                      </button>
                      <button
                        onClick={() => handleReject(order)}
                        disabled={actionLoading === order.id}
                        className="rounded-full border border-red-400/25 bg-red-400/8 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/15 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === order.id ? '处理中…' : '✕ 拒绝'}
                      </button>
                    </div>
                    {msgs[order.id]?.text && (
                      <p className={`text-xs ${msgs[order.id]?.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {msgs[order.id]?.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>
    </DashboardShell>
  )
}
