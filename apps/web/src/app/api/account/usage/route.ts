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
  const timeScope = since ? { createdAt: { gte: since } } : {}

  // Full filter: user + time + optional outputType + optional billingMode
  const where = {
    ...userScope,
    ...timeScope,
    ...(outputTypeParam !== 'all' ? { outputType: outputTypeParam } : {}),
    ...(billingModeParam !== 'all' ? { billingMode: billingModeParam } : {}),
  }

  // Billing-only scope (user + time, no type/billing filter) for global distribution
  const billingScope = { ...userScope, ...timeScope }

  try {
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
    ] = await Promise.all([
      db.usageLog.count({ where }),
      db.usageLog.count({ where: { ...where, status: 'succeeded' } }),
      db.usageLog.count({ where: { ...where, status: 'failed' } }),
      // Global billing-mode counts for the time range (not filtered by outputType/billingMode)
      db.usageLog.count({ where: { ...billingScope, billingMode: 'user_provider_account' } }),
      db.usageLog.count({ where: { ...billingScope, billingMode: 'platform_credits' } }),
      // Per-type counts: spread { outputType: X } overrides any outputType already in `where`
      db.usageLog.count({ where: { ...where, outputType: 'text' } }),
      db.usageLog.count({ where: { ...where, outputType: 'image' } }),
      db.usageLog.count({ where: { ...where, outputType: 'video' } }),
      db.usageLog.aggregate({
        where: billingScope,
        _sum: { platformServiceFeeCredits: true },
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

    // Compute distributions in memory — avoids groupBy + orderBy _count which
    // can behave unexpectedly with PgBouncer transaction mode in some Prisma versions
    const byOutputType = (() => {
      if (outputTypeParam !== 'all') {
        return total > 0 ? [{ outputType: outputTypeParam, count: total }] : []
      }
      return [
        { outputType: 'text', count: textCount },
        { outputType: 'image', count: imageCount },
        { outputType: 'video', count: videoCount },
      ].filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
    })()

    const byBillingMode = [
      { billingMode: 'user_provider_account', count: byok },
      { billingMode: 'platform_credits', count: platformCredits },
    ].filter((r) => r.count > 0)

    // Provider distribution from recent window (top 10 by frequency)
    const providerCounts = new Map<string, number>()
    for (const r of recent) {
      providerCounts.set(r.providerId, (providerCounts.get(r.providerId) ?? 0) + 1)
    }
    const byProvider = [...providerCounts.entries()]
      .map(([providerId, count]) => ({ providerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

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
      byOutputType,
      byBillingMode,
      byProvider,
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
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const errCode = (err as Record<string, unknown>)?.code ?? 'UNKNOWN'
    console.error('[account/usage] query failed:', errCode, errMsg)
    return NextResponse.json(
      { message: '数据库查询失败，请稍后刷新重试。', errorCode: 'USAGE_DB_UNAVAILABLE' },
      { status: 500 },
    )
  }
}
