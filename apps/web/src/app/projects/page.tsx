'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
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
  ownerRole?: string | null
  membershipRole?: string | null
}

function readProjectsCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROJECTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { projects?: ProjectListItem[] }
    return Array.isArray(parsed.projects) ? parsed.projects : null
  } catch {
    return null
  }
}

function writeProjectsCache(projects: ProjectListItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({
      projects,
      updatedAt: new Date().toISOString(),
    }))
  } catch {
    // Project list cache is only used to keep navigation responsive.
  }
}

export default function ProjectsPage() {
  const router = useRouter()
  const { status: authStatus } = useCurrentUser()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [message, setMessage] = useState('')
  const hasVisibleProjectsRef = useRef(false)

  useEffect(() => {
    const cachedProjects = readProjectsCache()
    if (cachedProjects?.length) {
      hasVisibleProjectsRef.current = true
      setProjects(cachedProjects)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    for (const project of projects.slice(0, 6)) {
      router.prefetch(`/projects/${encodeURIComponent(project.id)}`)
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
        const response = await fetch('/api/projects?scope=owned', {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({})) as { projects?: ProjectListItem[]; message?: string; errorCode?: string }
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
    return () => {
      cancelled = true
    }
  }, [authStatus, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setNewProjectOpen(true)
    }
  }, [])

  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="mt-1 text-sm text-white/45">真实保存的 Creator City 项目和画布工作流。</p>
          </div>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
          >
            新建项目
          </button>
        </div>

        {message ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {message}
          </div>
        ) : null}

        {loading && projects.length > 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
            正在同步项目列表...
          </div>
        ) : null}

        {loading && projects.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/45">
            加载项目中...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-12 text-center">
            <div className="text-base font-semibold text-white">还没有项目</div>
            <p className="mt-2 text-sm text-white/45">创建第一个项目后，画布节点、连线和生成结果会随项目保存。</p>
            <button
              type="button"
              onClick={() => setNewProjectOpen(true)}
              className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              新建项目
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${encodeURIComponent(project.id)}`}
                onPointerEnter={() => {
                  router.prefetch(`/projects/${encodeURIComponent(project.id)}`)
                }}
                onFocus={() => {
                  router.prefetch(`/projects/${encodeURIComponent(project.id)}`)
                }}
                onClick={() => {
                  try {
                    window.localStorage.setItem('creator-city:last-project-id', project.id)
                    if (project.workflowId) window.localStorage.setItem('creator-city:last-workflow-id', project.workflowId)
                  } catch {
                    // localStorage unavailable; explicit projectId still opens this project.
                  }
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">{project.title || 'Untitled Project'}</div>
                    <div className="mt-1 text-xs text-white/40">
                      {project.description || 'Main Canvas'} · {project.visibility} · {project.status} · {project.nodeCount ?? 0} nodes · {project.ownerRole ?? project.membershipRole ?? 'MEMBER'}
                    </div>
                  </div>
                  <div className="text-xs text-white/40">
                    {new Date(project.lastOpenedAt ?? project.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          source="projects"
        />
      </div>
    </DashboardShell>
  )
}
