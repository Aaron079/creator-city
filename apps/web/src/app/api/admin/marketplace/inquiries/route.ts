import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { MarketplaceInquiryStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Valid status values for filter
const VALID_STATUSES: MarketplaceInquiryStatus[] = ['PENDING', 'RESPONDED', 'REJECTED', 'CLOSED']

// GET /api/admin/marketplace/inquiries?status=&limit=
// ADMIN only. Read-only. No mutation, no payment, no wallet.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') as MarketplaceInquiryStatus | null
    const limitParam = parseInt(searchParams.get('limit') ?? '100', 10)
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 100 : limitParam), 100)

    const statusWhere =
      statusParam && VALID_STATUSES.includes(statusParam) ? statusParam : undefined

    const inquiries = await db.marketplaceInquiry.findMany({
      where: statusWhere ? { status: statusWhere } : undefined,
      include: {
        buyer: { select: { id: true, displayName: true, email: true } },
        seller: { select: { id: true, displayName: true, email: true } },
        asset: { select: { id: true, title: true, name: true, type: true } },
        listing: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return jsonOk({
      items: inquiries.map((inq) => ({
        id: inq.id,
        status: inq.status,
        message: inq.message,
        sellerNote: inq.sellerNote,
        createdAt: inq.createdAt.toISOString(),
        updatedAt: inq.updatedAt.toISOString(),
        respondedAt: inq.respondedAt?.toISOString() ?? null,
        closedAt: inq.closedAt?.toISOString() ?? null,
        buyer: { id: inq.buyer.id, displayName: inq.buyer.displayName, email: inq.buyer.email },
        seller: { id: inq.seller.id, displayName: inq.seller.displayName, email: inq.seller.email },
        asset: { id: inq.asset.id, title: inq.asset.title ?? inq.asset.name, type: inq.asset.type },
        listing: { id: inq.listing.id, title: inq.listing.title, status: inq.listing.status },
      })),
    })
  } catch (error) {
    console.error('[admin/marketplace/inquiries] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('ADMIN_INQUIRY_LIST_FAILED', '获取合作意向列表失败。', 500)
  }
}
