'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CreditPackagesPanel } from './CreditPackagesPanel'

interface BalanceResult {
  availableCredits: number
}

interface CreditInsufficientModalProps {
  open: boolean
  onClose: () => void
  requiredCredits?: number
  availableCredits?: number
}

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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const displayAvailable = freshBalance ?? availableCreditsFromError
  const gap = requiredCredits != null && displayAvailable != null
    ? Math.max(0, requiredCredits - displayAvailable)
    : null

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
        background: 'rgba(0,0,0,0.72)',
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
          maxWidth: '500px',
          borderRadius: '20px',
          border: '1px solid rgba(160, 60, 255, 0.28)',
          background: 'linear-gradient(160deg, rgba(18,10,28,0.97), rgba(10,6,18,0.99))',
          boxShadow: '0 32px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(160,60,255,0.08) inset',
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
            position: 'absolute', top: '16px', right: '16px',
            width: '30px', height: '30px', borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(160,60,255,0.18)', border: '1px solid rgba(160,60,255,0.3)',
              fontSize: '18px',
            }}>◎</span>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '-0.01em' }}>
              余额不足
            </h2>
          </div>

          {requiredCredits != null && displayAvailable != null ? (
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.62)' }}>
              本次生成预计需要{' '}
              <span style={{ color: 'rgba(200,160,255,0.95)', fontWeight: 600 }}>
                {requiredCredits.toLocaleString()} credits
              </span>
              ，你当前可用余额为{' '}
              <span style={{ color: 'rgba(255,200,100,0.9)', fontWeight: 600 }}>
                {displayAvailable.toLocaleString()} credits
              </span>
              {gap != null && gap > 0 && (
                <>，还差 <span style={{ color: 'rgba(255,120,100,0.9)', fontWeight: 600 }}>{gap.toLocaleString()} credits</span></>
              )}
              。
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: '1.6', color: 'rgba(255,255,255,0.62)' }}>
              当前余额不足，无法完成本次生成。请充值 credits 后继续。
            </p>
          )}
        </div>

        {/* Package plans */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
          }}>
            充值方案
          </p>
          <CreditPackagesPanel limit={3} />
        </div>

        {/* Operations notice */}
        <div style={{
          marginBottom: '20px',
          padding: '12px 14px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.65', color: 'rgba(255,255,255,0.45)' }}>
            支付接入即将开放。<br />
            当前测试期请联系管理员充值 credits。
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            disabled
            style={{
              flex: 1, height: '40px', borderRadius: '10px',
              border: '1px solid rgba(160,60,255,0.2)',
              background: 'rgba(160,60,255,0.1)',
              color: 'rgba(200,160,255,0.45)', fontSize: '13px', fontWeight: 500,
              cursor: 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            购买积分
            <span style={{
              fontSize: '9px', background: 'rgba(160,60,255,0.18)',
              border: '1px solid rgba(160,60,255,0.25)', borderRadius: '4px',
              padding: '1px 5px', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Soon</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1, height: '40px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.70)', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
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
