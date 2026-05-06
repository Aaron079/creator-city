'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type ProjectType = 'blank' | 'text' | 'image' | 'video' | 'template'
type ProjectSource = 'projects' | 'home' | 'dashboard' | 'create'

const PROJECT_TYPES: Array<{ value: ProjectType; label: string; hint: string }> = [
  { value: 'blank', label: '空白画布', hint: '从一个干净的新画布开始。' },
  { value: 'text', label: '文本创作', hint: '先写 brief、脚本或结构。' },
  { value: 'image', label: '图片创作', hint: '先做视觉方向和关键帧。' },
  { value: 'video', label: '视频创作', hint: '直接推进镜头和运动。' },
  { value: 'template', label: '从模板开始', hint: '创建项目后再选择模板流程。' },
]

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: ProjectSource
  beforeCreate?: () => boolean
}

export function NewProjectDialog({
  open,
  onOpenChange,
  source: _source,
  beforeCreate,
}: NewProjectDialogProps) {
  const router = useRouter()
  const creatingRef = useRef(false)
  const createAbortRef = useRef<AbortController | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectType, setProjectType] = useState<ProjectType>('blank')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')

  if (!open) return null

  function navigateToProject(projectId: string, workflowId?: string | null, redirectTo?: string) {
    try {
      const oldProjectId = window.localStorage.getItem('creator-city:last-project-id')
      window.localStorage.setItem('creator-city:last-project-id', projectId)
      if (workflowId) {
        const now = new Date().toISOString()
        window.localStorage.setItem('creator-city:last-workflow-id', workflowId)
        window.localStorage.setItem(`creator-city:canvas-cache:${projectId}`, JSON.stringify({
          projectId,
          workflowId,
          nodes: [],
          edges: [],
          viewport: { zoom: 1, pan: { x: 0, y: 0 } },
          updatedAt: now,
          syncedAt: now,
          serverUpdatedAt: now,
        }))
        window.localStorage.removeItem(`creator-city:draft:${projectId}`)
      }
      if (oldProjectId && oldProjectId !== projectId) {
        window.localStorage.removeItem(`creator-city:draft:${oldProjectId}`)
      }
    } catch {
      // storage might be blocked in incognito; explicit URL still opens the project.
    }

    const dest = redirectTo ?? `/create?projectId=${encodeURIComponent(projectId)}`
    onOpenChange(false)
    router.push(dest)

    // Fallback: if router.push doesn't navigate within 1 s, hard redirect.
    window.setTimeout(() => {
      try {
        if (`${window.location.pathname}${window.location.search}` !== dest) {
          window.location.href = dest
        }
      } catch {
        // ignore
      }
    }, 1000)
  }

  async function createProject() {
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setMessage('')

    let navigating = false
    const controller = new AbortController()
    createAbortRef.current = controller
    const slowTimer = window.setTimeout(() => {
      setMessage('正在创建，服务器较慢...')
    }, 15_000)

    try {
      window.dispatchEvent(new CustomEvent('creator-city:switching-project'))

      if (beforeCreate) {
        const shouldContinue = beforeCreate()
        if (!shouldContinue) {
          window.dispatchEvent(new CustomEvent('creator-city:switching-project-cancelled'))
          return
        }
      }

      let response: Response
      try {
        response = await fetch('/api/projects/new', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({
            title: title.trim() || undefined,
            description: description.trim() || undefined,
            projectType,
            source: 'new-project-dialog',
          }),
        })
      } catch (fetchErr) {
        if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
          throw new Error('创建已取消。')
        }
        throw new Error(`网络异常：${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`)
      }

      const raw = await response.text()
      let data: {
        success?: boolean
        project?: { id: string }
        workflow?: { id: string }
        redirectTo?: string
        message?: string
        errorCode?: string
      } = {}
      try {
        data = raw ? JSON.parse(raw) as typeof data : {}
      } catch {
        // Non-JSON body — surface the raw response for debugging
        throw new Error(`服务器返回非 JSON（HTTP ${response.status}）：${raw.slice(0, 200)}`)
      }

      if (response.status === 401) {
        router.push(`/auth/login?next=${encodeURIComponent('/projects?new=1')}`)
        return
      }

      if (!response.ok || !data.project?.id) {
        const errCode = data.errorCode ? `[${data.errorCode}] ` : ''
        throw new Error(`${errCode}${data.message ?? `创建项目失败（HTTP ${response.status}）`}`)
      }

      navigating = true
      navigateToProject(data.project.id, data.workflow?.id, data.redirectTo)
    } catch (error) {
      window.dispatchEvent(new CustomEvent('creator-city:switching-project-cancelled'))
      setMessage(error instanceof Error ? error.message : '创建项目失败。')
    } finally {
      window.clearTimeout(slowTimer)
      if (createAbortRef.current === controller) createAbortRef.current = null
      creatingRef.current = false
      if (!navigating) setCreating(false)
    }
  }

  function cancelCreateProject() {
    if (creating) {
      createAbortRef.current?.abort()
      return
    }
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b101a]/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">New Project</div>
            <h2 className="mt-2 text-xl font-semibold text-white">新建项目</h2>
          </div>
          <button
            type="button"
            onClick={cancelCreateProject}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            取消
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs text-white/50">项目标题</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled Project"
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </label>

          <div>
            <div className="text-xs text-white/50">项目类型</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PROJECT_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setProjectType(item.value)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    projectType === item.value
                      ? 'border-white/30 bg-white/[0.1]'
                      : 'border-white/10 bg-white/[0.035] hover:border-white/20'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-white/42">{item.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-white/50">描述（可选）</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="记录项目目标、风格或客户 brief。"
              className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </label>

          {message ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {message}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelCreateProject}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => { void createProject() }}
              disabled={creating}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? '正在创建...' : '创建项目'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
