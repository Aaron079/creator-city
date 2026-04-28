'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProviderCategoryRail } from '@/components/tools/ProviderCategoryRail'
import { ProviderStatusBadge, STATUS_META } from '@/components/tools/ProviderStatusBadge'
import {
  NODE_TYPE_LABELS,
  getToolProviderGroups,
  getToolProviderStatusCounts,
  type ToolProvider,
  type ToolProviderStatus,
} from '@/lib/tools/provider-status'

interface ApiProviderStatus {
  id: string
  displayName: string
  category: string
  status: ToolProviderStatus
  configured: boolean
  missingEnvKeys: string[]
  canTest: boolean
  setupHint: string
  hasAdapter: boolean
}

interface TestResult {
  ok: boolean
  providerId: string
  status: string
  message: string
}

function joinList(items: string[]) {
  return items.join(' / ')
}

function getStatusFeedback(provider: ToolProvider, apiStatus?: ApiProviderStatus) {
  const status = apiStatus?.status ?? provider.status
  const name = provider.name

  if (status === 'available') return `${name}：配置完成，可真实调用。`
  if (status === 'not-configured') {
    const missing = apiStatus?.missingEnvKeys.join('、') ?? provider.envKeys.join('、')
    return `${name}：未配置。缺少环境变量：${missing || '未知'}。${apiStatus?.setupHint ?? ''}`
  }
  if (status === 'mock') return `${name}：模拟生成，不会调用第三方 API。`
  if (status === 'bridge-only') return `${name}：当前仅展示桥接格式，不会真实调用。`
  if (status === 'coming-soon') return `${name}：即将接入，当前不可真实调用。`
  if (status === 'error') return `${name}：状态异常，请检查 API key 或网络。`
  return `${name}：状态未知。`
}

export function ToolProviderStatusPanel() {
  const staticGroups = getToolProviderGroups()
  const [activeGroupId, setActiveGroupId] = useState(staticGroups[0]?.id ?? 'video-generation')
  const [feedback, setFeedback] = useState('未配置 API 的工具不会被伪装为可用。从 /api/providers/status 加载真实状态…')
  const [apiStatuses, setApiStatuses] = useState<Map<string, ApiProviderStatus>>(new Map())
  const [loadingStatuses, setLoadingStatuses] = useState(true)
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map())
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void fetch('/api/providers/status')
      .then((r) => r.json())
      .then((data: { providers?: ApiProviderStatus[] }) => {
        if (Array.isArray(data.providers)) {
          const map = new Map<string, ApiProviderStatus>()
          for (const p of data.providers) map.set(p.id, p)
          setApiStatuses(map)
          setFeedback('已从服务端加载真实 provider 状态。未配置 API key 的 provider 显示 not-configured。')
        }
      })
      .catch(() => {
        setFeedback('无法加载服务端状态，显示静态 catalog 数据。')
      })
      .finally(() => setLoadingStatuses(false))
  }, [])

  async function handleTest(providerId: string) {
    setTestingIds((prev) => new Set(prev).add(providerId))
    try {
      const response = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })
      const result = await response.json() as TestResult
      setTestResults((prev) => new Map(prev).set(providerId, result))
      setFeedback(
        result.ok
          ? `✓ ${providerId}：${result.message}`
          : `✗ ${providerId}：${result.message}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : '测试失败'
      setTestResults((prev) => new Map(prev).set(providerId, { ok: false, providerId, status: 'error', message }))
      setFeedback(`✗ ${providerId}：${message}`)
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  const providers = useMemo(
    () => staticGroups.flatMap((group) => group.entries),
    [staticGroups],
  )

  const effectiveProviders = useMemo(
    () => providers.map((p) => {
      const api = apiStatuses.get(p.id)
      if (!api) return p
      return { ...p, status: api.status }
    }),
    [providers, apiStatuses],
  )

  const summary = useMemo(
    () => getToolProviderStatusCounts(effectiveProviders),
    [effectiveProviders],
  )

  const activeGroup = staticGroups.find((g) => g.id === activeGroupId) ?? staticGroups[0]

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-[28px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/35">Provider Catalog / API Matrix v2</div>
          <h2 className="mt-3 text-[26px] font-light tracking-[-0.03em] text-white">工具 / API 状态中心</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/56">
            显示平台 AI 工具的真实可用性。配置了 API key 才标记 available；未配置显示 not-configured；无官方 API 显示 coming-soon 或 bridge-only。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_META) as ToolProviderStatus[]).map((status) => (
            <ProviderStatusBadge key={status} status={status} />
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[18px] border border-white/8 bg-black/20 px-4 py-3 text-xs leading-6 text-white/56">
        <span className="text-white/34">{loadingStatuses ? '加载中… ' : '状态：'}</span>
        {feedback}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">total providers</div>
          <div className="mt-2 text-xl font-light text-white">{effectiveProviders.length}</div>
        </div>
        {(Object.entries(summary) as Array<[ToolProviderStatus, number]>).map(([status, value]) => (
          <div key={status} className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/34">{status}</div>
            <div className="mt-2 text-xl font-light text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ProviderCategoryRail groups={staticGroups} activeId={activeGroup?.id ?? activeGroupId} onSelect={(id) => setActiveGroupId(id as typeof activeGroupId)} />
      </div>

      {activeGroup ? (
        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-light tracking-[-0.03em] text-white">{activeGroup.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/48">{activeGroup.description}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/42">
              {activeGroup.entries.length} providers
            </span>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {activeGroup.entries.map((provider) => {
              const apiStatus = apiStatuses.get(provider.id)
              const effectiveStatus = apiStatus?.status ?? provider.status
              const testResult = testResults.get(provider.id)
              const isTesting = testingIds.has(provider.id)
              const canTest = apiStatus?.canTest ?? false
              const missingKeys = apiStatus?.missingEnvKeys ?? []
              const setupHint = apiStatus?.setupHint ?? ''

              return (
                <article
                  key={provider.id}
                  className="rounded-[20px] border border-white/8 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-medium text-white">{provider.name}</h4>
                        {provider.badge ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/46">
                            {provider.badge}
                          </span>
                        ) : null}
                        {apiStatus?.hasAdapter ? (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2 py-0.5 text-[10px] text-emerald-400/70">
                            adapter
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-white/32">
                        {provider.category} · {provider.adapterId}
                      </div>
                    </div>
                    <ProviderStatusBadge status={effectiveStatus} />
                  </div>

                  <p className="mt-3 text-sm leading-6 text-white/56">{provider.description}</p>

                  <div className="mt-4 grid gap-3 text-xs leading-6 text-white/48 sm:grid-cols-2">
                    <div>
                      <span className="text-white/30">nodeTypes：</span>
                      {joinList(provider.nodeTypes.map((nt) => NODE_TYPE_LABELS[nt]))}
                    </div>
                    <div>
                      <span className="text-white/30">estimatedTime：</span>
                      {provider.estimatedTime}
                    </div>
                    <div>
                      <span className="text-white/30">envKeys：</span>
                      {provider.envKeys.length ? joinList(provider.envKeys) : 'none'}
                    </div>
                    {missingKeys.length > 0 ? (
                      <div className="text-amber-400/70">
                        <span className="text-white/30">缺少：</span>
                        {joinList(missingKeys)}
                      </div>
                    ) : null}
                  </div>

                  {setupHint ? (
                    <div className="mt-3 rounded-[14px] border border-white/6 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-white/38">
                      {setupHint}
                    </div>
                  ) : null}

                  {testResult ? (
                    <div className={`mt-3 rounded-[14px] border px-3 py-2 text-xs leading-5 ${
                      testResult.ok
                        ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400/80'
                        : 'border-red-500/20 bg-red-500/[0.06] text-red-400/80'
                    }`}>
                      {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={!canTest || isTesting}
                      onClick={() => setFeedback(getStatusFeedback(provider, apiStatus))}
                      className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs transition ${
                        !canTest || isTesting
                          ? 'cursor-not-allowed border-white/8 bg-white/[0.025] text-white/34'
                          : 'border-white/10 bg-white/[0.05] text-white/78 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {effectiveStatus === 'available' ? '真实可用' : effectiveStatus === 'mock' ? '模拟生成' : effectiveStatus === 'bridge-only' ? '需桥接' : effectiveStatus === 'not-configured' ? '未配置' : '即将接入'}
                    </button>

                    {canTest ? (
                      <button
                        type="button"
                        disabled={isTesting}
                        onClick={() => void handleTest(provider.id)}
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/78 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isTesting ? '测试中…' : '测试连接'}
                      </button>
                    ) : null}

                    <code className="max-w-full truncate text-[10px] text-white/34">
                      {provider.id}
                    </code>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}
    </section>
  )
}
