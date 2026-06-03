'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'
import { useCurrentUser } from '@/lib/auth/use-current-user'

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldMetaEntry = { label: string; last4: string; updatedAt: string }
type FieldMetaMap = Record<string, FieldMetaEntry>

type ProviderAccount = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  credentialType: string | null
  fieldMeta: FieldMetaMap | null
  status: string
  isDefault: boolean
  projectScope: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: string
  updatedAt: string
}

type ApiResponse<T> = { success: true } & T | { success: false; message: string }

// ── Provider whitelist ────────────────────────────────────────────────────────

type CredentialType = 'single_api_key' | 'bearer_with_endpoint'

type ExtraField = {
  name: string
  label: string
  placeholder: string
  description: string
}

type ProviderOption = {
  value: string
  label: string
  category: string
  credentialType: CredentialType
  extraFields?: ExtraField[]
  byokStatus: 'live' | 'coming_soon'
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: 'deepseek-text',            label: 'DeepSeek V4 Flash',   category: '文本', credentialType: 'single_api_key', byokStatus: 'live' },
  { value: 'deepseek-reasoner',        label: 'DeepSeek V4 Pro',     category: '文本', credentialType: 'single_api_key', byokStatus: 'live' },
  { value: 'kimi-text',               label: 'Kimi K2.6',           category: '文本', credentialType: 'single_api_key', byokStatus: 'live' },
  { value: 'openai-text',             label: 'OpenAI GPT',          category: '文本', credentialType: 'single_api_key', byokStatus: 'live' },
  {
    value: 'volcengine-seedream-image',
    label: 'Seedream Image (火山方舟)',
    category: '图片',
    credentialType: 'bearer_with_endpoint',
    byokStatus: 'live',
    extraFields: [
      {
        name: 'endpointId',
        label: 'Endpoint ID / Model ID（来自火山方舟控制台）',
        placeholder: '例：ep-xxxxxxxxxxxx-xxxxxxxx',
        description: '在火山方舟控制台 → 模型接入 → Seedream → 复制接入点 ID。',
      },
    ],
  },
  {
    value: 'volcengine-seedance-video',
    label: 'Seedance Video (火山方舟)',
    category: '视频',
    credentialType: 'bearer_with_endpoint',
    byokStatus: 'coming_soon',
    extraFields: [
      {
        name: 'endpointId',
        label: 'Endpoint ID / Model ID（来自火山方舟控制台）',
        placeholder: '例：ep-xxxxxxxxxxxx-xxxxxxxx',
        description: '在火山方舟控制台 → 模型接入 → Seedance → 复制接入点 ID。',
      },
    ],
  },
  { value: 'openai-image',            label: 'OpenAI Image',        category: '图片', credentialType: 'single_api_key', byokStatus: 'coming_soon' },
  { value: 'runway',                  label: 'Runway',              category: '视频', credentialType: 'single_api_key', byokStatus: 'coming_soon' },
  { value: 'elevenlabs',              label: 'ElevenLabs',          category: '音频', credentialType: 'single_api_key', byokStatus: 'coming_soon' },
]

function getProviderOption(providerId: string): ProviderOption | undefined {
  return PROVIDER_OPTIONS.find((p) => p.value === providerId)
}

// ── Capability matrix (display-only, not wired to form) ───────────────────────

type CapabilityStatus = 'live' | 'ready' | 'planned'

type CapabilityRow = {
  label: string
  category: string
  byokStatus: CapabilityStatus
  note: string
}

const CAPABILITY_MATRIX: CapabilityRow[] = [
  { label: 'DeepSeek V4 Flash',           category: '文本', byokStatus: 'live',    note: '已上线' },
  { label: 'DeepSeek V4 Pro',             category: '文本', byokStatus: 'live',    note: '已上线' },
  { label: 'Kimi K2.6',                   category: '文本', byokStatus: 'live',    note: '已上线' },
  { label: 'OpenAI GPT',                  category: '文本', byokStatus: 'live',    note: '已上线' },
  { label: 'Seedream Image（火山方舟）',   category: '图片', byokStatus: 'live',    note: '已上线' },
  { label: 'Seedance Video（火山方舟）',   category: '视频', byokStatus: 'ready',   note: '存凭证，生成接入中' },
  { label: 'OpenAI Image',                category: '图片', byokStatus: 'planned', note: '即将开放' },
  { label: 'Runway',                      category: '视频', byokStatus: 'planned', note: '即将开放' },
  { label: 'ElevenLabs',                  category: '音频', byokStatus: 'planned', note: '即将开放' },
]

function capabilityIcon(status: CapabilityStatus) {
  if (status === 'live') return '✅'
  if (status === 'ready') return '🟡'
  return '○'
}

function capabilityColor(status: CapabilityStatus) {
  if (status === 'live') return 'text-emerald-400'
  if (status === 'ready') return 'text-amber-400'
  return 'text-white/25'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusLabel(status: string) {
  if (status === 'active') return '正常'
  if (status === 'disabled') return '已停用'
  if (status === 'invalid') return '无效'
  return status
}

function statusColor(status: string) {
  if (status === 'active') return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/[0.07]'
  if (status === 'disabled') return 'text-white/40 border-white/10 bg-white/[0.03]'
  return 'text-rose-400 border-rose-400/30 bg-rose-400/[0.07]'
}

function testStatusLabel(s: string | null) {
  if (!s) return null
  if (s === 'ok') return '连接正常'
  if (s === 'auth_failed') return '认证失败（请确认填写的是 API Key，而不是账号密码）'
  if (s === 'timeout') return '连接超时'
  if (s === 'rate_limited') return '请求限流'
  if (s === 'insufficient_quota') return '额度不足'
  if (s === 'unsupported') return '不支持自动测试'
  return '测试异常'
}

function testStatusColor(s: string | null) {
  if (s === 'ok') return 'text-emerald-400'
  if (s === 'auth_failed') return 'text-rose-400'
  if (s === 'unsupported') return 'text-white/30'
  return 'text-amber-400'
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function providerLabel(id: string) {
  return PROVIDER_OPTIONS.find((p) => p.value === id)?.label ?? id
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function apiErrorMessage(status: number, body: { message?: string }): string {
  if (status === 401) return '请先登录后再管理 Provider API 账户。'
  if (status === 503) return 'Provider Key 加密服务暂时不可用，请稍后再试。'
  if (status === 404) return '未找到该 API 账户。'
  if (body.message) return body.message
  return '操作失败，请稍后再试。'
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  providerId: 'deepseek-text',
  accountLabel: '',
  apiKey: '',
  endpointId: '',
  isDefault: false,
  projectScope: '',
}

export default function ProviderAccountsPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const { status: sessionStatus, refresh: refreshSession } = useCurrentUser()

  // Wait for session to resolve before deciding to redirect.
  // Zustand initial state is isAuthenticated=false (before localStorage hydrates),
  // so we must not redirect until the /api/auth/me check completes.
  const effectiveIsAuthenticated =
    sessionStatus === 'authenticated' ||
    ((sessionStatus === 'loading' || sessionStatus === 'unknown') && isAuthenticated)

  const [accounts, setAccounts] = useState<ProviderAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [actionState, setActionState] = useState<Record<string, string>>({})
  const [testState, setTestState] = useState<Record<string, 'testing' | ''>>({})

  const selectedProvider = getProviderOption(form.providerId)
  const isMultiField = selectedProvider?.credentialType === 'bearer_with_endpoint'
  const selectedByokStatus = selectedProvider?.byokStatus ?? 'coming_soon'

  // ── Auth guard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === 'loading' || sessionStatus === 'unknown') return
    if (!effectiveIsAuthenticated) {
      router.push('/auth/login?next=/account/providers')
    }
  }, [effectiveIsAuthenticated, sessionStatus, router])

  // ── Load accounts ───────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const res = await fetch('/api/provider-accounts', { credentials: 'include' })
      const data = await res.json() as ApiResponse<{ accounts: ProviderAccount[] }>
      if (!res.ok || !data.success) {
        setListError(apiErrorMessage(res.status, data as { message?: string }))
        return
      }
      setAccounts((data as { accounts: ProviderAccount[] }).accounts)
    } catch {
      setListError('网络错误，请刷新重试。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (effectiveIsAuthenticated) void loadAccounts()
  }, [effectiveIsAuthenticated, loadAccounts])

  // ── Create account ──────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    // Client-side validation for extra fields
    if (isMultiField && !form.endpointId.trim()) {
      setFormError('请填写 Endpoint ID / Model ID。')
      return
    }

    setSubmitting(true)
    try {
      const credentialType = selectedProvider?.credentialType ?? 'single_api_key'
      const fields = isMultiField && form.endpointId.trim()
        ? { endpointId: form.endpointId.trim() }
        : undefined

      const res = await fetch('/api/provider-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          providerId: form.providerId,
          apiKey: form.apiKey,
          accountLabel: form.accountLabel,
          isDefault: form.isDefault,
          projectScope: form.projectScope.trim() || null,
          credentialType,
          fields,
        }),
      })
      const data = await res.json() as ApiResponse<{ account: ProviderAccount }>
      if (!res.ok || !data.success) {
        setFormError(apiErrorMessage(res.status, data as { message?: string }))
        return
      }
      setForm({ ...EMPTY_FORM })
      setFormSuccess('API 账户已添加。凭证已加密存储。')
      await loadAccounts()
    } catch {
      setFormError('网络错误，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Update account ──────────────────────────────────────────────────────────

  const patchAccount = async (id: string, patch: Record<string, unknown>) => {
    setActionState((s) => ({ ...s, [id]: 'loading' }))
    try {
      const res = await fetch(`/api/provider-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      })
      const data = await res.json() as ApiResponse<{ account: ProviderAccount }>
      if (!res.ok || !data.success) {
        setActionState((s) => ({ ...s, [id]: `error:${apiErrorMessage(res.status, data as { message?: string })}` }))
        return
      }
      setActionState((s) => ({ ...s, [id]: '' }))
      await loadAccounts()
    } catch {
      setActionState((s) => ({ ...s, [id]: 'error:网络错误，请稍后再试。' }))
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────

  const deleteAccount = async (id: string, label: string) => {
    if (!window.confirm(`确认删除「${label}」？此操作不可恢复，Key 将永久销毁。`)) return
    setActionState((s) => ({ ...s, [id]: 'loading' }))
    try {
      const res = await fetch(`/api/provider-accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json() as ApiResponse<{ deleted: boolean }>
      if (!res.ok || !data.success) {
        setActionState((s) => ({ ...s, [id]: `error:${apiErrorMessage(res.status, data as { message?: string })}` }))
        return
      }
      setActionState((s) => { const next = { ...s }; delete next[id]; return next })
      await loadAccounts()
    } catch {
      setActionState((s) => ({ ...s, [id]: 'error:网络错误，请稍后再试。' }))
    }
  }

  // ── Test connection ─────────────────────────────────────────────────────────

  const testAccount = async (id: string, accProviderId: string) => {
    // bearer_with_endpoint providers (Volcengine) don't have a reachable /models endpoint — skip
    const opt = getProviderOption(accProviderId)
    if (opt?.credentialType === 'bearer_with_endpoint') {
      // Simulate unsupported gracefully without calling the API
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, lastTestedAt: new Date().toISOString(), lastTestStatus: 'unsupported', lastTestError: '火山方舟账户不支持自动连接测试，请通过画布生成验证。' }
            : a
        )
      )
      return
    }

    setTestState((s) => ({ ...s, [id]: 'testing' }))
    try {
      const res = await fetch(`/api/provider-accounts/${id}/test`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json() as ApiResponse<{ account: ProviderAccount }>
      if (res.ok && data.success) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? (data as { account: ProviderAccount }).account : a))
        )
      }
    } catch {
      // Silently ignore network errors; user can retry
    } finally {
      setTestState((s) => ({ ...s, [id]: '' }))
    }
  }

  // If Zustand says the user is authenticated, render immediately — don't wait for the
  // network check to finish. effectiveIsAuthenticated already accounts for this.
  // Returning null only when we're SURE the user is not authenticated (will redirect).
  if (!effectiveIsAuthenticated) {
    // Auth check timed out or hit a transient error, and Zustand has no session either —
    // show a retry prompt instead of a permanent blank screen.
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

  return (
    <DashboardShell>
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.22em] text-white/30">账号设置</div>
            <h1 className="text-2xl font-semibold text-white">模型账户中心</h1>
            <p className="mt-1.5 text-sm text-white/45 leading-relaxed max-w-xl">
              连接你自己的 AI 模型 API 账户。API 调用费用由你直接支付给服务商，
              Creator City 提供安全的创作工作台与账户管理，不作为 API 中间商参与计费。
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white/35">
              <span>🔐 凭证加密存储，不可查看</span>
              <span>·</span>
              <span>⚡ 生成时直接调用你的 Provider</span>
              <span>·</span>
              <span>💰 API 费用直接结算给服务商</span>
            </div>
          </div>
          <Link
            href="/account"
            className="flex-shrink-0 ml-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
          >
            ← 账号设置
          </Link>
        </div>

        {/* Billing model info card */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35 mb-3">账单模式</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/15 bg-white/[0.05] text-white/50">当前默认</span>
              </div>
              <p className="text-xs font-semibold text-white/70 mb-1">平台额度</p>
              <p className="text-xs text-white/40 leading-relaxed">
                购买 Creator City 积分，由平台代付 API 调用费用。适合轻度用户，无需管理 API Key。
              </p>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-violet-400/30 bg-violet-400/[0.08] text-violet-300">此页面功能</span>
              </div>
              <p className="text-xs font-semibold text-violet-300 mb-1">我的 API 账户（BYOK）</p>
              <p className="text-xs text-white/40 leading-relaxed">
                接入自己的 Provider API Key，API 费用由你直接支付给服务商，Creator City 不代扣。
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.03] p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-400/60">规划中</span>
              </div>
              <p className="text-xs font-semibold text-cyan-300/70 mb-1">纯平台服务费</p>
              <p className="text-xs text-white/30 leading-relaxed">
                Creator City 仅收取工作台与协作工具服务费，不再作为 API 中间商参与 API 计费。
              </p>
            </div>
          </div>
        </div>

        {/* Capability matrix */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35 mb-3">BYOK 能力矩阵</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITY_MATRIX.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-white/[0.02]">
                <span className="text-sm flex-shrink-0">{capabilityIcon(row.byokStatus)}</span>
                <div className="min-w-0">
                  <p className="text-xs text-white/65 truncate">{row.label}</p>
                  <p className={`text-[10px] mt-0.5 ${capabilityColor(row.byokStatus)}`}>
                    {row.category} · {row.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-white/20 leading-relaxed">
            ✅ 已上线 · 🟡 存凭证，生成接入中 · ○ 规划中
          </p>
        </div>

        {/* Phase notice */}
        <div className="mb-6 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3 space-y-1.5">
          <p className="text-xs text-emerald-400/80 leading-relaxed">
            <span className="font-semibold">当前状态：</span>
            文本 BYOK（DeepSeek / Kimi / OpenAI）和 Seedream Image BYOK 已上线可用于生成。
            Seedance Video BYOK 凭证结构已准备，生成接入正在推进，当前保存凭证不触发任何生成调用。
          </p>
          <p className="text-xs text-emerald-400/40 leading-relaxed">
            <span className="font-semibold">什么是 API Key？</span>{' '}
            API Key 是 Provider 控制台生成的访问密钥（如 sk-xxx），
            不是你的网页登录账号和密码。
          </p>
        </div>

        {/* Account list */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">已连接账户</h2>
            <button
              type="button"
              onClick={() => void loadAccounts()}
              disabled={loading}
              className="text-xs text-white/35 hover:text-white/60 transition disabled:opacity-40"
            >
              {loading ? '加载中…' : '刷新'}
            </button>
          </div>

          {listError && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300 mb-3">
              {listError}
            </div>
          )}

          {!loading && !listError && accounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.02] px-6 py-10 text-center">
              <p className="text-sm text-white/35">还没有连接任何 API 账户。</p>
              <p className="text-xs text-white/25 mt-1">在下方填写并保存你的第一个账户。</p>
            </div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-3">
              {accounts.map((acc) => {
                const state = actionState[acc.id] ?? ''
                const isActing = state === 'loading'
                const actionError = state.startsWith('error:') ? state.slice(6) : null
                const isTesting = testState[acc.id] === 'testing'
                const accOpt = getProviderOption(acc.providerId)

                return (
                  <div
                    key={acc.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white truncate">
                            {acc.accountLabel}
                          </span>
                          {accOpt?.category && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-white/40 flex-shrink-0">
                              {accOpt.category}
                            </span>
                          )}
                          {acc.isDefault && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-violet-400/30 bg-violet-400/[0.08] text-violet-300 flex-shrink-0">
                              默认
                            </span>
                          )}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusColor(acc.status)}`}>
                            {statusLabel(acc.status)}
                          </span>
                          {accOpt?.byokStatus === 'coming_soon' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-white/30 flex-shrink-0">
                              生成接入中
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {providerLabel(acc.providerId)}
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="font-mono tracking-widest">•••• {acc.keyLast4}</span>
                          {/* Extra fields preview from fieldMeta */}
                          {acc.fieldMeta?.endpointId && (
                            <>
                              <span className="mx-1.5 opacity-40">·</span>
                              <span className="font-mono tracking-widest">
                                Endpoint: •••• {acc.fieldMeta.endpointId.last4}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/30 mb-3">
                      <span>范围：{acc.projectScope ?? '全局'}</span>
                      <span>添加于 {fmtDate(acc.createdAt)}</span>
                      {acc.lastTestedAt && (
                        <span>
                          测试于 {fmtDateTime(acc.lastTestedAt)}
                          {acc.lastTestStatus && (
                            <span className={`ml-1 font-medium ${testStatusColor(acc.lastTestStatus)}`}>
                              · {testStatusLabel(acc.lastTestStatus)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Action error */}
                    {actionError && (
                      <p className="text-xs text-rose-400 mb-2">{actionError}</p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        label={isTesting ? '测试中…' : '测试连接'}
                        disabled={isActing || isTesting}
                        onClick={() => void testAccount(acc.id, acc.providerId)}
                      />
                      {!acc.isDefault && (
                        <ActionButton
                          label="设为默认"
                          disabled={isActing || isTesting}
                          onClick={() => void patchAccount(acc.id, { isDefault: true })}
                        />
                      )}
                      {acc.status === 'active' ? (
                        <ActionButton
                          label="停用"
                          disabled={isActing || isTesting}
                          onClick={() => void patchAccount(acc.id, { status: 'disabled' })}
                        />
                      ) : (
                        <ActionButton
                          label="启用"
                          disabled={isActing || isTesting}
                          onClick={() => void patchAccount(acc.id, { status: 'active' })}
                        />
                      )}
                      <ActionButton
                        label={isActing ? '处理中…' : '删除'}
                        disabled={isActing || isTesting}
                        variant="danger"
                        onClick={() => void deleteAccount(acc.id, acc.accountLabel)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Add account form */}
        <section>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-1">添加 API 账户</h2>
          <p className="text-xs text-white/35 mb-3">凭证加密存储，保存后只显示末 4 位，平台不持有明文 Key。</p>

          {formSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-300">
              {formSuccess}
            </div>
          )}
          {formError && (
            <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-300">
              {formError}
            </div>
          )}

          <form
            onSubmit={(e) => void handleCreate(e)}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4"
          >
            {/* Provider */}
            <Field label="Provider">
              <select
                value={form.providerId}
                onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value, endpointId: '' }))}
                className="input-field"
                required
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    [{p.category}] {p.label}{p.byokStatus === 'live' ? '' : ' (保存凭证，生成暂未开放)'}
                  </option>
                ))}
              </select>
            </Field>

            {/* Notice for providers with credential storage but pending generation */}
            {selectedByokStatus === 'coming_soon' && (
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3.5 py-3">
                <p className="text-[11px] text-amber-300/70 leading-relaxed">
                  <span className="font-semibold">凭证存储已支持。</span>{' '}
                  {selectedProvider?.label} BYOK 生成接入正在推进中。
                  当前保存凭证不会触发任何生成调用，也不会扣费。凭证加密存储，随时可删除。
                </p>
              </div>
            )}

            {/* Label */}
            <Field label="账户名称">
              <input
                type="text"
                required
                placeholder="例：我的火山方舟账户"
                value={form.accountLabel}
                onChange={(e) => setForm((f) => ({ ...f, accountLabel: e.target.value }))}
                className="input-field"
              />
            </Field>

            {/* API Key */}
            <Field label="API Key（控制台生成的 Bearer Token，不是账号密码）">
              <input
                type="password"
                required
                placeholder="粘贴 Provider 控制台生成的 API Key，例如 sk-..."
                autoComplete="off"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="input-field font-mono"
              />
              <p className="mt-1.5 text-[11px] text-amber-400/60 leading-relaxed">
                注意：这里需要填写 Provider 控制台生成的 API Key（如 sk-xxx），
                不是你的网页登录账号和密码。
              </p>
              <p className="mt-1 text-[11px] text-white/25">
                Key 仅在保存时提交一次，加密后存储，保存后只显示末 4 位。
              </p>
            </Field>

            {/* Extra fields for multi-credential providers */}
            {isMultiField && selectedProvider?.extraFields?.map((field) => (
              <Field key={field.name} label={field.label}>
                <input
                  type="text"
                  required
                  placeholder={field.placeholder}
                  autoComplete="off"
                  value={form.endpointId}
                  onChange={(e) => setForm((f) => ({ ...f, endpointId: e.target.value }))}
                  className="input-field font-mono"
                />
                <p className="mt-1.5 text-[11px] text-white/40 leading-relaxed">
                  {field.description}
                </p>
              </Field>
            ))}

            {/* Project scope */}
            <Field label="项目范围（可选）">
              <input
                type="text"
                placeholder="留空表示所有项目可用"
                value={form.projectScope}
                onChange={(e) => setForm((f) => ({ ...f, projectScope: e.target.value }))}
                className="input-field"
              />
            </Field>

            {/* isDefault */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                className="w-4 h-4 rounded border border-white/20 bg-white/[0.06] accent-violet-500"
              />
              <span className="text-sm text-white/60">设为该 Provider 的默认账户</span>
            </label>

            {/* Security notice */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[11px] text-white/30 space-y-1 leading-relaxed">
              <p className="font-semibold text-white/40 mb-1.5">安全说明</p>
              <p>· Key 仅在提交时传输一次，加密存储后不可查看，仅保留末 4 位</p>
              <p>· 请勿提交他人的 API Key，也不要提交登录账号密码</p>
              <p>· 删除账户后 Key 永久销毁，无法恢复</p>
              <p>· Creator City 不记录你的明文 API Key，不持有你的调用凭据</p>
              <p>· 如怀疑 Key 泄漏，请立即在 Provider 控制台吊销并重新生成</p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-violet-600/80 hover:bg-violet-600 border border-violet-500/30 text-white font-medium px-6 py-2.5 text-sm transition disabled:opacity-50"
              >
                {submitting ? '保存中…' : '保存 API 账户'}
              </button>
            </div>
          </form>
        </section>

      </main>
    </DashboardShell>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/55 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

function ActionButton({
  label,
  disabled,
  variant = 'default',
  onClick,
}: {
  label: string
  disabled: boolean
  variant?: 'default' | 'danger'
  onClick: () => void
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
