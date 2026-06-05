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

  // Simulated service credits — BYOK succeeded only, read-only, no DB write
  const [byokSucceededLogs, byokSimFailedCount, byokSimPendingCount] = await Promise.all([
    db.usageLog.findMany({
      where: {
        createdAt: { gte: since },
        billingMode: 'user_provider_account',
        status: 'succeeded',
      },
      select: { outputType: true, durationSeconds: true },
      take: 2000,
    }),
    db.usageLog.count({
      where: {
        createdAt: { gte: since },
        billingMode: 'user_provider_account',
        status: 'failed',
      },
    }),
    db.usageLog.count({
      where: {
        createdAt: { gte: since },
        billingMode: 'user_provider_account',
        status: { notIn: ['succeeded', 'failed', 'canceled'] },
      },
    }),
  ])

  let textCalls = 0, imageCalls = 0, videoCalls = 0
  let imageCredits = 0, videoCredits = 0
  let videoMissingDuration = false

  for (const log of byokSucceededLogs) {
    if (log.outputType === 'text') {
      textCalls++
    } else if (log.outputType === 'image') {
      imageCalls++
      imageCredits += 1
    } else if (log.outputType === 'video') {
      videoCalls++
      if (log.durationSeconds === null) {
        videoMissingDuration = true
        videoCredits += 5
      } else if (log.durationSeconds <= 5) {
        videoCredits += 5
      } else {
        videoCredits += 10
      }
    }
  }

  const totalSimulatedCredits = imageCredits + videoCredits

  // ── BYOK Business Metrics — read-only, no DB write ────────────────────────
  const HIGH_FREQ_THRESHOLD = 10

  const [byokAllLogs, platformAllLogs] = await Promise.all([
    db.usageLog.findMany({
      where: { createdAt: { gte: since }, billingMode: 'user_provider_account' },
      select: { userId: true, outputType: true, providerId: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    db.usageLog.findMany({
      where: { createdAt: { gte: since }, billingMode: 'platform_credits' },
      select: { status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
  ])

  // Reduce over BYOK logs
  const byokUserMap = new Map<string, {
    calls: number; succeeded: number; failed: number
    providers: Map<string, number>; outputTypes: Map<string, number>
  }>()
  const byokProviderMap = new Map<string, { calls: number; succeeded: number; failed: number }>()
  const byokOutputCounts = { text: 0, image: 0, video: 0 }
  const byokDailyMap = new Map<string, { byokCalls: number; byokSucceeded: number; byokFailed: number }>()
  let byokSucceededAll = 0, byokFailedAll = 0

  for (const log of byokAllLogs) {
    if (!byokUserMap.has(log.userId)) {
      byokUserMap.set(log.userId, { calls: 0, succeeded: 0, failed: 0, providers: new Map(), outputTypes: new Map() })
    }
    const u = byokUserMap.get(log.userId)!
    u.calls++
    if (log.status === 'succeeded') { u.succeeded++; byokSucceededAll++ }
    if (log.status === 'failed') { u.failed++; byokFailedAll++ }
    u.providers.set(log.providerId, (u.providers.get(log.providerId) ?? 0) + 1)
    u.outputTypes.set(log.outputType, (u.outputTypes.get(log.outputType) ?? 0) + 1)

    if (!byokProviderMap.has(log.providerId)) {
      byokProviderMap.set(log.providerId, { calls: 0, succeeded: 0, failed: 0 })
    }
    const pv = byokProviderMap.get(log.providerId)!
    pv.calls++
    if (log.status === 'succeeded') pv.succeeded++
    if (log.status === 'failed') pv.failed++

    if (log.outputType === 'text') byokOutputCounts.text++
    else if (log.outputType === 'image') byokOutputCounts.image++
    else if (log.outputType === 'video') byokOutputCounts.video++

    const dk = log.createdAt.toISOString().slice(0, 10)
    if (!byokDailyMap.has(dk)) byokDailyMap.set(dk, { byokCalls: 0, byokSucceeded: 0, byokFailed: 0 })
    const d = byokDailyMap.get(dk)!
    d.byokCalls++
    if (log.status === 'succeeded') d.byokSucceeded++
    if (log.status === 'failed') d.byokFailed++
  }

  // Platform daily
  const platformDailyMap = new Map<string, number>()
  for (const log of platformAllLogs) {
    const dk = log.createdAt.toISOString().slice(0, 10)
    platformDailyMap.set(dk, (platformDailyMap.get(dk) ?? 0) + 1)
  }

  const byokTotalCalls = byokAllLogs.length
  const platformTotalCalls = platformAllLogs.length
  const bizTotalCalls = byokTotalCalls + platformTotalCalls
  const byokSharePct = bizTotalCalls > 0 ? Math.round((byokTotalCalls / bizTotalCalls) * 100) : 0
  const byokSuccessRatePct = byokTotalCalls > 0 ? Math.round((byokSucceededAll / byokTotalCalls) * 100) : 0
  const byokFailureRatePct = byokTotalCalls > 0 ? Math.round((byokFailedAll / byokTotalCalls) * 100) : 0
  const activeByokUsers = byokUserMap.size

  // Provider top 10
  const byokByProvider = [...byokProviderMap.entries()]
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 10)
    .map(([providerId, pv]) => ({
      providerId,
      calls: pv.calls,
      succeeded: pv.succeeded,
      failed: pv.failed,
      successRate: pv.calls > 0 ? Math.round((pv.succeeded / pv.calls) * 100) : 0,
    }))

  // High-frequency users
  const highFreqRaw = [...byokUserMap.entries()]
    .filter(([, v]) => v.calls >= HIGH_FREQ_THRESHOLD)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 10)
  const highFrequencyCount = [...byokUserMap.values()].filter(v => v.calls >= HIGH_FREQ_THRESHOLD).length

  let highFrequencyUsers: Array<{
    userId: string; email: string | null; displayName: string | null
    calls: number; succeeded: number; failed: number; successRate: number
    topProviderId: string | null; topOutputType: string | null
  }> = []

  if (highFreqRaw.length > 0) {
    const hfIds = highFreqRaw.map(([id]) => id)
    const hfProfiles = await db.user.findMany({
      where: { id: { in: hfIds } },
      select: { id: true, email: true, displayName: true },
    })
    const hfMap = new Map(hfProfiles.map(p => [p.id, p]))
    highFrequencyUsers = highFreqRaw.map(([userId, v]) => {
      const p = hfMap.get(userId)
      return {
        userId,
        email: p?.email ?? null,
        displayName: p?.displayName ?? null,
        calls: v.calls,
        succeeded: v.succeeded,
        failed: v.failed,
        successRate: v.calls > 0 ? Math.round((v.succeeded / v.calls) * 100) : 0,
        topProviderId: v.providers.size > 0
          ? ([...v.providers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
          : null,
        topOutputType: v.outputTypes.size > 0
          ? ([...v.outputTypes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
          : null,
      }
    })
  }

  // Daily trend (last 30 calendar days)
  const trendDates = [...new Set([...byokDailyMap.keys(), ...platformDailyMap.keys()])].sort().slice(-30)
  const dailyTrend = trendDates.map(date => ({
    date,
    byokCalls: byokDailyMap.get(date)?.byokCalls ?? 0,
    platformCreditCalls: platformDailyMap.get(date) ?? 0,
    byokSucceeded: byokDailyMap.get(date)?.byokSucceeded ?? 0,
    byokFailed: byokDailyMap.get(date)?.byokFailed ?? 0,
  }))

  const byokBusinessMetrics = {
    enabled: true,
    label: 'BYOK 商业指标（只读）',
    range,
    byokCalls: byokTotalCalls,
    platformCreditCalls: platformTotalCalls,
    totalCalls: bizTotalCalls,
    byokSharePercent: byokSharePct,
    activeByokUsers,
    byokSuccessRate: byokSuccessRatePct,
    byokFailureRate: byokFailureRatePct,
    highFrequencyThreshold: HIGH_FREQ_THRESHOLD,
    highFrequencyCount,
    byokByOutputType: byokOutputCounts,
    byokByProvider,
    highFrequencyUsers,
    dailyTrend,
    notes: [
      '只读指标，不启用收费',
      '用于观察 30–60 天 BYOK 真实使用情况',
      '不写入账本，不改变 UsageLog.platformServiceFeeCredits',
      `数据来源：最近 ${byokTotalCalls} 条 BYOK 记录（上限 5000）`,
    ],
  }

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
    byokBusinessMetrics,
    simulatedServiceCredits: {
      enabled: false,
      label: '只读模拟，当前未启用扣费',
      range,
      totalCredits: totalSimulatedCredits,
      byOutputType: {
        text: { calls: textCalls, simulatedCredits: 0, rule: '0 / 次' },
        image: { calls: imageCalls, simulatedCredits: imageCredits, rule: '1 / 次' },
        video: {
          calls: videoCalls,
          simulatedCredits: videoCredits,
          rule: '≤5s → 5，>5s → 10 service credits / 次',
          hasMissingDuration: videoMissingDuration,
        },
      },
      failedByokCalls: byokSimFailedCount,
      pendingByokCalls: byokSimPendingCount,
      assumptions: [
        '只统计我的 API（BYOK）成功任务',
        'Text 按 0，Image 按 1，Video 按 5/10 估算',
        '当前不会扣费，UsageLog.platformServiceFeeCredits 仍为 0',
        '未来真实收费必须支持生成前展示与失败退款',
      ],
    },
  })
}
