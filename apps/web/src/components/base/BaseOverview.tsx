'use client'

import { useAuthStore } from '@/store/auth.store'

const stats = [
  { label: '声望', key: 'reputation' as const, icon: '⭐', color: 'text-city-gold' },
  { label: '等级', key: 'level' as const, icon: '🏅', color: 'text-city-accent-glow' },
  { label: '积分', key: 'credits' as const, icon: '💎', color: 'text-city-emerald' },
]

export function BaseOverview() {
  const { user } = useAuthStore()

  return (
    <div className="city-card">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-city-accent/30 to-city-accent/10 border border-city-accent/20 flex items-center justify-center text-2xl font-bold text-city-accent-glow">
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user?.displayName ?? '—'} 的基地</h2>
            <p className="text-sm text-gray-400">@{user?.username}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 sm:ml-auto">
          {stats.map((s) => (
            <div key={s.key} className="text-center">
              <div className={`text-xl font-bold ${s.color}`}>
                {s.icon} {user?.[s.key] ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* XP bar */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>等级进度</span>
          <span>Lv.{user?.level ?? 1} → Lv.{(user?.level ?? 1) + 1}</span>
        </div>
        <div className="h-1.5 rounded-full bg-city-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-city-accent to-city-accent-glow transition-all duration-700"
            style={{ width: '62%' }}
          />
        </div>
      </div>
    </div>
  )
}
