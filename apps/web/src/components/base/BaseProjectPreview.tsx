'use client'

import Link from 'next/link'

const MOCK_PROJECTS = [
  {
    id: 'p1',
    title: '《暗流》短片',
    type: '短片',
    status: 'IN_PROGRESS',
    progress: 65,
    members: 3,
    updatedAt: '2小时前',
  },
  {
    id: 'p2',
    title: '城市交响曲 Vol.3',
    type: '音乐',
    status: 'IN_REVIEW',
    progress: 90,
    members: 2,
    updatedAt: '昨天',
  },
]

const statusLabel: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: '进行中', color: 'text-city-sky' },
  IN_REVIEW:   { label: '审核中', color: 'text-city-gold' },
  COMPLETED:   { label: '已完成', color: 'text-city-emerald' },
  DRAFT:       { label: '草稿',   color: 'text-gray-500' },
}

export function BaseProjectPreview() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">当前项目</h2>
        <Link href="/projects" className="text-xs text-city-accent-glow hover:underline underline-offset-2">
          所有项目 →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MOCK_PROJECTS.map((p) => {
          const st = statusLabel[p.status] ?? { label: p.status, color: 'text-gray-500' }
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="city-card hover:border-city-accent/30 group block"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-city-accent-glow transition-colors">
                    {p.title}
                  </h3>
                  <span className="text-xs text-gray-500">{p.type}</span>
                </div>
                <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>进度</span>
                  <span>{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-city-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-city-accent to-city-accent-glow"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>👥 {p.members} 成员</span>
                <span>{p.updatedAt}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
