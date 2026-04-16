'use client'

const MOCK_BUILDINGS = [
  { id: '1', name: '导演工作室', type: 'STUDIO', level: 3, icon: '🎬', desc: '解锁影片制作流水线', status: 'active' },
  { id: '2', name: '音乐实验室', type: 'LAB',    level: 2, icon: '🎵', desc: '作曲与混音工作台',   status: 'active' },
  { id: '3', name: 'Agent 训练场', type: 'GYM',  level: 1, icon: '🤖', desc: 'Agent 升级加速 +10%', status: 'upgrading' },
  { id: '4', name: '素材仓库',    type: 'VAULT', level: 2, icon: '📦', desc: '存储容量 500 GB',    status: 'active' },
  { id: '5', name: '展览馆',      type: 'GALLERY', level: 0, icon: '🖼️', desc: '展示并出售你的作品', status: 'locked' },
]

const statusLabel: Record<string, { label: string; color: string }> = {
  active:    { label: '运行中', color: 'text-city-emerald' },
  upgrading: { label: '升级中', color: 'text-city-gold' },
  locked:    { label: '未解锁', color: 'text-gray-600' },
}

export function BuildingList() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">建筑列表</h2>
        <button className="text-xs px-3 py-1.5 rounded-lg bg-city-accent/10 text-city-accent-glow border border-city-accent/20 hover:bg-city-accent/20 transition-colors">
          + 新建建筑
        </button>
      </div>

      <div className="space-y-2">
        {MOCK_BUILDINGS.map((b) => {
          const st = statusLabel[b.status]
          const isLocked = b.status === 'locked'
          return (
            <div
              key={b.id}
              className={`city-card flex items-center gap-4 ${isLocked ? 'opacity-50' : 'hover:border-city-accent/30'}`}
            >
              <div className="text-2xl w-10 flex-shrink-0 text-center">{b.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{b.name}</span>
                  <span className="text-xs text-gray-600">Lv.{b.level}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-xs font-medium ${st.color}`}>{st.label}</div>
                {!isLocked && (
                  <button className="text-xs text-gray-600 hover:text-white mt-0.5 transition-colors">
                    升级 →
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
