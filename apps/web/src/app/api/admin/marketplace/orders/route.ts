import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { MarketplaceOrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const VALID_STATUSES: MarketplaceOrderStatus[] = [
  'PENDING', 'QUOTED', 'COMPLETED', 'REFUNDED', 'CANCELLED', 'REJECTED',
]

// ─── GET /api/admin/marketplace/orders ───────────────────────────────────────
// Admin views all platform MarketplaceOrders. Read-only.
// Supports ?status= filter and ?limit= (max 100).

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') as MarketplaceOrderStatus | null
    const limitParam = parseInt(searchParams.get('limit') ?? '100', 10)
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 100 : limitParam), 100)

    const statusWhere =
      statusFilter && VALID_STATUSES.includes(statusFilter) ? statusFilter : undefined

    const includeArgs = {
      buyer: {
        select: { id: true, displayName: true, username: true, email: true },
      },
      seller: {
        select: { id: true, displayName: true, username: true, email: true },
      },
      asset: {
        select: { id: true, title: true, name: true, type: true, thumbnailUrl: true },
      },
      listing: {
        select: { id: true, priceCredits: true, licenseMode: true, status: true, title: true },
      },
      refundRequest: {
        select: {
          id: true,
          status: true,
          reason: true,
          adminNote: true,
          executionNote: true,
          executedAt: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    } as const

    const orders = await db.marketplaceOrder.findMany({
      where: statusWhere ? { status: statusWhere } : undefined,
      include: includeArgs,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return jsonOk({
      items: orders.map((o) => ({
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
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        cancelledAt: o.cancelledAt?.toISOString() ?? null,
        rejectedAt: o.rejectedAt?.toISOString() ?? null,
        quotedAt: o.quotedAt?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        refundedAt: o.refundedAt?.toISOString() ?? null,
        buyer: {
          id: o.buyer.id,
          displayName: o.buyer.displayName,
          username: o.buyer.username ?? null,
          email: o.buyer.email,
        },
        seller: {
          id: o.seller.id,
          displayName: o.seller.displayName,
          username: o.seller.username ?? null,
          email: o.seller.email,
        },
        asset: {
          id: o.asset.id,
          title: o.asset.title ?? o.asset.name,
          type: o.asset.type,
          thumbnailUrl: o.asset.thumbnailUrl ?? null,
        },
        listing: {
          id: o.listing.id,
          title: o.listing.title,
          priceCredits: o.listing.priceCredits,
          licenseMode: o.listing.licenseMode,
          status: o.listing.status,
        },
        refundRequest: o.refundRequest
          ? {
              id: o.refundRequest.id,
              status: o.refundRequest.status,
              reason: o.refundRequest.reason,
              adminNote: o.refundRequest.adminNote,
              executionNote: o.refundRequest.executionNote,
              executedAt: o.refundRequest.executedAt?.toISOString() ?? null,
              createdAt: o.refundRequest.createdAt.toISOString(),
              reviewedAt: o.refundRequest.reviewedAt?.toISOString() ?? null,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error('[admin/marketplace/orders] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('ADMIN_MARKETPLACE_ORDERS_FAILED', '获取订单列表失败。', 500)
  }
}
