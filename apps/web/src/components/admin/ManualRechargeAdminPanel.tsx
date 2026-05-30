'use client'

import { useEffect, useState, useCallback } from 'react'

type ManualOrder = {
  id: string
  externalOrderId: string | null
  userId: string
  userEmail: string | null
  userDisplayName: string | null
  credits: number
  amount: number
  currency: string
  status: string
  createdAt: string
  paidAt: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="ml-1.5 shrink-0 rounded border border-white/15 px-2 py-0.5 text-xs text-white/50 hover:border-white/30 hover:text-white/75 transition"
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN')
}

export function ManualRechargeAdminPanel() {
  const [orders, setOrders] = useState<ManualOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/admin/payments/china?status=PENDING', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.status === 401) { setFetchError('请先登录管理员账户'); setLoading(false); return }
      if (res.status === 403) { setFetchError('无权限：仅管理员可访问'); setLoading(false); return }
      if (!res.ok) { setFetchError('加载失败，请刷新重试'); setLoading(false); return }
      const data = await res.json() as { success: boolean; orders: ManualOrder[]; total: number }
      if (data.success) {
        setOrders(data.orders)
        setTotal(data.total)
      } else {
        setFetchError('加载失败')
      }
    } catch {
      setFetchError('网络错误，加载失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleApprove(order: ManualOrder) {
    setApprovingId(order.id)
    setMsg(null)
    setConfirmingId(null)
    try {
      const res = await fetch('/api/admin/payments/china/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json() as { success?: boolean; idempotent?: boolean; message?: string }
      if (!res.ok || !data.success) {
        setMsg({ id: order.id, ok: false, text: data.message ?? '审批失败' })
      } else {
        setMsg({
          id: order.id,
          ok: true,
          text: data.idempotent
            ? '订单已审批（幂等，未重复发放）'
            : `已确认到账，${order.credits.toLocaleString()} credits 已发放给 ${order.userEmail ?? order.userId}`,
        })
        void load()
      }
    } catch {
      setMsg({ id: order.id, ok: false, text: '网络错误，请重试' })
    }
    setApprovingId(null)
  }

  const confirmingOrder = confirmingId ? orders.find((o) => o.id === confirmingId) ?? null : null

  return (
    <section className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">人工充值申请 — 待审核</h2>
          <p className="mt-1 text-sm text-white/45">
            用户提交的转账充值申请。核对线下到账后点击&ldquo;确认到账并发放 credits&rdquo;。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="text-xs text-white/30">{total} 条待处理</span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:border-white/30 hover:text-white transition disabled:opacity-40"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mb-4 rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {fetchError}
        </div>
      )}

      {/* Inline confirm dialog */}
      {confirmingOrder && (
        <div className="mb-4 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-medium text-amber-200">确认该订单已线下到账？</p>
          <p className="mt-1 text-sm text-white/70">
            确认后将立即发放{' '}
            <span className="font-semibold text-cyan-200">{confirmingOrder.credits.toLocaleString()} credits</span>{' '}
            给{' '}
            <span className="font-semibold text-white">{confirmingOrder.userEmail ?? confirmingOrder.userId}</span>。
          </p>
          {confirmingOrder.credits >= 15000 && (
            <p className="mt-2 text-xs font-semibold text-amber-300">
              ⚠ 高额订单（{confirmingOrder.credits.toLocaleString()} credits），请二次确认转账截图与金额后再操作。
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleApprove(confirmingOrder)}
              disabled={!!approvingId}
              className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              {approvingId === confirmingOrder.id ? '确认中...' : '确认发放'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingId(null)}
              disabled={!!approvingId}
              className="rounded-md border border-white/15 px-4 py-1.5 text-sm text-white/60 hover:border-white/30 hover:text-white transition disabled:opacity-40"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-sm text-white/40">加载中…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">
          暂无待确认充值申请
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">申请编号</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">积分</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isHigh = order.credits >= 15000
                const isApproving = approvingId === order.id
                const isConfirming = confirmingId === order.id
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-white/5 last:border-0 ${isHigh ? 'bg-amber-400/[0.03]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <code className="max-w-[180px] break-all font-mono text-xs text-white/70">{order.id}</code>
                        <CopyButton text={order.id} />
                      </div>
                      {isHigh && (
                        <span className="mt-0.5 block text-xs font-semibold text-amber-300">高额，需复核</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white/80">{order.userDisplayName ?? '—'}</div>
                      <div className="text-xs text-white/45">{order.userEmail ?? order.userId}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{order.credits.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200">{order.status}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/45">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!!approvingId || isConfirming}
                        onClick={() => setConfirmingId(order.id)}
                        className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40 transition"
                      >
                        {isApproving ? '确认中...' : '确认到账并发放 credits'}
                      </button>
                      {msg?.id === order.id && (
                        <p className={`mt-1 text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                          {msg.text}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
