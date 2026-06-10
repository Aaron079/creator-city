'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  displayName?: string | null
  username?: string | null
  bio?: string | null
  avatarUrl?: string | null
  city?: string | null
  company?: string | null
  websiteUrl?: string | null
}

interface MeStats {
  assets: {
    total: number
    image: number
    video: number
    audio: number
    public: number
    private: number
    ready: number
  }
  licenseIntent: Record<string, number>
  projects: { total: number }
}

interface MiniAsset {
  id: string
  title?: string | null
  name: string
  type: string
  isPublic?: boolean | null
  resolvedUrl?: string | null
  thumbnailUrl?: string | null
  url?: string | null
  metadataJson?: unknown
  createdAt: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MePage() {
  const router = useRouter()
  const authUser = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [projectSummary, setProjectSummary] = useState({
    ownedProjectsCount: 0,
    loading: true,
    currentProjectId: null as string | null,
    recentProjectTitle: null as string | null,
  })

  useEffect(() => {
    if (!isAuthenticated || !authUser) return
    let cancelled = false
    fetch('/api/projects', { credentials: 'include' })
      .then(
        (r) =>
          r.json() as Promise<{
            projects?: Array<{ id: string; title?: string; ownerRole?: string | null }>
            summary?: {
              ownedProjectsCount?: number
              currentProjectId?: string | null
              recentProject?: { title?: string } | null
            }
          }>,
      )
      .then((data) => {
        if (cancelled) return
        const projects = data.projects ?? []
        setProjectSummary({
          ownedProjectsCount:
            data.summary?.ownedProjectsCount ?? projects.filter((p) => p.ownerRole === 'OWNER').length,
          loading: false,
          currentProjectId: data.summary?.currentProjectId ?? projects[0]?.id ?? null,
          recentProjectTitle: data.summary?.recentProject?.title ?? projects[0]?.title ?? null,
        })
      })
      .catch(() => {
        if (!cancelled) setProjectSummary((c) => ({ ...c, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [authUser, isAuthenticated])

  async function handleEnsureProject() {
    const response = await fetch('/api/projects/ensure', { method: 'POST', credentials: 'include' })
    const data = (await response.json().catch(() => ({}))) as {
      project?: { id: string }
      workflow?: { id: string }
      message?: string
    }
    if (!response.ok || !data.project?.id) return
    try {
      window.localStorage.setItem('creator-city:last-project-id', data.project.id)
      if (data.workflow?.id) window.localStorage.setItem('creator-city:last-workflow-id', data.workflow.id)
    } catch {
      // Explicit URL still opens the project.
    }
    router.push(`/create?projectId=${encodeURIComponent(data.project.id)}`)
  }

  if (!isAuthenticated || !authUser) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white">欢迎来到 Creator City</h1>
            <p className="mt-2 text-sm text-white/50">请登录或注册以访问你的工作台。</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-2.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
            >
              登录
            </Link>
            <Link
              href="/auth/register"
              className="rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 px-6 py-2.5 text-sm text-white font-medium transition"
            >
              注册
            </Link>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-6 px-4">
        <PassportCard authUser={authUser} projectSummary={projectSummary} onEnsureProject={handleEnsureProject} />
        <StatsCard />
        <MyAssetsBlock />
      </div>
    </DashboardShell>
  )
}

// ─── Passport Card ────────────────────────────────────────────────────────────

interface AuthUser {
  id: string
  email: string
  displayName: string
  role: string
}

function PassportCard({
  authUser,
  projectSummary,
  onEnsureProject,
}: {
  authUser: AuthUser
  projectSummary: {
    ownedProjectsCount: number
    loading: boolean
    recentProjectTitle: string | null
  }
  onEnsureProject: () => Promise<void>
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/user/profile', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ profile?: UserProfile }>)
      .then((data) => {
        if (!cancelled) setProfile(data.profile ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = profile?.displayName ?? authUser.displayName
  const bio = profile?.bio
  const city = profile?.city
  const company = profile?.company
  const websiteUrl = profile?.websiteUrl
  const avatarUrl = profile?.avatarUrl

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">Creator Passport</p>

      <div className="mt-4 flex items-start gap-4">
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-white/30">🎬</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white truncate">{displayName}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">
              {authUser.role}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-white/40 truncate">{authUser.email}</p>
          {!loadingProfile && bio && <p className="mt-2 text-xs text-white/50 line-clamp-2">{bio}</p>}
          {!loadingProfile && (city || company) && (
            <p className="mt-1 text-xs text-white/35">{[company, city].filter(Boolean).join(' · ')}</p>
          )}
          {!loadingProfile && websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-white/35 hover:text-white/60 transition truncate block"
            >
              {websiteUrl}
            </a>
          )}
        </div>

        <Link href="/profile/edit" className="flex-shrink-0 text-xs text-white/30 hover:text-white/60 transition">
          编辑
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-[10px] text-white/40">账号 ID</div>
          <div className="mt-1 text-xs font-mono text-white/70">{authUser.id.slice(0, 10)}…</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-[10px] text-white/40">拥有项目</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {projectSummary.loading ? '…' : projectSummary.ownedProjectsCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-[10px] text-white/40">最近项目</div>
          <div className="mt-1 text-xs text-white/70 truncate">
            {projectSummary.loading ? '…' : (projectSummary.recentProjectTitle ?? '无')}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {projectSummary.ownedProjectsCount > 0 ? (
          <Link
            href="/create"
            className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85"
          >
            进入创作 →
          </Link>
        ) : !projectSummary.loading ? (
          <button
            type="button"
            onClick={() => {
              void onEnsureProject()
            }}
            className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-white/85"
          >
            创建项目
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

const LICENSE_LABELS: Record<string, string> = {
  private_only: '仅私有',
  public_showcase: '公开展示',
  reusable_noncommercial: '可复用（非商业）',
  reusable_commercial: '可复用（商业）',
  marketplace_license: '市场授权',
  unset: '未设置',
}

function StatsCard() {
  const [stats, setStats] = useState<MeStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/me/stats', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ success?: boolean } & Partial<MeStats>>)
      .then((data) => {
        if (!cancelled && data.assets && data.licenseIntent && data.projects) {
          setStats({ assets: data.assets, licenseIntent: data.licenseIntent, projects: data.projects })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">我的创作数据</p>
        <p className="mt-3 text-xs text-white/30">加载中…</p>
      </div>
    )
  }

  if (!stats) return null

  const rows = [
    { label: '总素材', value: stats.assets.total },
    { label: '图片', value: stats.assets.image },
    { label: '视频', value: stats.assets.video },
    { label: '项目', value: stats.projects.total },
    { label: '公开素材', value: stats.assets.public },
    { label: '私有素材', value: stats.assets.private },
  ]

  const licenseRows = Object.entries(stats.licenseIntent).filter(([, v]) => v > 0)

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">我的创作数据 · 真实统计</p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
            <div className="text-lg font-bold text-white">{row.value}</div>
            <div className="mt-0.5 text-[10px] text-white/40">{row.label}</div>
          </div>
        ))}
      </div>
      {licenseRows.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-2">授权分布</p>
          <div className="flex flex-wrap gap-2">
            {licenseRows.map(([mode, count]) => (
              <span
                key={mode}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/50"
              >
                {LICENSE_LABELS[mode] ?? mode} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── License badge helper ─────────────────────────────────────────────────────

function LicenseBadge({ metadataJson, isPublic }: { metadataJson?: unknown; isPublic?: boolean | null }) {
  const li =
    metadataJson && typeof metadataJson === 'object'
      ? (metadataJson as Record<string, unknown>).licenseIntent
      : null
  const mode =
    li && typeof li === 'object' ? ((li as Record<string, unknown>).mode as string | undefined) : undefined

  const BADGE_MAP: Record<string, { icon: string; bg: string; color: string }> = {
    private_only: { icon: '🔒', bg: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.4)' },
    public_showcase: { icon: '🌐', bg: 'rgba(52,211,153,0.2)', color: '#6ee7b7' },
    reusable_noncommercial: { icon: '🔄', bg: 'rgba(96,165,250,0.2)', color: '#93c5fd' },
    reusable_commercial: { icon: '💼', bg: 'rgba(251,146,60,0.2)', color: '#fdba74' },
    marketplace_license: { icon: '🏪', bg: 'rgba(167,139,250,0.2)', color: '#c4b5fd' },
  }

  const key = mode && BADGE_MAP[mode] ? mode : isPublic ? 'public_showcase' : 'private_only'
  const cfg = BADGE_MAP[key] ?? BADGE_MAP['private_only']!

  return (
    <span className="rounded px-1 py-0.5 text-[8px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon}
    </span>
  )
}

// ─── Real assets block ────────────────────────────────────────────────────────

function MyAssetsBlock() {
  const [assets, setAssets] = useState<MiniAsset[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/assets?limit=12&type=IMAGE', { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { assets?: MiniAsset[] }
      setAssets((data.assets ?? []).slice(0, 12))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return null
  if (assets.length === 0) return null

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">My Assets · 我的作品</p>
          <p className="mt-1 text-xs text-white/35">最近生成的图片资产 — 真实数据</p>
        </div>
        <Link href="/assets" className="text-xs text-white/40 hover:text-white/70 transition">
          查看全部 →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {assets.map((a) => {
          const thumb = a.resolvedUrl ?? a.thumbnailUrl ?? a.url ?? ''
          return (
            <Link
              key={a.id}
              href={`/assets/${a.id}`}
              className="group relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.03] hover:border-white/20 transition"
              style={{ aspectRatio: '1' }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt={a.title ?? a.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl opacity-20">🖼</div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition">
                <p className="truncate text-[9px] text-white/70">{a.title ?? a.name}</p>
              </div>
              <div className="absolute right-1 top-1">
                <LicenseBadge metadataJson={a.metadataJson} isPublic={a.isPublic} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
