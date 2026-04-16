'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { href: '/city', label: 'City', icon: '🏙️' },
  { href: '/projects', label: 'Projects', icon: '🎬' },
  { href: '/agents', label: 'Agents', icon: '🤖' },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  return (
    <div className="flex min-h-screen bg-city-bg">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-city-border flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-city-border">
          <span className="text-lg font-bold text-gradient">Creator City</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                pathname === item.href
                  ? 'bg-city-accent/10 text-city-accent-glow border border-city-accent/20'
                  : 'text-gray-400 hover:text-white hover:bg-city-surface',
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-city-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-city-accent/20 flex items-center justify-center text-city-accent-glow font-bold text-sm">
              {user?.displayName[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.displayName}</div>
              <div className="text-xs text-gray-500">Lv.{user?.level}</div>
            </div>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-white text-xs transition-colors"
              title="Sign out"
            >
              ↩
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
