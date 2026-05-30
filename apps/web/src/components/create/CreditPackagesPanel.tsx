'use client'

import { useEffect, useState } from 'react'

interface CreditPackage {
  id: string
  name: string
  credits: number
  baseCredits: number
  bonusCredits: number
  priceUsd: number | null
  label: string
  status: 'soon' | 'active'
}

interface CreditPackagesPanelProps {
  /** Show only the first N packages. Defaults to 3 (Starter, Creator, Studio). */
  limit?: number
}

export function CreditPackagesPanel({ limit = 3 }: CreditPackagesPanelProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/credits/packages', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as { success?: boolean; packages?: CreditPackage[] }
        if (data.success && Array.isArray(data.packages)) {
          setPackages(data.packages.slice(0, limit))
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [limit])

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${limit}, 1fr)`, gap: '10px' }}>
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              height: '100px',
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    )
  }

  if (packages.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(packages.length, limit)}, 1fr)`, gap: '10px' }}>
      {packages.map((pkg) => (
        <div
          key={pkg.id}
          style={{
            borderRadius: '12px',
            border: '1px solid rgba(160, 60, 255, 0.18)',
            background: 'rgba(160, 60, 255, 0.06)',
            padding: '14px 12px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Soon badge */}
          <span style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(160, 60, 255, 0.7)',
            background: 'rgba(160, 60, 255, 0.12)',
            border: '1px solid rgba(160, 60, 255, 0.2)',
            borderRadius: '4px',
            padding: '2px 5px',
          }}>
            Soon
          </span>

          {/* Package name */}
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '6px',
            paddingRight: '28px',
            textAlign: 'left',
          }}>
            {pkg.name.split(' ')[0]}
          </div>

          {/* Credits */}
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(200,160,255,0.95)', lineHeight: 1 }}>
            {pkg.credits.toLocaleString()}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px', marginTop: '2px' }}>
            credits{pkg.bonusCredits > 0 ? ` (+${pkg.bonusCredits} bonus)` : ''}
          </div>

          {/* Label */}
          {pkg.label ? (
            <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.38)', marginBottom: '4px' }}>
              {pkg.label}
            </div>
          ) : null}

          {/* Price */}
          {pkg.priceUsd != null ? (
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
              ${pkg.priceUsd.toFixed(2)}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
