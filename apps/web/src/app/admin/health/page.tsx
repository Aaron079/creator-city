'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'

type HealthStatus = 'ok' | 'warning' | 'error'

interface HealthSection {
  status: HealthStatus
  message: string
  details: Record<string, unknown>
}

interface HealthResponse {
  success?: boolean
  checkedAt?: string
  sections?: Record<string, HealthSection>
  errorCode?: string
  message?: string
}

const SECTION_TITLES: Record<string, string> = {
  auth: 'Auth',
  database: 'Database',
  projects: 'Projects',
  canvas: 'Canvas',
  assets: 'Assets',
  storage: 'Storage',
  payments: 'Payments',
  providers: 'Providers',
  delivery: 'Delivery',
  comments: 'Comments',
}

const SECTION_ORDER = [
  'auth',
  'database',
  'projects',
  'canvas',
  'assets',
  'storage',
  'payments',
  'providers',
  'delivery',
  'comments',
]

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  if (!raw.trim()) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return {
      success: false,
      errorCode: 'NON_JSON_RESPONSE',
      message: `接口返回非 JSON（HTTP ${response.status}）`,
    } as T
  }
}

function statusClass(status: HealthStatus) {
  if (status === 'ok') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
  if (status === 'warning') return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
  return 'border-red-400/20 bg-red-400/10 text-red-200'
}

function statusLabel(status: HealthStatus) {
  if (status === 'ok') return 'ok'
  if (status === 'warning') return 'warning'
  return 'error'
}

function getOverallStatus(sections?: Record<string, HealthSection>): HealthStatus {
  const values = Object.values(sections ?? {})
  if (values.some((section) => section.status === 'error')) return 'error'
  if (values.some((section) => section.status === 'warning')) return 'warning'
  return 'ok'
}

function countText(details: Record<string, unknown>) {
  const countKeys = [
    'recentCount',
    'sampledNodeCount',
    'sampledEdgeCount',
    'recentPaymentOrderCount',
    'recentCreditLedgerCount',
    'recentShareCount',
    'recentItemCount',
    'recentCommentCount',
    'recentCanvasCommentCount',
    'recentDeliveryCommentCount',
  ]
  return countKeys
    .filter((key) => typeof details[key] === 'number')
    .map((key) => `${key}: ${details[key]}`)
    .join(' · ')
}

function SectionCard({ name, section }: { name: string; section: HealthSection }) {
  const counts = countText(section.details)
  const degraded = Boolean(section.details.degraded)
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{SECTION_TITLES[name] ?? name}</h2>
          <p className="mt-2 text-sm leading-6 text-white/58">{section.message}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(section.status)}`}>
          {statusLabel(section.status)}
        </span>
      </div>
      {degraded ? (
        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          数据库连接池繁忙，健康检查已降级为轻量检查。
        </div>
      ) : null}
      {counts ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/55">
          {counts}
        </div>
      ) : null}
      <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/55">
        {JSON.stringify(section.details, null, 2)}
      </pre>
    </section>
  )
}

export default function AdminHealthPage() {
  const { user } = useAuthStore()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ errorCode?: string; message: string } | null>(null)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/health', {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await readJsonResponse<HealthResponse>(response)
      if (!response.ok || data.success === false) {
        throw new Error(data.errorCode ? `${data.errorCode}: ${data.message ?? '系统健康检查失败。'}` : data.message ?? '系统健康检查失败。')
      }
      setHealth(data)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '系统健康检查失败。'
      const [errorCode, ...rest] = message.split(': ')
      setError(rest.length ? { errorCode, message: rest.join(': ') } : { message })
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHealth()
  }, [loadHealth])

  const overallStatus = useMemo(() => getOverallStatus(health?.sections), [health])
  const sections = health?.sections

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">Regression Center</div>
            <h1 className="mt-2 text-2xl font-semibold text-white">System Health / 系统健康检查</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
              健康检查为只读轻量诊断，不触发生成、支付、上传或写入。
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void loadHealth() }}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? '检查中...' : '重新检查'}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/30">当前用户</div>
            <div className="mt-2 text-sm font-semibold text-white">{user?.email ?? '未加载'}</div>
            <div className="mt-1 text-xs text-white/45">{user?.role ?? 'unknown'}</div>
          </section>
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/30">checkedAt</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {health?.checkedAt ? new Date(health.checkedAt).toLocaleString() : loading ? '检查中...' : '未完成'}
            </div>
          </section>
          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/30">总体状态</div>
            <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(overallStatus)}`}>
              {statusLabel(overallStatus)}
            </div>
          </section>
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error.errorCode ? `${error.errorCode}: ` : ''}{error.message}
          </div>
        ) : null}

        {loading && !sections ? (
          <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-6 text-sm text-white/50">
            正在执行只读健康检查...
          </div>
        ) : null}

        {sections ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {SECTION_ORDER.map((name) => (
              sections[name] ? <SectionCard key={name} name={name} section={sections[name]} /> : null
            ))}
          </div>
        ) : null}
      </main>
    </DashboardShell>
  )
}
