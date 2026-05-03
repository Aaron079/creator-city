import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getOrCreateWallet } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })

  try {
    const wallet = await getOrCreateWallet(user.id)
    return NextResponse.json({
      id: wallet.id,
      userId: wallet.userId,
      balanceCredits: wallet.balance + wallet.frozenBalance,
      reservedCredits: wallet.frozenBalance,
      availableCredits: wallet.balance,
      lifetimePurchasedCredits: wallet.totalPurchased,
      lifetimeSpentCredits: wallet.totalConsumed,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    })
  } catch (err) {
    console.error('[credits/wallet]', err)
    return NextResponse.json({ message: '获取钱包失败' }, { status: 500 })
  }
}
