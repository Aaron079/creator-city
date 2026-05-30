/**
 * POST /api/admin/credits/grant
 *
 * Admin-only. Supports three modes:
 *   Mode A — approve/reject a pending manual recharge order (orderId + action)
 *   Mode B — direct grant by userId (userId + amountCredits)
 *   Mode C — direct grant by email (targetUserEmail + amountCredits)
 *
 * This is an operations endpoint, not a user-facing payment endpoint.
 * All grants are recorded in CreditLedger with type = ADMIN_ADJUSTMENT.
 * Auth: session cookie, user.role must equal 'ADMIN'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { approveManualRecharge, rejectManualRecharge, adminDirectGrant, getOrCreateWallet } from '@/lib/credits/server'
import { db } from '@/lib/db'

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

  // ── Mode B / C: direct grant ─────────────────────────────────────────────────
  const amountCredits = Number(body.amountCredits)
  if (!Number.isInteger(amountCredits) || amountCredits < 1 || amountCredits > 100_000) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_AMOUNT', message: '积分数量必须在 1–100,000 之间' },
      { status: 400 },
    )
  }

  let targetUserId: string

  if (body.userId) {
    // Mode B: grant by userId
    targetUserId = body.userId
  } else if (body.targetUserEmail) {
    // Mode C: grant by email — look up user
    const email = body.targetUserEmail.trim().toLowerCase()
    const found = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (!found) {
      return NextResponse.json(
        { success: false, errorCode: 'USER_NOT_FOUND', message: `未找到邮箱 ${email} 对应的用户` },
        { status: 404 },
      )
    }
    targetUserId = found.id
  } else {
    return NextResponse.json(
      { success: false, errorCode: 'MISSING_TARGET', message: '必须提供 userId 或 targetUserEmail' },
      { status: 400 },
    )
  }

  try {
    await adminDirectGrant({ userId: targetUserId, amountCredits, adminUserId: admin.id, note })
    const wallet = await getOrCreateWallet(targetUserId)
    return NextResponse.json({
      success: true,
      userId: targetUserId,
      creditsGranted: amountCredits,
      availableCredits: wallet.balance,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '操作失败'
    console.error('[admin/credits/grant]', err)
    return NextResponse.json({ success: false, errorCode: 'GRANT_FAILED', message: msg }, { status: 500 })
  }
}
