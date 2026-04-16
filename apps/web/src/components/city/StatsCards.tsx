'use client'

import { useAuthStore } from '@/store/auth.store'
import { formatReputation, formatCredits } from '@/lib/utils'

export function StatsCards() {
  const { user } = useAuthStore()

  const stats = [
    { label: 'Reputation', value: formatReputation(user?.reputation ?? 0), icon: '⭐', color: 'text-city-gold' },
    { label: 'Credits', value: formatCredits(user?.credits ?? 0), icon: '💎', color: 'text-sky-400' },
    { label: 'Level', value: `${user?.level ?? 1}`, icon: '🏆', color: 'text-emerald-400' },
    { label: 'Role', value: user?.role ?? 'CREATOR', icon: '🎭', color: 'text-city-accent-glow' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="city-card">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <span>{stat.icon}</span>
            {stat.label}
          </div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}
