'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/create',    label: 'Create' },
  { href: '/jobs',      label: 'Jobs' },
  { href: '/explore',   label: 'Explore' },
  { href: '/community', label: 'Community' },
  { href: '/me',        label: '我的' },
]

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/[0.06] bg-[#0a0f1a]/85 backdrop-blur-xl">
      <Link href="/" className="text-sm font-bold tracking-wide text-gradient">
        Creator City
      </Link>

      <div className="flex items-center gap-0.5">
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3.5 py-1.5 rounded-lg text-sm transition-all duration-200 ${
              pathname.startsWith(l.href)
                ? 'text-white bg-white/[0.08] font-medium'
                : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <Link
        href="/auth/login"
        className="text-xs px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white transition-all duration-200"
      >
        登录
      </Link>
    </nav>
  )
}
