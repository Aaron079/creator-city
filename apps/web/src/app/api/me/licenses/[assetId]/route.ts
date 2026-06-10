import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { assetId: string } }

// ─── GET /api/me/licenses/[assetId] ──────────────────────────────────────────
// Returns whether the current user has an ACTIVE grant for the given asset.

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonOk({ granted: false })

    const grant = await db.licenseGrant.findFirst({
      where: { buyerId: user.id, assetId: params.assetId, status: 'ACTIVE' },
      orderBy: { grantedAt: 'desc' },
    })

    if (!grant) return jsonOk({ granted: false })

    return jsonOk({
      granted: true,
      grant: {
        id: grant.id,
        listingId: grant.listingId,
        assetId: grant.assetId,
        licenseMode: grant.licenseMode,
        paidCredits: grant.paidCredits,
        status: grant.status,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        termsJson: grant.termsJson,
      },
    })
  } catch (error) {
    console.error('[me/licenses/[assetId]] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('LICENSE_CHECK_FAILED', '授权状态查询失败。', 500)
  }
}
