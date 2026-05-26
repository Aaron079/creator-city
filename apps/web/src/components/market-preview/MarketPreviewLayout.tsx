// Skeleton layout component — not used yet. Available for future page-level unification.
import type { ReactNode } from 'react'

export function MarketPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090b',
        color: '#a1a1aa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '0 0 6rem',
      }}
    >
      {children}
    </div>
  )
}
