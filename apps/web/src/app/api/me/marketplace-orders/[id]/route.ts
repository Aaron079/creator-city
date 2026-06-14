import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { settleMarketplaceOrder, MarketplaceSettleError } from '@/lib/marketplace/settle'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── PATCH /api/me/marketplace-orders/[id] ────────────────────────────────────
// action: 'cancel' → buyer cancels their PENDING order  (PENDING → CANCELLED)
// action: 'reject' → seller rejects a PENDING order     (PENDING → REJECTED)
// action: 'quote'  → seller confirms quote intent       (PENDING → QUOTED)
// action: 'pay'    → buyer pays and settles             (QUOTED  → COMPLETED)

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: { action?: string; failureReason?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const { action, failureReason } = body

    if (action !== 'cancel' && action !== 'reject' && action !== 'quote' && action !== 'pay') {
      return jsonError('INVALID_ACTION', 'action 必须为 cancel、reject、quote 或 pay。', 400)
    }

    // 'pay' has its own flow (requires QUOTED, not PENDING)
    if (action === 'pay') {
      // Feature flag: credit settlement is disabled for first launch
      if (process.env.MARKETPLACE_CREDITS_PAYMENT_ENABLED !== 'true') {
        return jsonError('FEATURE_DISABLED', '积分结算功能第一版暂未开放。', 503)
      }
      try {
        const result = await settleMarketplaceOrder(params.id, user.id)
        const order = result.order!
        return jsonOk({
          idempotent: result.idempotent,
          order: serializeOrder(order),
          grant: result.grant ? serializeGrant(result.grant) : null,
          priceCredits: result.priceCredits,
          platformFeeCredits: result.platformFeeCredits,
          sellerAmountCredits: result.sellerAmountCredits,
        })
      } catch (err) {
        if (err instanceof MarketplaceSettleError) {
          const status =
            err.code === 'ORDER_NOT_FOUND' ? 404
            : err.code === 'NOT_BUYER' || err.code === 'ACTION_NOT_ALLOWED' ? 403
            : err.code === 'INSUFFICIENT_CREDITS' ? 402
            : err.code === 'SETTLEMENT_FAILED' ? 409
            : 400
          return jsonError(err.code, err.message, status, err.extra)
        }
        throw err
      }
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
  completedAt: Date | null
}) {
  return {
    id: o.id,
    listingId: o.listingId,
    assetId: o.assetId,
    buyerId: o.buyerId,
    sellerId: o.sellerId,
    priceCredits: o.priceCredits,
    platformFeeCredits: o.platformFeeCredits,
    sellerAmountCredits: o.sellerAmountCredits,
    status: o.status,
    message: o.message,
    failureReason: o.failureReason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    rejectedAt: o.rejectedAt?.toISOString() ?? null,
    quotedAt: o.quotedAt?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
  }
}

function serializeGrant(g: {
  id: string
  listingId: string
  buyerId: string
  sellerId: string
  assetId: string
  licenseMode: string
  paidCredits: number
  status: string
  grantedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  termsJson: unknown
}) {
  return {
    id: g.id,
    listingId: g.listingId,
    buyerId: g.buyerId,
    sellerId: g.sellerId,
    assetId: g.assetId,
    licenseMode: g.licenseMode,
    paidCredits: g.paidCredits,
    status: g.status,
    grantedAt: g.grantedAt.toISOString(),
    expiresAt: g.expiresAt?.toISOString() ?? null,
    revokedAt: g.revokedAt?.toISOString() ?? null,
    termsJson: g.termsJson,
  }
}
