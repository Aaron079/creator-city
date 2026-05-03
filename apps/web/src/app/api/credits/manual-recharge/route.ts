import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { submitManualRechargeRequest } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })

  try {
    const body = await req.json() as { amountCredits?: unknown; note?: unknown }
    const amountCredits = Number(body.amountCredits)
    if (!Number.isInteger(amountCredits) || amountCredits < 1 || amountCredits > 1_000_000) {
      return NextResponse.json({ message: '积分数量必须在 1–1,000,000 之间' }, { status: 400 })
    }
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined

    const order = await submitManualRechargeRequest(user.id, amountCredits, note)
    return NextResponse.json({ orderId: order.id, status: order.status }, { status: 201 })
  } catch (err) {
    console.error('[credits/manual-recharge]', err)
    return NextResponse.json({ message: '提交申请失败，请稍后重试' }, { status: 500 })
  }
}
