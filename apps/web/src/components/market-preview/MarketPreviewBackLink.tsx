// No POST, no PUT, no DELETE. Static navigation link only.
import Link from 'next/link'
import type { MarketChainKey } from './marketPreviewShared'
import { MARKET_BACK_LINKS } from './marketPreviewShared'

export function MarketPreviewBackLink({ current }: { current: MarketChainKey }) {
  const { href, label } = MARKET_BACK_LINKS[current]
  return (
    <div style={{ padding: '1rem 1.5rem 0' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <Link
          href={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8rem',
            color: '#71717a',
            border: '1px solid #27272a',
            borderRadius: '7px',
            padding: '0.35rem 0.875rem',
            textDecoration: 'none',
          }}
        >
          ← {label}
        </Link>
      </div>
    </div>
  )
}
