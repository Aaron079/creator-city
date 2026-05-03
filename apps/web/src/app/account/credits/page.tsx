'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { WalletBalanceCard } from '@/components/billing/WalletBalanceCard'
import { CreditLedgerTable } from '@/components/billing/CreditLedgerTable'
import type { UserWallet, CreditLedgerEntry } from '@/lib/billing/types'

interface ManualOrder {
  id: string
  amountCredits: number
  status: string
  note: string | null
  createdAt: string
}

export default function AccountCreditsPage() {
  const [wallet, setWallet] = useState<UserWallet | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [pendingOrders, setPendingOrders] = useState<ManualOrder[]>([])
  const [authError, setAuthError] = useState(false)
  const [loading, setLoading] = useState(true)

  // recharge form
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const [walletRes, ledgerRes] = await Promise.all([
      fetch('/api/credits/wallet', { credentials: 'include' }),
      fetch('/api/credits/ledger?limit=50', { credentials: 'include' }),
    ])
    if (walletRes.status === 401) { setAuthError(true); setLoading(false); return }
    if (walletRes.ok) setWallet(await walletRes.json() as UserWallet)
    if (ledgerRes.ok) {
      const d = await ledgerRes.json() as { items: CreditLedgerEntry[] }
      setLedger(d.items)
    }
    // fetch user's own pending orders — 403 is fine (non-admin path)
    const ordersRes = await fetch('/api/credits/my-orders?status=PENDING', { credentials: 'include' })
    if (ordersRes.ok) {
      const d = await ordersRes.json() as { orders: ManualOrder[] }
      setPendingOrders(d.orders)
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleRecharge(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(amount, 10)
    if (!n || n < 1) { setSubmitMsg({ ok: false, text: '请输入有效积分数量' }); return }
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch('/api/credits/manual-recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amountCredits: n, note: note.trim() || undefined }),
      })
      const data = await res.json() as { orderId?: string; message?: string }
      if (res.ok) {
        setSubmitMsg({ ok: true, text: `申请已提交（${data.orderId?.slice(0, 8)}…），等待管理员审核。` })
        setAmount(''); setNote('')
        void load()
      } else {
        setSubmitMsg({ ok: false, text: data.message ?? '提交失败' })
      }
    } catch {
      setSubmitMsg({ ok: false, text: '网络错误，请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <DashboardShell><div className="p-8 text-sm text-white/50">加载中…</div></DashboardShell>
  if (authError) return (
    <DashboardShell>
      <div className="p-8 text-sm text-red-400">请先 <a href="/auth/login" className="underline">登录</a> 后查看积分钱包。</div>
    </DashboardShell>
  )

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">

        <div>
          <h1 className="text-2xl font-semibold text-white">我的积分</h1>
          <p className="mt-1 text-sm text-white/50">余额、充值申请、消耗流水。</p>
        </div>

        <WalletBalanceCard wallet={wallet} />

        {/* Pending recharge orders */}
        {pendingOrders.length > 0 && (
          <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-amber-300">待审核申请 ({pendingOrders.length})</h2>
            <div className="space-y-2">
              {pendingOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{o.amountCredits.toLocaleString()} 积分</span>
                  {o.note && <span className="truncate max-w-xs text-white/40">{o.note}</span>}
                  <span className="text-white/40">{new Date(o.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recharge form */}
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 text-base font-semibold text-white">申请人工充值</h2>
          <form onSubmit={(e) => void handleRecharge(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-white/50">申请积分数量</label>
              <input
                type="number" min={1} max={1000000} value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="例：1000"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-white/50">备注（可选，如转账凭证）</label>
              <input
                type="text" value={note} onChange={(e) => setNote(e.target.value)}
                maxLength={200} placeholder="备注信息"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 sm:shrink-0"
            >
              {submitting ? '提交中…' : '提交申请'}
            </button>
          </form>
          {submitMsg && (
            <p className={`mt-3 text-sm ${submitMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{submitMsg.text}</p>
          )}
        </section>

        {/* Ledger */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">积分流水</h2>
          <CreditLedgerTable items={ledger} />
        </section>

      </main>
    </DashboardShell>
  )
}
