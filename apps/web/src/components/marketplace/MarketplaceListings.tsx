'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListingItem {
  id: string
  assetId: string
  sellerId: string
  status: string
  licenseMode: string
  priceCredits: number | null
  title: string | null
  description: string | null
  commercialUse: boolean
  derivativeAllowed: boolean
  attributionRequired: boolean
  publishedAt: string | null
  asset: {
    id: string
    title: string | null
    type: string
    url: string | null
    thumbnailUrl: string | null
    provider: string | null
  }
  seller: {
    id: string
    displayName: string
    username: string | null
    avatarUrl: string | null
  }
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({ item }: { item: ListingItem }) {
  const thumb = item.asset.thumbnailUrl ?? item.asset.url ?? ''

  const licenseColor =
    item.licenseMode === 'reusable_commercial'
      ? { bg: 'rgba(251,146,60,0.12)', color: '#fdba74', label: '💼 商用复用' }
      : { bg: 'rgba(96,165,250,0.12)', color: '#93c5fd', label: '🔄 非商用复用' }

  return (
    <div
      style={{
        borderRadius: 22,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.18)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={item.title ?? item.asset.title ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 28, opacity: 0.2 }}>
            {item.asset.type === 'VIDEO' ? '🎬' : item.asset.type === 'AUDIO' ? '🎵' : '🖼️'}
          </span>
        )}
      </div>

      {/* Title + seller */}
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title ?? item.asset.title ?? '未命名'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{item.seller.displayName}</div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 5,
            background: licenseColor.bg,
            color: licenseColor.color,
            fontWeight: 600,
          }}
        >
          {licenseColor.label}
        </span>
        {item.commercialUse ? null : (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.28)' }}>
            非商用
          </span>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
        {item.priceCredits != null ? `标价：${item.priceCredits} 积分（购买功能规划中）` : '标价：待定'}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
        <Link
          href={`/assets/${item.asset.id}`}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.70)',
            textDecoration: 'none',
          }}
        >
          查看资产
        </Link>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.18)',
            cursor: 'not-allowed',
            userSelect: 'none',
          }}
        >
          申请授权 · 即将开放
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarketplaceListings() {
  const [items, setItems] = useState<ListingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/marketplace/listings', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items?: ListingItem[]; message?: string }>)
      .then((data) => {
        if (!cancelled) setItems(data.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('加载失败，请刷新页面重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section
      style={{
        borderRadius: 30,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        padding: '24px',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)' }}>
        正式上架资产 · Active Listings
      </div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 300, letterSpacing: '-0.04em', color: '#fff' }}>
        已上架资产
      </div>
      <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, color: 'rgba(255,255,255,0.42)' }}>
        以下为创作者正式上架的可复用资产 Listing。
        <br />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          购买授权、定价、收益分成将在后续 Marketplace 阶段接入。所有申请授权按钮当前为只读。
        </span>
      </p>

      {loading ? (
        <div style={{ marginTop: 24, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>加载中…</div>
      ) : error ? (
        <div style={{ marginTop: 24, fontSize: 13, color: 'rgba(248,113,113,0.7)' }}>{error}</div>
      ) : items.length === 0 ? (
        <div
          style={{
            marginTop: 24,
            padding: '20px',
            borderRadius: 16,
            border: '1px dashed rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>暂无正式上架资产</div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
            创作者可在资产详情页设置可复用授权意图，然后创建 Listing 草稿并激活上架。
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
