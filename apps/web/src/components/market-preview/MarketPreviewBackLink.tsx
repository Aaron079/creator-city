// No POST, no PUT, no DELETE. Static navigation link only.
import Link from 'next/link'
import type { MarketChainKey } from './marketPreviewShared'
import { MARKET_BACK_LINKS } from './marketPreviewShared'

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.78rem',
  color: '#71717a',
  border: '1px solid #27272a',
  borderRadius: '7px',
  padding: '0.3rem 0.75rem',
  textDecoration: 'none',
  background: 'rgba(9,9,11,0.4)',
}

export function MarketPreviewBackLink({ current }: { current: MarketChainKey }) {
  const { href, label } = MARKET_BACK_LINKS[current]
  const isHome = current === 'marketplace'
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Link href={href} style={btnStyle}>← {label}</Link>
      {!isHome && <Link href="/" style={btnStyle}>返回首页</Link>}
    </div>
  )
}
