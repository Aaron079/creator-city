// GET /api/provider-accounts/usage-summary
// Returns per-account UsageLog stats for the current user, last 90 days.
// Security boundary: every query must include userId: user.id.
// Never returns prompt text, API keys, encryptedApiKey, or encryptedFields.

import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export type AccountUsageSummary = {
  total: number
  succeeded: number
  failed: number
  text: number
  image: number
  video: number
  lastUsedAt: string | null
  platformServiceFeeCredits: number
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  try {
    // Single query scoped to this user — index on userId.
    // We cap at 2000 rows to avoid full-table scans; 90-day window further limits scope.
    // Only select non-sensitive fields: no prompt, no key material.
    const rows = await db.usageLog.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
        providerAccountId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        providerAccountId: true,
        status: true,
        outputType: true,
        createdAt: true,
        platformServiceFeeCredits: true,
      },
    })

    // Reduce in memory by providerAccountId
    const map = new Map<string, AccountUsageSummary>()
    for (const row of rows) {
      const id = row.providerAccountId!
      const entry = map.get(id) ?? {
        total: 0,
        succeeded: 0,
        failed: 0,
        text: 0,
        image: 0,
        video: 0,
        lastUsedAt: null,
        platformServiceFeeCredits: 0,
      }
      entry.total += 1
      if (row.status === 'succeeded') entry.succeeded += 1
      else if (row.status === 'failed') entry.failed += 1
      if (row.outputType === 'text') entry.text += 1
      else if (row.outputType === 'image') entry.image += 1
      else if (row.outputType === 'video') entry.video += 1
      entry.platformServiceFeeCredits += row.platformServiceFeeCredits ?? 0
      // rows are desc by createdAt — first occurrence is most recent
      if (!entry.lastUsedAt) entry.lastUsedAt = row.createdAt.toISOString()
      map.set(id, entry)
    }

    const summaries = Object.fromEntries(map.entries())
    return jsonOk({ summaries })
  } catch {
    // Graceful degradation — caller should show "用量暂时不可用" instead of breaking the page
    return jsonError('USAGE_UNAVAILABLE', '用量数据暂时不可用，请稍后重试。', 503)
  }
}
