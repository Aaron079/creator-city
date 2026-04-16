'use client'

interface Props { projectId: string }

const PHASES = [
  { id: 'dev',    label: '开发',   pct: 100, color: 'bg-city-emerald' },
  { id: 'pre',    label: '前期',   pct: 100, color: 'bg-city-emerald' },
  { id: 'prod',   label: '制作',   pct: 65,  color: 'bg-city-accent' },
  { id: 'post',   label: '后期',   pct: 0,   color: 'bg-city-border' },
  { id: 'release',label: '发行',   pct: 0,   color: 'bg-city-border' },
]

const EVENTS = [
  { id: 'e1', time: '04-10', label: '剧本终稿交付',  done: true  },
  { id: 'e2', time: '04-12', label: '主演选角完成',  done: true  },
  { id: 'e3', time: '04-15', label: '场景 2 开拍',   done: false, active: true },
  { id: 'e4', time: '04-22', label: '粗剪完成',      done: false },
  { id: 'e5', time: '05-01', label: '公映上线',      done: false },
]

export function ProjectTimeline({ projectId: _ }: Props) {
  return (
    <div className="city-card">
      <h2 className="text-base font-semibold mb-4">时间线</h2>

      {/* Phase bars */}
      <div className="flex gap-1 mb-5 h-2 rounded-full overflow-hidden">
        {PHASES.map((p) => (
          <div key={p.id} className="flex-1 bg-city-border rounded-full overflow-hidden" title={p.label}>
            <div className={`h-full ${p.color} transition-all duration-700`} style={{ width: `${p.pct}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mb-5">
        {PHASES.map((p) => (
          <div key={p.id} className="flex-1 text-center text-xs text-gray-500">{p.label}</div>
        ))}
      </div>

      {/* Event list */}
      <div className="relative pl-4">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-city-border" />
        <div className="space-y-3">
          {EVENTS.map((e) => (
            <div key={e.id} className="relative flex items-start gap-3">
              <div
                className={`absolute -left-[14px] top-1 w-3 h-3 rounded-full border-2 flex-shrink-0
                  ${e.done    ? 'bg-city-emerald border-city-emerald'
                  : e.active  ? 'bg-city-accent border-city-accent-glow animate-pulse'
                  :             'bg-city-bg border-city-border'}`}
              />
              <span className="text-xs text-gray-600 w-12 flex-shrink-0">{e.time}</span>
              <span className={`text-xs ${e.active ? 'text-city-accent-glow font-medium' : e.done ? 'text-gray-400 line-through' : 'text-gray-300'}`}>
                {e.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
