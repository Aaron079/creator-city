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
      <header style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px', background: 'rgba(8,8,20,0.98)', borderBottom: '1px solid rgba(124,58,237,0.18)', flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <a href="/projects" style={{ color: '#4b5563', textDecoration: 'none', fontSize: 12, whiteSpace: 'nowrap' }}>← 返回</a>
          <span style={{ color: '#1e1b4b', fontSize: 16, lineHeight: 1 }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>Canvas V2</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, color: '#c4b5fd', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Beta</span>
          {projectId ? (
            <span style={{ fontSize: 11, color: '#6ee7b7', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>#{shortProjectId}</span>
          ) : (
            <span style={{ fontSize: 11, color: '#f59e0b', whiteSpace: 'nowrap' }}>未关联项目</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!projectId && <CanvasV2ProjectActions />}
          {userEmail ? (
            <span style={{ fontSize: 11, color: '#4b5563', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
          ) : (
            <a href="/auth/login" style={{ fontSize: 11, color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>登录</a>
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
