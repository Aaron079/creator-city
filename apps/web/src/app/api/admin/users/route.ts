import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    const users = await db.user.findMany({
      where: { status: { not: 'INACTIVE' } },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        profile: {
          select: { username: true, avatarUrl: true, city: true, company: true },
        },
        membership: {
          select: { status: true, expiresAt: true, planCode: true },
        },
        _count: {
          select: { providerAccounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return jsonOk({
      users: users.map((u) => {
        const m = u.membership
        const now = new Date()
        const membershipActive = !!(m && m.status === 'ACTIVE' && m.expiresAt && m.expiresAt > now)
        return {
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          username: u.username,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          profile: u.profile,
          membershipActive,
          membershipStatus: m?.status ?? 'INACTIVE',
          membershipExpiresAt: m?.expiresAt?.toISOString() ?? null,
          membershipPlanCode: m?.planCode ?? null,
          providerAccountCount: u._count.providerAccounts,
        }
      }),
      total: users.length,
    })
  } catch (error) {
    console.error('[admin/users] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('ADMIN_USERS_FAILED', '获取用户列表失败。', 500)
  }
}
