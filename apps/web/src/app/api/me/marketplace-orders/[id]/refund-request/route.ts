import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── POST /api/me/marketplace-orders/[id]/refund-request ─────────────────
// Buyer submits a manual refund request for a COMPLETED paid order.
// Does NOT execute any accounting — only records intent for admin review.

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    // Feature flag: refund request submission is disabled for first launch
    if (process.env.MARKETPLACE_REFUND_REQUEST_ENABLED !== 'true') {
      return jsonError('FEATURE_DISABLED', '退款申请功能第一版暂未开放。', 503)
    }

    let body: { reason?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const reason = body.reason?.trim() ?? ''
    if (!reason || reason.length < 10) {
      return jsonError('REFUND_REASON_REQUIRED', '请填写退款申请原因（至少 10 个字）。', 400)
    }
    if (reason.length > 500) {
      return jsonError('REFUND_REASON_REQUIRED', '退款申请原因不能超过 500 字。', 400)
    }

    const order = await db.marketplaceOrder.findUnique({
      where: { id: params.id },
    })
    if (!order || order.buyerId !== user.id) {
      return jsonError('ORDER_NOT_FOUND', '订单不存在或无权访问。', 404)
    }
    if (order.status !== 'COMPLETED') {
      return jsonError('ORDER_NOT_COMPLETED', '只有已完成的付费订单可以申请人工退款。', 400)
    }
    if (order.priceCredits <= 0) {
      return jsonError('ORDER_NOT_COMPLETED', '免费订单不支持退款申请。', 400)
    }

    // Check if there's already a refund request for this order
    const existing = await db.marketplaceRefundRequest.findUnique({
      where: { orderId: params.id },
    })
    if (existing) {
      return jsonError('REFUND_REQUEST_EXISTS', '该订单已提交过退款申请。', 409, {
        refundRequest: serializeRefundRequest(existing),
      })
    }

    const refundRequest = await db.marketplaceRefundRequest.create({
      data: {
        id: randomUUID(),
        orderId: params.id,
        buyerId: user.id,
        sellerId: order.sellerId,
        assetId: order.assetId,
        status: 'PENDING',
        reason,
      },
    })

    return jsonOk({ refundRequest: serializeRefundRequest(refundRequest) }, { status: 201 })
  } catch (error) {
    console.error('[me/marketplace-orders/[id]/refund-request] POST failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUEST_CREATE_FAILED', '退款申请提交失败，请稍后重试。', 500)
  }
}

// ─── PATCH /api/me/marketplace-orders/[id]/refund-request ────────────────
// Buyer cancels their PENDING refund request.
// action: 'cancel'

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: { action?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    if (body.action !== 'cancel') {
      return jsonError('INVALID_ACTION', 'action 必须为 cancel。', 400)
    }

    const refundRequest = await db.marketplaceRefundRequest.findUnique({
      where: { orderId: params.id },
    })
    if (!refundRequest || refundRequest.buyerId !== user.id) {
      return jsonError('REFUND_REQUEST_NOT_FOUND', '退款申请不存在或无权访问。', 404)
    }
    if (refundRequest.status !== 'PENDING') {
      return jsonError('REFUND_REQUEST_NOT_PENDING', '只有待处理的退款申请可以撤销。', 409)
    }

    const updated = await db.marketplaceRefundRequest.update({
      where: { id: refundRequest.id },
      data: { status: 'CANCELLED', reviewedAt: new Date() },
    })

    return jsonOk({ refundRequest: serializeRefundRequest(updated) })
  } catch (error) {
    console.error('[me/marketplace-orders/[id]/refund-request] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUEST_UPDATE_FAILED', '撤销退款申请失败，请稍后重试。', 500)
  }
}

// ─── GET /api/me/marketplace-orders/[id]/refund-request ──────────────────
// Buyer reads their refund request status.

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const refundRequest = await db.marketplaceRefundRequest.findUnique({
      where: { orderId: params.id },
    })
    if (!refundRequest || refundRequest.buyerId !== user.id) {
      return jsonOk({ refundRequest: null })
    }

    return jsonOk({ refundRequest: serializeRefundRequest(refundRequest) })
  } catch (error) {
    console.error('[me/marketplace-orders/[id]/refund-request] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUEST_FETCH_FAILED', '获取退款申请状态失败。', 500)
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
