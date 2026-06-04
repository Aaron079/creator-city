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
  const userScope = { userId: user.id }
  const timeScope = since ? { createdAt: { gte: since } } : {}

  // Security boundary: every query MUST include userId: user.id
  const where = {
    ...userScope,
    ...timeScope,
    ...(outputTypeParam !== 'all' ? { outputType: outputTypeParam } : {}),
    ...(billingModeParam !== 'all' ? { billingMode: billingModeParam } : {}),
  }

  // diagStage tracks exactly which query failed so the user can see it in the error response
  let diagStage = 'init'
  try {
    // ── Stage 1: total count with all active filters ─────────────────────────
    diagStage = 'count'
    const total = await db.usageLog.count({ where })

    // ── Stage 2: recent records (safe fields only, no prompt/credential data) ─
    diagStage = 'findMany'
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

    // ── Stage 3: compute all stats in memory from the recent window ──────────
    // (avoids aggregate/groupBy queries that can fail in PgBouncer tx mode)
    diagStage = 'compute'

    const recentByok = recent.filter((r) => r.billingMode === 'user_provider_account').length
    const recentPlatform = recent.filter((r) => r.billingMode === 'platform_credits').length
    const recentText = recent.filter((r) => r.outputType === 'text').length
    const recentImage = recent.filter((r) => r.outputType === 'image').length
    const recentVideo = recent.filter((r) => r.outputType === 'video').length
    const recentSucceeded = recent.filter((r) => r.status === 'succeeded').length
    const recentFailed = recent.filter((r) => r.status === 'failed').length

    const byOutputType = [
      { outputType: 'text', count: recentText },
      { outputType: 'image', count: recentImage },
      { outputType: 'video', count: recentVideo },
    ].filter((r) => r.count > 0).sort((a, b) => b.count - a.count)

    const byBillingMode = [
      { billingMode: 'user_provider_account', count: recentByok },
      { billingMode: 'platform_credits', count: recentPlatform },
    ].filter((r) => r.count > 0)

    const providerMap = new Map<string, number>()
    for (const r of recent) {
      providerMap.set(r.providerId, (providerMap.get(r.providerId) ?? 0) + 1)
    }
    const byProvider = [...providerMap.entries()]
      .map(([providerId, count]) => ({ providerId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      range,
      since: since?.toISOString() ?? null,
      summary: {
        total,
        byok: recentByok,
        platformCredits: recentPlatform,
        text: recentText,
        image: recentImage,
        video: recentVideo,
        succeeded: recentSucceeded,
        failed: recentFailed,
        successRate: recent.length > 0 ? Math.round((recentSucceeded / recent.length) * 100) : 0,
        platformServiceFeeCredits: 0, // fee charging not yet enabled — always 0
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
    const errCode = String((err as Record<string, unknown>)?.code ?? 'UNKNOWN')
    const errMsg = err instanceof Error ? err.message : String(err)
    // Log full details server-side; expose code+stage to client (not the full message)
    console.error(`[account/usage] failed at stage=${diagStage} code=${errCode}:`, errMsg)
    return NextResponse.json(
      {
        message: '数据库查询失败，请稍后刷新重试。',
        errorCode: 'USAGE_DB_UNAVAILABLE',
        _stage: diagStage,
        _code: errCode,
      },
      { status: 500 },
    )
  }
}
