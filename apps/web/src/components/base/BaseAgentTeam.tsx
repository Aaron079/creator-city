'use client'

import Link from 'next/link'

const MOCK_AGENTS = [
  { id: '1', name: 'Ada',    role: '编剧',   tier: 'RARE',  level: 7, status: 'WORKING', icon: '📝' },
  { id: '2', name: 'Max',    role: '导演',   tier: 'EPIC',  level: 12, status: 'IDLE',   icon: '🎬' },
  { id: '3', name: 'Luna',   role: '作曲家', tier: 'RARE',  level: 5, status: 'WORKING', icon: '🎵' },
  { id: '4', name: 'Spike',  role: 'VFX师',  tier: 'COMMON',level: 3, status: 'IDLE',   icon: '✨' },
]

const tierColor: Record<string, string> = {
  COMMON: 'text-gray-400',
  RARE:   'text-city-sky',
  EPIC:   'text-city-accent-glow',
  LEGEND: 'text-city-gold',
}

const statusDot: Record<string, string> = {
  WORKING: 'bg-city-emerald animate-pulse',
  IDLE:    'bg-gray-600',
}

export function BaseAgentTeam() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Agent 团队</h2>
        <Link href="/agents" className="text-xs text-city-accent-glow hover:underline underline-offset-2">
          全部 →
        </Link>
      </div>

      <div className="space-y-2">
        {MOCK_AGENTS.map((agent) => (
          <div key={agent.id} className="city-card flex items-center gap-3 hover:border-city-accent/30">
            <div className="text-xl w-8 flex-shrink-0 text-center">{agent.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{agent.name}</span>
                <span className={`text-xs ${tierColor[agent.tier]}`}>
                  {agent.tier}
                </span>
              </div>
              <div className="text-xs text-gray-500">{agent.role} · Lv.{agent.level}</div>
            </div>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[agent.status]}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
