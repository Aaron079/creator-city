'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { StatsCards } from '@/components/city/StatsCards'
import { AgentList } from '@/components/agent/AgentList'
import { ProjectGrid } from '@/components/project/ProjectGrid'

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

  if (!user) return null

  return (
    <DashboardShell>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, <span className="text-gradient">{user.displayName}</span>
          </h1>
          <p className="text-gray-400 mt-1">Here&apos;s what&apos;s happening in your city.</p>
        </div>

        <StatsCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Active Projects</h2>
            <ProjectGrid />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4">Your Agents</h2>
            <AgentList compact />
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
