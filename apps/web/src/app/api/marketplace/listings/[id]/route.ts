import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { membershipGateResponse } from '@/lib/membership/server'
import { AssetListingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

const REUSABLE_MODES = new Set(['reusable_noncommercial', 'reusable_commercial'])

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const listing = await db.assetListing.findFirst({
      where: { id: params.id },
    })
    if (!listing) return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)

    const isSeller = listing.sellerId === user.id
    if (!isSeller && listing.status !== AssetListingStatus.ACTIVE) {
      return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)
    }

    return jsonOk({ listing: serializeListing(listing) })
  } catch (error) {
    console.error('[marketplace/listings/[id]] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('LISTING_FETCH_FAILED', '获取 Listing 失败。', 500)
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

type PatchBody = {
  status?: string
  priceCredits?: number | null
  title?: string | null
  description?: string | null
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const listing = await db.assetListing.findFirst({
      where: { id: params.id },
      include: {
        asset: { select: { ownerId: true, isPublic: true, status: true } },
      },
    })
    if (!listing) return jsonError('LISTING_NOT_FOUND', 'Listing 不存在。', 404)
    if (listing.sellerId !== user.id) return jsonError('FORBIDDEN', '只有 Listing 创建者可以修改。', 403)
    if (listing.status === AssetListingStatus.ARCHIVED) {
      return jsonError('LISTING_ARCHIVED', '已归档的 Listing 不可修改。如需重新上架，请创建新 Listing。', 400)
    }

    let body: PatchBody
    try {
      body = (await request.json()) as PatchBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const updateData: Record<string, unknown> = {}

    // Status transition
    if (body.status !== undefined) {
      const next = body.status as string
      const curr = listing.status

      const validTransition =
        (curr === AssetListingStatus.DRAFT && (next === 'ACTIVE' || next === 'ARCHIVED')) ||
        (curr === AssetListingStatus.ACTIVE && (next === 'PAUSED' || next === 'ARCHIVED')) ||
        (curr === AssetListingStatus.PAUSED && (next === 'ACTIVE' || next === 'ARCHIVED'))

      if (!validTransition) {
        return jsonError('INVALID_STATUS_TRANSITION', `不允许从 ${curr} 转换到 ${next}。`, 400)
      }

      if (next === 'ACTIVE') {
        const membershipGate = membershipGateResponse(user)
        if (membershipGate) return membershipGate
        // Re-validate asset conditions
        if (listing.asset.ownerId !== user.id) return jsonError('FORBIDDEN', '资产所有权已变更。', 403)
        if (!listing.asset.isPublic) return jsonError('ASSET_NOT_PUBLIC', '资产必须是公开状态才能上架。', 400)
        if (listing.asset.status !== 'READY') return jsonError('ASSET_NOT_READY', '资产必须是 READY 状态才能上架。', 400)
        if (!REUSABLE_MODES.has(listing.licenseMode)) {
          return jsonError('INVALID_LICENSE_MODE', 'Listing 授权模式无效，不可上架。', 400)
        }
        if (!listing.publishedAt) {
          updateData.publishedAt = new Date()
        }
      }

      updateData.status = next
    }

    // Optional field updates
    if (body.priceCredits !== undefined) {
      if (body.priceCredits === null) {
        updateData.priceCredits = null
      } else {
        const price = Number(body.priceCredits)
        if (!Number.isInteger(price) || price < 0 || price > 999999) {
          return jsonError('VALIDATION_FAILED', 'priceCredits 必须是 0–999999 的整数。', 400)
        }
        updateData.priceCredits = price
      }
    }
    if (body.title !== undefined) {
      updateData.title = body.title?.trim() || null
    }
    if (body.description !== undefined) {
      if (body.description && body.description.length > 500) {
        return jsonError('VALIDATION_FAILED', 'description 最多 500 字。', 400)
      }
      updateData.description = body.description?.trim() || null
    }

    const updated = await db.assetListing.update({
      where: { id: params.id },
      data: updateData as Parameters<typeof db.assetListing.update>[0]['data'],
    })

    return jsonOk({ listing: serializeListing(updated) })
  } catch (error) {
    console.error('[marketplace/listings/[id]] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('LISTING_UPDATE_FAILED', '更新 Listing 失败。', 500)
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
