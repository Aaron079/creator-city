'use client'

import { AppShell } from '@/components/layout/AppShell'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell maxWidth="max-w-6xl">{children}</AppShell>
  )
}
