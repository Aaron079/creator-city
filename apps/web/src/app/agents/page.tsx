'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { AgentList } from '@/components/agent/AgentList'

export default function AgentsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Agents</h1>
          <p className="text-gray-400 mt-1">Your team of AI creative workers.</p>
        </div>
        <AgentList />
      </div>
    </DashboardShell>
  )
}
