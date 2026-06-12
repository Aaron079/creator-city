'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { formatAdminDateTime } from '@/lib/format/adminDate'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RefundRequest {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  assetId: string
  status: string
  reason: string
  adminNote: string | null
  executionNote: string | null
  executedAt: string | null
  createdAt: string
  reviewedAt: string | null
  buyer: { id: string; displayName: string; username: string | null; email?: string } | null
  seller: { id: string; displayName: string; username: string | null; email?: string } | null
  asset: { id: string; title: string; type: string } | null
  order: {
    id: string
    priceCredits: number
    sellerAmountCredits: number | null
    status: string
    refundedAt: string | null
  } | null
}

interface MarketplaceOrder {
  id: string
  listingId: string
  assetId: string
  buyerId: string
  sellerId: string
  priceCredits: number
  platformFeeCredits: number | null
  sellerAmountCredits: number | null
  status: string
  message: string | null
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  rejectedAt: string | null
  quotedAt: string | null
  completedAt: string | null
  refundedAt: string | null
  buyer: { id: string; displayName: string; username: string | null; email: string }
  seller: { id: string; displayName: string; username: string | null; email: string }
  asset: { id: string; title: string; type: string; thumbnailUrl: string | null }
  listing: { id: string; title: string; priceCredits: number | null; licenseMode: string; status: string }
  refundRequest: { id: string; status: string; reason: string; executedAt: string | null } | null
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已批准，待执行',
  REJECTED: '已驳回',
  EXECUTED: '已执行退款',
  EXECUTION_FAILED: '执行失败',
  CANCELLED: '已撤销',
}

const REFUND_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-amber-400/15 text-amber-200 border-amber-400/20',
  APPROVED: 'bg-sky-400/15 text-sky-200 border-sky-400/20',
  REJECTED: 'bg-white/8 text-white/40 border-white/10',
  EXECUTED: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/20',
  EXECUTION_FAILED: 'bg-red-400/15 text-red-300 border-red-400/20',
  CANCELLED: 'bg-white/8 text-white/40 border-white/10',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  QUOTED: '已报价',
  COMPLETED: '已完成支付',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
  REJECTED: '已拒绝',
}

const ORDER_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'bg-amber-400/15 text-amber-200',
  QUOTED: 'bg-sky-400/15 text-sky-200',
  COMPLETED: 'bg-emerald-400/15 text-emerald-200',
  REFUNDED: 'bg-violet-400/15 text-violet-200',
  CANCELLED: 'bg-white/8 text-white/40',
  REJECTED: 'bg-white/8 text-white/40',
}

function StatusBadge({ status, labels, classes }: { status: string; labels: Record<string, string>; classes: Record<string, string> }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${classes[status] ?? 'bg-white/8 text-white/40 border-white/10'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ─── Confirm helper ───────────────────────────────────────────────────────────

const EXECUTE_CONFIRM_MSG =
  '确认执行退款？\n\n这将真实返还买家积分、扣回卖家积分，并撤销授权凭证。该操作不可逆。\n\n请确认该订单已通过人工审核，且不是误操作。'

// ─── Refund Requests Tab ──────────────────────────────────────────────────────

type RefundStatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXECUTION_FAILED' | 'CANCELLED' | 'ALL'

const REFUND_FILTER_TABS: RefundStatusFilter[] = ['PENDING', 'APPROVED', 'EXECUTION_FAILED', 'EXECUTED', 'REJECTED', 'CANCELLED', 'ALL']
const REFUND_FILTER_LABELS: Record<RefundStatusFilter, string> = {
  PENDING: '待审核',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  EXECUTED: '已执行',
  EXECUTION_FAILED: '执行失败',
  CANCELLED: '已撤销',
  ALL: '全部',
}

function RefundRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<RefundStatusFilter>('PENDING')
  const [requests, setRequests] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setActionMsg(null)
    const qs = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`
    const res = await fetch(`/api/admin/marketplace/refund-requests${qs}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json() as { items: RefundRequest[] }
      setRequests(data.items)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  async function callAction(id: string, action: string, adminNote?: string) {
    if (action === 'execute' || action === 'approveAndExecute') {
      if (!window.confirm(EXECUTE_CONFIRM_MSG)) return
    }
    if (action === 'approve') {
      if (!window.confirm('仅标记审核通过，不执行退款。确认继续？')) return
    }
    setLoadingAction(id + ':' + action)
    setActionMsg(null)
    const res = await fetch(`/api/admin/marketplace/refund-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, adminNote }),
    })
    const data = await res.json() as { message?: string; warning?: string }
    if (res.ok) {
      const warnings: Record<string, string> = {
        approveAndExecute: '已批准并执行退款',
        approve: `已批准（待执行）${data.warning ? ' — ' + data.warning : ''}`,
        reject: '已驳回',
        execute: '退款已执行',
      }
      setActionMsg({ id, ok: true, text: warnings[action] ?? '操作成功' })
      void load()
    } else {
      setActionMsg({ id, ok: false, text: data.message ?? '操作失败，请稍后重试' })
    }
    setLoadingAction(null)
  }

  return (
    <div>
      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {REFUND_FILTER_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === t ? 'bg-white text-slate-950' : 'text-white/50 hover:text-white'
            }`}
          >
            {REFUND_FILTER_LABELS[t]}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto text-xs text-white/30 hover:text-white/60">↻ 刷新</button>
      </div>

      {loading ? (
        <div className="py-10 text-sm text-white/40">加载中…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-8 text-center text-sm text-white/40">
          暂无{REFUND_FILTER_LABELS[statusFilter]}退款申请
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.status === 'EXECUTION_FAILED'
                  ? 'border-red-400/20 bg-red-400/5'
                  : r.status === 'APPROVED'
                  ? 'border-sky-400/20 bg-sky-400/5'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start gap-3">
                <StatusBadge status={r.status} labels={REFUND_STATUS_LABELS} classes={REFUND_STATUS_CLASSES} />
                <span className="font-mono text-xs text-white/40">{r.id.slice(0, 8)}</span>
                <span className="ml-auto text-xs text-white/30">{formatAdminDateTime(r.createdAt)}</span>
              </div>

              {/* Main info grid */}
              <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">资产</div>
                  <div className="mt-0.5 text-white/80">
                    {r.asset
                      ? <Link href={`/assets/${r.asset.id}`} className="hover:text-white underline underline-offset-2">{r.asset.title}</Link>
                      : <span className="font-mono text-xs">{r.assetId.slice(0, 8)}</span>
                    }
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">买家</div>
                  <div className="mt-0.5 text-white/80">{r.buyer?.displayName ?? r.buyerId.slice(0, 8)}</div>
                  {r.buyer?.email && <div className="text-xs text-white/40">{r.buyer.email}</div>}
                </div>
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">卖家</div>
                  <div className="mt-0.5 text-white/80">{r.seller?.displayName ?? r.sellerId.slice(0, 8)}</div>
                  {r.seller?.email && <div className="text-xs text-white/40">{r.seller.email}</div>}
                </div>
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">订单金额</div>
                  <div className="mt-0.5 font-semibold text-white">{r.order?.priceCredits?.toLocaleString() ?? '—'} 积分</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">卖家应退</div>
                  <div className="mt-0.5 text-white/80">
                    {r.order?.sellerAmountCredits != null ? `${r.order.sellerAmountCredits.toLocaleString()} 积分` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-white/35 uppercase tracking-wide">订单状态</div>
                  <div className="mt-0.5">
                    {r.order ? (
                      <StatusBadge status={r.order.status} labels={ORDER_STATUS_LABELS} classes={ORDER_STATUS_CLASSES} />
                    ) : '—'}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="mt-3 rounded-md bg-white/[0.03] px-3 py-2 text-sm text-white/60">
                <span className="text-white/35 text-[11px] uppercase tracking-wide mr-2">申请原因</span>
                {r.reason}
              </div>

              {/* Admin note / execution note */}
              {r.adminNote && (
                <div className="mt-2 rounded-md bg-white/[0.03] px-3 py-2 text-sm text-white/60">
                  <span className="text-white/35 text-[11px] uppercase tracking-wide mr-2">管理员备注</span>
                  {r.adminNote}
                </div>
              )}
              {r.executionNote && (
                <div className={`mt-2 rounded-md px-3 py-2 text-sm ${r.status === 'EXECUTION_FAILED' ? 'bg-red-400/10 text-red-200' : 'bg-white/[0.03] text-white/60'}`}>
                  <span className="text-[11px] uppercase tracking-wide mr-2 opacity-60">执行说明</span>
                  {r.executionNote}
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/30">
                {r.reviewedAt && <span>审核时间：{formatAdminDateTime(r.reviewedAt)}</span>}
                {r.executedAt && <span className="text-emerald-400/70">执行时间：{formatAdminDateTime(r.executedAt)}</span>}
              </div>

              {/* APPROVED amber notice */}
              {r.status === 'APPROVED' && (
                <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                  已批准（审核通过），尚未执行退款。点击下方&ldquo;执行退款&rdquo;完成账务处理。
                </div>
              )}

              {/* EXECUTION_FAILED notice */}
              {r.status === 'EXECUTION_FAILED' && (
                <div className="mt-3 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                  退款执行失败。如为卖家余额不足，请等卖家充值后重试执行；或联系运营人工处理。
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap items-start gap-3">

                {/* PENDING actions */}
                {r.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => void callAction(r.id, 'approveAndExecute')}
                      disabled={loadingAction !== null}
                      className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {loadingAction === r.id + ':approveAndExecute' ? '执行中…' : '批准并执行退款'}
                    </button>
                    <button
                      onClick={() => void callAction(r.id, 'approve')}
                      disabled={loadingAction !== null}
                      className="rounded-md border border-sky-400/30 px-4 py-1.5 text-sm text-sky-300 hover:border-sky-400/60 disabled:opacity-50"
                    >
                      {loadingAction === r.id + ':approve' ? '处理中…' : '仅批准'}
                    </button>
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={rejectNote[r.id] ?? ''}
                        onChange={(e) => setRejectNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="拒绝原因（必填）"
                        maxLength={500}
                        className="w-52 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                      />
                      <button
                        onClick={() => void callAction(r.id, 'reject', rejectNote[r.id])}
                        disabled={!rejectNote[r.id]?.trim() || loadingAction !== null}
                        className="rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                      >
                        {loadingAction === r.id + ':reject' ? '处理中…' : '驳回'}
                      </button>
                    </div>
                  </>
                )}

                {/* APPROVED actions */}
                {r.status === 'APPROVED' && (
                  <button
                    onClick={() => void callAction(r.id, 'execute')}
                    disabled={loadingAction !== null}
                    className="rounded-md bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
                  >
                    {loadingAction === r.id + ':execute' ? '执行中…' : '执行退款'}
                  </button>
                )}

                {/* EXECUTION_FAILED retry */}
                {r.status === 'EXECUTION_FAILED' && (
                  <button
                    onClick={() => void callAction(r.id, 'execute')}
                    disabled={loadingAction !== null}
                    className="rounded-md border border-red-400/30 px-4 py-1.5 text-sm text-red-300 hover:border-red-400/60 disabled:opacity-50"
                  >
                    {loadingAction === r.id + ':execute' ? '重试中…' : '重试执行退款'}
                  </button>
                )}
              </div>

              {/* Action feedback */}
              {actionMsg?.id === r.id && (
                <p className={`mt-2 text-sm ${actionMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {actionMsg.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Orders Overview Tab ──────────────────────────────────────────────────────

type OrderStatusFilter = 'ALL' | 'PENDING' | 'QUOTED' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED' | 'REJECTED'

const ORDER_FILTER_TABS: OrderStatusFilter[] = ['ALL', 'PENDING', 'QUOTED', 'COMPLETED', 'REFUNDED', 'CANCELLED', 'REJECTED']
const ORDER_FILTER_LABELS: Record<OrderStatusFilter, string> = {
  ALL: '全部',
  PENDING: '待处理',
  QUOTED: '已报价',
  COMPLETED: '已完成',
  REFUNDED: '已退款',
  CANCELLED: '已取消',
  REJECTED: '已拒绝',
}

function OrdersTab() {
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL')
  const [orders, setOrders] = useState<MarketplaceOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`
    const res = await fetch(`/api/admin/marketplace/orders${qs}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json() as { items: MarketplaceOrder[] }
      setOrders(data.items)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  return (
    <div>
      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ORDER_FILTER_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === t ? 'bg-white text-slate-950' : 'text-white/50 hover:text-white'
            }`}
          >
            {ORDER_FILTER_LABELS[t]}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto text-xs text-white/30 hover:text-white/60">↻ 刷新</button>
      </div>

      {loading ? (
        <div className="py-10 text-sm text-white/40">加载中…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-8 text-center text-sm text-white/40">
          暂无订单记录
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/35">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">订单 ID</th>
                <th className="px-4 py-3 whitespace-nowrap">资产</th>
                <th className="px-4 py-3 whitespace-nowrap">买家</th>
                <th className="px-4 py-3 whitespace-nowrap">卖家</th>
                <th className="px-4 py-3 whitespace-nowrap">金额</th>
                <th className="px-4 py-3 whitespace-nowrap">平台费</th>
                <th className="px-4 py-3 whitespace-nowrap">卖家到手</th>
                <th className="px-4 py-3 whitespace-nowrap">状态</th>
                <th className="px-4 py-3 whitespace-nowrap">退款申请</th>
                <th className="px-4 py-3 whitespace-nowrap">创建时间</th>
                <th className="px-4 py-3 whitespace-nowrap">完成时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-white/50">{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/assets/${o.assetId}`} className="text-white/80 hover:text-white underline underline-offset-2">
                      {o.asset.title}
                    </Link>
                    <div className="text-[11px] text-white/35">{o.asset.type}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white/80">{o.buyer.displayName}</div>
                    <div className="text-[11px] text-white/35">{o.buyer.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white/80">{o.seller.displayName}</div>
                    <div className="text-[11px] text-white/35">{o.seller.email}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                    {o.priceCredits.toLocaleString()} 积分
                  </td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {o.platformFeeCredits != null ? `${o.platformFeeCredits.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {o.sellerAmountCredits != null ? `${o.sellerAmountCredits.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} labels={ORDER_STATUS_LABELS} classes={ORDER_STATUS_CLASSES} />
                  </td>
                  <td className="px-4 py-3">
                    {o.refundRequest ? (
                      <StatusBadge
                        status={o.refundRequest.status}
                        labels={REFUND_STATUS_LABELS}
                        classes={REFUND_STATUS_CLASSES}
                      />
                    ) : <span className="text-white/25">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white/35 whitespace-nowrap text-xs">
                    {formatAdminDateTime(o.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-white/35 whitespace-nowrap text-xs">
                    {o.completedAt ? formatAdminDateTime(o.completedAt) : o.refundedAt ? formatAdminDateTime(o.refundedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type MainTab = 'refunds' | 'orders'

export default function AdminMarketplacePage() {
  const [authError, setAuthError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<MainTab>('refunds')

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { user?: { role?: string } }) => {
        if (!data.user) { setAuthError('请先登录管理员账户。'); return }
        if (data.user.role !== 'ADMIN') { setAuthError('403：无权限访问市场运营管理台。'); return }
        setAuthed(true)
      })
      .catch(() => setAuthError('无法验证身份，请刷新重试。'))
  }, [])

  if (authError) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <Link href="/admin" className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white">
            ← 管理员面板
          </Link>
          <div className="mt-6 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {authError}
          </div>
        </main>
      </DashboardShell>
    )
  }

  if (!authed) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="py-10 text-sm text-white/30">验证身份中…</div>
        </main>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">

        {/* Back */}
        <Link href="/admin" className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white">
          ← 管理员面板
        </Link>

        {/* Header */}
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-[0.22em] text-white/30">Admin Console</div>
          <h1 className="text-2xl font-semibold text-white">市场运营管理台</h1>
          <p className="mt-1.5 text-sm text-white/50">
            用于查看市场订单和处理退款申请。退款执行会真实影响 buyer / seller 积分，请谨慎操作。
          </p>
        </div>

        {/* Warning notice */}
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-200">
          ⚠️ 退款执行（批准并执行 / 执行退款）为不可逆操作，将真实扣回卖家积分、返还买家积分并撤销授权凭证。操作前系统将弹出二次确认。
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 w-fit">
          {([['refunds', '退款申请'], ['orders', '订单概览']] as [MainTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                tab === key ? 'bg-white text-slate-950' : 'text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'refunds' ? <RefundRequestsTab /> : <OrdersTab />}

      </main>
    </DashboardShell>
  )
}
