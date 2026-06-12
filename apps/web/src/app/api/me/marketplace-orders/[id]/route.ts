import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── PATCH /api/me/marketplace-orders/[id] ────────────────────────────────────
// action: 'cancel' → buyer cancels their PENDING order  (PENDING → CANCELLED)
// action: 'reject' → seller rejects a PENDING order     (PENDING → REJECTED)

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: { action?: string; failureReason?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const { action, failureReason } = body

    if (action !== 'cancel' && action !== 'reject' && action !== 'quote') {
      return jsonError('INVALID_ACTION', 'action 必须为 cancel、reject 或 quote。', 400)
    }

    const order = await db.marketplaceOrder.findUnique({ where: { id: params.id } })
    if (!order) return jsonError('ORDER_NOT_FOUND', '订单不存在。', 404)
    if (order.status !== 'PENDING') {
      return jsonError('ORDER_NOT_PENDING', '只有 PENDING 状态的订单可以操作。', 409)
    }

    if (action === 'cancel') {
      if (order.buyerId !== user.id) {
        return jsonError('ACTION_NOT_ALLOWED', '只有买家可以取消申请。', 403)
      }
      const updated = await db.marketplaceOrder.update({
        where: { id: params.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          failureReason: failureReason?.trim() || null,
        },
      })
      return jsonOk({ order: serializeOrder(updated) })
    }

    if (action === 'reject') {
      if (order.sellerId !== user.id) {
        return jsonError('ACTION_NOT_ALLOWED', '只有卖家可以拒绝申请。', 403)
      }
      const updated = await db.marketplaceOrder.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          failureReason: failureReason?.trim() || null,
        },
      })
      return jsonOk({ order: serializeOrder(updated) })
    }

    // action === 'quote'
    if (order.sellerId !== user.id) {
      return jsonError('ACTION_NOT_ALLOWED', '只有卖家可以确认报价意向。', 403)
    }
    const updated = await db.marketplaceOrder.update({
      where: { id: params.id },
      data: { status: 'QUOTED', quotedAt: new Date() },
    })
    return jsonOk({ order: serializeOrder(updated) })
  } catch (error) {
    console.error('[me/marketplace-orders/[id]] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('UPDATE_ORDER_FAILED', '更新订单状态失败，请稍后重试。', 500)
  }
}

function serializeOrder(o: {
  id: string
  listingId: string
  assetId: string
  buyerId: string
  sellerId: string
  priceCredits: number
  platformFeeCredits: number | null
  sellerAmountCredits: number | null
  status: string
  message: string | null
  failureReason: string | null
  metadataJson: unknown
  createdAt: Date
  updatedAt: Date
  cancelledAt: Date | null
  rejectedAt: Date | null
  quotedAt: Date | null
}) {
  return {
    id: o.id,
    listingId: o.listingId,
    assetId: o.assetId,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    priceCredits: o.priceCredits,
    status: o.status,
    message: o.message,
    failureReason: o.failureReason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    rejectedAt: o.rejectedAt?.toISOString() ?? null,
    quotedAt: o.quotedAt?.toISOString() ?? null,
  }
}
