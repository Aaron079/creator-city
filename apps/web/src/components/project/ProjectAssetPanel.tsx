'use client'

interface Props { projectId: string }

const ASSETS = [
  { id: 'a1', name: '剧本终稿.pdf',     type: 'DOC',   icon: '📄', size: '1.2 MB' },
  { id: 'a2', name: '场景参考板.zip',   type: 'PACK',  icon: '📦', size: '48 MB'  },
  { id: 'a3', name: '主题曲 demo.mp3',  type: 'AUDIO', icon: '🎵', size: '8.4 MB' },
  { id: 'a4', name: '角色概念图.psd',   type: 'IMAGE', icon: '🖼️', size: '22 MB'  },
]

export function ProjectAssetPanel({ projectId: _ }: Props) {
  return (
    <div className="city-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">素材面板</h3>
        <button className="text-xs text-city-accent-glow hover:underline underline-offset-2">
          上传
        </button>
      </div>

      <div className="space-y-1.5">
        {ASSETS.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-city-surface cursor-pointer transition-colors group"
          >
            <span className="text-base flex-shrink-0">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate group-hover:text-white transition-colors">{a.name}</p>
            </div>
            <span className="text-xs text-gray-600 flex-shrink-0">{a.size}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
