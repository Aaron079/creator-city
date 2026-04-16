'use client'

interface Props { projectId: string }

const MOCK_AGENTS = [
  { id: 'a1', name: 'Ada',  role: '编剧', icon: '📝', status: 'WORKING', task: '第二幕对白修订' },
  { id: 'a2', name: 'Max',  role: '导演', icon: '🎬', status: 'WORKING', task: '场景 2 分镜生成' },
  { id: 'a3', name: 'Luna', role: '作曲', icon: '🎵', status: 'IDLE',    task: null },
]

const dot: Record<string, string> = {
  WORKING: 'bg-city-emerald animate-pulse',
  IDLE:    'bg-gray-600',
  ERROR:   'bg-city-rose',
}

export function ProjectAgentStatus({ projectId: _ }: Props) {
  return (
    <div className="city-card">
      <h3 className="text-sm font-semibold mb-3">Agent 状态</h3>
      <div className="space-y-2">
        {MOCK_AGENTS.map((a) => (
          <div key={a.id} className="flex items-start gap-2">
            <span className="text-base flex-shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{a.name}</span>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot[a.status]}`} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {a.task ?? '空闲中'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
