'use client'

interface Props { projectId: string }

const REVIEWS = [
  { id: 'r1', title: '场景 1 粗剪',    submitter: 'Max',  time: '1小时前', status: 'pending' },
  { id: 'r2', title: '主题曲 demo',     submitter: 'Luna', time: '3小时前', status: 'approved' },
  { id: 'r3', title: '角色设定文档',    submitter: 'Ada',  time: '昨天',    status: 'changes_requested' },
]

const badge: Record<string, { label: string; color: string }> = {
  pending:           { label: '待审',   color: 'text-city-gold bg-city-gold/10 border-city-gold/30' },
  approved:          { label: '通过',   color: 'text-city-emerald bg-city-emerald/10 border-city-emerald/30' },
  changes_requested: { label: '需修改', color: 'text-city-rose bg-city-rose/10 border-city-rose/30' },
}

export function ProjectReviewQueue({ projectId: _ }: Props) {
  return (
    <div className="city-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">审核队列</h3>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-city-accent/10 text-city-accent-glow">
          {REVIEWS.filter((r) => r.status === 'pending').length} 待处理
        </span>
      </div>

      <div className="space-y-2">
        {REVIEWS.map((r) => {
          const b = badge[r.status] ?? { label: r.status, color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' }
          return (
            <div key={r.id} className="flex items-start gap-2 group cursor-pointer">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium group-hover:text-city-accent-glow transition-colors">
                  {r.title}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {r.submitter} · {r.time}
                </p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${b.color}`}>
                {b.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
