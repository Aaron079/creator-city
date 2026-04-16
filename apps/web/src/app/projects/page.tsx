'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { ProjectGrid } from '@/components/project/ProjectGrid'

export default function ProjectsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-gray-400 mt-1">Your productions and collaborations.</p>
          </div>
        </div>
        <ProjectGrid showCreateButton />
      </div>
    </DashboardShell>
  )
}
