'use client'

interface Props { projectId: string }

const MOCK_SCENES = [
  { id: 's1', label: '场景 1', title: '序幕·深夜码头',  status: 'done',       duration: '2:30' },
  { id: 's2', label: '场景 2', title: '追逐·霓虹街道',  status: 'in_progress', duration: '3:10' },
  { id: 's3', label: '场景 3', title: '对峙·废弃仓库',  status: 'pending',    duration: '4:00' },
  { id: 's4', label: '场景 4', title: '结局·破晓',      status: 'pending',    duration: '1:50' },
]

const sceneStatus: Record<string, { label: string; color: string; bg: string }> = {
  done:        { label: '已完成', color: 'text-city-emerald', bg: 'bg-city-emerald/10 border-city-emerald/30' },
  in_progress: { label: '进行中', color: 'text-city-gold',    bg: 'bg-city-gold/10 border-city-gold/30' },
  pending:     { label: '待处理', color: 'text-gray-500',     bg: 'bg-city-border/30 border-city-border' },
}

export function ProjectCanvas({ projectId: _ }: Props) {
  return (
    <div className="city-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">导演总控画布</h2>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2.5 py-1 rounded bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">
            + 新增场景
          </button>
          <button className="text-xs px-2.5 py-1 rounded bg-city-surface border border-city-border text-gray-400 hover:text-white transition-colors">
            导出分镜
          </button>
        </div>
      </div>

      {/* Scene grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MOCK_SCENES.map((scene) => {
          const st = sceneStatus[scene.status] ?? { label: scene.status, color: 'text-gray-500', bg: 'bg-city-border/30 border-city-border' }
          return (
            <div
              key={scene.id}
              className={`rounded-xl border p-3 cursor-pointer transition-all hover:scale-[1.02] ${st.bg}`}
            >
              <div className="text-xs text-gray-500 mb-1">{scene.label}</div>
              <div className="text-sm font-medium leading-snug mb-2">{scene.title}</div>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${st.color}`}>{st.label}</span>
                <span className="text-xs text-gray-600">{scene.duration}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty drop zone hint */}
      <div className="mt-3 border border-dashed border-city-border rounded-xl h-16 flex items-center justify-center text-xs text-gray-600 hover:border-city-accent/30 cursor-pointer transition-colors">
        拖拽场景卡片到此处，或点击新增
      </div>
    </div>
  )
}
