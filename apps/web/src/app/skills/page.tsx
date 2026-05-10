'use client'

import { useCallback, useEffect, useState } from 'react'

type ToolRisk = 'safe' | 'license_review' | 'service_isolation_required' | 'reference_only'
type ToolTier = 'P0' | 'P1' | 'P2' | 'deferred'
type ToolStatus = 'enabled' | 'disabled' | 'misconfigured' | 'error'

interface ToolRow {
  id: string
  name: string
  tier: ToolTier
  category: string
  description: string
  license: string
  risk: ToolRisk
  featureFlag: string
  productSurface: string[]
  userVisibleCapability: string
  stars?: number
  homepage?: string
  notes?: string
  enabled: boolean
}

interface ToolHealth {
  toolId: string
  status: ToolStatus
  latencyMs?: number
  message?: string
  checkedAt: string
}

interface Summary {
  total: number
  enabled: number
  byTier: Record<string, number>
  byRisk: Record<string, number>
}

const RISK_LABEL: Record<ToolRisk, string> = {
  safe: '安全',
  license_review: '待审许可',
  service_isolation_required: 'GPL 隔离',
  reference_only: '仅参考',
}

const RISK_COLOR: Record<ToolRisk, string> = {
  safe: 'bg-green-900/40 text-green-300',
  license_review: 'bg-yellow-900/40 text-yellow-300',
  service_isolation_required: 'bg-red-900/40 text-red-300',
  reference_only: 'bg-gray-700/60 text-gray-400',
}

const TIER_COLOR: Record<ToolTier, string> = {
  P0: 'bg-purple-900/50 text-purple-300',
  P1: 'bg-blue-900/50 text-blue-300',
  P2: 'bg-cyan-900/50 text-cyan-300',
  deferred: 'bg-gray-700/50 text-gray-400',
}

const STATUS_COLOR: Record<ToolStatus, string> = {
  enabled: 'text-green-400',
  disabled: 'text-gray-500',
  misconfigured: 'text-yellow-400',
  error: 'text-red-400',
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${className}`}>{children}</span>
}

export default function SkillsPage() {
  const [tools, setTools] = useState<ToolRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [health, setHealth] = useState<Map<string, ToolHealth>>(new Map())
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTier, setFilterTier] = useState<ToolTier | 'all'>('all')

  useEffect(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTools(d.tools)
          setSummary(d.summary)
        } else {
          setError(d.message ?? 'Failed to load tools')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false))
  }, [])

  const runHealthCheck = useCallback(() => {
    setLoadingHealth(true)
    fetch('/api/skills/health')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const map = new Map<string, ToolHealth>()
          for (const h of d.health as ToolHealth[]) map.set(h.toolId, h)
          setHealth(map)
        }
      })
      .catch(() => null)
      .finally(() => setLoadingHealth(false))
  }, [])

  const visibleTools = filterTier === 'all' ? tools : tools.filter((t) => t.tier === filterTier)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">开源工具注册表</h1>
          <p className="text-gray-400 mt-1 text-sm">Creator City 集成工具一览 · 版本 / 许可 / 风险 / 健康状态</p>
        </div>

        {loading && <p className="text-gray-400">加载中…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: '全部工具', value: summary.total },
              { label: '已启用', value: summary.enabled },
              { label: 'P0 核心', value: summary.byTier.P0 },
              { label: '仅参考', value: summary.byRisk.reference_only },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-2">
            {(['all', 'P0', 'P1', 'P2', 'deferred'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filterTier === tier
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {tier === 'all' ? '全部' : tier}
              </button>
            ))}
          </div>
          <button
            onClick={runHealthCheck}
            disabled={loadingHealth}
            className="ml-auto px-4 py-1.5 rounded text-sm font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loadingHealth ? '检测中…' : '运行健康检测'}
          </button>
        </div>

        <div className="space-y-2">
          {visibleTools.map((tool) => {
            const h = health.get(tool.id)
            return (
              <div key={tool.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white">{tool.name}</span>
                      <Badge className={TIER_COLOR[tool.tier]}>{tool.tier}</Badge>
                      <Badge className={RISK_COLOR[tool.risk]}>{RISK_LABEL[tool.risk]}</Badge>
                      <span className="text-xs text-gray-500 font-mono">{tool.license}</span>
                      {tool.stars && <span className="text-xs text-gray-500">★ {tool.stars.toLocaleString()}</span>}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{tool.description}</p>
                    {tool.notes && <p className="text-xs text-yellow-500/80 italic">{tool.notes}</p>}
                    {tool.productSurface.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        {tool.productSurface.map((s) => (
                          <span key={s} className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-medium ${tool.enabled ? 'text-green-400' : 'text-gray-600'}`}>
                      {tool.enabled ? '● 已启用' : '○ 未启用'}
                    </span>
                    {h && (
                      <span className={`text-xs ${STATUS_COLOR[h.status]}`}>
                        {h.status}{h.latencyMs !== undefined ? ` ${h.latencyMs}ms` : ''}
                      </span>
                    )}
                    {tool.homepage && (
                      <a
                        href={tool.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        主页 ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
