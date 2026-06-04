'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'
import { formatAdminDateTime } from '@/lib/format/adminDate'

// ── Types ────────────────────────────────────────────────────────────────────

interface UsageSummary {
  total: number
  byok: number
  platformCredits: number
  succeeded: number
  failed: number
  successRate: number
  platformServiceFeeCredits: number
}

interface UsageData {
  range: string
  since: string
  summary: UsageSummary
  byOutputType: Array<{ outputType: string; count: number }>
  byProvider: Array<{ providerId: string; count: number }>
  byBillingMode: Array<{ billingMode: string; count: number }>
  byStatus: Array<{ status: string; count: number }>
  topUsers: Array<{ userId: string; email: string | null; displayName: string | null; count: number }>
  recent: Array<{
    id: string
    userId: string
    userEmail: string | null
    projectId: string | null
    nodeId: string | null
    providerId: string
    outputType: string
    billingMode: string
    status: string
    providerCostPaidBy: string
    promptChars: number
    platformServiceFeeCredits: number
    errorCode: string | null
    createdAt: string
  }>
}

type RangeOption = '24h' | '7d' | '30d'

// ── Small components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'violet' | 'cyan' | 'green' | 'rose' | 'amber'
}) {
  const accentClass =
    accent === 'violet' ? 'text-violet-300' :
    accent === 'cyan'   ? 'text-cyan-300'   :
    accent === 'green'  ? 'text-green-300'  :
    accent === 'rose'   ? 'text-rose-300'   :
    accent === 'amber'  ? 'text-amber-300'  :
    'text-white'
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-white/30">{sub}</div>}
    </div>
  )
}

function DistroRow({ label, count, max, accent }: {
  label: string
  count: number
  max: number
  accent?: string
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  const barColor = accent ?? 'bg-violet-500/60'
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 shrink-0 truncate text-xs text-white/65">{label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-10 shrink-0 text-right text-xs tabular-nums text-white/55">{count}</div>
    </div>
  )
}

function billingBadge(mode: string) {
  if (mode === 'user_provider_account') {
    return <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">BYOK</span>
  }
  return <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-medium text-cyan-300">平台额度</span>
}

function statusBadge(status: string) {
  if (status === 'succeeded') {
    return <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-300">成功</span>
  }
  if (status === 'failed') {
    return <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">失败</span>
  }
  return <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/40">{status}</span>
}

function typeBadge(outputType: string) {
  if (outputType === 'image') {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">图片</span>
  }
  if (outputType === 'video') {
    return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-300">视频</span>
  }
  return <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/40">文本</span>
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsagePage() {
  const { user, isAuthenticated } = useAuthStore()
  const [range, setRange] = useState<RangeOption>('7d')
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (r: RangeOption) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/usage?range=${r}`, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json() as { message?: string }
        setError(d.message ?? '加载失败')
        return
      }
      const d = await res.json() as UsageData
      setData(d)
    } catch {
      setError('网络错误，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setError('请先登录。')
      setLoading(false)
      return
    }
    if (user?.role !== 'ADMIN') {
      setError('无权限：仅管理员可访问此页面。')
      setLoading(false)
      return
    }
    void fetchData(range)
  }, [isAuthenticated, user?.role, range, fetchData])

  const ranges: RangeOption[] = ['24h', '7d', '30d']
  const rangeLabel: Record<RangeOption, string> = { '24h': '近 24h', '7d': '近 7 天', '30d': '近 30 天' }

  const maxProvider = data?.byProvider[0]?.count ?? 1
  const maxOutputType = Math.max(...(data?.byOutputType.map(r => r.count) ?? [1]), 1)
  const maxStatus = Math.max(...(data?.byStatus.map(r => r.count) ?? [1]), 1)

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* Header */}
        <Link
          href="/admin"
          className="mb-5 inline-flex rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
        >
          ← 管理员面板
        </Link>
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/30">Admin Console</div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">生成用量观察</h1>
            <p className="mt-1 text-sm text-white/40">BYOK 与平台额度调用统计。基于 UsageLog 表，只读。</p>
          </div>
          {/* Range selector */}
          <div className="flex shrink-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === r
                    ? 'bg-white/[0.10] text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {rangeLabel[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Notice banner */}
        <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2.5 text-xs text-white/35">
          当前仅统计用量，不启用平台服务费扣费。
          <span className="ml-2 text-white/25">platform_credits = 平台代付 Provider 费用；user_provider_account = 用户自带 API Key，Provider 费用由用户直接支付。</span>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="mt-8 text-sm text-white/35">加载中…</div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryCard label="总调用数" value={data.summary.total} />
              <SummaryCard label="BYOK 调用" value={data.summary.byok} accent="violet" sub="用户自带 Key" />
              <SummaryCard label="平台额度" value={data.summary.platformCredits} accent="cyan" sub="平台代付" />
              <SummaryCard label="成功率" value={`${data.summary.successRate}%`} accent="green" sub={`${data.summary.succeeded} 成功`} />
              <SummaryCard label="失败数" value={data.summary.failed} accent={data.summary.failed > 0 ? 'rose' : undefined} />
              <SummaryCard
                label="服务费总计"
                value={data.summary.platformServiceFeeCredits}
                accent="amber"
                sub="当前固定为 0"
              />
            </div>

            {/* Distributions */}
            <div className="mt-6 grid gap-4 lg:grid-cols-3">

              {/* By output type */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">生成类型</div>
                {data.byOutputType.length === 0 ? (
                  <div className="text-xs text-white/25">暂无数据</div>
                ) : (
                  data.byOutputType.map(r => (
                    <DistroRow
                      key={r.outputType}
                      label={r.outputType === 'image' ? '图片' : r.outputType === 'video' ? '视频' : '文本'}
                      count={r.count}
                      max={maxOutputType}
                      accent={r.outputType === 'image' ? 'bg-amber-500/60' : r.outputType === 'video' ? 'bg-blue-500/60' : 'bg-white/30'}
                    />
                  ))
                )}
              </div>

              {/* By billing mode */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">计费模式</div>
                {data.byBillingMode.length === 0 ? (
                  <div className="text-xs text-white/25">暂无数据</div>
                ) : (
                  data.byBillingMode.map(r => (
                    <DistroRow
                      key={r.billingMode}
                      label={r.billingMode === 'user_provider_account' ? 'BYOK（我的 API）' : '平台额度'}
                      count={r.count}
                      max={data.summary.total || 1}
                      accent={r.billingMode === 'user_provider_account' ? 'bg-violet-500/60' : 'bg-cyan-500/60'}
                    />
                  ))
                )}
              </div>

              {/* By status */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">状态分布</div>
                {data.byStatus.length === 0 ? (
                  <div className="text-xs text-white/25">暂无数据</div>
                ) : (
                  data.byStatus.map(r => (
                    <DistroRow
                      key={r.status}
                      label={r.status === 'succeeded' ? '成功' : r.status === 'failed' ? '失败' : r.status}
                      count={r.count}
                      max={maxStatus}
                      accent={r.status === 'succeeded' ? 'bg-green-500/60' : r.status === 'failed' ? 'bg-rose-500/60' : 'bg-white/20'}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Provider distribution */}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">Provider 分布（前 20）</div>
              {data.byProvider.length === 0 ? (
                <div className="text-xs text-white/25">暂无数据</div>
              ) : (
                <div className="grid gap-0 sm:grid-cols-2">
                  {data.byProvider.map(r => (
                    <DistroRow key={r.providerId} label={r.providerId} count={r.count} max={maxProvider} />
                  ))}
                </div>
              )}
            </div>

            {/* Top users */}
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/8 px-5 py-3 text-xs font-medium uppercase tracking-wider text-white/30">
                Top 10 用户（按调用次数）
              </div>
              {data.topUsers.length === 0 ? (
                <div className="px-5 py-4 text-xs text-white/25">暂无数据</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.14em] text-white/30">
                    <tr>
                      <th className="px-5 py-2.5">#</th>
                      <th className="px-5 py-2.5">邮箱</th>
                      <th className="px-5 py-2.5">显示名</th>
                      <th className="px-5 py-2.5 text-right">调用数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((u, i) => (
                      <tr key={u.userId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.015]">
                        <td className="px-5 py-2.5 text-white/30 tabular-nums">{i + 1}</td>
                        <td className="px-5 py-2.5 text-white/65">{u.email ?? '—'}</td>
                        <td className="px-5 py-2.5 text-white/45">{u.displayName ?? '—'}</td>
                        <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-white">{u.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent logs */}
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/8 px-5 py-3 text-xs font-medium uppercase tracking-wider text-white/30">
                最近 {data.recent.length} 条记录（不含 prompt 明文，仅展示字符数）
              </div>
              {data.recent.length === 0 ? (
                <div className="px-5 py-4 text-xs text-white/25">暂无数据</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/8 text-[10px] uppercase tracking-[0.14em] text-white/25">
                      <tr>
                        <th className="px-4 py-2.5 whitespace-nowrap">时间</th>
                        <th className="px-4 py-2.5">邮箱</th>
                        <th className="px-4 py-2.5">类型</th>
                        <th className="px-4 py-2.5">Provider</th>
                        <th className="px-4 py-2.5">计费</th>
                        <th className="px-4 py-2.5">状态</th>
                        <th className="px-4 py-2.5 text-right whitespace-nowrap">Prompt 字符</th>
                        <th className="px-4 py-2.5 text-right">服务费</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map(r => (
                        <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.015]">
                          <td className="px-4 py-2 text-white/35 whitespace-nowrap">
                            {formatAdminDateTime(r.createdAt)}
                          </td>
                          <td className="px-4 py-2 text-white/55 max-w-[160px] truncate">{r.userEmail ?? '—'}</td>
                          <td className="px-4 py-2">{typeBadge(r.outputType)}</td>
                          <td className="px-4 py-2 text-white/45 max-w-[140px] truncate">{r.providerId}</td>
                          <td className="px-4 py-2">{billingBadge(r.billingMode)}</td>
                          <td className="px-4 py-2">
                            {statusBadge(r.status)}
                            {r.errorCode && (
                              <div className="mt-0.5 text-[9px] text-rose-400/60 truncate max-w-[100px]">{r.errorCode}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/40">{r.promptChars}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-white/25">{r.platformServiceFeeCredits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-white/20">
              统计范围：{rangeLabel[range as RangeOption]} · 平台服务费收取：未启用 · 数据来源：UsageLog 表
            </div>
          </>
        )}

        {!loading && !error && data?.summary.total === 0 && (
          <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-6 text-center text-sm text-white/30">
            当前时间段内暂无用量记录。UsageLog 表为空或该范围内没有生成请求。
          </div>
        )}
      </main>
    </DashboardShell>
  )
}
