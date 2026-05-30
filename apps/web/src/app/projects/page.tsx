'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'
import { useCurrentUser } from '@/lib/auth/use-current-user'

const PROJECTS_CACHE_KEY = 'creator-city:projects-cache'

interface ProjectListItem {
  id: string
  title: string
  description: string
  status: string
  visibility: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  workflowId?: string | null
  nodeCount?: number
  assetCount?: number
  ownerRole?: string | null
  membershipRole?: string | null
}

function writeProjectsCache(projects: ProjectListItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({
      projects,
      updatedAt: new Date().toISOString(),
    }))
  } catch {
    // localStorage unavailable; explicit projectId still opens this project.
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text().catch(() => '')
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return { message: '接口返回了非 JSON 内容。' } as T
  }
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PRE_PRODUCTION: '前期',
  IN_PRODUCTION: '制作中',
  POST_PRODUCTION: '后期',
  COMPLETED: '已完成',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'rgba(255,255,255,0.25)',
  PRE_PRODUCTION: '#60a5fa',
  IN_PRODUCTION: '#a78bfa',
  POST_PRODUCTION: '#f59e0b',
  COMPLETED: '#34d399',
  PUBLISHED: '#10b981',
  ARCHIVED: 'rgba(255,255,255,0.2)',
}

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status
  const color = STATUS_COLOR[status] ?? 'rgba(255,255,255,0.25)'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      color,
      border: `1px solid ${color}`,
      background: `${color}18`,
    }}>
      {label}
    </span>
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
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        color: copied ? '#34d399' : 'rgba(255,255,255,0.45)',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s',
      }}
    >
      {copied ? '已复制' : (label ?? '复制')}
    </button>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{
      flex: '1 1 120px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  )
}

function ProjectCard({ project, onPrefetch }: { project: ProjectListItem; onPrefetch: (id: string) => void }) {
  const canvasHref = `/create?projectId=${encodeURIComponent(project.id)}`
  const tasksHref = `/tasks?projectId=${encodeURIComponent(project.id)}`
  const assetsHref = `/assets?projectId=${encodeURIComponent(project.id)}`
  const detailHref = `/projects/${encodeURIComponent(project.id)}/overview`
  const lastActive = project.lastOpenedAt ?? project.updatedAt

  function handleEnterCanvas(e: React.MouseEvent) {
    e.preventDefault()
    try {
      window.localStorage.setItem('creator-city:last-project-id', project.id)
      if (project.workflowId) window.localStorage.setItem('creator-city:last-workflow-id', project.workflowId)
    } catch {
      // localStorage unavailable
    }
    window.location.href = canvasHref
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '18px 20px',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(255,255,255,0.16)'
        el.style.background = 'rgba(255,255,255,0.055)'
        onPrefetch(project.id)
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.background = 'rgba(255,255,255,0.03)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        {/* Left: main info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {project.title || 'Untitled Project'}
            </span>
            <StatusChip status={project.status} />
            {project.visibility === 'PUBLIC' ? (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 6px' }}>公开</span>
            ) : null}
          </div>
          {project.description ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, maxWidth: 480 }}>
              {project.description.slice(0, 100)}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
              {project.id}
            </span>
            <CopyButton text={project.id} label="复制 ID" />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            <span>{project.nodeCount ?? 0} 个节点</span>
            <span>{project.assetCount ?? 0} 个资产</span>
            <span>上次打开 {new Date(lastActive).toLocaleString('zh-CN')}</span>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <a
            href={detailHref}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            详情
          </a>
          <a
            href={assetsHref}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            查看资产
          </a>
          <a
            href={tasksHref}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            查看任务
          </a>
          <button
            type="button"
            onClick={handleEnterCanvas}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            进入画布 →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const { status: authStatus } = useCurrentUser()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [message, setMessage] = useState('')
  const hasVisibleProjectsRef = useRef(false)

  // No initial render from localStorage cache — the cache key is not user-scoped,
  // so pre-populating would show the previous user's projects after account switch.
  // The API fetch (below) always replaces the state on load.

  const handlePrefetch = useCallback((projectId: string) => {
    router.prefetch(`/create?projectId=${encodeURIComponent(projectId)}`)
  }, [router])

  useEffect(() => {
    for (const project of projects.slice(0, 6)) {
      router.prefetch(`/create?projectId=${encodeURIComponent(project.id)}`)
    }
  }, [projects, router])

  useEffect(() => {
    if (authStatus === 'loading') return
    if (authStatus === 'unauthenticated') {
      router.replace('/auth/login?next=/projects')
      return
    }

    let cancelled = false
    async function loadProjects() {
      if (!hasVisibleProjectsRef.current) setLoading(true)
      setMessage('')
      try {
        const response = await fetch('/api/projects?limit=50&sort=lastOpenedAt&scope=owned', {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await readJson<{ projects?: ProjectListItem[]; message?: string }>(response)
        if (response.status === 401) {
          router.replace('/auth/login?next=/projects')
          return
        }
        if (!response.ok) throw new Error(data.message ?? '加载项目失败。')
        if (!cancelled) {
          const nextProjects = data.projects ?? []
          hasVisibleProjectsRef.current = nextProjects.length > 0
          setProjects(nextProjects)
          writeProjectsCache(nextProjects)
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '加载项目失败。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProjects()
    return () => { cancelled = true }
  }, [authStatus, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setNewProjectOpen(true)
    }
  }, [])

  const total = projects.length
  const draftCount = projects.filter((p) => p.status === 'DRAFT').length
  const inProductionCount = projects.filter((p) => p.status === 'IN_PRODUCTION').length
  const completedCount = projects.filter((p) => p.status === 'COMPLETED').length

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 60,
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
      }}>
        <a href="/create" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', whiteSpace: 'nowrap' }}>← 返回画布</a>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>项目中心</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#000',
            background: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + 新建项目
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="全部项目" value={total} />
          <StatCard label="草稿" value={draftCount} />
          <StatCard label="制作中" value={inProductionCount} />
          <StatCard label="已完成" value={completedCount} />
        </div>

        {/* Error */}
        {message ? (
          <div style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
            color: '#fbbf24',
            fontSize: 13,
            marginBottom: 20,
          }}>
            {message}
          </div>
        ) : null}

        {/* Syncing */}
        {loading && projects.length > 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>正在同步项目列表...</div>
        ) : null}

        {/* Loading state */}
        {loading && projects.length === 0 ? (
          <div style={{
            padding: '60px 24px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
          }}>
            加载项目中...
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            padding: '60px 24px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>还没有项目</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              创建第一个项目后，画布节点、连线和生成结果会随项目保存。
            </div>
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              style={{
                marginTop: 20,
                padding: '8px 20px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                color: '#000',
                background: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              新建项目
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onPrefetch={handlePrefetch} />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        source="projects"
      />
    </div>
  )
}
