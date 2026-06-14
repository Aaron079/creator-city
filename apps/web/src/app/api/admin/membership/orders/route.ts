import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { MembershipOrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status') ?? 'PENDING'

    const where =
      statusParam === 'ALL'
        ? {}
        : { status: statusParam as MembershipOrderStatus }

    const orders = await db.membershipOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        userId: true,
        status: true,
        planCode: true,
        amountCny: true,
        periodMonths: true,
        voucherNote: true,
        adminUserId: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
          },
        },
      },
    })
    return jsonOk({ orders })
  } catch (err) {
    console.error('[api/admin/membership/orders] GET failed', err)
    return jsonError('INTERNAL_ERROR', '获取订单列表失败。', 500)
  }
}
