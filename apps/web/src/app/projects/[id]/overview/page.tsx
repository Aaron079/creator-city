'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/auth/use-current-user'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectSummary {
  project: {
    id: string
    title: string
    type: string
    status: string
    createdAt: string
    updatedAt: string
  }
  stats: {
    workflowCount: number
    nodeCount: number
    assetCount: number
    imageAssetCount: number
    videoAssetCount: number
    taskCount: number
    runningTaskCount: number
    succeededTaskCount: number
    failedTaskCount: number
  }
  recentAssets: Array<{
    id: string
    type: string
    url: string | null
    thumbnailUrl: string | null
    providerId: string | null
    promptPreview: string | null
    generationJobId: string | null
    createdAt: string
  }>
  recentTasks: Array<{
    id: string
    nodeId: string | null
    type: string
    status: string
    promptPreview: string | null
    providerId: string
    errorCode: string | null
    errorStage: string | null
    createdAt: string
    completedAt: string | null
    durationMs: number | null
  }>
}

// ─── Mini-components ─────────────────────────────────────────────────────────

const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', PRE_PRODUCTION: '前期', IN_PRODUCTION: '制作中',
  POST_PRODUCTION: '后期', COMPLETED: '已完成', PUBLISHED: '已发布', ARCHIVED: '已归档',
}
const PROJECT_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'rgba(255,255,255,0.3)', PRE_PRODUCTION: '#60a5fa',
  IN_PRODUCTION: '#a78bfa', POST_PRODUCTION: '#f59e0b',
  COMPLETED: '#34d399', PUBLISHED: '#10b981', ARCHIVED: 'rgba(255,255,255,0.2)',
}
const TASK_STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '生成中', succeeded: '已完成', failed: '失败',
}
const TASK_STATUS_COLOR: Record<string, string> = {
  queued: '#f59e0b', running: '#60a5fa', succeeded: '#34d399', failed: '#f87171',
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600,
      color, border: `1px solid ${color}`,
      background: `${color}18`,
    }}>
      {label}
    </span>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div style={{
      flex: '1 1 100px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 16px',
      minWidth: 90,
    }}>
      <div style={{ fontSize: accent ? 24 : 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        padding: '3px 8px', borderRadius: 4,
        fontSize: 11, fontWeight: 500,
        color: copied ? '#34d399' : 'rgba(255,255,255,0.45)',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'color 0.15s',
      }}
    >
      {copied ? '已复制' : (label ?? '复制')}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
      color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

// ─── Recent assets grid ───────────────────────────────────────────────────────

function RecentAssetsGrid({ assets, projectId }: { assets: ProjectSummary['recentAssets']; projectId: string }) {
  if (assets.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        暂无资产
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
        {assets.map((a) => {
          const url = a.thumbnailUrl ?? a.url
          return (
            <div key={a.id} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, overflow: 'hidden',
              aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {a.type === 'VIDEO' ? (
                url ? (
                  <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="none" />
                ) : (
                  <span style={{ fontSize: 24, opacity: 0.4 }}>▶</span>
                )
              ) : url ? (
                <img src={url} alt={a.promptPreview ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              ) : (
                <span style={{ fontSize: 24, opacity: 0.3 }}>□</span>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                padding: '4px 6px',
              }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  {a.type}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <a href={`/assets?projectId=${encodeURIComponent(projectId)}`} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
        查看全部资产 →
      </a>
    </div>
  )
}

// ─── Recent tasks list ────────────────────────────────────────────────────────

function RecentTasksList({ tasks, projectId }: { tasks: ProjectSummary['recentTasks']; projectId: string }) {
  if (tasks.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        暂无生成任务
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {tasks.map((t) => (
          <div key={t.id} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <Chip label={t.type} color="rgba(255,255,255,0.4)" />
              <Chip
                label={TASK_STATUS_LABEL[t.status] ?? t.status}
                color={TASK_STATUS_COLOR[t.status] ?? 'rgba(255,255,255,0.3)'}
              />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flex: 1 }}>{t.providerId}</span>
              {t.durationMs != null ? (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {(t.durationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
            </div>
            {t.promptPreview ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4, lineHeight: 1.4 }}>
                {t.promptPreview}
              </div>
            ) : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                {t.id.slice(0, 8)}...
              </span>
              <CopyButton text={t.id} label="复制任务 ID" />
              {t.errorCode ? (
                <span style={{ fontSize: 11, color: '#f87171', marginLeft: 4 }}>
                  {t.errorCode}{t.errorStage ? ` @ ${t.errorStage}` : ''}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <a href={`/tasks?projectId=${encodeURIComponent(projectId)}`} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
        查看全部任务 →
      </a>
    </div>
  )
}

// ─── Hints (static, no AI) ────────────────────────────────────────────────────

function ProductionHints({ stats }: { stats: ProjectSummary['stats'] }) {
  const hints: string[] = []
  if (stats.failedTaskCount > 2) hints.push('失败任务较多，建议前往生成任务中心查看错误详情。')
  if (stats.assetCount === 0 && stats.taskCount === 0) hints.push('进入画布生成第一批图片或视频素材。')
  if (stats.runningTaskCount > 0) hints.push(`有 ${stats.runningTaskCount} 个任务正在进行中，视频通常需要 1–3 分钟。`)
  if (hints.length === 0) return null
  return (
    <div style={{
      background: 'rgba(167,139,250,0.06)',
      border: '1px solid rgba(167,139,250,0.15)',
      borderRadius: 8, padding: '12px 16px', marginBottom: 28,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(167,139,250,0.8)', marginBottom: 6, letterSpacing: '0.06em' }}>
        生产建议
      </div>
      {hints.map((h, i) => (
        <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: i < hints.length - 1 ? 4 : 0 }}>
          · {h}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = typeof params.id === 'string' ? params.id : ''
  const { status: authStatus } = useCurrentUser()

  const [data, setData] = useState<ProjectSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authStatus === 'loading') return
    if (authStatus === 'unauthenticated') {
      router.replace(`/auth/login?next=/projects/${projectId}/overview`)
    }
  }, [authStatus, router, projectId])

  const fetchSummary = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    fetch(`/api/projects/${encodeURIComponent(projectId)}/summary`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((r) => r.json() as Promise<ProjectSummary & { success?: boolean; error?: string; message?: string }>)
      .then((d) => {
        if (!d.success) {
          setError(d.message ?? d.error ?? '加载失败')
        } else {
          setData(d)
        }
      })
      .catch(() => setError('网络请求失败，请稍后重试'))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    if (authStatus === 'authenticated' || authStatus === 'unknown') fetchSummary()
  }, [authStatus, fetchSummary])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 56,
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
      }}>
        <a href="/projects" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          ← 项目中心
        </a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {data?.project.title ?? (loading ? '加载中...' : '项目详情')}
        </span>
        {!loading && !error && data ? (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <a
              href={`/create?projectId=${encodeURIComponent(projectId)}`}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#000', background: '#fff', textDecoration: 'none' }}
            >
              进入画布 →
            </a>
          </div>
        ) : null}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '80px 0', fontSize: 14 }}>
            正在加载项目详情...
          </div>
        ) : error ? (
          <div style={{
            padding: '32px 24px', textAlign: 'center',
            background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 10, marginBottom: 24,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>
              {error.includes('存在') || error.includes('NOT_FOUND') ? '项目不存在或无权限访问' : error}
            </div>
            <a href="/projects" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
              返回项目中心
            </a>
          </div>
        ) : data ? (
          <>
            {/* Project header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                  {data.project.title}
                </h1>
                <Chip
                  label={PROJECT_STATUS_LABEL[data.project.status] ?? data.project.status}
                  color={PROJECT_STATUS_COLOR[data.project.status] ?? 'rgba(255,255,255,0.3)'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                  {data.project.id}
                </span>
                <CopyButton text={data.project.id} label="复制 ID" />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                创建于 {new Date(data.project.createdAt).toLocaleString('zh-CN')} · 更新于 {new Date(data.project.updatedAt).toLocaleString('zh-CN')}
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={`/create?projectId=${encodeURIComponent(projectId)}`} style={{ padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#000', background: '#fff', textDecoration: 'none' }}>
                  进入画布 →
                </a>
                <a href={`/assets?projectId=${encodeURIComponent(projectId)}`} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', textDecoration: 'none' }}>
                  查看资产
                </a>
                <a href={`/tasks?projectId=${encodeURIComponent(projectId)}`} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', textDecoration: 'none' }}>
                  查看任务
                </a>
                <a href="/projects" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', textDecoration: 'none' }}>
                  返回项目中心
                </a>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
              <StatCard label="节点" value={data.stats.nodeCount} />
              <StatCard label="资产" value={data.stats.assetCount} accent />
              <StatCard label="图片" value={data.stats.imageAssetCount} />
              <StatCard label="视频" value={data.stats.videoAssetCount} />
              <StatCard label="任务" value={data.stats.taskCount} />
              <StatCard label="进行中" value={data.stats.runningTaskCount} />
              <StatCard label="已成功" value={data.stats.succeededTaskCount} />
              <StatCard label="失败" value={data.stats.failedTaskCount} />
            </div>

            {/* Production hints */}
            <ProductionHints stats={data.stats} />

            {/* 2-col: assets + tasks */}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {/* Recent assets */}
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <SectionTitle>最近资产</SectionTitle>
                <RecentAssetsGrid assets={data.recentAssets} projectId={projectId} />
              </div>

              {/* Recent tasks */}
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <SectionTitle>最近生成任务</SectionTitle>
                <RecentTasksList tasks={data.recentTasks} projectId={projectId} />
              </div>
            </div>

            <div style={{ height: 48 }} />
          </>
        ) : null}
      </div>
    </div>
  )
}
