'use client'

interface Props { projectId: string }

const MOCK_MEMBERS = [
  { id: 'u1', name: 'NeonDirector', avatar: '🎭', color: 'bg-rose-500' },
  { id: 'u2', name: 'SynthWave',    avatar: '🎵', color: 'bg-city-sky' },
  { id: 'u3', name: 'PixelForge',   avatar: '✏️', color: 'bg-city-emerald' },
]

export function ProjectPresence({ projectId: _ }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* Online avatars */}
      <div className="flex -space-x-2">
        {MOCK_MEMBERS.map((m) => (
          <div
            key={m.id}
            title={m.name}
            className={`w-8 h-8 rounded-full border-2 border-city-bg ${m.color} flex items-center justify-center text-sm cursor-default`}
          >
            {m.avatar}
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-400">
        <span className="text-city-emerald font-medium">{MOCK_MEMBERS.length}</span> 人在线
      </span>

      {/* Invite */}
      <button className="text-xs px-2.5 py-1 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">
        邀请协作
      </button>
    </div>
  )
}
