/**
 * GET /api/credits/balance
 *
 * Read-only wallet balance for the current user.
 * Returns consistent success/error envelope for client-side badge display.
 *
 * Does NOT: write ledger, modify wallet, create orders, or trigger billing.
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOrCreateWallet } from '@/lib/credits/server'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET() {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch (err) {
    console.error('[credits/balance] auth error', err)
    if (isDbConnectionError(err)) {
      return NextResponse.json(
        { success: false, errorCode: 'SERVICE_UNAVAILABLE', message: '服务暂时不可用，请稍后重试' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { success: false, errorCode: 'AUTH_ERROR', message: '认证失败，请刷新后重试' },
      { status: 500 },
    )
  }
  if (!user) {
    return NextResponse.json(
      { success: false, errorCode: 'UNAUTHENTICATED', message: '请先登录' },
      { status: 401 },
    )
  }

  try {
    const wallet = await getOrCreateWallet(user.id)
    return NextResponse.json({
      success: true,
      availableCredits: wallet.balance,
      frozenCredits: wallet.frozenBalance,
      totalCredits: wallet.balance + wallet.frozenBalance,
      totalPurchased: wallet.totalPurchased,
      totalConsumed: wallet.totalConsumed,
    })
  } catch (err) {
    console.error('[credits/balance]', err)
    if (isDbConnectionError(err)) {
      return NextResponse.json(
        { success: false, errorCode: 'SERVICE_UNAVAILABLE', message: '服务繁忙，请稍后重试' },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { success: false, errorCode: 'WALLET_ERROR', message: '获取余额失败' },
      { status: 500 },
    )
  }
}
