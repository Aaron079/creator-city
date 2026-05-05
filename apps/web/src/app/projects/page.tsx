'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { NewProjectDialog } from '@/components/projects/NewProjectDialog'
import { useAuthStore } from '@/store/auth.store'

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

export default function ProjectsPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login?next=/projects')
      return
    }

    let cancelled = false
    async function loadProjects() {
      setLoading(true)
      setMessage('')
      try {
        const response = await fetch('/api/projects', { credentials: 'include' })
        const data = await response.json().catch(() => ({})) as { projects?: ProjectListItem[]; message?: string; errorCode?: string }
        if (response.status === 401) {
          router.replace('/auth/login?next=/projects')
          return
        }
        if (!response.ok) throw new Error(data.message ?? '加载项目失败。')
        if (!cancelled) setProjects(data.projects ?? [])
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
  }, [router, user])

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

        {loading ? (
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
                href={`/create?projectId=${encodeURIComponent(project.id)}`}
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
