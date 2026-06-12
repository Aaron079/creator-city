import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { AssetListingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── POST /api/marketplace/listings/[id]/orders ───────────────────────────────
// Buyer submits a paid authorization request (MarketplaceOrder PENDING).
// No wallet, no billing, no LicenseGrant created.

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: { message?: string } = {}
    try { body = await _request.json() } catch { /* no body is fine */ }

    const listing = await db.assetListing.findFirst({
      where: { id: params.id },
      include: { asset: { select: { id: true, isPublic: true, status: true } } },
    })

    if (!listing) return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)
    if (listing.status !== AssetListingStatus.ACTIVE) {
      return jsonError('LISTING_NOT_ACTIVE', '只有 ACTIVE 状态的 Listing 可以提交申请。', 400)
    }
    if (!listing.asset.isPublic || listing.asset.status !== 'READY') {
      return jsonError('ASSET_NOT_AVAILABLE', '资产当前不可用。', 400)
    }
    if (listing.priceCredits === null) {
      return jsonError('PRICE_NOT_SET', '该资产价格未设定，暂不可申请。', 400)
    }
    if (listing.priceCredits === 0) {
      return jsonError('FREE_LISTING_USE_GRANT', '免费资产请使用免费领取授权。', 400)
    }
    if (listing.sellerId === user.id) {
      return jsonError('CANNOT_ORDER_OWN_LISTING', '不能申请自己上架的资产授权。', 400)
    }

    // Check if buyer already has an active LicenseGrant for this listing
    const existingGrant = await db.licenseGrant.findUnique({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: user.id } },
    })
    if (existingGrant?.status === 'ACTIVE') {
      return jsonError('ALREADY_GRANTED', '你已经获得了该资产的授权。', 409)
    }

    // Check for existing PENDING order (prevent duplicates)
    const existingOrder = await db.marketplaceOrder.findFirst({
      where: { listingId: listing.id, buyerId: user.id, status: 'PENDING' },
    })
    if (existingOrder) {
      return jsonError('ORDER_ALREADY_PENDING', '你已提交过该资产的授权申请，请等待处理。', 409, {
        order: serializeOrder(existingOrder),
      })
    }

    const order = await db.marketplaceOrder.create({
      data: {
        listingId: listing.id,
        assetId: listing.assetId,
        buyerId: user.id,
        sellerId: listing.sellerId,
        priceCredits: listing.priceCredits,
        status: 'PENDING',
        message: body.message?.trim() || null,
        metadataJson: {
          source: 'paid_authorization_request',
          listingLicenseMode: listing.licenseMode,
          listingPublishedAt: listing.publishedAt?.toISOString() ?? null,
          noPaymentCaptured: true,
        },
      },
    })

    return jsonOk({ order: serializeOrder(order) }, { status: 201 })
  } catch (error) {
    console.error('[marketplace/listings/[id]/orders] POST failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2021' || prismaCode === 'P2022') {
      return jsonError('ORDER_SCHEMA_NOT_DEPLOYED', '市场订单数据表尚未完成部署，请稍后重试。', 503)
    }
    return jsonError('ORDER_CREATE_FAILED', '提交授权申请失败，请稍后重试。', 500)
  }
}

// ─── GET /api/marketplace/listings/[id]/orders ────────────────────────────────
// Seller sees active orders (PENDING + QUOTED) for their listing.

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const listing = await db.assetListing.findFirst({ where: { id: params.id } })
    if (!listing) return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)
    if (listing.sellerId !== user.id) return jsonError('FORBIDDEN', '只有卖家可以查看订单列表。', 403)

    const orders = await db.marketplaceOrder.findMany({
      where: { listingId: params.id, status: { in: ['PENDING', 'QUOTED'] } },
      include: {
        buyer: { select: { id: true, displayName: true, username: true, profile: { select: { avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return jsonOk({
      orders: orders.map((o) => ({
        ...serializeOrder(o),
        buyer: { id: o.buyer.id, displayName: o.buyer.displayName, username: o.buyer.username ?? null, avatarUrl: o.buyer.profile?.avatarUrl ?? null },
      })),
    })
  } catch (error) {
    console.error('[marketplace/listings/[id]/orders] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('ORDERS_FETCH_FAILED', '获取订单列表失败。', 500)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    quotedAt: o.quotedAt?.toISOString() ?? null,
  }
}
