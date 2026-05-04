'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'

interface ProviderAccount {
  providerId: string
  displayName: string
  envStatus: 'available' | 'not-configured'
  nodeTypes: string[]
  monthlyBudgetUsd: number | null
  currentMonthCostUsd: number
  budgetMonth: string | null
  isActive: boolean
  lastCheckedAt: string | null
}

interface CostRow {
  id: string
  providerId: string
  jobType: string
  providerCostUsd: number
  userChargedCredits: number
  createdAt: string
  userId: string | null
}

export default function AdminProvidersPage() {
  const { user } = useAuthStore()
  const [accounts, setAccounts] = useState<ProviderAccount[]>([])
  const [costs, setCosts] = useState<CostRow[]>([])
  const [totalUsd, setTotalUsd] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setMessage('请先登录管理员账户。'); setLoading(false); return }
    if (user.role !== 'ADMIN') { setMessage('无权限：仅管理员可查看。'); setLoading(false); return }

    void Promise.all([
      fetch('/api/admin/providers/accounts', { credentials: 'include' })
        .then((r) => r.json() as Promise<{ accounts: ProviderAccount[] }>)
        .then((d) => setAccounts(d.accounts ?? [])),
      fetch('/api/admin/providers/costs?limit=50', { credentials: 'include' })
        .then((r) => r.json() as Promise<{ costs: CostRow[]; totalUsd: number }>)
        .then((d) => { setCosts(d.costs ?? []); setTotalUsd(d.totalUsd ?? 0) }),
    ])
      .catch(() => setMessage('加载 provider 数据失败，请刷新重试。'))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">Provider Gateway 管理</h1>
        <p className="mt-2 text-sm text-white/50">上游 AI API 账户状态、月度成本与定价规则。</p>

        {message && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {message}
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-white/40">加载中…</p>}

        {!loading && (
          <>
            {/* Account status table */}
            <section className="mt-8">
              <h2 className="mb-3 text-base font-medium text-white/80">Provider 账户状态</h2>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm text-white/70">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-left text-xs text-white/40">
                      <th className="px-4 py-2">Provider</th>
                      <th className="px-4 py-2">节点类型</th>
                      <th className="px-4 py-2">API 状态</th>
                      <th className="px-4 py-2">当月成本 (USD)</th>
                      <th className="px-4 py-2">月度预算 (USD)</th>
                      <th className="px-4 py-2">账单月份</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.providerId} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-medium text-white">{a.displayName}</td>
                        <td className="px-4 py-2 text-white/50">{a.nodeTypes.join(', ')}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.envStatus === 'available'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-white/10 text-white/40'
                            }`}
                          >
                            {a.envStatus === 'available' ? '已配置' : '未配置'}
                          </span>
                        </td>
                        <td className="px-4 py-2">${a.currentMonthCostUsd.toFixed(4)}</td>
                        <td className="px-4 py-2">{a.monthlyBudgetUsd != null ? `$${a.monthlyBudgetUsd.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-2 text-white/40">{a.budgetMonth ?? '—'}</td>
                      </tr>
                    ))}
                    {accounts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-white/30">暂无数据</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Cost ledger */}
            <section className="mt-8">
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-base font-medium text-white/80">最近成本记录</h2>
                <span className="text-xs text-white/40">最近 50 条 · 合计 ${totalUsd.toFixed(4)} USD</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm text-white/70">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-left text-xs text-white/40">
                      <th className="px-4 py-2">时间</th>
                      <th className="px-4 py-2">Provider</th>
                      <th className="px-4 py-2">类型</th>
                      <th className="px-4 py-2">成本 (USD)</th>
                      <th className="px-4 py-2">扣费积分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-2 text-white/40 tabular-nums">
                          {new Date(c.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-4 py-2">{c.providerId}</td>
                        <td className="px-4 py-2 text-white/50">{c.jobType}</td>
                        <td className="px-4 py-2 tabular-nums">${Number(c.providerCostUsd).toFixed(4)}</td>
                        <td className="px-4 py-2 tabular-nums">{c.userChargedCredits}</td>
                      </tr>
                    ))}
                    {costs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-white/30">暂无成本记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-xs text-white/40">
              成本写入 ProviderCostLedger 表；账户月度汇总写入 ProviderAccount 表。
              可通过 POST /api/admin/providers/accounts 设置 monthlyBudgetUsd 预算上限。
            </section>
          </>
        )}
      </main>
    </DashboardShell>
  )
}
