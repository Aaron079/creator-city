'use client'

import { TopNavigation } from '@/components/layout/TopNavigation'
import styles from './nonCanvasShell.module.css'

export function AppShell({
  children,
  maxWidth = 'max-w-7xl',
}: {
  children: React.ReactNode
  showContextBar?: boolean
  maxWidth?: string
}) {
  return (
    <div className={styles.shell}>
      <TopNavigation />
      <main className={`${styles.content} mx-auto ${maxWidth} px-6 pt-20 pb-10`}>
        {children}
      </main>
    </div>
  )
}
