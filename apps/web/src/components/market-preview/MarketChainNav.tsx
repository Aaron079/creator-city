// No POST, no PUT, no DELETE. Static market chain navigation only.
import Link from 'next/link'
import type { MarketChainKey } from './marketPreviewShared'
import {
  MARKET_CHAIN_ITEMS,
  MARKET_ACCENT_COLOR,
  MARKET_ACCENT_LIGHT,
} from './marketPreviewShared'

export function MarketChainNav({ current }: { current: MarketChainKey }) {
  const accentColor = MARKET_ACCENT_COLOR[current]
  const accentLight = MARKET_ACCENT_LIGHT[current]

  return (
    <div
      style={{
        background: '#111117',
        border: '1px solid #1e1e24',
        borderRadius: '14px',
        padding: '1.5rem 1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0',
      }}
    >
      {MARKET_CHAIN_ITEMS.flatMap((item, i) => {
        const isCurrent = item.key === current
        return [
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              background: isCurrent ? `${accentColor}18` : 'transparent',
              border: isCurrent ? `1px solid ${accentColor}40` : '1px solid transparent',
              textDecoration: 'none',
              minWidth: '76px',
              textAlign: 'center' as const,
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: isCurrent ? accentColor : '#3f3f46',
                letterSpacing: '0.04em',
              }}
            >
              {String(item.index).padStart(2, '0')}
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: isCurrent ? 700 : 500,
                color: isCurrent ? accentLight : '#71717a',
              }}
            >
              {item.label}
            </span>
            {isCurrent && (
              <span style={{ fontSize: '9px', color: accentColor, fontWeight: 600 }}>← 当前</span>
            )}
          </Link>,
          i < MARKET_CHAIN_ITEMS.length - 1 && (
            <span
              key={`arrow-${i}`}
              style={{ fontSize: '12px', color: '#27272a', padding: '0 0.15rem' }}
            >
              →
            </span>
          ),
        ]
      })}
    </div>
  )
}
