'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketplaceItem {
  id: string
  title: string
  type: string
  url: string | null
  thumbnailUrl: string | null
  owner: {
    id: string
    displayName: string
    username: string | null
    avatarUrl: string | null
  }
  licenseIntent: unknown
  marketplaceIntent: unknown
  provider: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLicenseMode(licenseIntent: unknown): string | null {
  if (!licenseIntent || typeof licenseIntent !== 'object') return null
  const li = licenseIntent as Record<string, unknown>
  return typeof li.mode === 'string' ? li.mode : null
}

function getWantsToList(marketplaceIntent: unknown): boolean {
  if (!marketplaceIntent || typeof marketplaceIntent !== 'object') return false
  const mi = marketplaceIntent as Record<string, unknown>
  return mi.wantsToList === true
}

function getSuggestedPrice(marketplaceIntent: unknown): number | null {
  if (!marketplaceIntent || typeof marketplaceIntent !== 'object') return null
  const mi = marketplaceIntent as Record<string, unknown>
  return typeof mi.suggestedPriceCredits === 'number' ? mi.suggestedPriceCredits : null
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ item }: { item: MarketplaceItem }) {
  const thumb = item.thumbnailUrl ?? item.url ?? ''
  const licenseMode = getLicenseMode(item.licenseIntent)
  const wantsToList = getWantsToList(item.marketplaceIntent)
  const suggestedPrice = getSuggestedPrice(item.marketplaceIntent)

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
          <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 28, opacity: 0.2 }}>
            {item.type === 'VIDEO' ? '🎬' : item.type === 'AUDIO' ? '🎵' : '🖼️'}
          </span>
        )}
      </div>

      {/* Title + creator */}
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
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{item.owner.displayName}</div>
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 20 }}>
        {licenseMode ? (
          <span
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 5,
              background: licenseMode === 'reusable_commercial' ? 'rgba(251,146,60,0.12)' : 'rgba(96,165,250,0.12)',
              color: licenseMode === 'reusable_commercial' ? '#fdba74' : '#93c5fd',
              fontWeight: 600,
            }}
          >
            {licenseMode === 'reusable_commercial' ? '💼 商用复用' : '🔄 非商用复用'}
          </span>
        ) : null}
        {wantsToList ? (
          <span
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 5,
              background: 'rgba(110,231,183,0.08)',
              color: '#6ee7b7',
            }}
          >
            📋 发布意向已登记
          </span>
        ) : null}
      </div>

      {/* Suggested price */}
      {suggestedPrice != null ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
          建议价：{suggestedPrice} 积分（规划中）
        </div>
      ) : null}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
        <Link
          href={`/assets/${item.id}`}
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
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/marketplace/listings', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ items?: MarketplaceItem[]; message?: string }>)
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
        公开可复用素材 · Real Assets
      </div>
      <div style={{ marginTop: 10, fontSize: 22, fontWeight: 300, letterSpacing: '-0.04em', color: '#fff' }}>
        真实公开资产
      </div>
      <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, color: 'rgba(255,255,255,0.42)' }}>
        以下为平台内公开且设置为可复用授权意图的真实资产。
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
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>暂无公开可复用资产</div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
            你可以在资产详情页将资产设为公开，并选择可复用授权意图，再登记发布意向。
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
            <AssetCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
