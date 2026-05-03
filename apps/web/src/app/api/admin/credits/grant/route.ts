import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { approveManualRecharge, rejectManualRecharge, adminDirectGrant } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ message: '请先登录' }, { status: 401 })
  if (admin.role !== 'ADMIN') return NextResponse.json({ message: '无权限' }, { status: 403 })

  try {
    const body = await req.json() as {
      // Mode A: approve/reject a pending order
      orderId?: string
      action?: 'approve' | 'reject'
      // Mode B: direct grant (no order)
      userId?: string
      amountCredits?: unknown
      // Shared
      note?: string
    }

    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined

    // Mode A: order action
    if (body.orderId) {
      if (body.action === 'approve') {
        await approveManualRecharge(body.orderId, admin.id, note)
        return NextResponse.json({ ok: true, action: 'approved' })
      }
      if (body.action === 'reject') {
        await rejectManualRecharge(body.orderId, admin.id, note)
        return NextResponse.json({ ok: true, action: 'rejected' })
      }
      return NextResponse.json({ message: 'action 必须是 approve 或 reject' }, { status: 400 })
    }

    // Mode B: direct grant
    if (!body.userId) {
      return NextResponse.json({ message: '必须提供 orderId 或 userId' }, { status: 400 })
    }
    const amountCredits = Number(body.amountCredits)
    if (!Number.isInteger(amountCredits) || amountCredits < 1 || amountCredits > 1_000_000) {
      return NextResponse.json({ message: '积分数量必须在 1–1,000,000 之间' }, { status: 400 })
    }

    await adminDirectGrant({ userId: body.userId, amountCredits, adminUserId: admin.id, note })
    return NextResponse.json({ ok: true, action: 'granted', amountCredits })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '操作失败'
    console.error('[admin/credits/grant]', err)
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}
