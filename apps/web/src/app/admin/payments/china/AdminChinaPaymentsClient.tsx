'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type AdminChinaPaymentOrder = {
  id: string
  outTradeNo: string | null
  userId: string
  provider: string
  packageName: string | null
  credits: number
  amount: number
  currency: string
  status: string
  createdAt: string
  paidAt: string | null
}

type Props = {
  orders: AdminChinaPaymentOrder[]
  simulationEnabled: boolean
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'CNY') return `¥${(amount / 100).toFixed(2)}`
  return `${currency} ${(amount / 100).toFixed(2)}`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'PAID'
    ? 'bg-emerald-400/15 text-emerald-200'
    : status === 'PENDING'
      ? 'bg-sky-400/15 text-sky-200'
      : 'bg-amber-400/15 text-amber-200'
  return <span className={`rounded-full px-2.5 py-1 text-xs ${className}`}>{status}</span>
}

export function AdminChinaPaymentsClient({ orders, simulationEnabled }: Props) {
  const router = useRouter()
  const [pendingOutTradeNo, setPendingOutTradeNo] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  async function simulatePaid(outTradeNo: string) {
    setPendingOutTradeNo(outTradeNo)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/payments/china/simulate-paid', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ outTradeNo }),
      })
      const data = await res.json().catch(() => ({})) as {
        success?: boolean
        errorCode?: string
        message?: string
        idempotent?: boolean
      }
      if (!res.ok || data.success === false) {
        setMessage({ ok: false, text: `${data.errorCode ?? 'SIMULATION_FAILED'}：${data.message ?? '模拟支付失败'}` })
        return
      }
      setMessage({ ok: true, text: data.idempotent ? '订单已支付，未重复加积分。' : '模拟支付成功，积分已入账。' })
      startTransition(() => router.refresh())
    } catch {
      setMessage({ ok: false, text: '网络错误，模拟支付失败。' })
    } finally {
      setPendingOutTradeNo(null)
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">自动支付 / 沙箱订单</h2>
          <p className="mt-1 text-sm text-white/45">
            支付宝 / 微信自动支付订单。支付回调验签通过后自动入账，无需人工审批。
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${simulationEnabled ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/45'}`}>
          {simulationEnabled ? 'simulation enabled' : '未开启支付模拟模式'}
        </span>
      </div>
      <div className="mb-4 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2.5 text-xs leading-relaxed text-white/40">
        此区域显示支付宝 / 微信自动支付订单，沙箱期间可能出现管理员模拟入账记录（settlementSource: sandbox_simulation）。
        <span className="font-medium text-amber-200/60"> 人工转账充值申请请在上方&ldquo;人工充值申请 — 待审核&rdquo;区块处理，两者互不干扰。</span>
      </div>

      {message ? (
        <div className={`mb-3 rounded-md border px-3 py-2 text-sm ${message.ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-red-400/25 bg-red-400/10 text-red-100'}`}>
          {message.text}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-6 text-center text-sm text-white/40">暂无中国支付订单</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">订单号</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">渠道</th>
                <th className="px-4 py-3">套餐</th>
                <th className="px-4 py-3">积分</th>
                <th className="px-4 py-3">金额</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">创建时间</th>
                <th className="px-4 py-3">支付时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const canSimulate = simulationEnabled && order.status === 'PENDING' && Boolean(order.outTradeNo)
                const disabledReason = !simulationEnabled
                  ? '未开启支付模拟模式'
                  : order.status !== 'PENDING'
                    ? '仅 PENDING 订单可模拟'
                    : !order.outTradeNo
                      ? '缺少订单号'
                      : ''
                return (
                  <tr key={order.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <div className="max-w-[210px] break-all font-mono text-xs text-white/70">{order.outTradeNo ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[160px] break-all font-mono text-xs text-white/55">{order.userId}</div>
                    </td>
                    <td className="px-4 py-3 text-white/70">{order.provider}</td>
                    <td className="px-4 py-3 text-white/70">{order.packageName ?? '-'}</td>
                    <td className="px-4 py-3 font-semibold text-white">{order.credits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-200">{formatAmount(order.amount, order.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/45">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/45">{formatDate(order.paidAt)}</td>
                    <td className="px-4 py-3">
                      {order.status === 'PENDING' ? (
                        <button
                          type="button"
                          title={disabledReason || '沙箱模拟：标记该自动支付订单为已支付（不影响人工充值审批）'}
                          disabled={!canSimulate || pendingOutTradeNo === order.outTradeNo || isRefreshing}
                          onClick={() => order.outTradeNo ? void simulatePaid(order.outTradeNo) : undefined}
                          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35"
                        >
                          {pendingOutTradeNo === order.outTradeNo ? '模拟中...' : '沙箱模拟入账'}
                        </button>
                      ) : (
                        <span className="text-xs text-white/35">-</span>
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
