// Shared community section header — no 'use client', works in server and client pages.
// Renders a breadcrumb row: ← 社群 / [district name + desc] / [district pills]

import Link from 'next/link'

const DISTRICTS = [
  { en: 'Plaza', href: '/explore' },
  { en: 'Gallery', href: '/assets' },
  { en: 'Studio', href: '/studio' },
  { en: 'Market', href: '/marketplace' },
  { en: 'Passport', href: '/me' },
] as const

interface CommunitySectionHeaderProps {
  districtZh: string
  desc: string
  activeHref: string
}

export function CommunitySectionHeader({ districtZh, desc, activeHref }: CommunitySectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        paddingBottom: 20,
        marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Back to community */}
      <Link
        href="/community"
        style={{
          flexShrink: 0,
          fontSize: 12,
          color: 'rgba(255,255,255,0.34)',
          textDecoration: 'none',
          fontWeight: 500,
        }}
      >
        ← 社群
      </Link>

      <span
        style={{
          width: 1,
          height: 14,
          background: 'rgba(255,255,255,0.10)',
          flexShrink: 0,
        }}
      />

      {/* District name + description */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.62)', flexShrink: 0 }}>
          {districtZh}
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.28)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {desc}
        </span>
      </div>

      {/* District navigation pills */}
      <nav
        aria-label="City districts"
        style={{ marginLeft: 'auto', display: 'flex', gap: 2, flexShrink: 0, flexWrap: 'wrap' }}
      >
        {DISTRICTS.map((d) => {
          const active = activeHref === d.href
          return (
            <Link
              key={d.href}
              href={d.href}
              style={{
                fontSize: 11,
                color: active ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.28)',
                textDecoration: 'none',
                padding: '4px 8px',
                borderRadius: 6,
                background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {d.en}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
