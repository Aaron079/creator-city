'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Nav } from '@/components/layout/Nav'
import { useOrderStore, ORDER_STATUS_META, STATUS_STEP } from '@/store/order.store'
import { useJobsStore } from '@/store/jobs.store'
import { useChatStore } from '@/store/chat.store'
import { useRelationshipStore } from '@/store/relationship.store'
import { useTeamStore } from '@/store/team.store'
import { generateSplit } from '@/lib/payment/split'
import { AnimatePresence, motion as m2 } from 'framer-motion'
import type { OrderStatus } from '@/store/order.store'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all',         label: '全部'  },
  { key: 'pending',     label: '待支付' },
  { key: 'paid',        label: '已支付' },
  { key: 'in_progress', label: '制作中' },
  { key: 'completed',   label: '已完成' },
  { key: 'settled',     label: '已结算' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Payment modal (inline for orders page) ───────────────────────────────────

function OrderPayModal({ orderId, price, onClose, onPay }: {
  orderId: string; price: number; onClose: () => void; onPay: () => void
}) {
  const [paying, setPaying] = useState(false)
  const [done,   setDone]   = useState(false)
  const [piId,   setPiId]   = useState('')
  const [error,  setError]  = useState('')

  const handlePay = async () => {
    setPaying(true)
    setError('')
    try {
      // Step 1: Create PaymentIntent via API
      const res = await fetch('/api/payment/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ orderId, amount: price }),
      })
      if (!res.ok) throw new Error('API error')
      const { clientSecret, paymentIntentId } = await res.json() as {
        clientSecret: string; paymentIntentId: string
      }

      // Step 2: Confirm (real: stripe.confirmPayment({ clientSecret }))
      setPiId(paymentIntentId)
      console.info('[Payment] intent:', paymentIntentId, '| secret:', clientSecret.slice(0, 20) + '…')
      await new Promise((r) => setTimeout(r, 700))

      // Step 3: Simulate webhook — server confirms and returns orderId
      const whRes = await fetch('/api/payment/webhook', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: paymentIntentId } },
        }),
      })
      const whData = await whRes.json() as { handled: boolean; action?: string }
      if (!whData.handled || whData.action !== 'mark_paid') throw new Error('webhook_rejected')

      // Step 4: Update order state only after server confirms
      onPay()
      setDone(true)
      await new Promise((r) => setTimeout(r, 900))
      onClose()
    } catch {
      setError('支付请求失败，请重试')
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <m2.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <m2.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0,   scale: 0.95,  y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: 'rgba(8,12,22,0.99)', border: '1px solid rgba(251,146,60,0.3)', boxShadow: '0 32px 80px rgba(0,0,0,0.75)' }}
      >
        <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #fb923c, #f59e0b44)' }} />
        <div className="p-6 flex flex-col gap-5">
          {done ? (
            <m2.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'rgba(16,185,129,0.2)', border: '2px solid #34d399' }}>✓</div>
              <p className="text-base font-bold text-white">支付成功</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>订单已进入制作流程</p>
            </m2.div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-white">确认支付</p>
                <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>✕</button>
              </div>
              <div className="rounded-2xl p-5 flex flex-col items-center gap-1"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>支付金额</p>
                <p className="text-4xl font-black" style={{ color: '#fb923c' }}>¥{price.toLocaleString()}</p>
              </div>
              <m2.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handlePay} disabled={paying}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{
                  background: paying ? 'rgba(251,146,60,0.4)' : 'linear-gradient(135deg, #fb923c, #f59e0b)',
                  boxShadow:  paying ? 'none' : '0 4px 20px rgba(251,146,60,0.45)',
                }}>
                {paying ? '支付中…' : '确认模拟支付'}
              </m2.button>
              {error && (
                <p className="text-[11px] text-center" style={{ color: '#f87171' }}>{error}</p>
              )}
              {piId && (
                <p className="text-[9px] text-center font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  {piId.slice(0, 28)}…
                </p>
              )}
              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.15)' }}>
                仅做状态模拟，不涉及真实资金
              </p>
            </>
          )}
        </div>
      </m2.div>
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, index }: {
  order: ReturnType<typeof useOrderStore.getState>['orders'][number]
  index: number
}) {
  const [showPay, setShowPay] = useState(false)

  const jobs               = useJobsStore((s) => s.jobs)
  const quotes             = useChatStore((s) => s.quotes)
  const payOrder           = useOrderStore((s) => s.payOrder)
  const startWork          = useOrderStore((s) => s.startWork)
  const completeAndSplit   = useOrderStore((s) => s.completeAndSplit)
  const markSettled        = useOrderStore((s) => s.markSettled)
  const upsertRelation     = useRelationshipStore((s) => s.upsert)
  const getTeamByOrder     = useTeamStore((s) => s.getTeamByOrder)

  const job   = jobs.find((j) => j.id === order.chatId)
  const quote = quotes.find((q) => q.id === order.quoteId)
  const meta  = ORDER_STATUS_META[order.status]

  const isUnpaid      = order.paymentStatus === 'unpaid'
  const isPaid        = order.status === 'paid'
  const isInProgress  = order.status === 'in_progress'
  const isCompleted   = order.status === 'completed'
  const isSettled     = order.status === 'settled'

  const steps: OrderStatus[] = ['pending', 'paid', 'in_progress', 'completed', 'settled']
  const currentStep = STATUS_STEP[order.status]

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isUnpaid ? 'rgba(251,146,60,0.06)' : 'rgba(255,255,255,0.025)',
        border:     isUnpaid ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow:  isUnpaid ? '0 0 0 1px rgba(251,146,60,0.1)' : 'none',
      }}
    >
      {/* Top accent line */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}33)` }} />

      <div className="p-6 flex flex-col gap-5">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {order.id.slice(0, 16)}
            </p>
            <p className="text-base font-bold text-white leading-snug">
              {job?.title ?? '未知项目'}
            </p>
            {quote && (
              <p className="text-[11px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {quote.description.slice(0, 60)}{quote.description.length > 60 ? '…' : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-2xl font-black" style={{ color: meta.color }}>
              ¥{order.price.toLocaleString()}
            </p>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
            >
              {meta.label}
            </span>
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0">
          {steps.map((step, si) => {
            const stepMeta = ORDER_STATUS_META[step]
            const done     = si <= currentStep
            const active   = si === currentStep
            return (
              <div key={step} className="flex items-center flex-1">
                {/* Node */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 transition-all"
                    style={{
                      background: done ? stepMeta.color : 'rgba(255,255,255,0.06)',
                      color:      done ? '#050810'       : 'rgba(255,255,255,0.2)',
                      boxShadow:  active ? `0 0 10px ${stepMeta.color}66` : 'none',
                    }}
                  >
                    {done && !active ? '✓' : si + 1}
                  </div>
                  <p className="text-[8px] whitespace-nowrap" style={{ color: done ? stepMeta.color : 'rgba(255,255,255,0.2)' }}>
                    {stepMeta.label}
                  </p>
                </div>
                {/* Connector */}
                {si < steps.length - 1 && (
                  <div
                    className="flex-1 h-px mx-1"
                    style={{ background: si < currentStep ? meta.color + '66' : 'rgba(255,255,255,0.06)' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Split panel */}
        <AnimatePresence>
          {order.split && (
            <m2.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(251,191,36,0.12)', background: 'rgba(251,191,36,0.05)' }}
                >
                  <span className="text-sm">💸</span>
                  <p className="text-[11px] font-bold flex-1" style={{ color: '#fbbf24' }}>收益分配</p>
                  {isSettled && (
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}
                    >
                      已结算
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 flex flex-col gap-1.5">
                  {/* Platform fee row */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-3 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>🏢</span>
                    <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      平台服务费 ({Math.round(order.split.platformRate * 100)}%)
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      ¥{order.split.platformFee.toLocaleString()}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="my-1" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }} />

                  {/* Member payouts */}
                  {order.split.payouts.map((payout) => (
                    <div key={payout.userId} className="flex items-center gap-2">
                      <span className="text-[10px] w-3 text-center">👤</span>
                      <span className="text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {payout.name}
                      </span>
                      <span
                        className="text-[9px] px-1 py-0.5 rounded"
                        style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}
                      >
                        {payout.weight}%
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: '#fbbf24' }}>
                        ¥{payout.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}

                  {/* Divider + total */}
                  <div className="flex items-center justify-between pt-1.5 mt-0.5" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>创作者总收益</span>
                    <span className="text-[11px] font-black" style={{ color: '#fbbf24' }}>
                      ¥{order.split.remaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </m2.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            创建于 {formatDate(order.createdAt)}
          </p>
          <div className="flex items-center gap-2">
            {job && (
              <Link
                href={`/chat/${job.id}`}
                className="px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all hover:opacity-80"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border:     '1px solid rgba(255,255,255,0.08)',
                  color:      'rgba(255,255,255,0.45)',
                }}
              >
                查看聊天 →
              </Link>
            )}
            {isUnpaid && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowPay(true)}
                className="px-4 py-1.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fb923c, #f59e0b)',
                  color:      'white',
                  boxShadow:  '0 2px 12px rgba(251,146,60,0.5)',
                }}
              >
                去支付 →
              </motion.button>
            )}
            {isPaid && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => startWork(order.id)}
                className="px-4 py-1.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color:      'white',
                  boxShadow:  '0 2px 12px rgba(99,102,241,0.4)',
                }}
              >
                开始制作 →
              </motion.button>
            )}
            {isInProgress && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (job?.creatorId) upsertRelation('user-me', job.creatorId, order.price)
                  const team    = getTeamByOrder(order.id)
                  const members = team ? team.members.filter((m) => m.status === 'joined') : []
                  const split   = generateSplit({ totalPrice: order.price, members })
                  completeAndSplit(order.id, split)
                }}
                className="px-4 py-1.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color:      'white',
                  boxShadow:  '0 2px 12px rgba(16,185,129,0.4)',
                }}
              >
                标记完成 ✓
              </motion.button>
            )}
            {isCompleted && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => markSettled(order.id)}
                className="px-4 py-1.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  color:      '#1a0f00',
                  boxShadow:  '0 2px 12px rgba(251,191,36,0.4)',
                }}
              >
                确认结算 →
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>

    <AnimatePresence>
      {showPay && (
        <OrderPayModal
          orderId={order.id}
          price={order.price}
          onClose={() => setShowPay(false)}
          onPay={() => payOrder(order.id)}
        />
      )}
    </AnimatePresence>
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-5xl">📦</p>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>暂无订单</p>
      <Link
        href="/jobs"
        className="px-5 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}
      >
        去接单广场看看
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [tab, setTab] = useState<'all' | OrderStatus>('all')
  const orders = useOrderStore((s) => s.orders)

  const filtered = tab === 'all'
    ? orders
    : orders.filter((o) => o.status === tab)

  const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt)

  // Count per status
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <main className="min-h-screen" style={{ background: '#050810', color: '#f9fafb' }}>
      <Nav />

      <div className="pt-14">
        {/* Header */}
        <div className="border-b border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-6 py-10">
            <p className="text-[10px] tracking-[0.2em] uppercase mb-2 font-medium" style={{ color: '#a5b4fc' }}>
              Orders
            </p>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">订单中心</h1>
                <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {orders.length} 个订单
                </p>
              </div>
              {/* Total value */}
              {orders.length > 0 && (
                <div className="text-right">
                  <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    总金额
                  </p>
                  <p className="text-2xl font-black" style={{ color: '#a5b4fc' }}>
                    ¥{orders.reduce((s, o) => s + o.price, 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.05]">
          <div className="max-w-3xl mx-auto px-6">
            <div className="flex gap-1 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {STATUS_TABS.map((t) => {
                const count = t.key === 'all' ? orders.length : (counts[t.key] ?? 0)
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                    style={
                      tab === t.key
                        ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }
                        : { background: 'transparent',           color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
                    }
                  >
                    {t.label}
                    {count > 0 && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{
                          background: tab === t.key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)',
                          color:      tab === t.key ? '#a5b4fc'               : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Order list */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          {sorted.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-4">
              {sorted.map((order, i) => (
                <OrderCard key={order.id} order={order} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
