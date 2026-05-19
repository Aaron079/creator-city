'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

type RecentProject = {
  id: string
  title?: string | null
  workflowId?: string | null
}

type Props = {
  currentProjectId?: string
  initialRecentProject?: RecentProject | null
  variant?: 'header' | 'panel'
}

type ProjectsResponse = {
  projects?: RecentProject[]
  summary?: {
    recentProject?: RecentProject | null
  }
}

type CreateProjectResponse = {
  project?: { id?: string }
  workflow?: { id?: string | null }
  errorCode?: string
  message?: string
}

function canvasV2Href(projectId: string, workflowId?: string | null) {
  const params = new URLSearchParams({ projectId })
  if (workflowId) params.set('workflowId', workflowId)
  return `/create-v2?${params.toString()}`
}

const baseButtonStyle: CSSProperties = {
  borderRadius: 8,
  border: '1px solid rgba(124,58,237,.38)',
  padding: '7px 11px',
  color: '#c4b5fd',
  background: 'rgba(124,58,237,.12)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

export function CanvasV2ProjectActions({ currentProjectId, initialRecentProject = null, variant = 'header' }: Props) {
  const [recentProject, setRecentProject] = useState<RecentProject | null>(initialRecentProject)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (currentProjectId || initialRecentProject) return

    let disposed = false
    fetch('/api/projects?limit=1&sort=lastOpenedAt', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data: ProjectsResponse | null) => {
        if (disposed || !data) return
        setRecentProject(data.summary?.recentProject ?? data.projects?.[0] ?? null)
      })
      .catch(() => undefined)

    return () => {
      disposed = true
    }
  }, [currentProjectId, initialRecentProject])

  async function createProject() {
    if (creating) return

    setCreating(true)
    setError('')
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: 'Canvas V2 Project',
          projectType: 'blank',
          source: 'canvas-v2',
        }),
      })

      if (response.status === 401) {
        window.location.href = `/auth/login?next=${encodeURIComponent('/create-v2')}`
        return
      }

      const data = await response.json().catch(() => ({})) as CreateProjectResponse
      const projectId = data.project?.id
      if (!response.ok || !projectId) {
        throw new Error(data.message ?? data.errorCode ?? '创建项目失败')
      }

      window.location.href = canvasV2Href(projectId, data.workflow?.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建项目失败')
      setCreating(false)
    }
  }

  if (currentProjectId) return null

  const gap = variant === 'panel' ? 10 : 8
  const buttonStyle: CSSProperties = {
    ...baseButtonStyle,
    padding: variant === 'panel' ? '9px 13px' : baseButtonStyle.padding,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap' }}>
      <a href="/create" style={buttonStyle}>
        返回 /create 选择项目
      </a>
      <button
        type="button"
        onClick={createProject}
        disabled={creating}
        style={{
          ...buttonStyle,
          background: creating ? 'rgba(124,58,237,.08)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          color: creating ? '#7c728b' : '#fff',
          cursor: creating ? 'not-allowed' : 'pointer',
        }}
      >
        {creating ? '正在创建…' : '创建新项目并进入 Canvas V2'}
      </button>
      {recentProject?.id && (
        <a href={canvasV2Href(recentProject.id, recentProject.workflowId)} style={buttonStyle}>
          从当前已有项目进入 Canvas V2
        </a>
      )}
      {error && (
        <span style={{ color: '#fca5a5', fontSize: 12, maxWidth: variant === 'panel' ? 360 : 220 }}>
          {error}
        </span>
      )}
    </div>
  )
}
