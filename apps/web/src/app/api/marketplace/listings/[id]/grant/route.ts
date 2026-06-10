import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { AssetListingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── POST /api/marketplace/listings/[id]/grant ────────────────────────────────
// Creates a free LicenseGrant for the current user.
// Only ACTIVE listings with priceCredits === 0 are eligible.

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const listing = await db.assetListing.findFirst({
      where: { id: params.id },
      include: {
        asset: { select: { id: true, isPublic: true, status: true, ownerId: true } },
      },
    })

    if (!listing) return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)
    if (listing.status !== AssetListingStatus.ACTIVE) {
      return jsonError('LISTING_NOT_ACTIVE', '只有 ACTIVE 状态的 Listing 可以领取授权。', 400)
    }
    if (!listing.asset.isPublic || listing.asset.status !== 'READY') {
      return jsonError('ASSET_NOT_AVAILABLE', '资产当前不可用。', 400)
    }

    // Paid listings are not supported yet
    if (listing.priceCredits === null || listing.priceCredits > 0) {
      return jsonError('PAID_LISTING_NOT_SUPPORTED', '付费授权功能规划中，当前仅支持免费授权（priceCredits = 0）。', 400)
    }

    // Sellers cannot grant themselves
    if (listing.sellerId === user.id) {
      return jsonError('CANNOT_GRANT_OWN_LISTING', '不能领取自己上架的资产授权。', 400)
    }

    // Check for existing grant
    const existing = await db.licenseGrant.findUnique({
      where: { listingId_buyerId: { listingId: listing.id, buyerId: user.id } },
    })
    if (existing) {
      return jsonError('ALREADY_GRANTED', '你已经获得了该资产的授权。', 409)
    }

    const termsJson = {
      commercialUse: listing.commercialUse,
      derivativeAllowed: listing.derivativeAllowed,
      attributionRequired: listing.attributionRequired,
      source: 'free_license_grant',
      listingPublishedAt: listing.publishedAt?.toISOString() ?? null,
    }

    const grant = await db.licenseGrant.create({
      data: {
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.sellerId,
        assetId: listing.assetId,
        licenseMode: listing.licenseMode,
        paidCredits: 0,
        status: 'ACTIVE',
        termsJson,
      },
    })

    return jsonOk({ grant: serializeGrant(grant) }, { status: 201 })
  } catch (error) {
    console.error('[marketplace/listings/[id]/grant] POST failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('GRANT_FAILED', '创建授权失败。', 500)
  }
}

// ─── GET /api/marketplace/listings/[id]/grant ─────────────────────────────────
// Check whether the current user already has a grant for this listing.

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonOk({ granted: false })

    const grant = await db.licenseGrant.findUnique({
      where: { listingId_buyerId: { listingId: params.id, buyerId: user.id } },
    })

    if (!grant || grant.status !== 'ACTIVE') return jsonOk({ granted: false })
    return jsonOk({ granted: true, grant: serializeGrant(grant) })
  } catch (error) {
    console.error('[marketplace/listings/[id]/grant] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('GRANT_CHECK_FAILED', '授权状态查询失败。', 500)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
