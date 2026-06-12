import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') // 'buyer' | 'seller' | null (both)

    const where =
      role === 'buyer'
        ? { buyerId: user.id }
        : role === 'seller'
          ? { sellerId: user.id }
          : { OR: [{ buyerId: user.id }, { sellerId: user.id }] }

    const orders = await db.marketplaceOrder.findMany({
      where,
      include: {
        listing: {
          select: { id: true, title: true, licenseMode: true, priceCredits: true, status: true },
        },
        asset: {
          select: { id: true, title: true, name: true, type: true, thumbnailUrl: true },
        },
        buyer: {
          select: { id: true, displayName: true, username: true, profile: { select: { avatarUrl: true } } },
        },
        seller: {
          select: { id: true, displayName: true, username: true, profile: { select: { avatarUrl: true } } },
        },
        refundRequest: {
          select: { id: true, status: true, reason: true, adminNote: true, executedAt: true, executionNote: true, createdAt: true, reviewedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const items = orders.map((o) => ({
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
      listing: {
        id: o.listing.id,
        title: o.listing.title,
        licenseMode: o.listing.licenseMode,
        priceCredits: o.listing.priceCredits,
        status: o.listing.status,
      },
      asset: {
        id: o.asset.id,
        title: o.asset.title ?? o.asset.name,
        type: o.asset.type,
        thumbnailUrl: o.asset.thumbnailUrl ?? null,
      },
      buyer: {
        id: o.buyer.id,
        displayName: o.buyer.displayName,
        username: o.buyer.username ?? null,
        avatarUrl: o.buyer.profile?.avatarUrl ?? null,
      },
      seller: {
        id: o.seller.id,
        displayName: o.seller.displayName,
        username: o.seller.username ?? null,
        avatarUrl: o.seller.profile?.avatarUrl ?? null,
      },
      refundRequest: o.refundRequest ? {
        id: o.refundRequest.id,
        status: o.refundRequest.status,
        reason: o.refundRequest.reason,
        adminNote: o.refundRequest.adminNote,
        executedAt: o.refundRequest.executedAt?.toISOString() ?? null,
        executionNote: o.refundRequest.executionNote,
        createdAt: o.refundRequest.createdAt.toISOString(),
        reviewedAt: o.refundRequest.reviewedAt?.toISOString() ?? null,
      } : null,
    }))

    return jsonOk({ items })
  } catch (error) {
    console.error('[me/marketplace-orders] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2021' || prismaCode === 'P2022') {
      return jsonOk({ items: [] })
    }
    return jsonError('ORDERS_FETCH_FAILED', '获取订单列表失败。', 500)
  }
}
