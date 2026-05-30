'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type BalanceState =
  | { status: 'loading' }
  | { status: 'ok'; availableCredits: number }
  | { status: 'unauthenticated' }
  | { status: 'error' }

export function CreditBalanceBadge() {
  const [state, setState] = useState<BalanceState>({ status: 'loading' })

  const fetchBalance = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/credits/balance', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (res.status === 401) {
        setState({ status: 'unauthenticated' })
        return
      }
      if (!res.ok) {
        setState({ status: 'error' })
        return
      }
      const data = await res.json() as { success: boolean; availableCredits?: number }
      if (data.success && typeof data.availableCredits === 'number') {
        setState({ status: 'ok', availableCredits: data.availableCredits })
      } else {
        setState({ status: 'error' })
      }
    } catch {
      setState({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    void fetchBalance()
  }, [fetchBalance])

  if (state.status === 'unauthenticated') return null

  if (state.status === 'loading') {
    return (
      <span className="canvas-credit-badge is-loading" aria-label="加载余额中">
        ···
      </span>
    )
  }

  if (state.status === 'error') {
    return (
      <span className="canvas-credit-badge is-error" title="余额加载失败">
        Credits —
      </span>
    )
  }

  return (
    <Link
      href="/billing?region=CN&method=manual"
      className="canvas-credit-badge"
      style={{ pointerEvents: 'auto', cursor: 'pointer', textDecoration: 'none' }}
      title={`可用积分: ${state.availableCredits.toLocaleString()} — 点击充值`}
    >
      ◎ {state.availableCredits.toLocaleString()}
    </Link>
  )
}
