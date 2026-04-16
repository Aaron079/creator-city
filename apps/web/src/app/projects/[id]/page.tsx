'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ProjectCanvas } from '@/components/project/ProjectCanvas'
import { ProjectPresence } from '@/components/project/ProjectPresence'
import { ProjectAgentStatus } from '@/components/project/ProjectAgentStatus'
import { ProjectTimeline } from '@/components/project/ProjectTimeline'
import { ProjectAssetPanel } from '@/components/project/ProjectAssetPanel'
import { ProjectReviewQueue } from '@/components/project/ProjectReviewQueue'

export default function ProjectSpacePage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <DashboardShell>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">《暗流》短片</h1>
            <p className="text-xs text-gray-500 mt-0.5">项目 ID: {projectId}</p>
          </div>
          <ProjectPresence projectId={projectId} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Canvas — main area */}
          <div className="lg:col-span-3 space-y-4">
            <ProjectCanvas projectId={projectId} />
            <ProjectTimeline projectId={projectId} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <ProjectAgentStatus projectId={projectId} />
            <ProjectAssetPanel projectId={projectId} />
            <ProjectReviewQueue projectId={projectId} />
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
