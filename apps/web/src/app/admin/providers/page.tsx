'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'

type ProviderStatus = 'configured' | 'not-configured' | 'error'
type AvailabilityStatus = 'available' | 'disabled' | 'not-configured' | 'error'
type LastTestStatus = 'untested' | 'passed' | 'failed'

interface ProviderRow {
  providerId: string
  displayName: string
  capability: string[]
  category: string
  envKey: string
  envKeys: string[]
  optionalEnvKeys: string[]
  status: ProviderStatus
  configured: boolean
  enabled: boolean
  available: boolean
  availabilityStatus: AvailabilityStatus
  estimatedCost: number
  creditsPerCall: number
  monthlyBudgetUsd: number | null
  currentMonthCostUsd: number
  missingEnv: string[]
  missingEnvKeys: string[]
  lastTestStatus: LastTestStatus
  lastCheckedAt: string | null
  canTest: boolean
  canToggle: boolean
  reason: string
  setupHint: string
}

interface ProviderSummary {
  total: number
  configured: number
  notConfigured: number
  error: number
  enabled: number
  disabled: number
  available: number
  unavailable: number
}

interface StatusResponse {
  success?: boolean
  providers?: ProviderRow[]
  categories?: string[]
  summary?: ProviderSummary
  errorCode?: string
  message?: string
}

interface TestResponse {
  success?: boolean
  providerId?: string
  ok?: boolean
  status?: ProviderStatus
  message?: string
  missingEnvKeys?: string[]
  checkedAt?: string
  mode?: string
  errorCode?: string
}

const ALL_CATEGORIES = 'All'

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  if (!raw.trim()) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return { success: false, errorCode: 'NON_JSON_RESPONSE', message: `接口返回非 JSON（HTTP ${response.status}）` } as T
  }
}

function statusClass(status: ProviderStatus) {
  if (status === 'configured') return 'bg-emerald-400/15 text-emerald-200'
  if (status === 'error') return 'bg-red-400/15 text-red-200'
  return 'bg-amber-400/15 text-amber-200'
}

function statusLabel(status: ProviderStatus) {
  if (status === 'configured') return 'configured'
  if (status === 'error') return 'error'
  return 'not-configured'
}

function testLabel(status: LastTestStatus) {
  if (status === 'passed') return 'passed'
  if (status === 'failed') return 'failed'
  return 'untested'
}

function availabilityClass(status: AvailabilityStatus) {
  if (status === 'available') return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
  if (status === 'disabled') return 'border-red-300/25 bg-red-400/10 text-red-200'
  if (status === 'error') return 'border-red-300/25 bg-red-400/10 text-red-200'
  return 'border-white/12 bg-white/[0.05] text-white/48'
}

function availabilityLabel(provider: ProviderRow) {
  if (!provider.configured) return '不可用'
  return provider.enabled ? 'enabled' : 'disabled'
}

function buildClientSummary(providers: ProviderRow[]): ProviderSummary {
  return providers.reduce<ProviderSummary>((acc, provider) => {
    acc.total += 1
    if (provider.configured) acc.configured += 1
    else acc.notConfigured += 1
    if (provider.status === 'error') acc.error += 1
    if (provider.available) {
      acc.available += 1
      acc.enabled += 1
    }
    if (provider.configured && !provider.enabled) acc.disabled += 1
    if (!provider.configured) acc.unavailable += 1
    return acc
  }, { total: 0, configured: 0, notConfigured: 0, error: 0, enabled: 0, disabled: 0, available: 0, unavailable: 0 })
}

export default function AdminProvidersPage() {
  const { user } = useAuthStore()
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [summary, setSummary] = useState<StatusResponse['summary'] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [testingId, setTestingId] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const [testResults, setTestResults] = useState<Record<string, TestResponse>>({})
  const [copiedId, setCopiedId] = useState('')

  const loadProviders = useCallback(async () => {
    if (!user) {
      setMessage('请先登录管理员账户。')
      setLoading(false)
      return
    }
    if (user.role !== 'ADMIN') {
      setMessage('无权限：仅管理员可查看。')
      setLoading(false)
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/providers/status', {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await readJsonResponse<StatusResponse>(response)
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '加载 Provider 失败。'}` : data.message ?? '加载 Provider 失败。')
      }
      setProviders(data.providers ?? [])
      setSummary(data.summary ?? null)
      setCategories(data.categories ?? [])
      if (data.errorCode) setMessage(`${data.errorCode}: ${data.message ?? ''}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载 Provider 数据失败。')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const visibleProviders = useMemo(() => (
    activeCategory === ALL_CATEGORIES
      ? providers
      : providers.filter((provider) => provider.category === activeCategory || provider.capability.includes(activeCategory))
  ), [activeCategory, providers])

  async function handleToggle(provider: ProviderRow) {
    if (!provider.canToggle) {
      setMessage(`${provider.displayName}: ${provider.reason || '缺少环境变量，不能启用该 Provider'}`)
      return
    }
    setTogglingId(provider.providerId)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/providers/toggle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ providerId: provider.providerId, enabled: !provider.enabled }),
      })
      const data = await readJsonResponse<{
        success?: boolean
        message?: string
        errorCode?: string
        enabled?: boolean
        available?: boolean
        availabilityStatus?: AvailabilityStatus
        reason?: string
      }>(response)
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '更新失败。'}` : data.message ?? '更新失败。')
      }
      setProviders((current) => {
        const next = current.map((item) => (
          item.providerId === provider.providerId
            ? {
                ...item,
                enabled: Boolean(data.enabled),
                available: Boolean(data.available),
                availabilityStatus: data.availabilityStatus ?? (data.enabled ? 'available' : 'disabled'),
                reason: data.reason ?? (data.enabled ? '可用' : '已停用'),
              }
            : item
        ))
        setSummary(buildClientSummary(next))
        return next
      })
      setMessage(`${provider.displayName} 已${data.enabled ? '启用' : '停用'}。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新启用状态失败。')
    } finally {
      setTogglingId('')
    }
  }

  async function handleTest(provider: ProviderRow) {
    setTestingId(provider.providerId)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/providers/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ providerId: provider.providerId }),
      })
      const data = await readJsonResponse<TestResponse>(response)
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '测试失败。'}` : data.message ?? '测试失败。')
      }
      setTestResults((current) => ({ ...current, [provider.providerId]: data }))
      setProviders((current) => current.map((item) => (
        item.providerId === provider.providerId
          ? {
              ...item,
              status: data.status ?? item.status,
              lastTestStatus: data.ok ? 'passed' : 'failed',
              lastCheckedAt: data.checkedAt ?? new Date().toISOString(),
              missingEnvKeys: data.missingEnvKeys ?? item.missingEnvKeys,
            }
          : item
      )))
      setMessage(`${provider.displayName}: ${data.message ?? (data.ok ? '测试通过。' : '测试失败。')}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '测试连接失败。')
    } finally {
      setTestingId('')
    }
  }

  async function handleCopyMissing(provider: ProviderRow) {
    const keys = provider.missingEnvKeys.length ? provider.missingEnvKeys : provider.envKeys
    const text = keys.map((key) => `${key}=`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(provider.providerId)
      window.setTimeout(() => setCopiedId(''), 1400)
    } catch {
      window.prompt('复制缺失环境变量', text)
    }
  }

  const categoryTabs = [ALL_CATEGORIES, ...categories, 'LLM', 'Image-to-Video']
    .filter((value, index, array) => array.indexOf(value) === index)

  return (
    <DashboardShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">API Provider 管理中心</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
              统一查看生成、存储和支付 Provider 的环境变量、启用开关、轻量测试入口、价格和积分成本。测试连接不会触发真实生成、支付、扣费或上传。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadProviders()}
            disabled={loading}
            className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? '刷新中...' : '刷新状态'}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {[
            ['Total', summary?.total ?? providers.length],
            ['Configured', summary?.configured ?? 0],
            ['Missing Env', summary?.notConfigured ?? 0],
            ['Available', summary?.available ?? summary?.enabled ?? 0],
            ['Disabled', summary?.disabled ?? 0],
            ['Unavailable', summary?.unavailable ?? summary?.notConfigured ?? 0],
            ['Error', summary?.error ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
              <div className="text-xs text-white/38">{label}</div>
              <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          {categoryTabs.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                activeCategory === category
                  ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-100'
                  : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/25 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-white/40">加载中...</p>
        ) : (
          <section className="mt-6 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[1180px] text-left text-sm text-white/70">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-xs text-white/42">
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Capability</th>
                  <th className="px-4 py-3">Env</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Credits</th>
                  <th className="px-4 py-3">Last Test</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleProviders.map((provider) => {
                  const testResult = testResults[provider.providerId]
                  const missing = provider.missingEnvKeys.length ? provider.missingEnvKeys : provider.missingEnv
                  const missingText = missing.join(', ')
                  return (
                    <tr key={provider.providerId} className="border-b border-white/5 align-top hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{provider.displayName}</div>
                        <code className="mt-1 block text-xs text-white/36">{provider.providerId}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {provider.capability.map((item) => (
                            <span key={item} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-white/62">{item}</span>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <code className="block whitespace-pre-wrap break-words text-xs text-white/46">{provider.envKey || 'none'}</code>
                        {missing.length ? (
                          <div className="mt-1 text-xs text-amber-200/80">missingEnv: {missingText}</div>
                        ) : (
                          <div className="mt-1 text-xs text-emerald-200/70">missingEnv: none</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusClass(provider.status)}`}>
                          {statusLabel(provider.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleToggle(provider)}
                          disabled={!provider.canToggle || togglingId === provider.providerId}
                          className={`rounded-md border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-70 ${availabilityClass(provider.availabilityStatus)}`}
                        >
                          {togglingId === provider.providerId ? '更新中...' : availabilityLabel(provider)}
                        </button>
                        <div className="mt-1 max-w-[180px] text-xs text-white/34">{provider.reason}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">${provider.estimatedCost.toFixed(4)}</td>
                      <td className="px-4 py-3 tabular-nums">{provider.creditsPerCall}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-white/60">{testResult ? (testResult.ok ? 'passed' : 'failed') : testLabel(provider.lastTestStatus)}</div>
                        <div className="mt-1 max-w-[220px] text-xs text-white/34">
                          {testResult?.message ?? (provider.lastCheckedAt ? new Date(provider.lastCheckedAt).toLocaleString('zh-CN') : 'never')}
                        </div>
                        {testResult?.mode ? (
                          <div className="mt-1 text-xs text-white/30">{testResult.mode}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleTest(provider)}
                            disabled={testingId === provider.providerId}
                            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/68 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                          >
                            {testingId === provider.providerId ? '测试中...' : '测试连接'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyMissing(provider)}
                            className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/68 transition hover:border-white/25 hover:text-white"
                          >
                            {copiedId === provider.providerId ? '已复制' : '复制缺失环境变量'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {visibleProviders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-white/36">没有匹配的 Provider。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </DashboardShell>
  )
}
