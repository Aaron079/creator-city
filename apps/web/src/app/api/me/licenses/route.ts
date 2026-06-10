import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

// ─── GET /api/me/licenses ─────────────────────────────────────────────────────
// Returns all LicenseGrants the current user has received as buyer.

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const grants = await db.licenseGrant.findMany({
      where: { buyerId: user.id, status: 'ACTIVE' },
      orderBy: { grantedAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            priceCredits: true,
            status: true,
          },
        },
        asset: {
          select: {
            id: true,
            title: true,
            type: true,
            thumbnailUrl: true,
            url: true,
          },
        },
        seller: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    })

    const items = grants.map((g) => ({
      id: g.id,
      listingId: g.listingId,
      assetId: g.assetId,
      licenseMode: g.licenseMode,
      paidCredits: g.paidCredits,
      status: g.status,
      grantedAt: g.grantedAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() ?? null,
      termsJson: g.termsJson,
      asset: g.asset,
      listing: g.listing,
      seller: g.seller,
    }))

    return jsonOk({ items })
  } catch (error) {
    console.error('[me/licenses] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('LICENSES_FETCH_FAILED', '获取授权列表失败。', 500)
  }
}
