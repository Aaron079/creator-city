'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

// First-launch feature flag: platform credit payment is disabled
const CREDITS_PAYMENT_ENABLED = process.env.NEXT_PUBLIC_MARKETPLACE_CREDITS_PAYMENT_ENABLED === 'true'

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

function ListingCard({
  item,
  currentUserId,
  initialOrder,
}: {
  item: ListingItem
  currentUserId: string | null
  initialOrder: { id: string; status: string } | null
}) {
  const thumb = item.asset.thumbnailUrl ?? item.asset.url ?? ''
  const isSeller = currentUserId === item.sellerId
  const isFree = item.priceCredits === 0
  const isPaid = item.priceCredits !== null && item.priceCredits > 0

  const [grantState, setGrantState] = useState<'idle' | 'loading' | 'granted' | 'error'>('idle')
  const [grantChecked, setGrantChecked] = useState(false)

  const [orderId, setOrderId] = useState<string | null>(initialOrder?.id ?? null)
  const [orderState, setOrderState] = useState<'idle' | 'loading' | 'submitted' | 'cancelling' | 'cancelled' | 'rejected' | 'quoted' | 'completed' | 'error'>(
    initialOrder?.status === 'PENDING' ? 'submitted'
    : initialOrder?.status === 'CANCELLED' ? 'cancelled'
    : initialOrder?.status === 'REJECTED' ? 'rejected'
    : initialOrder?.status === 'QUOTED' ? 'quoted'
    : initialOrder?.status === 'COMPLETED' ? 'completed'
    : 'idle'
  )

  // Check existing grant on mount (only for eligible non-seller buyers)
  useEffect(() => {
    if (!currentUserId || isSeller || !isFree) return
    let cancelled = false
    fetch(`/api/marketplace/listings/${item.id}/grant`, { credentials: 'include' })
      .then((r) => r.json() as Promise<{ granted?: boolean }>)
      .then((data) => {
        if (!cancelled && data.granted) setGrantState('granted')
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setGrantChecked(true) })
    return () => { cancelled = true }
  }, [item.id, currentUserId, isSeller, isFree])

  const handleGrant = useCallback(async () => {
    if (grantState !== 'idle') return
    setGrantState('loading')
    try {
      const res = await fetch(`/api/marketplace/listings/${item.id}/grant`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as { errorCode?: string }
      if (res.ok || res.status === 201) {
        setGrantState('granted')
      } else if (data.errorCode === 'ALREADY_GRANTED') {
        setGrantState('granted')
      } else {
        setGrantState('error')
        setTimeout(() => setGrantState('idle'), 2500)
      }
    } catch {
      setGrantState('error')
      setTimeout(() => setGrantState('idle'), 2500)
    }
  }, [item.id, grantState])

  const handleOrderSubmit = useCallback(async () => {
    if (orderState !== 'idle' && orderState !== 'cancelled') return
    setOrderState('loading')
    try {
      const res = await fetch(`/api/marketplace/listings/${item.id}/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { errorCode?: string; order?: { id: string } }
      if (res.ok || res.status === 201) {
        setOrderId(data.order?.id ?? null)
        setOrderState('submitted')
      } else if (data.errorCode === 'ORDER_ALREADY_PENDING') {
        setOrderState('submitted')
      } else {
        setOrderState('error')
        setTimeout(() => setOrderState('idle'), 2500)
      }
    } catch {
      setOrderState('error')
      setTimeout(() => setOrderState('idle'), 2500)
    }
  }, [item.id, orderState])

  const handleOrderCancel = useCallback(async () => {
    if (!orderId || orderState !== 'submitted') return
    setOrderState('cancelling')
    try {
      const res = await fetch(`/api/me/marketplace-orders/${orderId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })
      if (res.ok) {
        setOrderState('cancelled')
      } else {
        setOrderState('submitted')
      }
    } catch {
      setOrderState('submitted')
    }
  }, [orderId, orderState])

  const licenseColor =
    item.licenseMode === 'reusable_commercial'
      ? { bg: 'rgba(251,146,60,0.12)', color: '#fdba74', label: '💼 商用复用' }
      : { bg: 'rgba(96,165,250,0.12)', color: '#93c5fd', label: '🔄 非商用复用' }

  // Determine action button
  const renderActionButton = () => {
    if (isSeller) {
      return (
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.20)',
            userSelect: 'none',
          }}
        >
          你的上架资产
        </span>
      )
    }

    // Paid listing
    if (isPaid) {
      if (orderState === 'submitted') {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '7px 0',
                borderRadius: 10,
                border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24',
                userSelect: 'none',
              }}
            >
              ✓ 申请已提交
            </span>
            {orderId ? (
              <button
                onClick={handleOrderCancel}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  padding: '2px 0',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(248,113,113,0.55)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                取消申请
              </button>
            ) : null}
          </div>
        )
      }

      if (orderState === 'cancelling') {
        return (
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 12,
              padding: '7px 0',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.3)',
              userSelect: 'none',
            }}
          >
            取消中…
          </span>
        )
      }

      if (orderState === 'cancelled') {
        return (
          <button
            onClick={handleOrderSubmit}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 12,
              padding: '7px 0',
              borderRadius: 10,
              border: '1px solid rgba(251,191,36,0.2)',
              color: 'rgba(251,191,36,0.55)',
              background: 'transparent',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            已取消 · 重新申请
          </button>
        )
      }

      if (orderState === 'rejected') {
        return (
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 12,
              padding: '7px 0',
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.2)',
              color: 'rgba(248,113,113,0.65)',
              userSelect: 'none',
            }}
          >
            申请已被拒绝
          </span>
        )
      }

      if (orderState === 'completed') {
        return (
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 12,
              padding: '7px 0',
              borderRadius: 10,
              border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80',
              userSelect: 'none',
            }}
          >
            ✓ 已获得授权
          </span>
        )
      }

      if (orderState === 'quoted') {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link
              href={`/assets/${item.assetId}`}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '7px 0',
                borderRadius: 10,
                border: '1px solid rgba(147,197,253,0.35)',
                color: '#93c5fd',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              {CREDITS_PAYMENT_ENABLED ? '卖家已确认报价 · 去支付' : '卖家已响应 · 查看详情'}
            </Link>
            <span style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.28)', userSelect: 'none' }}>
              {CREDITS_PAYMENT_ENABLED ? '尚未扣款，点击资产页面完成支付。' : '请通过创作者主页联系沟通授权方式。'}
            </span>
          </div>
        )
      }

      if (orderState === 'error') {
        return (
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 12,
              padding: '7px 0',
              borderRadius: 10,
              border: '1px solid rgba(248,113,113,0.25)',
              color: 'rgba(248,113,113,0.8)',
              userSelect: 'none',
            }}
          >
            提交失败，请重试
          </span>
        )
      }

      if (!CREDITS_PAYMENT_ENABLED) {
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Link
              href={`/assets/${item.assetId}`}
              style={{
                textAlign: 'center',
                fontSize: 12,
                padding: '7px 0',
                borderRadius: 10,
                border: '1px solid rgba(251,191,36,0.2)',
                color: 'rgba(251,191,36,0.7)',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              申请授权合作 →
            </Link>
            <span style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)', userSelect: 'none', lineHeight: 1.5 }}>
              第一版暂不支持平台内积分支付，请点击查看资产详情联系创作者。
            </span>
          </div>
        )
      }

      return (
        <button
          onClick={handleOrderSubmit}
          disabled={orderState === 'loading'}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(251,191,36,0.35)',
            color: orderState === 'loading' ? 'rgba(255,255,255,0.3)' : '#fbbf24',
            background: 'transparent',
            cursor: orderState === 'loading' ? 'wait' : 'pointer',
            userSelect: 'none',
          }}
        >
          {orderState === 'loading' ? '提交中…' : '申请付费授权'}
        </button>
      )
    }

    // Null price (price not set)
    if (item.priceCredits === null) {
      return (
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
          价格待定 · 暂不可申请
        </span>
      )
    }

    // Free listing — show grant button
    if (grantState === 'granted') {
      return (
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(74,222,128,0.25)',
            color: '#4ade80',
            userSelect: 'none',
          }}
        >
          ✓ 已获取授权
        </span>
      )
    }

    if (grantState === 'error') {
      return (
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 12,
            padding: '7px 0',
            borderRadius: 10,
            border: '1px solid rgba(248,113,113,0.25)',
            color: 'rgba(248,113,113,0.8)',
            userSelect: 'none',
          }}
        >
          领取失败，请重试
        </span>
      )
    }

    return (
      <button
        onClick={handleGrant}
        disabled={grantState === 'loading' || (!grantChecked && !!currentUserId)}
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 12,
          padding: '7px 0',
          borderRadius: 10,
          border: '1px solid rgba(96,165,250,0.35)',
          color: grantState === 'loading' ? 'rgba(255,255,255,0.3)' : '#93c5fd',
          background: 'transparent',
          cursor: grantState === 'loading' ? 'wait' : 'pointer',
          userSelect: 'none',
        }}
      >
        {grantState === 'loading' ? '处理中…' : '免费领取授权'}
      </button>
    )
  }

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
        {isFree && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(74,222,128,0.08)', color: 'rgba(74,222,128,0.7)', fontWeight: 600 }}>
            免费
          </span>
        )}
        {isPaid && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(251,191,36,0.08)', color: 'rgba(251,191,36,0.7)' }}>
            {item.priceCredits} 积分
          </span>
        )}
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
        {renderActionButton()}
      </div>
      {isPaid && !isSeller && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2, lineHeight: 1.5 }}>
          当前仅提交申请，不扣款、不生成授权
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarketplaceListings() {
  const [items, setItems] = useState<ListingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [orderByListingId, setOrderByListingId] = useState<Map<string, { id: string; status: string }>>(new Map())

  useEffect(() => {
    let cancelled = false

    // Load current user id, listings, and pending orders in parallel
    Promise.all([
      fetch('/api/auth/me', { credentials: 'include' })
        .then((r) => r.json() as Promise<{ user?: { id: string } }>)
        .then((d) => d.user?.id ?? null)
        .catch(() => null),
      fetch('/api/marketplace/listings', { credentials: 'include' })
        .then((r) => r.json() as Promise<{ items?: ListingItem[] }>)
        .then((d) => d.items ?? []),
      fetch('/api/me/marketplace-orders?role=buyer', { credentials: 'include' })
        .then((r) => r.json() as Promise<{ items?: Array<{ id: string; listingId: string; status: string }> }>)
        .then((d) => {
          const map = new Map<string, { id: string; status: string }>()
          for (const o of d.items ?? []) {
            // Items are sorted desc by createdAt; first match per listing is most recent
            if (!map.has(o.listingId)) {
              map.set(o.listingId, { id: o.id, status: o.status })
            }
          }
          return map
        })
        .catch(() => new Map<string, { id: string; status: string }>()),
    ])
      .then(([userId, listingItems, orderMap]) => {
        if (!cancelled) {
          setCurrentUserId(userId)
          setItems(listingItems)
          setOrderByListingId(orderMap)
        }
      })
      .catch(() => {
        if (!cancelled) setError('加载失败，请刷新页面重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
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
          免费资产可直接领取授权。付费授权可提交申请意向，不扣款、不生成正式授权。
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
            <ListingCard
              key={item.id}
              item={item}
              currentUserId={currentUserId}
              initialOrder={orderByListingId.get(item.id) ?? null}
            />
          ))}
        </div>
      )}
    </section>
  )
}
