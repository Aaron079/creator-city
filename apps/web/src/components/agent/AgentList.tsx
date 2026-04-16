'use client'

import { useEffect } from 'react'
import { useAgentStore } from '@/store/agent.store'
import { apiClient } from '@/lib/api-client'
import { getAgentRoleColor, getAgentStatusColor } from '@/lib/utils'

export function AgentList({ compact = false }: { compact?: boolean }) {
  const { agents, setAgents, isLoading, setLoading } = useAgentStore()

  useEffect(() => {
    setLoading(true)
    apiClient
      .get<typeof agents>('/agents')
      .then(setAgents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [setAgents, setLoading])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="city-card animate-pulse h-20 bg-city-surface/50" />
        ))}
      </div>
    )
  }

  const displayAgents = compact ? agents.slice(0, 4) : agents

  return (
    <div className="space-y-3">
      {displayAgents.length === 0 ? (
        <div className="city-card text-center py-8 text-gray-500">
          <div className="text-2xl mb-2">🤖</div>
          <p className="text-sm">No agents yet.</p>
          <p className="text-xs mt-1 text-gray-600">Hire your first AI agent to get started.</p>
        </div>
      ) : (
        displayAgents.map((agent) => (
          <div key={agent.id} className="city-card">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-city-surface border border-city-border flex items-center justify-center text-xl">
                {roleEmoji(agent.role)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="text-xs text-gray-500">Lv.{agent.level}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs ${getAgentRoleColor(agent.role)}`}>
                    {agent.role.replace('_', ' ')}
                  </span>
                  <span className="text-gray-600">·</span>
                  <span className={`text-xs ${getAgentStatusColor(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>
              </div>

              {/* Tier badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${tierStyle(agent.tier)}`}>
                {agent.tier}
              </span>
            </div>

            {/* XP bar */}
            {!compact && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>XP</span>
                  <span>{agent.experience} / {(agent.level * 1000)}</span>
                </div>
                <div className="h-1 bg-city-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-city-accent rounded-full transition-all"
                    style={{ width: `${Math.min((agent.experience / (agent.level * 1000)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function roleEmoji(role: string): string {
  const map: Record<string, string> = {
    SCRIPTWRITER: '✍️', DIRECTOR: '🎬', CINEMATOGRAPHER: '📷',
    EDITOR: '✂️', COMPOSER: '🎵', VFX_ARTIST: '✨',
    PRODUCER: '📋', MARKETER: '📣', RESEARCHER: '🔬',
  }
  return map[role] ?? '🤖'
}

function tierStyle(tier: string): string {
  const styles: Record<string, string> = {
    BASIC: 'border-gray-600 text-gray-400',
    ADVANCED: 'border-sky-500/50 text-sky-400',
    EXPERT: 'border-purple-500/50 text-purple-400',
    LEGENDARY: 'border-yellow-500/50 text-yellow-400',
  }
  return styles[tier] ?? 'border-gray-600 text-gray-400'
}
