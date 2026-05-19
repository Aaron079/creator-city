import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth/current-user'
import { CanvasV2Workspace } from '@/components/create-v2/CanvasV2Workspace'
import { CanvasV2ProjectActions } from '@/components/create-v2/CanvasV2ProjectActions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PageProps {
  searchParams: Promise<{ projectId?: string; workflowId?: string }> | { projectId?: string; workflowId?: string }
}

export default async function CreateV2Page({ searchParams }: PageProps) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const projectId = typeof params.projectId === 'string' && params.projectId ? params.projectId.trim() : undefined
  const workflowId = typeof params.workflowId === 'string' && params.workflowId ? params.workflowId.trim() : undefined
  const shortProjectId = projectId ? `${projectId.slice(0, 8)}…` : ''

  let userEmail: string | null = null
  try {
    const user = await getCurrentUser()
    userEmail = user?.email ?? null
  } catch { /* anonymous OK */ }

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#080814', overflow: 'hidden' }}>
      <header style={{ minHeight: projectId ? 52 : 76, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, padding: '10px 20px', background: 'rgba(8,8,20,0.98)', borderBottom: '1px solid rgba(124,58,237,0.2)', flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <a href={`/create${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: 13 }}>
            ← 返回旧画布
          </a>
          <span style={{ color: '#1e1b4b' }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Creator City</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: 'linear-gradient(90deg,#7c3aed,#4f46e5)', borderRadius: 10, color: '#fff', letterSpacing: 0.5 }}>Canvas V2 Beta</span>
          {projectId ? (
            <span style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 700 }}>已关联项目：{shortProjectId}</span>
          ) : (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, color: '#fcd34d', fontWeight: 800 }}>临时画布 · 未关联项目</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>请先选择或创建项目后再生成</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!projectId && <CanvasV2ProjectActions />}
          {userEmail ? (
            <span style={{ fontSize: 12, color: '#6b7280' }}>{userEmail}</span>
          ) : (
            <a href="/auth/login" style={{ fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>登录</a>
          )}
        </div>
      </header>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: 14 }}>正在加载画布…</div>}>
          <CanvasV2Workspace projectId={projectId} workflowId={workflowId} />
        </Suspense>
      </div>
    </div>
  )
}
