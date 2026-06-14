'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'

interface MembershipStatus {
  membershipActive: boolean
  membershipStatus: string
  membershipExpiresAt: string | null
  membershipPlanCode: string | null
  daysRemaining: number
  plan: { code: string; amountCny: number; amountText: string; periodMonths: number }
}

interface MembershipOrder {
  id: string
  status: string
  planCode: string
  amountCny: number
  periodMonths: number
  voucherNote: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

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
  return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AccountMembershipPage() {
  const [ms, setMs] = useState<MembershipStatus | null>(null)
  const [orders, setOrders] = useState<MembershipOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [voucherNote, setVoucherNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [msRes, ordersRes] = await Promise.all([
        fetch('/api/me/membership'),
        fetch('/api/me/membership/orders'),
      ])
      if (msRes.ok) setMs(await msRes.json().then((d) => ({ ...d })))
      if (ordersRes.ok) setOrders(await ordersRes.json().then((d: { orders: MembershipOrder[] }) => d.orders))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch('/api/me/membership/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherNote: voucherNote.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmitMsg({ ok: true, text: '申请已提交，请等待管理员审核。' })
        setVoucherNote('')
        await load()
      } else {
        setSubmitMsg({ ok: false, text: data.message ?? '提交失败，请重试。' })
      }
    } catch {
      setSubmitMsg({ ok: false, text: '网络错误，请重试。' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubmit(orderId: string) {
    setEditSubmitting(true)
    setEditMsg(null)
    try {
      const res = await fetch(`/api/me/membership/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherNote: editNote }),
      })
      const data = await res.json()
      if (res.ok) {
        setEditMsg({ ok: true, text: '付款备注已更新。' })
        setEditingId(null)
        await load()
      } else {
        setEditMsg({ ok: false, text: data.message ?? '更新失败。' })
      }
    } catch {
      setEditMsg({ ok: false, text: '网络错误，请重试。' })
    } finally {
      setEditSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-sm text-white/40">加载中…</p>
        </main>
      </DashboardShell>
    )
  }

  const pendingOrder = orders.find((o) => o.status === 'PENDING')

  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">账号 / 会员</p>
          <h1 className="mt-3 text-2xl font-light tracking-tight text-white">会员中心</h1>
        </div>

        {/* Current status */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white/60">当前状态</h2>
          {ms?.membershipActive ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  ✓ 会员有效
                </span>
                <span className="text-xs text-white/35">· {ms.membershipPlanCode}</span>
              </div>
              <p className="text-sm text-white/55">
                到期时间：<span className="text-white/80">{ms.membershipExpiresAt ? fmt(ms.membershipExpiresAt) : '—'}</span>
                <span className="ml-2 text-white/35">（剩余 {ms.daysRemaining} 天）</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40">
                {ms?.membershipStatus === 'EXPIRED' ? '会员已过期' : '未开通会员'}
              </span>
            </div>
          )}
        </section>

        {/* Plan card */}
        <section className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-6">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-light text-white">¥100</span>
            <span className="mb-0.5 text-sm text-white/40">/ 月</span>
          </div>
          <p className="mt-1 text-xs text-white/35">Creator City 会员 · 人工审核开通</p>
          <ul className="mt-4 space-y-1.5 text-xs text-white/45">
            <li>✓ 使用创作工作台（画布、节点生成）</li>
            <li>✓ 管理资产库与创作者主页</li>
            <li>✓ 浏览 Marketplace 申请授权合作</li>
            <li>✓ 使用 BYOK 接入自己的 AI Provider</li>
          </ul>
          <p className="mt-3 text-xs text-white/25">
            会员费是平台服务费，不包含第三方 AI API 调用成本。
            <Link href="/pricing" className="ml-1 underline underline-offset-2 hover:text-white/45">查看详情</Link>
          </p>
        </section>

        {/* Payment instructions */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white/60">付款说明</h2>
          <p className="text-sm leading-relaxed text-white/45">
            请完成线下转账/人工付款后，在下方填写付款备注（如转账时间、备注或截图说明）。
            管理员确认收款后将为你开通或续费会员。
          </p>
          <p className="text-xs text-white/30">
            如需获取付款方式（账号/二维码），请联系管理员。
          </p>
        </section>

        {/* Submit form — only show if no pending order */}
        {!pendingOrder ? (
          <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white/60">提交开通/续费申请</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={voucherNote}
                onChange={(e) => setVoucherNote(e.target.value)}
                maxLength={1000}
                placeholder="付款备注（选填）：如转账时间、金额备注、截图说明等"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 placeholder-white/25 resize-none focus:border-violet-400/40 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-violet-500 px-5 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '提交中…' : '提交申请'}
                </button>
                <span className="text-xs text-white/30">提交后等待管理员人工审核</span>
              </div>
              {submitMsg && (
                <p className={`text-sm ${submitMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{submitMsg.text}</p>
              )}
            </form>
          </section>
        ) : (
          <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-6">
            <p className="text-sm text-amber-200/80">
              你已有一条待审核申请，管理员正在处理中。
              {pendingOrder.voucherNote ? (
                <span className="ml-1 text-white/40">（已填写付款备注）</span>
              ) : (
                <span className="ml-1 text-amber-200/50">建议在下方更新付款备注，有助于加快审核。</span>
              )}
            </p>
          </section>
        )}

        {/* Order history */}
        {orders.length > 0 && (
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white/60">申请记录</h2>
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-white/[0.06] bg-black/20 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs text-white/30">{order.id.slice(0, 8)}…</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[order.status] ?? 'text-white/40'}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="text-xs text-white/35 space-y-0.5">
                    <p>金额：¥{(order.amountCny / 100).toFixed(2)} · {order.periodMonths} 个月</p>
                    <p>提交时间：{fmt(order.createdAt)}</p>
                    {order.voucherNote && (
                      <p className="text-white/50">付款备注：{order.voucherNote}</p>
                    )}
                    {order.adminNote && (
                      <p className="text-white/45">管理员备注：{order.adminNote}</p>
                    )}
                  </div>

                  {/* Edit voucherNote for PENDING orders */}
                  {order.status === 'PENDING' && (
                    <div className="pt-1">
                      {editingId === order.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            maxLength={1000}
                            rows={2}
                            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70 placeholder-white/25 focus:outline-none focus:border-violet-400/40"
                            placeholder="更新付款备注"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSubmit(order.id)}
                              disabled={editSubmitting}
                              className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs text-violet-200 hover:bg-violet-400/20 disabled:opacity-50"
                            >
                              {editSubmitting ? '保存中…' : '保存'}
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditMsg(null) }}
                              className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/40 hover:text-white/60"
                            >
                              取消
                            </button>
                          </div>
                          {editMsg && (
                            <p className={`text-xs ${editMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{editMsg.text}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingId(order.id); setEditNote(order.voucherNote ?? '') }}
                          className="text-xs text-violet-300/60 underline underline-offset-2 hover:text-violet-300/80"
                        >
                          {order.voucherNote ? '修改付款备注' : '添加付款备注'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/account/providers" className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60">
            绑定 Provider API Key（BYOK）
          </Link>
          <Link href="/pricing" className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60">
            查看会员权益
          </Link>
          <Link href="/account/credits" className="text-xs text-white/40 underline underline-offset-2 hover:text-white/60">
            积分与账单
          </Link>
        </div>

      </main>
    </DashboardShell>
  )
}
