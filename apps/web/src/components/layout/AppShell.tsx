'use client'

import { CurrentContextBar } from '@/components/layout/CurrentContextBar'
import { TopNavigation } from '@/components/layout/TopNavigation'

export function AppShell({
  children,
  showContextBar = true,
  maxWidth = 'max-w-7xl',
}: {
  children: React.ReactNode
  showContextBar?: boolean
  maxWidth?: string
}) {
  return (
    <div className="min-h-screen bg-city-bg text-white">
      <TopNavigation />
      {showContextBar ? <CurrentContextBar /> : null}
      <main className={`mx-auto ${maxWidth} px-6 ${showContextBar ? 'pt-32' : 'pt-20'} pb-10`}>
        {children}
      </main>
    </div>
  )
}
