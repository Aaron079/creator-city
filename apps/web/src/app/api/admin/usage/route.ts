import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function rangeSince(range: string): Date {
  const hours = range === '24h' ? 24 : range === '7d' ? 7 * 24 : 30 * 24
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限：仅管理员可访问。' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const rawRange = searchParams.get('range') ?? '7d'
  const range = rawRange === '24h' || rawRange === '7d' || rawRange === '30d' ? rawRange : '7d'
  const outputTypeParam = searchParams.get('outputType') ?? 'all'
  const billingModeParam = searchParams.get('billingMode') ?? 'all'

  const since = rangeSince(range)

  const baseWhere = {
    createdAt: { gte: since },
    ...(outputTypeParam !== 'all' ? { outputType: outputTypeParam } : {}),
  }

  const where = {
    ...baseWhere,
    ...(billingModeParam !== 'all' ? { billingMode: billingModeParam } : {}),
  }

  const [
    total,
    succeeded,
    failed,
    byok,
    platformCredits,
    feeSumAgg,
    byOutputType,
    byProvider,
    byBillingMode,
    byStatus,
  ] = await Promise.all([
    db.usageLog.count({ where }),
    db.usageLog.count({ where: { ...where, status: 'succeeded' } }),
    db.usageLog.count({ where: { ...where, status: 'failed' } }),
    db.usageLog.count({ where: { ...baseWhere, billingMode: 'user_provider_account' } }),
    db.usageLog.count({ where: { ...baseWhere, billingMode: 'platform_credits' } }),
    db.usageLog.aggregate({ where: baseWhere, _sum: { platformServiceFeeCredits: true } }),
    db.usageLog.groupBy({
      by: ['outputType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    db.usageLog.groupBy({
      by: ['providerId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
    db.usageLog.groupBy({
      by: ['billingMode'],
      where,
      _count: { id: true },
    }),
    db.usageLog.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
  ])

  // Top users — group then join for email
  const topUsersRaw = await db.usageLog.groupBy({
    by: ['userId'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  const topUsers: Array<{ userId: string; email: string | null; displayName: string | null; count: number }> = []
  if (topUsersRaw.length > 0) {
    const ids = topUsersRaw.map(r => r.userId)
    const profiles = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, displayName: true },
    })
    const profileMap = new Map(profiles.map(u => [u.id, u]))
    for (const r of topUsersRaw) {
      const p = profileMap.get(r.userId)
      topUsers.push({
        userId: r.userId,
        email: p?.email ?? null,
        displayName: p?.displayName ?? null,
        count: r._count.id,
      })
    }
  }

  // Recent logs — select safe fields only, join email separately
  const recentRaw = await db.usageLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      userId: true,
      projectId: true,
      nodeId: true,
      providerId: true,
      outputType: true,
      billingMode: true,
      status: true,
      providerCostPaidBy: true,
      promptChars: true,
      platformServiceFeeCredits: true,
      errorCode: true,
      createdAt: true,
    },
  })

  const recentUserIds = [...new Set(recentRaw.map(r => r.userId))]
  const recentProfiles = recentUserIds.length > 0
    ? await db.user.findMany({
        where: { id: { in: recentUserIds } },
        select: { id: true, email: true },
      })
    : []
  const emailMap = new Map(recentProfiles.map(u => [u.id, u.email]))

  const recent = recentRaw.map(r => ({
    id: r.id,
    userId: r.userId,
    userEmail: emailMap.get(r.userId) ?? null,
    projectId: r.projectId,
    nodeId: r.nodeId,
    providerId: r.providerId,
    outputType: r.outputType,
    billingMode: r.billingMode,
    status: r.status,
    providerCostPaidBy: r.providerCostPaidBy,
    promptChars: r.promptChars,
    platformServiceFeeCredits: r.platformServiceFeeCredits,
    errorCode: r.errorCode,
    createdAt: r.createdAt.toISOString(),
  }))

  return NextResponse.json({
    range,
    since: since.toISOString(),
    summary: {
      total,
      byok,
      platformCredits,
      succeeded,
      failed,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      platformServiceFeeCredits: feeSumAgg._sum.platformServiceFeeCredits ?? 0,
    },
    byOutputType: byOutputType.map(r => ({ outputType: r.outputType, count: r._count.id })),
    byProvider: byProvider.map(r => ({ providerId: r.providerId, count: r._count.id })),
    byBillingMode: byBillingMode.map(r => ({ billingMode: r.billingMode, count: r._count.id })),
    byStatus: byStatus.map(r => ({ status: r.status, count: r._count.id })),
    topUsers,
    recent,
  })
}
