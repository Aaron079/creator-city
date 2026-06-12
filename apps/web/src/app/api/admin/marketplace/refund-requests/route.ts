import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

// ─── GET /api/admin/marketplace/refund-requests ────────────────────────────────
// Admin lists marketplace refund requests. Supports ?status= filter.

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('FORBIDDEN', '无权限：仅管理员可访问。', 403)

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']
    const where = statusFilter && validStatuses.includes(statusFilter)
      ? { status: statusFilter as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' }
      : {}

    const requests = await db.marketplaceRefundRequest.findMany({
      where,
      include: {
        buyer: { select: { id: true, displayName: true, username: true } },
        seller: { select: { id: true, displayName: true, username: true } },
        asset: { select: { id: true, title: true, name: true, type: true } },
        order: { select: { id: true, priceCredits: true, completedAt: true, sellerAmountCredits: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return jsonOk({
      items: requests.map((r) => ({
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
        buyer: { id: r.buyer.id, displayName: r.buyer.displayName, username: r.buyer.username ?? null },
        seller: { id: r.seller.id, displayName: r.seller.displayName, username: r.seller.username ?? null },
        asset: { id: r.asset.id, title: r.asset.title ?? r.asset.name, type: r.asset.type },
        order: {
          id: r.order.id,
          priceCredits: r.order.priceCredits,
          sellerAmountCredits: r.order.sellerAmountCredits,
          completedAt: r.order.completedAt?.toISOString() ?? null,
        },
      })),
    })
  } catch (error) {
    console.error('[admin/marketplace/refund-requests] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('REFUND_REQUESTS_FETCH_FAILED', '获取退款申请列表失败。', 500)
  }
}
