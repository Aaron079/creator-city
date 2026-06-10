import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { AssetListingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const REUSABLE_MODES = new Set(['reusable_noncommercial', 'reusable_commercial'])

// ─── GET ──────────────────────────────────────────────────────────────────────
// Public: ?assetId=&mine=true → returns seller's own listing for that asset (any status)
// Default: returns all ACTIVE listings for the marketplace

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('assetId')
    const mine = searchParams.get('mine') === 'true'

    // Seller lookup: GET /api/marketplace/listings?assetId=X&mine=true
    if (assetId && mine) {
      const listing = await db.assetListing.findFirst({
        where: {
          assetId,
          sellerId: user.id,
          status: { not: AssetListingStatus.ARCHIVED },
        },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { grants: { where: { status: 'ACTIVE' } } } } },
      })
      if (!listing) return jsonOk({ listing: null, grantCount: 0 })
      const { _count, ...listingData } = listing
      return jsonOk({ listing: serializeListing(listingData), grantCount: _count.grants })
    }

    // Public marketplace: all ACTIVE listings on public READY assets
    const listings = await db.assetListing.findMany({
      where: {
        status: AssetListingStatus.ACTIVE,
        asset: { isPublic: true, status: 'READY' },
      },
      include: {
        asset: {
          select: {
            id: true,
            title: true,
            name: true,
            type: true,
            url: true,
            dataUrl: true,
            thumbnailUrl: true,
            provider: true,
            metadataJson: true,
          },
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    })

    const items = listings.map((l) => ({
      ...serializeListing(l),
      asset: {
        id: l.asset.id,
        title: l.asset.title ?? l.asset.name,
        type: l.asset.type,
        url: l.asset.url || l.asset.dataUrl || null,
        thumbnailUrl: l.asset.thumbnailUrl ?? null,
        provider: l.asset.provider ?? null,
        metadataJson: l.asset.metadataJson,
      },
      seller: {
        id: l.seller.id,
        displayName: l.seller.displayName,
        username: l.seller.username ?? null,
        avatarUrl: l.seller.profile?.avatarUrl ?? null,
      },
    }))

    return jsonOk({ items })
  } catch (error) {
    console.error('[marketplace/listings] GET failed', { error })
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2021' || prismaCode === 'P2022') {
      return jsonError('LISTING_SCHEMA_NOT_DEPLOYED', '市场数据表尚未完成部署，请稍后重试或联系管理员。', 503)
    }
    return jsonError('LISTINGS_FETCH_FAILED', '获取市场列表失败。', 500)
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Create a new DRAFT listing for an asset the current user owns.

type PostBody = {
  assetId: string
  licenseMode?: string | null
  priceCredits?: number | null
  title?: string | null
  description?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: PostBody
    try {
      body = (await request.json()) as PostBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const { assetId } = body
    if (!assetId || typeof assetId !== 'string') {
      return jsonError('VALIDATION_FAILED', 'assetId 必填。', 400)
    }

    // Validate optional fields early
    if (body.priceCredits != null) {
      const price = Number(body.priceCredits)
      if (!Number.isInteger(price) || price < 0 || price > 999999) {
        return jsonError('VALIDATION_FAILED', 'priceCredits 必须是 0–999999 的整数。', 400)
      }
    }
    if (body.description && typeof body.description === 'string' && body.description.length > 500) {
      return jsonError('VALIDATION_FAILED', 'description 最多 500 字。', 400)
    }

    // Load asset
    const asset = await db.asset.findFirst({
      where: { id: assetId },
      select: { id: true, ownerId: true, isPublic: true, status: true, title: true, name: true, metadataJson: true },
    })
    if (!asset) return jsonError('ASSET_NOT_FOUND', '资产不存在或无权访问。', 404)
    if (asset.ownerId !== user.id) return jsonError('FORBIDDEN', '只有资产所有者可以创建 Listing。', 403)
    if (!asset.isPublic) return jsonError('ASSET_NOT_PUBLIC', '请先在资产详情页将资产设为公开，再创建 Listing。', 400)
    if (asset.status !== 'READY') {
      return jsonError('ASSET_NOT_READY', `资产当前状态为 ${asset.status ?? '未知'}，必须等资产变为 READY 状态后才能创建 Listing。`, 400)
    }

    // Resolve licenseMode
    const assetMeta =
      asset.metadataJson && typeof asset.metadataJson === 'object' && !Array.isArray(asset.metadataJson)
        ? (asset.metadataJson as Record<string, unknown>)
        : {}
    const li =
      assetMeta.licenseIntent && typeof assetMeta.licenseIntent === 'object' && !Array.isArray(assetMeta.licenseIntent)
        ? (assetMeta.licenseIntent as Record<string, unknown>)
        : null
    const assetLicenseMode = li && typeof li.mode === 'string' ? li.mode : null
    const licenseMode = (body.licenseMode ?? assetLicenseMode) as string | null
    if (!licenseMode) {
      return jsonError('LICENSE_INTENT_REQUIRED', '请先在授权意图区域选择授权类型并保存，再创建 Listing。', 400)
    }
    if (!REUSABLE_MODES.has(licenseMode)) {
      return jsonError('LICENSE_INTENT_NOT_REUSABLE', `当前授权意图（${licenseMode}）不支持上架。请选择「可复用 · 非商用」或「可复用 · 可商用」并保存后，再创建 Listing。`, 400)
    }

    // Check for existing non-archived listing
    const existing = await db.assetListing.findFirst({
      where: { assetId, status: { not: AssetListingStatus.ARCHIVED } },
    })
    if (existing) {
      return jsonError('LISTING_ALREADY_EXISTS', `该资产已有进行中的 Listing（状态：${existing.status}），请先归档后再创建新 Listing。`, 409)
    }

    const commercialUse = licenseMode === 'reusable_commercial'
    const sourceMarketplaceIntentJson =
      assetMeta.marketplaceIntent &&
      typeof assetMeta.marketplaceIntent === 'object' &&
      !Array.isArray(assetMeta.marketplaceIntent)
        ? assetMeta.marketplaceIntent
        : null

    const listing = await db.assetListing.create({
      data: {
        assetId,
        sellerId: user.id,
        status: AssetListingStatus.DRAFT,
        licenseMode,
        priceCredits: body.priceCredits != null ? Number(body.priceCredits) : null,
        title: body.title?.trim() || asset.title || asset.name,
        description: body.description?.trim() || null,
        commercialUse,
        derivativeAllowed: true,
        attributionRequired: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sourceMarketplaceIntentJson: (sourceMarketplaceIntentJson ?? undefined) as any,
      },
    })

    return jsonOk({ listing: serializeListing(listing) })
  } catch (error) {
    console.error('[marketplace/listings] POST failed', { error })
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2002') {
      return jsonError('LISTING_ALREADY_EXISTS', '该资产已有进行中的 Listing，请刷新页面后再试。', 409)
    }
    if (prismaCode === 'P2021' || prismaCode === 'P2022') {
      return jsonError('LISTING_SCHEMA_NOT_DEPLOYED', '市场数据表尚未完成部署，请稍后重试或联系管理员。', 503)
    }
    return jsonError('LISTING_CREATE_FAILED', '创建 Listing 失败，请稍后重试。如问题持续，请检查资产状态和授权意图是否正确保存。', 500)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeListing(l: {
  id: string
  assetId: string
  sellerId: string
  status: AssetListingStatus
  licenseMode: string
  priceCredits: number | null
  title: string | null
  description: string | null
  commercialUse: boolean
  derivativeAllowed: boolean
  attributionRequired: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: l.id,
    assetId: l.assetId,
    sellerId: l.sellerId,
    status: l.status,
    licenseMode: l.licenseMode,
    priceCredits: l.priceCredits,
    title: l.title,
    description: l.description,
    commercialUse: l.commercialUse,
    derivativeAllowed: l.derivativeAllowed,
    attributionRequired: l.attributionRequired,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}
