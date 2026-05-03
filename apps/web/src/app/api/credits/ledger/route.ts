import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getLedger } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)

  try {
    const { items, total } = await getLedger(user.id, limit, offset)
    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        userId: e.userId,
        walletId: e.walletId,
        type: e.type.toLowerCase(),
        amountCredits: e.amountCredits ?? e.delta,
        balanceAfter: e.balance,
        relatedPaymentOrderId: e.paymentOrderId ?? null,
        relatedGenerationJobId: e.generationJobId ?? null,
        description: e.description ?? e.note ?? null,
        createdAt: e.createdAt,
      })),
      total,
    })
  } catch (err) {
    console.error('[credits/ledger]', err)
    return NextResponse.json({ message: '获取账本失败' }, { status: 500 })
  }
}
