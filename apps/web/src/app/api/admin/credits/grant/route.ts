/** Historical manual orders remain reconcilable; new direct grants are retired. */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { approveManualRecharge, rejectManualRecharge } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ success: false, errorCode: 'UNAUTHENTICATED', message: '请先登录' }, { status: 401 })
  if (admin.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限' }, { status: 403 })

  let body: {
    orderId?: string
    action?: string
    userId?: string
    targetUserEmail?: string
    amountCredits?: unknown
    note?: string
  }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ success: false, errorCode: 'INVALID_JSON', message: '请求体必须是 JSON' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined

  // ── Mode A: approve / reject a pending order ─────────────────────────────────
  if (body.orderId) {
    if (body.action === 'approve') {
      await approveManualRecharge(body.orderId, admin.id, note)
      return NextResponse.json({ success: true, action: 'approved' })
    }
    if (body.action === 'reject') {
      await rejectManualRecharge(body.orderId, admin.id, note)
      return NextResponse.json({ success: true, action: 'rejected' })
    }
    return NextResponse.json({ success: false, errorCode: 'INVALID_ACTION', message: 'action 必须是 approve 或 reject' }, { status: 400 })
  }

  return NextResponse.json({ success: false, errorCode: 'CREDITS_RETIRED', message: 'City 积分制度已停用，不再发放新积分。' }, { status: 410 })
}
