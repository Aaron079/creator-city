'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectItem {
  id: string
  title: string
  status: string
  workflowId?: string | null
  nodeCount?: number
  assetCount?: number
  lastOpenedAt?: string | null
  updatedAt: string
}

interface AssetItem {
  id: string
  type: string
  url?: string | null
  resolvedUrl?: string | null
  thumbnailUrl?: string | null
  prompt?: string | null
  providerId?: string | null
  createdAt: string
}

interface TaskItem {
  id: string
  type: string
  status: string
  promptPreview?: string | null
  providerId?: string | null
  errorCode?: string | null
  createdAt: string
}

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text().catch(() => '')
  if (!raw) return {} as T
  try { return JSON.parse(raw) as T } catch { return {} as T }
}

// ─── Mini-components ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', PRE_PRODUCTION: '前期', IN_PRODUCTION: '制作中',
  POST_PRODUCTION: '后期', COMPLETED: '已完成', PUBLISHED: '已发布', ARCHIVED: '已归档',
}
const STATUS_COLOR: Record<string, string> = {
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
      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      color, border: `1px solid ${color}`, background: `${color}18`,
    }}>
      {label}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

// ─── Navigation (grouped) ─────────────────────────────────────────────────────

function TopNav({ onNewProject }: { onNewProject: () => void }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const groups = [
    {
      id: 'create',
      label: '创作',
      items: [
        { label: '工作台', href: '/dashboard' },
        { label: '创作画布', href: '/create' },
        { label: '新建项目', href: null, onClick: onNewProject },
      ],
    },
    {
      id: 'manage',
      label: '管理',
      items: [
        { label: '项目中心', href: '/projects' },
        { label: '资产中心', href: '/assets' },
        { label: '生成任务', href: '/tasks' },
      ],
    },
    {
      id: 'system',
      label: '系统',
      items: [
        { label: 'API 中心', href: '/providers' },
      ],
    },
  ]

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 56, background: 'rgba(10,10,15,0.9)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 4,
    }}
      onMouseLeave={() => setOpenGroup(null)}
    >
      {/* Logo / brand */}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginRight: 16, letterSpacing: '-0.02em' }}>
        Creator City
      </span>

      {/* Groups */}
      {groups.map((group) => (
        <div key={group.id} style={{ position: 'relative' }}>
          <button
            type="button"
            onMouseEnter={() => setOpenGroup(group.id)}
            onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              color: openGroup === group.id ? '#fff' : 'rgba(255,255,255,0.6)',
              background: openGroup === group.id ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {group.label}
            <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
          </button>

          {openGroup === group.id ? (
            <div style={{
              position: 'absolute', top: '100%', left: 0,
              marginTop: 4, minWidth: 140,
              background: 'rgba(18,18,26,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '4px 0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 200,
            }}>
              {group.items.map((item) => (
                item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    style={{
                      display: 'block', padding: '8px 14px',
                      fontSize: 13, color: 'rgba(255,255,255,0.8)',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => { item.onClick?.(); setOpenGroup(null) }}
                    style={{
                      display: 'block', width: '100%', padding: '8px 14px',
                      fontSize: 13, color: 'rgba(255,255,255,0.8)',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    {item.label}
                  </button>
                )
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* Primary CTA */}
      <a
        href="/create"
        style={{
          padding: '6px 16px', borderRadius: 6,
          fontSize: 13, fontWeight: 600,
          color: '#000', background: '#fff',
          textDecoration: 'none',
        }}
      >
        进入创作画布
      </a>
    </div>
  )
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

interface OverviewCardProps {
  title: string
  lines: Array<{ label: string; value: string | number; accent?: boolean }>
  href: string
  cta: string
  loading: boolean
}

function OverviewCard({ title, lines, href, cta, loading }: OverviewCardProps) {
  return (
    <div style={{
      flex: '1 1 200px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      minHeight: 140,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>加载中...</div>
        ) : (
          lines.map((line) => (
            <div key={line.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{line.label}</span>
              <span style={{ fontSize: line.accent ? 22 : 14, fontWeight: line.accent ? 700 : 500, color: line.accent ? '#fff' : 'rgba(255,255,255,0.7)' }}>
                {line.value}
              </span>
            </div>
          ))
        )}
      </div>
      <a
        href={href}
        style={{
          fontSize: 12, fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          textDecoration: 'none',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 10,
          display: 'block',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)' }}
      >
        {cta} →
      </a>
    </div>
  )
}

// ─── Recent projects ──────────────────────────────────────────────────────────

function RecentProjects({ projects, loading }: { projects: ProjectItem[]; loading: boolean }) {
  return (
    <div style={{ flex: '1 1 360px', minWidth: 0 }}>
      <SectionLabel>最近项目</SectionLabel>
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>加载中...</div>
      ) : projects.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>暂无项目</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {projects.slice(0, 5).map((p) => (
            <div key={p.id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title || 'Untitled'}
                </span>
                <Chip label={STATUS_LABEL[p.status] ?? p.status} color={STATUS_COLOR[p.status] ?? 'rgba(255,255,255,0.3)'} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                {p.nodeCount ?? 0} 节点 · {p.assetCount ?? 0} 资产 · {new Date(p.lastOpenedAt ?? p.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={`/create?projectId=${encodeURIComponent(p.id)}`} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>进入画布</a>
                <a href={`/assets?projectId=${encodeURIComponent(p.id)}`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>资产</a>
                <a href={`/tasks?projectId=${encodeURIComponent(p.id)}`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', padding: '3px 8px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>任务</a>
              </div>
            </div>
          ))}
        </div>
      )}
      <a href="/projects" style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
        查看全部项目 →
      </a>
    </div>
  )
}

// ─── Recent assets ────────────────────────────────────────────────────────────

function bestUrl(a: AssetItem) { return a.resolvedUrl ?? a.url ?? null }

function RecentAssets({ assets, loading }: { assets: AssetItem[]; loading: boolean }) {
  return (
    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
      <SectionLabel>最近资产</SectionLabel>
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>加载中...</div>
      ) : assets.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>暂无资产</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
          {assets.slice(0, 8).map((a) => {
            const url = bestUrl(a)
            return (
              <div key={a.id} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 6, overflow: 'hidden',
                aspectRatio: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {a.type === 'VIDEO' ? (
                  url ? (
                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline preload="none" />
                  ) : (
                    <span style={{ fontSize: 20 }}>🎬</span>
                  )
                ) : url ? (
                  <img src={url} alt={a.prompt?.slice(0, 30) ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                ) : (
                  <span style={{ fontSize: 20 }}>🖼️</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      <a href="/assets" style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
        查看资产中心 →
      </a>
    </div>
  )
}

// ─── Recent tasks ─────────────────────────────────────────────────────────────

function RecentTasks({ tasks, loading }: { tasks: TaskItem[]; loading: boolean }) {
  if (loading) return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>加载中...</div>
  if (tasks.length === 0) return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>暂无任务</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tasks.slice(0, 5).map((t) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
        }}>
          <Chip label={t.type} color="rgba(255,255,255,0.4)" />
          <Chip
            label={TASK_STATUS_LABEL[t.status] ?? t.status}
            color={TASK_STATUS_COLOR[t.status] ?? 'rgba(255,255,255,0.3)'}
          />
          <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.promptPreview ?? '(无提示词)'}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
            {t.providerId ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Provider status card ─────────────────────────────────────────────────────

function ProviderStatusCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: 10 }}>
        API 状态
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[
          { name: 'Seedream Image', desc: '图片生成' },
          { name: 'Seedance Video', desc: '视频生成' },
          { name: 'Jimeng Image', desc: '图片生成' },
          { name: 'Jimeng Video', desc: '视频生成' },
        ].map((p) => (
          <span key={p.name} style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
          }}>
            {p.name}
          </span>
        ))}
      </div>
      <a href="/providers" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
        查看 API 中心 →
      </a>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { status: authStatus } = useCurrentUser()
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)

  // Auth guard
  useEffect(() => {
    if (authStatus === 'loading') return
    if (authStatus === 'unauthenticated') {
      router.replace('/auth/login?next=/dashboard')
    }
  }, [authStatus, router])

  // Fetch data — GET only, no POST
  const fetchAll = useCallback(() => {
    // Projects
    fetch('/api/projects?limit=10&sort=lastOpenedAt&scope=owned', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => readJson<{ projects?: ProjectItem[] }>(r))
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))

    // Assets
    fetch('/api/assets?limit=8', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => readJson<{ assets?: AssetItem[] }>(r))
      .then((d) => setAssets(d.assets ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false))

    // Tasks
    fetch('/api/generation-tasks?limit=10', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => readJson<{ tasks?: TaskItem[] }>(r))
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoadingTasks(false))
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') fetchAll()
  }, [authStatus, fetchAll])

  // Derived stats
  const totalProjects = projects.length
  const totalAssets = assets.length
  const imageAssets = assets.filter((a) => a.type === 'IMAGE').length
  const videoAssets = assets.filter((a) => a.type === 'VIDEO').length
  const runningTasks = tasks.filter((t) => t.status === 'running' || t.status === 'queued').length
  const succeededTasks = tasks.filter((t) => t.status === 'succeeded').length
  const failedTasks = tasks.filter((t) => t.status === 'failed').length

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <TopNav onNewProject={() => setNewProjectOpen(true)} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>
            Creator City
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            创作者工作台
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', maxWidth: 440 }}>
            从项目、资产、任务和 API 状态进入你的创作流程
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <a
              href="/create"
              style={{
                padding: '10px 22px', borderRadius: 8,
                fontSize: 14, fontWeight: 700,
                color: '#000', background: '#fff',
                textDecoration: 'none',
              }}
            >
              进入创作画布 →
            </a>
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              style={{
                padding: '10px 18px', borderRadius: 8,
                fontSize: 14, fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer',
              }}
            >
              + 新建项目
            </button>
          </div>
        </div>

        {/* Overview cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
          <OverviewCard
            title="项目中心"
            lines={[
              { label: '全部项目', value: totalProjects, accent: true },
              { label: '制作中', value: projects.filter((p) => p.status === 'IN_PRODUCTION').length },
              { label: '已完成', value: projects.filter((p) => p.status === 'COMPLETED').length },
            ]}
            href="/projects"
            cta="查看项目中心"
            loading={loadingProjects}
          />
          <OverviewCard
            title="资产中心"
            lines={[
              { label: '全部资产', value: totalAssets, accent: true },
              { label: '图片', value: imageAssets },
              { label: '视频', value: videoAssets },
            ]}
            href="/assets"
            cta="查看资产中心"
            loading={loadingAssets}
          />
          <OverviewCard
            title="生成任务"
            lines={[
              { label: '进行中', value: runningTasks, accent: true },
              { label: '已完成', value: succeededTasks },
              { label: '失败', value: failedTasks },
            ]}
            href="/tasks"
            cta="查看任务中心"
            loading={loadingTasks}
          />
          <OverviewCard
            title="API 中心"
            lines={[
              { label: 'Provider', value: '4 个', accent: true },
              { label: '查看配置状态', value: '→' },
            ]}
            href="/providers"
            cta="查看 API 中心"
            loading={false}
          />
        </div>

        {/* Recent projects + assets */}
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 40 }}>
          <RecentProjects projects={projects} loading={loadingProjects} />
          <RecentAssets assets={assets} loading={loadingAssets} />
        </div>

        {/* Recent tasks */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>最近生成任务</SectionLabel>
          <RecentTasks tasks={tasks} loading={loadingTasks} />
          <a href="/tasks" style={{ display: 'block', marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            查看全部任务 →
          </a>
        </div>

        {/* Provider status */}
        <ProviderStatusCard />

        {/* Footer spacer */}
        <div style={{ height: 48 }} />
      </div>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} source="dashboard" />
    </div>
  )
}
