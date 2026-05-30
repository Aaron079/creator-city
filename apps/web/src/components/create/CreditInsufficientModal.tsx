'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface BalanceResult {
  availableCredits: number
}

interface CreditInsufficientModalProps {
  open: boolean
  onClose: () => void
  requiredCredits?: number
  availableCredits?: number
}

const PLANS = [
  { name: 'Starter', credits: 500, price: '$6.99' },
  { name: 'Creator', credits: 1500, price: '$14.99' },
  { name: 'Studio', credits: 5500, price: '$49.99' },
]

export function CreditInsufficientModal({
  open,
  onClose,
  requiredCredits,
  availableCredits: availableCreditsFromError,
}: CreditInsufficientModalProps) {
  const [freshBalance, setFreshBalance] = useState<number | null>(null)

  // Fetch fresh balance when modal opens
  useEffect(() => {
    if (!open) return
    setFreshBalance(null)
    void fetch('/api/credits/balance', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as { success?: boolean } & Partial<BalanceResult>
        if (data.success && typeof data.availableCredits === 'number') {
          setFreshBalance(data.availableCredits)
        }
      })
      .catch(() => null)
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const displayAvailable = freshBalance ?? availableCreditsFromError

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="余额不足"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '16px',
      }}
    >
      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '20px',
          border: '1px solid rgba(160, 60, 255, 0.28)',
          background: 'linear-gradient(160deg, rgba(18, 10, 28, 0.97), rgba(10, 6, 18, 0.99))',
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(160, 60, 255, 0.08) inset',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          padding: '32px 28px 28px',
          color: '#fff',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(160, 60, 255, 0.18)',
              border: '1px solid rgba(160, 60, 255, 0.3)',
              fontSize: '18px',
            }}>
              ◎
            </span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>
              余额不足
            </h2>
          </div>

          {requiredCredits != null && displayAvailable != null ? (
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.62)' }}>
              本次生成预计需要{' '}
              <span style={{ color: 'rgba(200, 160, 255, 0.95)', fontWeight: 600 }}>
                {requiredCredits.toLocaleString()} credits
              </span>
              ，你当前可用余额为{' '}
              <span style={{ color: 'rgba(255, 200, 100, 0.9)', fontWeight: 600 }}>
                {displayAvailable.toLocaleString()} credits
              </span>
              。请充值后继续生成。
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.62)' }}>
              当前余额不足，无法完成本次生成。请充值 credits 后继续。
            </p>
          )}
        </div>

        {/* Plan cards */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{
            margin: '0 0 12px',
            fontSize: '10.5px',
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)',
          }}>
            充值方案
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {PLANS.map((plan) => (
              <div
                key={plan.name}
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
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'rgba(255,255,255,0.9)' }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(200,160,255,0.95)', marginBottom: '2px' }}>
                  {plan.credits.toLocaleString()}
                </div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>
                  credits
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>
                  {plan.price}
                </div>
              </div>
            ))}
          </div>

          <p style={{
            margin: '12px 0 0',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.28)',
            textAlign: 'center',
            letterSpacing: '0.01em',
          }}>
            支付接入即将开放
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            disabled
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '10px',
              border: '1px solid rgba(160, 60, 255, 0.2)',
              background: 'rgba(160, 60, 255, 0.1)',
              color: 'rgba(200, 160, 255, 0.45)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            了解充值方案
            <span style={{
              fontSize: '9px',
              background: 'rgba(160, 60, 255, 0.18)',
              border: '1px solid rgba(160, 60, 255, 0.25)',
              borderRadius: '4px',
              padding: '1px 5px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              Soon
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.70)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
