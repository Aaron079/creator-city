import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── PATCH /api/admin/marketplace/refund-requests/[id] ────────────────────────
// Admin reviews a marketplace refund request.
// action: 'approve' → status=APPROVED (intent only — no accounting executed)
// action: 'reject'  → status=REJECTED
//
// IMPORTANT: APPROVED in P1-1 only records admin's review intent.
// Actual refund execution (buyer credit, seller reversal, grant revoke) is P1-2.

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('FORBIDDEN', '无权限：仅管理员可访问。', 403)

    let body: { action?: string; adminNote?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const { action, adminNote } = body

    if (action !== 'approve' && action !== 'reject') {
      return jsonError('INVALID_ACTION', 'action 必须为 approve 或 reject。', 400)
    }

    const refundRequest = await db.marketplaceRefundRequest.findUnique({
      where: { id: params.id },
    })
    if (!refundRequest) return jsonError('REFUND_REQUEST_NOT_FOUND', '退款申请不存在。', 404)
    if (refundRequest.status !== 'PENDING') {
      return jsonError('REFUND_REQUEST_NOT_PENDING', '只有待处理的退款申请可以审核。', 409)
    }

    const now = new Date()

    if (action === 'reject') {
      const updated = await db.marketplaceRefundRequest.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote?.trim() || null,
          reviewedAt: now,
        },
      })
      return jsonOk({ refundRequest: serializeRefundRequest(updated) })
    }

    // action === 'approve'
    // P1-1: Records admin intent ONLY. No accounting. No wallet changes. No LicenseGrant revoke.
    const updated = await db.marketplaceRefundRequest.update({
      where: { id: params.id },
      data: {
        status: 'APPROVED',
        adminNote: adminNote?.trim() || null,
        reviewedAt: now,
      },
    })
    return jsonOk({
      refundRequest: serializeRefundRequest(updated),
      warning: 'APPROVED 仅代表人工审核通过意向。实际退款执行（账务反转、LicenseGrant 撤销）将在 P1-2 实现。',
    })
  } catch (error) {
    console.error('[admin/marketplace/refund-requests/[id]] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUEST_UPDATE_FAILED', '审核退款申请失败，请稍后重试。', 500)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeRefundRequest(r: {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  assetId: string
  status: string
  reason: string
  adminNote: string | null
  createdAt: Date
  reviewedAt: Date | null
}) {
  return {
    id: r.id,
    orderId: r.orderId,
    buyerId: r.buyerId,
    sellerId: r.sellerId,
    assetId: r.assetId,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
  }
}
