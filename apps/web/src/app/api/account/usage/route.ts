import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function rangeSince(range: string): Date | null {
  if (range === 'all') return null
  const hours = range === '24h' ? 24 : range === '7d' ? 7 * 24 : 30 * 24
  return new Date(Date.now() - hours * 60 * 60 * 1000)
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录。' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  const rawRange = searchParams.get('range') ?? '7d'
  const range = ['24h', '7d', '30d', 'all'].includes(rawRange) ? rawRange : '7d'

  const outputTypeParam = searchParams.get('outputType') ?? 'all'
  const billingModeParam = searchParams.get('billingMode') ?? 'all'
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = isNaN(rawLimit) || rawLimit < 1 || rawLimit > 200 ? 50 : rawLimit

  const since = rangeSince(range)

  // All queries are scoped to the current user — this is the security boundary
  const userScope = { userId: user.id }

  const baseWhere = {
    ...userScope,
    ...(since ? { createdAt: { gte: since } } : {}),
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
    textCount,
    imageCount,
    videoCount,
    feeSumAgg,
    byOutputType,
    byBillingMode,
    byProvider,
  ] = await Promise.all([
    db.usageLog.count({ where }),
    db.usageLog.count({ where: { ...where, status: 'succeeded' } }),
    db.usageLog.count({ where: { ...where, status: 'failed' } }),
    db.usageLog.count({ where: { ...userScope, ...(since ? { createdAt: { gte: since } } : {}), billingMode: 'user_provider_account' } }),
    db.usageLog.count({ where: { ...userScope, ...(since ? { createdAt: { gte: since } } : {}), billingMode: 'platform_credits' } }),
    db.usageLog.count({ where: { ...where, outputType: 'text' } }),
    db.usageLog.count({ where: { ...where, outputType: 'image' } }),
    db.usageLog.count({ where: { ...where, outputType: 'video' } }),
    db.usageLog.aggregate({
      where: { ...userScope, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { platformServiceFeeCredits: true },
    }),
    db.usageLog.groupBy({
      by: ['outputType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    db.usageLog.groupBy({
      by: ['billingMode'],
      where,
      _count: { id: true },
    }),
    db.usageLog.groupBy({
      by: ['providerId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ])

  // Recent logs — safe fields only, no prompt text, no credentials
  const recent = await db.usageLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
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

  return NextResponse.json({
    range,
    since: since?.toISOString() ?? null,
    summary: {
      total,
      byok,
      platformCredits,
      text: textCount,
      image: imageCount,
      video: videoCount,
      succeeded,
      failed,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      platformServiceFeeCredits: feeSumAgg._sum.platformServiceFeeCredits ?? 0,
    },
    byOutputType: byOutputType.map((r) => ({ outputType: r.outputType, count: r._count.id })),
    byBillingMode: byBillingMode.map((r) => ({ billingMode: r.billingMode, count: r._count.id })),
    byProvider: byProvider.map((r) => ({ providerId: r.providerId, count: r._count.id })),
    recent: recent.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
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
    })),
  })
}
