'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import type {
  AccountSummaryAccount,
  AccountSummaryUsage,
  AccountSummaryRecentRow,
  AccountHealth,
} from '@/app/api/provider-accounts/[id]/summary/route'

// ── Provider label map ────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  'deepseek-text': 'DeepSeek V4 Flash',
  'deepseek-reasoner': 'DeepSeek V4 Pro',
  'kimi-text': 'Kimi K2.6',
  'openai-text': 'OpenAI GPT',
  'openai-image': 'OpenAI Image',
  'volcengine-seedream-image': 'Seedream Image (火山方舟)',
  'volcengine-seedance-video': 'Seedance Video (火山方舟)',
  'runway': 'Runway',
  'elevenlabs': 'ElevenLabs',
}

function providerLabel(id: string) { return PROVIDER_LABELS[id] ?? id }

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(s: string) {
  if (s === 'active') return '正常'
  if (s === 'disabled') return '已停用'
  if (s === 'invalid') return '无效'
  return s
}

function statusColor(s: string) {
  if (s === 'active') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/[0.07]'
  if (s === 'disabled') return 'text-white/40 border-white/10 bg-white/[0.03]'
  return 'text-rose-400 border-rose-400/30 bg-rose-400/[0.07]'
}

function testStatusLabel(s: string | null) {
  if (!s) return '—'
  if (s === 'ok') return '连接正常'
  if (s === 'auth_failed') return '认证失败'
  if (s === 'timeout') return '连接超时'
  if (s === 'rate_limited') return '请求限流'
  if (s === 'insufficient_quota') return '额度不足'
  if (s === 'unsupported') return '不支持自动测试'
  return '测试异常'
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function outputTypeLabel(t: string | null) {
  if (t === 'text') return '文本'
  if (t === 'image') return '图片'
  if (t === 'video') return '视频'
  return t ?? '—'
}

function billingModeLabel(m: string | null) {
  if (m === 'user_provider_account') return '我的 API'
  if (m === 'platform_credits') return '平台额度'
  return m ?? '—'
}

function rowStatusLabel(s: string | null) {
  if (s === 'succeeded') return '成功'
  if (s === 'failed') return '失败'
  if (s === 'pending' || s === 'queued' || s === 'running') return '处理中'
  if (s === 'canceled') return '已取消'
  return s ?? '—'
}

function healthColor(h: AccountHealth['status']) {
  if (h === 'healthy') return 'text-emerald-400 border-emerald-400/25 bg-emerald-400/[0.06]'
  if (h === 'warning') return 'text-amber-400 border-amber-400/25 bg-amber-400/[0.06]'
  if (h === 'error') return 'text-rose-400 border-rose-400/25 bg-rose-400/[0.06]'
  return 'text-white/40 border-white/10 bg-white/[0.03]'
}

function healthIcon(h: AccountHealth['status']) {
  if (h === 'healthy') return '✓'
  if (h === 'warning') return '!'
  if (h === 'error') return '✕'
  return '?'
}

function rowStatusColor(s: string | null) {
  if (s === 'succeeded') return 'text-emerald-400'
  if (s === 'failed') return 'text-rose-400'
  return 'text-white/30'
}

type SummaryData = {
  account: AccountSummaryAccount
  usageSummary: AccountSummaryUsage | null
  recentUsage: AccountSummaryRecentRow[]
  health: AccountHealth
  usageSummaryUnavailable: boolean
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProviderAccountDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { status: sessionStatus, refresh: refreshSession } = useCurrentUser()

  const effectiveIsAuthenticated =
    sessionStatus === 'authenticated' ||
    ((sessionStatus === 'loading' || sessionStatus === 'unknown') && isAuthenticated)

  const [data, setData] = useState<SummaryData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [actionState, setActionState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'testing'>('idle')

  // ── Auth guard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === 'loading' || sessionStatus === 'unknown') return
    if (!effectiveIsAuthenticated) {
      router.push(`/auth/login?next=/account/providers/${params.id}`)
    }
  }, [effectiveIsAuthenticated, sessionStatus, router, params.id])

  // ── Load summary ────────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/provider-accounts/${params.id}/summary`, { credentials: 'include' })
      if (res.status === 404) { setLoadError('未找到该 API 账户，可能已被删除。'); return }
      if (res.status === 401) { router.push(`/auth/login?next=/account/providers/${params.id}`); return }
      if (!res.ok) { setLoadError('加载账户信息失败，请稍后重试。'); return }
      const body = await res.json() as { success: boolean } & SummaryData
      if (!body.success) { setLoadError('加载账户信息失败。'); return }
      setData(body)
    } catch {
      setLoadError('网络错误，请刷新重试。')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => {
    if (effectiveIsAuthenticated) void loadSummary()
  }, [effectiveIsAuthenticated, loadSummary])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const patchAccount = async (patch: Record<string, unknown>) => {
    setActionState('loading')
    setActionError(null)
    try {
      const res = await fetch(`/api/provider-accounts/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const body = await res.json() as { success: boolean; message?: string }
      if (!res.ok || !body.success) {
        setActionState('error')
        setActionError(body.message ?? '操作失败，请稍后再试。')
        return
      }
      setActionState('idle')
      await loadSummary()
    } catch {
      setActionState('error')
      setActionError('网络错误，请稍后再试。')
    }
  }

  const deleteAccount = async () => {
    if (!data) return
    const label = data.account.accountLabel
    if (!window.confirm(`确认删除「${label}」？此操作不可恢复，API Key 将永久销毁。`)) return
    setActionState('loading')
    setActionError(null)
    try {
      const res = await fetch(`/api/provider-accounts/${params.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const body = await res.json() as { success: boolean; message?: string }
      if (!res.ok || !body.success) {
        setActionState('error')
        setActionError(body.message ?? '删除失败，请稍后再试。')
        return
      }
      router.push('/account/providers')
    } catch {
      setActionState('error')
      setActionError('网络错误，请稍后再试。')
    }
  }

  const testConnection = async () => {
    if (!data) return
    setTestState('testing')
    try {
      const res = await fetch(`/api/provider-accounts/${params.id}/test`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) await loadSummary()
    } catch {
      // Silently ignore; user can retry
    } finally {
      setTestState('idle')
    }
  }

  // ── Render guards ───────────────────────────────────────────────────────────

  if (!effectiveIsAuthenticated) {
    if (sessionStatus === 'unknown') {
      return (
        <DashboardShell>
          <main className="mx-auto max-w-3xl px-4 py-20 text-center">
            <p className="text-sm text-white/50 mb-4">连接异常，无法验证登录状态，请重试。</p>
            <button onClick={() => void refreshSession()} className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2 text-sm text-white/70 hover:text-white transition">
              重新验证
            </button>
          </main>
        </DashboardShell>
      )
    }
    return null
  }

  if (loading) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm text-white/40">加载中…</p>
        </main>
      </DashboardShell>
    )
  }

  if (loadError || !data) {
    return (
      <DashboardShell>
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="mb-5">
            <Link href="/account/providers" className="text-xs text-white/40 hover:text-white/70 transition">← 模型账户中心</Link>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-4 text-sm text-rose-300">
            {loadError ?? '加载失败'}
          </div>
        </main>
      </DashboardShell>
    )
  }

  const { account, usageSummary, recentUsage, health, usageSummaryUnavailable } = data
  const isActing = actionState === 'loading'
  const isTesting = testState === 'testing'

  return (
    <DashboardShell>
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs text-white/35">
          <Link href="/account" className="hover:text-white/60 transition">账号设置</Link>
          <span>/</span>
          <Link href="/account/providers" className="hover:text-white/60 transition">模型账户中心</Link>
          <span>/</span>
          <span className="text-white/60 truncate max-w-[180px]">{account.accountLabel}</span>
        </div>

        {/* ── Account identity ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-semibold text-white">{account.accountLabel}</h1>
                {account.isDefault && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-400/30 bg-violet-400/[0.08] text-violet-300">默认</span>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusColor(account.status)}`}>
                  {statusLabel(account.status)}
                </span>
              </div>
              <p className="text-sm text-white/50">{providerLabel(account.providerId)}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <InfoCell label="添加日期" value={fmtDate(account.createdAt)} />
            <InfoCell label="上次更新" value={fmtDate(account.updatedAt)} />
            <InfoCell label="项目范围" value={account.projectScope ?? '全局'} />
            <InfoCell label="凭证类型" value={account.credentialType === 'bearer_with_endpoint' ? 'API Key + 接入点 ID' : 'API Key'} />
          </div>
        </div>

        {/* ── Health status ── */}
        <div className={`rounded-2xl border p-5 ${healthColor(health.status)}`}>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-lg font-bold">{healthIcon(health.status)}</span>
            <p className="text-sm font-semibold">健康状态</p>
          </div>
          <p className="text-sm opacity-80">{health.message}</p>
          {account.lastTestedAt && (
            <p className="mt-2 text-[11px] opacity-50">
              上次测试：{fmtDateTime(account.lastTestedAt)}
              {account.lastTestStatus && ` · ${testStatusLabel(account.lastTestStatus)}`}
            </p>
          )}
          {account.lastTestError && (
            <p className="mt-1 text-[11px] opacity-50">错误详情：{account.lastTestError}</p>
          )}
        </div>

        {/* ── Credentials ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">凭证信息</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-xs text-white/40">API Key</span>
              <span className="font-mono text-xs text-white/55 tracking-widest">•••• {account.keyLast4}</span>
            </div>
            {account.fieldMeta?.endpointId && (
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                <span className="text-xs text-white/40">Endpoint ID</span>
                <span className="font-mono text-xs text-white/55 tracking-widest">•••• {account.fieldMeta.endpointId.last4}</span>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-white/20 leading-relaxed">
            凭证加密存储，不可查看明文。如需更换 Key，请删除此账户后重新添加。
          </p>
        </div>

        {/* ── Usage summary ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">近 90 天用量</p>
          {usageSummaryUnavailable ? (
            <p className="text-sm text-white/30">用量数据暂时不可用，请稍后重试。</p>
          ) : !usageSummary || usageSummary.total === 0 ? (
            <p className="text-sm text-white/30">暂无使用记录。</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
                <StatCard label="总调用" value={usageSummary.total} color="text-white/70" />
                <StatCard label="成功" value={usageSummary.succeeded} color="text-emerald-400" />
                <StatCard label="失败" value={usageSummary.failed} color={usageSummary.failed > 0 ? 'text-rose-400' : 'text-white/30'} />
                <StatCard label="平台服务费" value={`${usageSummary.platformServiceFeeCredits}`} color="text-white/30" note="积分（未启用）" />
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] mb-2">
                {usageSummary.text > 0 && <span className="text-sky-400/70">文本 {usageSummary.text} 次</span>}
                {usageSummary.image > 0 && <span className="text-violet-400/70">图片 {usageSummary.image} 次</span>}
                {usageSummary.video > 0 && <span className="text-amber-400/70">视频 {usageSummary.video} 次</span>}
              </div>
              <p className="text-[11px] text-white/25">最近使用：{fmtDateTime(usageSummary.lastUsedAt)}</p>
            </>
          )}
        </div>

        {/* ── Recent usage logs ── */}
        {!usageSummaryUnavailable && recentUsage.length > 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">最近调用记录（最多 20 条）</p>
            <div className="space-y-1.5">
              {recentUsage.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[11px]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-white/30 flex-shrink-0">{fmtTime(row.createdAt)}</span>
                    <span className="text-white/50 flex-shrink-0">{outputTypeLabel(row.outputType)}</span>
                    <span className="text-white/30 flex-shrink-0">{billingModeLabel(row.billingMode)}</span>
                    {row.errorCode && (
                      <span className="text-rose-400/70 font-mono truncate">{row.errorCode}</span>
                    )}
                  </div>
                  <span className={`flex-shrink-0 font-medium ${rowStatusColor(row.status)}`}>
                    {rowStatusLabel(row.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">操作</p>

          {actionError && (
            <p className="text-xs text-rose-400 mb-3">{actionError}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-5">
            <ActionButton
              label={isTesting ? '测试中…' : '测试连接'}
              disabled={isActing || isTesting}
              onClick={() => void testConnection()}
            />
            {!account.isDefault && (
              <ActionButton
                label="设为默认"
                disabled={isActing || isTesting}
                onClick={() => void patchAccount({ isDefault: true })}
              />
            )}
            {account.status === 'active' ? (
              <ActionButton
                label={isActing ? '处理中…' : '停用账户'}
                disabled={isActing || isTesting}
                onClick={() => void patchAccount({ status: 'disabled' })}
              />
            ) : (
              <ActionButton
                label={isActing ? '处理中…' : '启用账户'}
                disabled={isActing || isTesting}
                onClick={() => void patchAccount({ status: 'active' })}
              />
            )}
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] text-white/25 mb-3 leading-relaxed">
              删除操作不可恢复。删除后 API Key 永久销毁，所有引用此账户的生成任务将回退到平台额度。
            </p>
            <ActionButton
              label={isActing ? '删除中…' : '删除账户'}
              disabled={isActing || isTesting}
              variant="danger"
              onClick={() => void deleteAccount()}
            />
          </div>
        </div>

        {/* ── Security notes ── */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] px-4 py-3.5 text-[11px] text-white/25 space-y-1 leading-relaxed">
          <p className="font-semibold text-white/35 mb-1.5">安全说明</p>
          <p>· 凭证加密存储，平台不持有明文 Key，不记录 Prompt 内容</p>
          <p>· 此页面仅对账户本人可见，账户详情与用量数据不向他人共享</p>
          <p>· 如怀疑 Key 已泄漏，请立即在 Provider 控制台吊销，然后删除并重新添加账户</p>
          <p>· 用量记录只统计调用次数，不记录 Prompt 文本或生成内容</p>
        </div>

      </main>
    </DashboardShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-white/30 mb-0.5">{label}</p>
      <p className="text-white/60 truncate">{value}</p>
    </div>
  )
}

function StatCard({ label, value, color, note }: { label: string; value: string | number; color: string; note?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center">
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
      {note && <p className="text-[9px] text-white/20">{note}</p>}
    </div>
  )
}

function ActionButton({
  label, disabled, variant = 'default', onClick,
}: {
  label: string; disabled: boolean; variant?: 'default' | 'danger'; onClick: () => void
}) {
  const base = 'rounded-lg px-3 py-1.5 text-xs font-medium border transition disabled:opacity-40'
  const style = variant === 'danger'
    ? 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300 hover:bg-rose-500/10'
    : 'border-white/10 bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white'
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${style}`}>
      {label}
    </button>
  )
}
