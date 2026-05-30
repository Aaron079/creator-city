import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { approveManualRecharge } from '@/lib/credits/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser()
  if (!admin) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 })
  if (admin.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限' }, { status: 403 })

  let body: { orderId?: string; note?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ success: false, errorCode: 'INVALID_JSON', message: '请求体必须是 JSON' }, { status: 400 })
  }

  const orderId = body.orderId?.trim()
  if (!orderId) {
    return NextResponse.json({ success: false, errorCode: 'MISSING_ORDER_ID', message: 'orderId 必填' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined

  let order: Awaited<ReturnType<typeof db.paymentOrder.findUnique>>
  try {
    order = await db.paymentOrder.findUnique({ where: { id: orderId } })
  } catch (err) {
    console.error('[POST /api/admin/payments/china/approve] DB lookup failed', err)
    return NextResponse.json(
      { success: false, errorCode: 'ADMIN_APPROVE_FAILED', message: '确认到账失败，请稍后重试。' },
      { status: 500 },
    )
  }

  if (!order) {
    return NextResponse.json({ success: false, errorCode: 'ORDER_NOT_FOUND', message: '订单不存在' }, { status: 404 })
  }
  if (order.provider !== 'manual') {
    return NextResponse.json({ success: false, errorCode: 'NOT_MANUAL_ORDER', message: '只能审批人工充值订单' }, { status: 400 })
  }
  if (order.credits < 1) {
    return NextResponse.json({ success: false, errorCode: 'INVALID_CREDITS', message: '积分数量无效' }, { status: 400 })
  }

  // Idempotent: already approved
  if (order.status === 'PAID') {
    return NextResponse.json({ success: true, idempotent: true, credits: order.credits })
  }

  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { success: false, errorCode: 'ORDER_NOT_PENDING', message: `订单状态为 ${order.status}，无法审批` },
      { status: 409 },
    )
  }

  try {
    await approveManualRecharge(orderId, admin.id, note)
    return NextResponse.json({ success: true, idempotent: false, credits: order.credits })
  } catch (err) {
    console.error('[POST /api/admin/payments/china/approve]', err)
    return NextResponse.json({ success: false, errorCode: 'ADMIN_APPROVE_FAILED', message: '确认到账失败，请稍后重试。' }, { status: 500 })
  }
}
