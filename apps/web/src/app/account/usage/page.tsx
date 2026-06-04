'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'
import { useCurrentUser } from '@/lib/auth/use-current-user'

// ── Types ─────────────────────────────────────────────────────────────────────

type RangeOption = '24h' | '7d' | '30d' | 'all'
type BillingFilter = 'all' | 'platform_credits' | 'user_provider_account'
type OutputFilter = 'all' | 'text' | 'image' | 'video'

type Summary = {
  total: number
  byok: number
  platformCredits: number
  text: number
  image: number
  video: number
  succeeded: number
  failed: number
  successRate: number
  platformServiceFeeCredits: number
}

type DistroItem = { outputType?: string; billingMode?: string; providerId?: string; count: number }

type RecentItem = {
  id: string
  createdAt: string
  projectId: string | null
  nodeId: string | null
  providerId: string
  outputType: string
  billingMode: string
  status: string
  providerCostPaidBy: string | null
  promptChars: number | null
  platformServiceFeeCredits: number | null
  errorCode: string | null
}

type UsageData = {
  range: string
  since: string | null
  summary: Summary
  byOutputType: DistroItem[]
  byBillingMode: DistroItem[]
  byProvider: DistroItem[]
  recent: RecentItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  'deepseek-text': 'DeepSeek Flash',
  'deepseek-reasoner': 'DeepSeek Pro',
  'kimi-text': 'Kimi K2.6',
  'openai-text': 'OpenAI GPT',
  'volcengine-seedream-image': 'Seedream Image',
  'volcengine-seedance-video': 'Seedance Video',
  'openai-image': 'OpenAI Image',
  'runway': 'Runway',
}

function providerLabel(id: string) {
  return PROVIDER_LABELS[id] ?? id
}

function outputTypeLabel(t: string) {
  if (t === 'text') return '文本'
  if (t === 'image') return '图片'
  if (t === 'video') return '视频'
  return t
}

function outputTypeIcon(t: string) {
  if (t === 'text') return '📝'
  if (t === 'image') return '🖼'
  if (t === 'video') return '🎬'
  return '·'
}

function billingModeLabel(m: string) {
  if (m === 'platform_credits') return '平台额度'
  if (m === 'user_provider_account') return '我的 API'
  return m
}

function billingModeShort(m: string) {
  if (m === 'platform_credits') return '平台'
  if (m === 'user_provider_account') return '自付'
  return m
}

function statusLabel(s: string) {
  if (s === 'succeeded') return '成功'
  if (s === 'failed') return '失败'
  if (s === 'canceled') return '已取消'
  if (s === 'pending' || s === 'queued' || s === 'running') return '处理中'
  return s
}

function providerCostLabel(v: string | null) {
  if (v === 'platform') return '平台承担'
  if (v === 'user') return '用户承担'
  return '—'
}

function statusColor(s: string) {
  if (s === 'succeeded') return 'text-emerald-400 bg-emerald-400/[0.07] border-emerald-400/20'
  if (s === 'failed') return 'text-rose-400 bg-rose-400/[0.07] border-rose-400/20'
  return 'text-white/40 bg-white/[0.04] border-white/10'
}

function billingBadgeStyle(m: string) {
  if (m === 'user_provider_account') return 'text-violet-300 bg-violet-400/[0.07] border-violet-400/20'
  return 'text-white/50 bg-white/[0.04] border-white/10'
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-20 text-white/50 truncate shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-white/35 shrink-0">{count}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsageHistoryPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { status: sessionStatus, refresh: refreshSession } = useCurrentUser()

  const effectiveIsAuthenticated =
    sessionStatus === 'authenticated' ||
    ((sessionStatus === 'loading' || sessionStatus === 'unknown') && isAuthenticated)

  const [range, setRange] = useState<RangeOption>('7d')
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('all')
  const [outputFilter, setOutputFilter] = useState<OutputFilter>('all')

  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Auth guard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === 'loading' || sessionStatus === 'unknown') return
    if (!effectiveIsAuthenticated) {
      router.push('/auth/login?next=/account/usage')
    }
  }, [effectiveIsAuthenticated, sessionStatus, router])

  // ── Data fetch ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ range, billingMode: billingFilter, outputType: outputFilter })
      const res = await fetch(`/api/account/usage?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json() as { message?: string }
        setError(body.message ?? '加载失败，请刷新重试。')
        return
      }
      const json = await res.json() as UsageData
      setData(json)
    } catch {
      setError('网络错误，请刷新重试。')
    } finally {
      setLoading(false)
    }
  }, [range, billingFilter, outputFilter])

  useEffect(() => {
    if (effectiveIsAuthenticated) void fetchData()
  }, [effectiveIsAuthenticated, fetchData])

  // If Zustand says the user is authenticated, render immediately — don't wait for the
  // network check to finish. effectiveIsAuthenticated already accounts for this.
  if (!effectiveIsAuthenticated) {
    if (sessionStatus === 'unknown') {
      return (
        <DashboardShell>
          <main className="mx-auto max-w-4xl px-4 py-20 text-center">
            <p className="text-sm text-white/50 mb-4">连接异常，无法验证登录状态，请重试。</p>
            <button
              onClick={() => void refreshSession()}
              className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2 text-sm text-white/70 hover:text-white transition"
            >
              重新验证
            </button>
          </main>
        </DashboardShell>
      )
    }
    return null
  }

  const s = data?.summary

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.22em] text-white/30">账号设置</div>
            <h1 className="text-2xl font-semibold text-white">我的生成用量</h1>
            <p className="mt-1.5 text-sm text-white/45 leading-relaxed max-w-xl">
              你在 Creator City 中使用平台额度与我的 API 账户的生成记录。
              Provider 费用由对应付款方承担，<span className="text-white/55">当前平台服务费未启用。</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/30">
              <span>◎ 平台额度：Creator City 代付模型调用</span>
              <span>·</span>
              <span>⚡ 我的 API：你直接支付给 Provider</span>
              <span>·</span>
              <span>○ 平台服务费：当前未启用</span>
            </div>
          </div>
          <Link
            href="/account"
            className="flex-shrink-0 ml-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            ← 账号设置
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-2 items-center">
          {/* Range */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 gap-0.5">
            {(['24h', '7d', '30d', 'all'] as RangeOption[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  range === r
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {r === '24h' ? '近 24 小时' : r === '7d' ? '近 7 天' : r === '30d' ? '近 30 天' : '全部'}
              </button>
            ))}
          </div>

          {/* Billing filter */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 gap-0.5">
            {([['all', '全部来源'], ['platform_credits', '平台额度'], ['user_provider_account', '我的 API']] as [BillingFilter, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setBillingFilter(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  billingFilter === v
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Output type filter */}
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 gap-0.5">
            {([['all', '全部类型'], ['text', '文本'], ['image', '图片'], ['video', '视频']] as [OutputFilter, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setOutputFilter(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  outputFilter === v
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <span className="text-xs text-white/30 ml-1">加载中…</span>}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {s && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="总生成次数" value={s.total} note="次调用" />
            <SummaryCard label="我的 API" value={s.byok} note="次·自付" accent="violet" />
            <SummaryCard label="平台额度" value={s.platformCredits} note="次·平台代付" />
            <SummaryCard label="文本 / 图片" value={`${s.text} / ${s.image}`} note="次" raw />
            <SummaryCard label="成功率" value={`${s.successRate}%`} note={`${s.succeeded}/${s.total}`} raw accent={s.successRate >= 80 ? 'green' : 'amber'} />
            <SummaryCard label="平台服务费" value="0" note="当前未启用" accent="dim" />
          </div>
        )}

        {/* Distribution panels */}
        {s && s.total > 0 && data && (
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* By type */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">按类型</p>
              <div className="space-y-2">
                {data.byOutputType.map((r) => (
                  <BarRow
                    key={r.outputType}
                    label={outputTypeLabel(r.outputType ?? '')}
                    count={r.count}
                    total={s.total}
                    color="bg-sky-500/50"
                  />
                ))}
              </div>
            </div>

            {/* By billing */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">按费用来源</p>
              <div className="space-y-2">
                {data.byBillingMode.map((r) => (
                  <BarRow
                    key={r.billingMode}
                    label={billingModeLabel(r.billingMode ?? '')}
                    count={r.count}
                    total={s.total}
                    color={r.billingMode === 'user_provider_account' ? 'bg-violet-500/50' : 'bg-white/20'}
                  />
                ))}
              </div>
            </div>

            {/* By provider */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-3">按 Provider</p>
              <div className="space-y-2">
                {data.byProvider.slice(0, 5).map((r) => (
                  <BarRow
                    key={r.providerId}
                    label={providerLabel(r.providerId ?? '')}
                    count={r.count}
                    total={s.total}
                    color="bg-emerald-500/40"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent usage table */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">最近生成记录</h2>
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={loading}
              className="text-xs text-white/35 hover:text-white/60 transition disabled:opacity-40"
            >
              刷新
            </button>
          </div>

          {/* Empty state */}
          {!loading && data && data.recent.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.02] px-6 py-12 text-center">
              <p className="text-2xl mb-3 opacity-40">○</p>
              <p className="text-sm font-medium text-white/40 mb-1">还没有生成记录</p>
              <p className="text-xs text-white/25 mb-6 leading-relaxed max-w-xs mx-auto">
                当你使用平台额度或我的 API 账户生成文本 / 图片后，用量会显示在这里。
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href="/projects"
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/60 hover:text-white hover:border-white/20 transition"
                >
                  去画布创作
                </Link>
                <Link
                  href="/account/providers"
                  className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] px-4 py-2 text-xs text-violet-300/70 hover:text-violet-200 transition"
                >
                  管理我的 API
                </Link>
              </div>
            </div>
          )}

          {/* Table */}
          {data && data.recent.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
              {/* Mobile: card view */}
              <div className="sm:hidden divide-y divide-white/[0.05]">
                {data.recent.map((item) => (
                  <div key={item.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{outputTypeIcon(item.outputType)}</span>
                        <span className="text-xs font-medium text-white/70">{outputTypeLabel(item.outputType)}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${billingBadgeStyle(item.billingMode)}`}>
                          {billingModeShort(item.billingMode)}
                        </span>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusColor(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/30">
                      {fmtDateTime(item.createdAt)}
                      <span className="mx-1.5 opacity-40">·</span>
                      {providerLabel(item.providerId)}
                      {item.promptChars != null && (
                        <><span className="mx-1.5 opacity-40">·</span>{item.promptChars} 字符</>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['时间', '类型', 'Provider', '费用来源', '费用承担', '状态', 'Prompt 字符数', '平台服务费'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {data.recent.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-2.5 text-white/40 whitespace-nowrap">
                          {fmtDateTime(item.createdAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span>{outputTypeIcon(item.outputType)}</span>
                            <span className="text-white/60">{outputTypeLabel(item.outputType)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white/45 whitespace-nowrap">
                          {providerLabel(item.providerId)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${billingBadgeStyle(item.billingMode)}`}>
                            {billingModeLabel(item.billingMode)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                          {providerCostLabel(item.providerCostPaidBy)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${statusColor(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white/35 font-mono">
                          {item.promptChars != null ? item.promptChars : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-white/25">
                          {item.platformServiceFeeCredits ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Help section */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-3">费用说明</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HelpItem
              icon="◎"
              title="平台额度"
              body="Creator City 代付 Provider API 调用费用。生成时消耗你购买的平台积分。"
            />
            <HelpItem
              icon="⚡"
              title="我的 API"
              body="使用你自己的 Provider API Key。Provider 费用由你直接支付给服务商，不经过 Creator City。"
            />
            <HelpItem
              icon="○"
              title="平台服务费"
              body="当前未启用。未来平台服务费用于工作台工具与协作功能，将提前明确展示，不含 API 转售差价。"
            />
            <HelpItem
              icon="🔒"
              title="创作隐私"
              body="Creator City 不在此页面展示 prompt 明文。这里只显示字符数，以保护你的创作内容隐私。"
            />
          </div>
        </div>

      </main>
    </DashboardShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type AccentColor = 'violet' | 'green' | 'amber' | 'dim' | undefined

function SummaryCard({
  label,
  value,
  note,
  accent,
  raw = false,
}: {
  label: string
  value: number | string
  note: string
  accent?: AccentColor
  raw?: boolean
}) {
  const valueStr = raw ? String(value) : typeof value === 'number' ? value.toLocaleString('zh-CN') : String(value)

  const valueColor =
    accent === 'violet' ? 'text-violet-300' :
    accent === 'green'  ? 'text-emerald-400' :
    accent === 'amber'  ? 'text-amber-400' :
    accent === 'dim'    ? 'text-white/25' :
    'text-white'

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueColor}`}>{valueStr}</p>
      <p className="text-[10px] text-white/25 mt-0.5">{note}</p>
    </div>
  )
}

function HelpItem({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-2.5">
      <span className="text-base shrink-0 text-white/30 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-medium text-white/50 mb-0.5">{title}</p>
        <p className="text-[11px] text-white/25 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}
