'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export type AlipayQrPayment = {
  packageId: string
  packageName: string
  amountCnyFen: number
  credits: number
  outTradeNo: string
  qrCode: string
  expiresAt?: string
}

type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'

type Props = {
  payment: AlipayQrPayment | null
  onClose: () => void
  onRefresh: (packageId: string) => Promise<AlipayQrPayment | null>
  onPaid: () => Promise<void> | void
}

function formatMoney(amountCnyFen: number) {
  return `¥${(amountCnyFen / 100).toFixed(2)}`
}

function formatSeconds(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function AlipayQrPaymentModal({ payment, onClose, onRefresh, onPaid }: Props) {
  const [current, setCurrent] = useState<AlipayQrPayment | null>(payment)
  const [status, setStatus] = useState<PaymentStatus>('PENDING')
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const checkingRef = useRef(false)
  const paidRef = useRef(false)

  useEffect(() => {
    setCurrent(payment)
    setStatus('PENDING')
    setError(null)
    setTimedOut(false)
    setNow(Date.now())
    checkingRef.current = false
    paidRef.current = false
  }, [payment])

  const secondsLeft = useMemo(() => {
    if (!current?.expiresAt) return 0
    return Math.ceil((new Date(current.expiresAt).getTime() - now) / 1000)
  }, [current?.expiresAt, now])

  const checkStatus = useCallback(async () => {
    if (!current?.outTradeNo || checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    try {
      const res = await fetch(`/api/payment/china/status?outTradeNo=${encodeURIComponent(current.outTradeNo)}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => ({})) as {
        success?: boolean
        status?: PaymentStatus
        message?: string
      }
      if (!res.ok || data.success === false) {
        setError(data.message ?? '查询支付状态失败')
        return
      }
      if (data.status) setStatus(data.status)
      if (data.status === 'PAID' && !paidRef.current) {
        paidRef.current = true
        setError(null)
        await onPaid()
        window.setTimeout(onClose, 1200)
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        setError(data.message ?? '支付失败或已取消')
      }
    } catch {
      setError('网络错误，暂时无法查询支付状态')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }, [current?.outTradeNo, onClose, onPaid])

  useEffect(() => {
    if (!current || status !== 'PENDING') return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() - startedAt >= 3 * 60 * 1000) {
        setTimedOut(true)
        window.clearInterval(timer)
        return
      }
      void checkStatus()
    }, 2000)
    return () => window.clearInterval(timer)
  }, [checkStatus, current, status])

  const refreshQr = async () => {
    if (!current || refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const next = await onRefresh(current.packageId)
      if (next) {
        setCurrent(next)
        setStatus('PENDING')
        setTimedOut(false)
        setNow(Date.now())
        paidRef.current = false
      }
    } finally {
      setRefreshing(false)
    }
  }

  if (!current) return null

  const statusText = status === 'PAID'
    ? '支付成功'
    : timedOut
      ? '支付超时'
      : status === 'FAILED'
        ? '支付失败'
        : status === 'CANCELLED'
          ? '已取消'
          : '等待支付'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">支付宝扫码支付</h2>
            <p className="mt-1 text-sm text-white/50">请使用支付宝 App 扫码完成支付。</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs ${status === 'PAID' ? 'bg-emerald-400/15 text-emerald-200' : timedOut || status === 'FAILED' ? 'bg-amber-400/15 text-amber-200' : 'bg-sky-400/15 text-sky-200'}`}>
            {statusText}
          </span>
        </div>

        <div className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-white/45">套餐</span><span className="text-white">{current.packageName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-white/45">金额</span><span className="font-semibold text-emerald-200">{formatMoney(current.amountCnyFen)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-white/45">积分</span><span className="text-white">{current.credits.toLocaleString()}</span></div>
          <div className="flex flex-col gap-1"><span className="text-white/45">订单号</span><span className="break-all font-mono text-xs text-white/70">{current.outTradeNo}</span></div>
        </div>

        <div className="my-5 flex justify-center">
          <div className="rounded-md bg-white p-4">
            <QRCodeSVG value={current.qrCode} size={220} includeMargin />
          </div>
        </div>

        <div className="mb-4 text-center text-sm text-white/55">
          {status === 'PAID'
            ? '支付成功，积分已到账。'
            : timedOut
              ? '支付超时，请刷新二维码或重新下单。'
              : `二维码有效期 ${formatSeconds(secondsLeft)}`}
        </div>

        {status !== 'PAID' ? (
          <div className="mb-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/45">
            沙箱 iOS 暂无法扫码时，可由管理员在 /admin/payments/china 模拟支付成功，用于验证到账链路。
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-md border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => void refreshQr()}
            disabled={refreshing || status === 'PAID'}
            className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? '刷新中...' : '刷新二维码'}
          </button>
          <button
            type="button"
            onClick={() => void checkStatus()}
            disabled={checking || status === 'PAID'}
            className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/75 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? '查询中...' : '我已支付，刷新状态'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-100"
          >
            取消订单
          </button>
        </div>
      </div>
    </div>
  )
}
