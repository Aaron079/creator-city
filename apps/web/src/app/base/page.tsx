'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { BaseOverview } from '@/components/base/BaseOverview'
import { BuildingList } from '@/components/base/BuildingList'
import { BaseAgentTeam } from '@/components/base/BaseAgentTeam'
import { BaseProjectPreview } from '@/components/base/BaseProjectPreview'

export default function BasePage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <DashboardShell>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">我的基地</h1>
          <p className="text-gray-400 mt-1 text-sm">管理你的建筑、Agent 团队与进行中的项目</p>
        </div>

        {/* 基地总览 */}
        <BaseOverview />

        {/* 建筑 + Agent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <BuildingList />
          </div>
          <div>
            <BaseAgentTeam />
          </div>
        </div>

        {/* 当前项目 */}
        <BaseProjectPreview />
      </div>
    </DashboardShell>
  )
}
