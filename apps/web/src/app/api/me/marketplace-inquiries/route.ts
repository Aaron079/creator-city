import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { listMarketplaceInquiries, serializeInquiry } from '@/lib/marketplace/inquiry'

export const dynamic = 'force-dynamic'

// ─── GET /api/me/marketplace-inquiries?role=seller|buyer ─────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const { searchParams } = new URL(request.url)
    const roleParam = searchParams.get('role')
    const role: 'buyer' | 'seller' = roleParam === 'buyer' ? 'buyer' : 'seller'

    const inquiries = await listMarketplaceInquiries(user.id, role)

    const items = inquiries.map((i) => ({
      ...serializeInquiry(i),
      listing: {
        id: i.listing.id,
        title: i.listing.title,
        licenseMode: i.listing.licenseMode,
        status: i.listing.status,
      },
      asset: {
        id: i.asset.id,
        title: i.asset.title ?? i.asset.name,
        type: i.asset.type,
        thumbnailUrl: i.asset.thumbnailUrl ?? null,
      },
      buyer: {
        id: i.buyer.id,
        displayName: i.buyer.displayName,
        username: i.buyer.username ?? null,
        avatarUrl: i.buyer.profile?.avatarUrl ?? null,
      },
      seller: {
        id: i.seller.id,
        displayName: i.seller.displayName,
        username: i.seller.username ?? null,
        avatarUrl: i.seller.profile?.avatarUrl ?? null,
      },
    }))

    return jsonOk({ items })
  } catch (error) {
    console.error('[me/marketplace-inquiries] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2021' || prismaCode === 'P2022') return jsonOk({ items: [] })
    return jsonError('INQUIRIES_FETCH_FAILED', '获取合作意向列表失败。', 500)
  }
}
