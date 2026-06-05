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

interface ByokProviderEntry {
  providerId: string
  calls: number
  succeeded: number
  failed: number
  successRate: number
}

interface ByokHighFreqUser {
  userId: string
  email: string | null
  displayName: string | null
  calls: number
  succeeded: number
  failed: number
  successRate: number
  topProviderId: string | null
  topOutputType: string | null
}

interface DailyTrendEntry {
  date: string
  byokCalls: number
  platformCreditCalls: number
  byokSucceeded: number
  byokFailed: number
}

interface ByokBusinessMetrics {
  enabled: boolean
  label: string
  range: string
  byokCalls: number
  platformCreditCalls: number
  totalCalls: number
  byokSharePercent: number
  activeByokUsers: number
  byokSuccessRate: number
  byokFailureRate: number
  highFrequencyThreshold: number
  highFrequencyCount: number
  byokByOutputType: { text: number; image: number; video: number }
  byokByProvider: ByokProviderEntry[]
  highFrequencyUsers: ByokHighFreqUser[]
  dailyTrend: DailyTrendEntry[]
  notes: string[]
}

interface SimulatedOutputType {
  calls: number
  simulatedCredits: number
  rule: string
  hasMissingDuration?: boolean
}

interface SimulatedServiceCredits {
  enabled: boolean
  label: string
  range: string
  totalCredits: number
  byOutputType: {
    text: SimulatedOutputType
    image: SimulatedOutputType
    video: SimulatedOutputType & { hasMissingDuration: boolean }
  }
  failedByokCalls: number
  pendingByokCalls: number
  assumptions: string[]
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
  byokBusinessMetrics: ByokBusinessMetrics
  simulatedServiceCredits: SimulatedServiceCredits
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

// ── Observation summary builder ───────────────────────────────────────────────

function buildObservationSummary(data: UsageData, rangeLbl: string): string {
  const m = data.byokBusinessMetrics
  const s = data.simulatedServiceCredits

  let conclusion: string
  if (m.byokCalls === 0) {
    conclusion = '当前范围暂无 BYOK 使用，暂不具备定价判断依据。'
  } else if (m.byokFailureRate > 20) {
    conclusion = 'BYOK 失败率偏高，优先修复稳定性和错误引导，不建议推进收费。'
  } else if (m.byokCalls >= 100) {
    conclusion = 'BYOK 使用量较高，建议持续跟踪高频用户与基础设施成本，但仍不建议在缺少服务 credits 钱包和失败退款前启用收费。'
  } else if (m.byokCalls >= 20 && m.byokSuccessRate >= 80) {
    conclusion = 'BYOK 已有一定使用量且成功率较稳定，可继续观察高频用户和 Provider 分布。'
  } else {
    conclusion = '当前 BYOK 用量较低，建议继续观察。'
  }

  const topProviders = m.byokByProvider.slice(0, 3).map(p =>
    `${p.providerId}（${p.calls}次，成功率${p.successRate}%）`
  ).join('、')

  return [
    `Creator City BYOK 观察摘要（${rangeLbl}）`,
    `生成日期：${new Date().toISOString().slice(0, 10)}`,
    '',
    `· BYOK 调用数：${m.byokCalls}`,
    `· 平台额度调用数：${m.platformCreditCalls}`,
    `· BYOK 占比：${m.byokSharePercent}%`,
    `· 活跃 BYOK 用户：${m.activeByokUsers}`,
    `· BYOK 成功率：${m.byokSuccessRate}%`,
    `· 高频 BYOK 用户（≥${m.highFrequencyThreshold}次）：${m.highFrequencyCount}`,
    `· Top Provider：${topProviders || '暂无数据'}`,
    `· 类型分布：文本 ${m.byokByOutputType.text} / 图片 ${m.byokByOutputType.image} / 视频 ${m.byokByOutputType.video}`,
    `· 模拟服务积分：${s.totalCredits} service credits（只读估算，当前未启用扣费）`,
    `· BYOK 失败：${s.failedByokCalls} 次；处理中：${s.pendingByokCalls} 次（不计入模拟服务积分）`,
    '',
    `· 观察结论：${conclusion}`,
    '',
    '· 边界说明：此摘要只读，不写账本，不改变 UsageLog.platformServiceFeeCredits，不代表实际收费。',
    '· 当前未启用平台服务费。模拟 service credits 只是估算，不会扣费，不会写入账本。',
  ].join('\n')
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsagePage() {
  const { user, isAuthenticated } = useAuthStore()
  const [range, setRange] = useState<RangeOption>('7d')
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [showFallback, setShowFallback] = useState(false)

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

  const handleCopy = useCallback(async () => {
    if (!data) return
    const rangeLabelMap: Record<RangeOption, string> = { '24h': '近 24h', '7d': '近 7 天', '30d': '近 30 天' }
    const text = buildObservationSummary(data, rangeLabelMap[range])
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
      setShowFallback(false)
      setTimeout(() => setCopyStatus('idle'), 2500)
    } catch {
      setCopyStatus('failed')
      setShowFallback(true)
    }
  }, [data, range])

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

            {/* BYOK Business Metrics — read-only analysis */}
            {data.byokBusinessMetrics && (
              <div className="mt-6 rounded-xl border border-sky-500/20 bg-sky-500/[0.03]">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2 border-b border-sky-500/15 px-5 py-3">
                  <span className="text-sm font-semibold text-sky-300">BYOK 商业指标（只读）</span>
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                    只读指标
                  </span>
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-400">
                    当前不会扣费
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs text-sky-200/50 leading-relaxed">
                    用于观察我的 API 在 30–60 天内的真实增长、成功率和高频用户。
                    <strong className="text-sky-300"> 当前不会扣费，不会写入账本，不会改变 UsageLog.platformServiceFeeCredits。</strong>
                  </p>

                  {/* Summary cards */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <SummaryCard label="BYOK 调用数" value={data.byokBusinessMetrics.byokCalls} accent="cyan" sub="我的 API" />
                    <SummaryCard
                      label="BYOK 占比"
                      value={`${data.byokBusinessMetrics.byokSharePercent}%`}
                      accent="cyan"
                      sub={`共 ${data.byokBusinessMetrics.totalCalls} 次`}
                    />
                    <SummaryCard label="活跃 BYOK 用户" value={data.byokBusinessMetrics.activeByokUsers} accent="violet" sub="本时间段" />
                    <SummaryCard
                      label="BYOK 成功率"
                      value={`${data.byokBusinessMetrics.byokSuccessRate}%`}
                      accent={data.byokBusinessMetrics.byokSuccessRate >= 80 ? 'green' : 'amber'}
                    />
                    <SummaryCard
                      label="高频用户数"
                      value={data.byokBusinessMetrics.highFrequencyCount}
                      sub={`≥ ${data.byokBusinessMetrics.highFrequencyThreshold} 次`}
                    />
                    <SummaryCard label="平台额度调用" value={data.byokBusinessMetrics.platformCreditCalls} sub="平台代付" />
                  </div>

                  {/* Output type + Provider distribution */}
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {/* BYOK output type */}
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
                      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">BYOK 类型分布</div>
                      {data.byokBusinessMetrics.byokCalls === 0 ? (
                        <div className="text-xs text-white/25">暂无 BYOK 数据</div>
                      ) : (() => {
                        const maxOut = Math.max(
                          data.byokBusinessMetrics.byokByOutputType.text,
                          data.byokBusinessMetrics.byokByOutputType.image,
                          data.byokBusinessMetrics.byokByOutputType.video,
                          1,
                        )
                        return (
                          <>
                            <DistroRow label="文本" count={data.byokBusinessMetrics.byokByOutputType.text} max={maxOut} accent="bg-white/30" />
                            <DistroRow label="图片" count={data.byokBusinessMetrics.byokByOutputType.image} max={maxOut} accent="bg-amber-500/60" />
                            <DistroRow label="视频" count={data.byokBusinessMetrics.byokByOutputType.video} max={maxOut} accent="bg-blue-500/60" />
                          </>
                        )
                      })()}
                    </div>

                    {/* BYOK provider top 10 */}
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
                      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">BYOK Provider Top 10</div>
                      {data.byokBusinessMetrics.byokByProvider.length === 0 ? (
                        <div className="text-xs text-white/25">暂无 BYOK 数据</div>
                      ) : (
                        data.byokBusinessMetrics.byokByProvider.map(p => (
                          <DistroRow
                            key={p.providerId}
                            label={`${p.providerId} (${p.successRate}%)`}
                            count={p.calls}
                            max={data.byokBusinessMetrics.byokByProvider[0]?.calls ?? 1}
                            accent="bg-sky-500/60"
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* High-frequency users table */}
                  {data.byokBusinessMetrics.highFrequencyUsers.length > 0 && (
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02]">
                      <div className="border-b border-white/8 px-5 py-3 text-xs font-medium uppercase tracking-wider text-white/30">
                        高频 BYOK 用户（≥ {data.byokBusinessMetrics.highFrequencyThreshold} 次）
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-white/8 text-[10px] uppercase tracking-[0.14em] text-white/25">
                            <tr>
                              <th className="px-4 py-2.5">#</th>
                              <th className="px-4 py-2.5">用户</th>
                              <th className="px-4 py-2.5 text-right">调用数</th>
                              <th className="px-4 py-2.5 text-right">成功</th>
                              <th className="px-4 py-2.5 text-right">失败</th>
                              <th className="px-4 py-2.5 text-right">成功率</th>
                              <th className="px-4 py-2.5">主要 Provider</th>
                              <th className="px-4 py-2.5">主要类型</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.byokBusinessMetrics.highFrequencyUsers.map((u, i) => (
                              <tr key={u.userId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.015]">
                                <td className="px-4 py-2 text-white/30 tabular-nums">{i + 1}</td>
                                <td className="px-4 py-2">
                                  <div className="truncate max-w-[180px] text-white/65">{u.email ?? '—'}</div>
                                  {u.displayName && <div className="text-[10px] text-white/35">{u.displayName}</div>}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold tabular-nums text-white">{u.calls}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-green-300/70">{u.succeeded}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-rose-300/70">{u.failed}</td>
                                <td className="px-4 py-2 text-right tabular-nums text-white/55">{u.successRate}%</td>
                                <td className="px-4 py-2 truncate max-w-[120px] text-white/40">{u.topProviderId ?? '—'}</td>
                                <td className="px-4 py-2">
                                  {u.topOutputType ? typeBadge(u.topOutputType) : <span className="text-white/25">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daily trend */}
                  {data.byokBusinessMetrics.dailyTrend.length > 0 && (
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4">
                      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
                        每日趋势（最近 {data.byokBusinessMetrics.dailyTrend.length} 天）
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="border-b border-white/8 text-[10px] uppercase tracking-wider text-white/25">
                            <tr>
                              <th className="py-1.5 pr-4 whitespace-nowrap">日期</th>
                              <th className="py-1.5 pr-4 text-right text-sky-300/50 whitespace-nowrap">BYOK</th>
                              <th className="py-1.5 pr-4 text-right text-cyan-300/50 whitespace-nowrap">平台额度</th>
                              <th className="py-1.5 pr-4 text-right text-green-300/50 whitespace-nowrap">BYOK 成功</th>
                              <th className="py-1.5 pr-4 text-right text-rose-300/50 whitespace-nowrap">BYOK 失败</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.byokBusinessMetrics.dailyTrend.map(d => (
                              <tr key={d.date} className="border-b border-white/5 last:border-0">
                                <td className="py-1.5 pr-4 text-white/40 tabular-nums">{d.date}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums text-sky-300/70">{d.byokCalls}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums text-cyan-300/50">{d.platformCreditCalls}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums text-green-300/60">{d.byokSucceeded}</td>
                                <td className="py-1.5 pr-4 text-right tabular-nums text-rose-300/60">{d.byokFailed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-3 rounded-lg border border-white/6 bg-white/[0.015] px-3 py-2.5">
                    <ul className="space-y-0.5">
                      {data.byokBusinessMetrics.notes.map((n, i) => (
                        <li key={i} className="text-[10px] text-white/30 before:mr-1.5 before:content-['·']">{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Service Credits — read-only, no fee charged */}
            {data.simulatedServiceCredits && (
              <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/[0.04]">
                {/* Section header */}
                <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/15 px-5 py-3">
                  <span className="text-sm font-semibold text-amber-300">模拟服务积分（只读）</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    未启用 / 不扣费
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    只读模拟
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs text-amber-200/55 leading-relaxed">
                    基于当前 BYOK 成功用量估算，如果未来按草案规则收费，本时间范围理论会产生多少 service credits。
                    <strong className="text-amber-300"> 当前不会扣费，不会写入账本，不会改变 UsageLog.platformServiceFeeCredits。</strong>
                  </p>
                  <p className="mt-1 text-[11px] text-amber-200/35">
                    未来真实收费必须先支持生成前展示、失败退款、账单明细和 feature flag，当前九项 no-go 条件均未满足。
                  </p>

                  {/* Total + breakdown */}
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {/* Total */}
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/50">理论总计</div>
                      <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-300">
                        {data.simulatedServiceCredits.totalCredits}
                      </div>
                      <div className="mt-0.5 text-[10px] text-amber-200/35">service credits</div>
                    </div>

                    {/* Text */}
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/30">文本 BYOK</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-white/60">
                        {data.simulatedServiceCredits.byOutputType.text.simulatedCredits}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/25">
                        {data.simulatedServiceCredits.byOutputType.text.calls} 次 · {data.simulatedServiceCredits.byOutputType.text.rule}
                      </div>
                    </div>

                    {/* Image */}
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/50">图片 BYOK</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-amber-300">
                        {data.simulatedServiceCredits.byOutputType.image.simulatedCredits}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/25">
                        {data.simulatedServiceCredits.byOutputType.image.calls} 次 · {data.simulatedServiceCredits.byOutputType.image.rule}
                      </div>
                    </div>

                    {/* Video */}
                    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-blue-300/50">视频 BYOK</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-blue-300">
                        {data.simulatedServiceCredits.byOutputType.video.simulatedCredits}
                      </div>
                      <div className="mt-0.5 text-[10px] text-white/25">
                        {data.simulatedServiceCredits.byOutputType.video.calls} 次 · {data.simulatedServiceCredits.byOutputType.video.rule}
                      </div>
                      {data.simulatedServiceCredits.byOutputType.video.hasMissingDuration && (
                        <div className="mt-1 text-[9px] text-amber-400/60">视频缺少时长时按 5 估算</div>
                      )}
                    </div>
                  </div>

                  {/* Failed / pending — shown but not counted */}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.015] px-3 py-2">
                      <span className="text-[10px] text-white/30">BYOK 失败（不计入）</span>
                      <span className="text-sm font-semibold tabular-nums text-rose-400/70">
                        {data.simulatedServiceCredits.failedByokCalls}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.015] px-3 py-2">
                      <span className="text-[10px] text-white/30">BYOK 处理中/排队（不计入）</span>
                      <span className="text-sm font-semibold tabular-nums text-white/35">
                        {data.simulatedServiceCredits.pendingByokCalls}
                      </span>
                    </div>
                  </div>

                  {/* Assumptions */}
                  <div className="mt-3 rounded-lg border border-white/6 bg-white/[0.015] px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/25">模拟假设</div>
                    <ul className="space-y-0.5">
                      {data.simulatedServiceCredits.assumptions.map((a, i) => (
                        <li key={i} className="text-[10px] text-white/30 before:mr-1.5 before:content-['·']">{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* BYOK Observation Summary — read-only copy */}
            {data.byokBusinessMetrics && data.simulatedServiceCredits && (
              <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]">
                <div className="flex flex-wrap items-center gap-2 border-b border-emerald-500/15 px-5 py-3">
                  <span className="text-sm font-semibold text-emerald-300">BYOK 观察摘要（只读）</span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    只读
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    不扣费
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs text-emerald-200/50 leading-relaxed">
                    基于当前筛选范围生成可复制的运营观察摘要。
                    <strong className="text-emerald-300"> 当前不会扣费，不会写入账本，不会改变 UsageLog.platformServiceFeeCredits。</strong>
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleCopy}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition active:scale-[0.98] ${
                        copyStatus === 'copied'
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                          : copyStatus === 'failed'
                          ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      {copyStatus === 'copied' ? '✓ 已复制' : copyStatus === 'failed' ? '复制失败，请手动复制' : '复制观察摘要'}
                    </button>
                    {copyStatus === 'copied' && (
                      <span className="text-xs text-emerald-400/60">摘要已复制到剪贴板</span>
                    )}
                    {copyStatus === 'failed' && (
                      <span className="text-xs text-white/35">浏览器不支持自动复制，请选中下方文本手动复制</span>
                    )}
                  </div>

                  {showFallback ? (
                    <textarea
                      readOnly
                      value={buildObservationSummary(data, rangeLabel[range])}
                      rows={22}
                      className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-xs leading-relaxed text-white/55 resize-y"
                      onClick={e => (e.target as HTMLTextAreaElement).select()}
                    />
                  ) : (
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-black/15 px-4 py-3 text-[11px] leading-relaxed text-white/40">
                      {buildObservationSummary(data, rangeLabel[range])}
                    </pre>
                  )}
                </div>
              </div>
            )}

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
