// GET /api/provider-accounts/:id/summary
// Returns account details + 90-day usage stats for the current user.
// Security boundary: ownership enforced by where: { id: params.id, userId: user.id }
// Never returns encryptedApiKey, encryptedFields, prompt text, or key plaintext.
// Only fieldMeta (last4 previews) is returned for extra credential fields.

import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: { id: string } }

export type AccountSummaryAccount = {
  id: string
  providerId: string
  accountLabel: string
  keyLast4: string
  status: string
  isDefault: boolean
  projectScope: string | null
  credentialType: string | null
  fieldMeta: Record<string, { label: string; last4: string; updatedAt: string }> | null
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestError: string | null
  createdAt: string
  updatedAt: string
}

export type AccountSummaryUsage = {
  total: number
  succeeded: number
  failed: number
  text: number
  image: number
  video: number
  platformServiceFeeCredits: number
  lastUsedAt: string | null
}

export type AccountSummaryRecentRow = {
  id: string
  createdAt: string
  outputType: string | null
  billingMode: string | null
  status: string | null
  providerCostPaidBy: string | null
  promptChars: number | null
  platformServiceFeeCredits: number | null
  errorCode: string | null
}

export type AccountHealth = {
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  message: string
}

function computeHealth(
  account: Pick<AccountSummaryAccount, 'status' | 'lastTestStatus'>,
  usage: AccountSummaryUsage
): AccountHealth {
  if (account.status === 'disabled') return { status: 'warning', message: '账户已停用' }
  if (account.status === 'invalid') return { status: 'error', message: '账户状态无效，请检查 API Key' }
  if (account.lastTestStatus === 'ok') return { status: 'healthy', message: '连接测试正常' }
  if (account.lastTestStatus === 'auth_failed') return { status: 'error', message: '认证失败，请确认 API Key 是否正确' }
  if (account.lastTestStatus === 'timeout') return { status: 'warning', message: '连接超时，请稍后重试' }
  if (account.lastTestStatus === 'rate_limited') return { status: 'warning', message: '请求限流' }
  if (account.lastTestStatus === 'insufficient_quota') return { status: 'warning', message: '额度不足' }
  if (account.lastTestStatus === 'unsupported') {
    if (usage.succeeded > 0) return { status: 'healthy', message: '有成功生成记录' }
    return { status: 'unknown', message: '不支持自动连接测试，请通过画布生成验证' }
  }
  if (usage.total >= 5) {
    const failRate = usage.failed / usage.total
    if (failRate > 0.5) return { status: 'warning', message: `近 90 天失败率 ${Math.round(failRate * 100)}%` }
    if (usage.succeeded > 0) return { status: 'healthy', message: '有成功生成记录' }
  }
  if (usage.succeeded > 0) return { status: 'healthy', message: '有成功生成记录' }
  return { status: 'unknown', message: '尚未测试连接' }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  // Ownership check: only return if userId matches
  const raw = await db.userProviderAccount.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      providerId: true,
      accountLabel: true,
      keyLast4: true,
      status: true,
      isDefault: true,
      projectScope: true,
      credentialType: true,
      fieldMeta: true,
      lastTestedAt: true,
      lastTestStatus: true,
      lastTestError: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!raw) return jsonError('NOT_FOUND', '未找到该 API 账户。', 404)

  const account: AccountSummaryAccount = {
    ...raw,
    fieldMeta: (raw.fieldMeta as Record<string, { label: string; last4: string; updatedAt: string }> | null) ?? null,
    lastTestedAt: raw.lastTestedAt?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  let usageSummary: AccountSummaryUsage = {
    total: 0, succeeded: 0, failed: 0, text: 0, image: 0, video: 0,
    platformServiceFeeCredits: 0, lastUsedAt: null,
  }
  let recentUsage: AccountSummaryRecentRow[] = []
  let usageSummaryUnavailable = false

  try {
    // Double-scope: userId + providerAccountId — both required per security contract
    const rows = await db.usageLog.findMany({
      where: {
        userId: user.id,
        providerAccountId: account.id,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        createdAt: true,
        outputType: true,
        billingMode: true,
        status: true,
        providerCostPaidBy: true,
        promptChars: true,
        platformServiceFeeCredits: true,
        errorCode: true,
      },
    })

    usageSummary = {
      total: rows.length,
      succeeded: rows.filter((r) => r.status === 'succeeded').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      text: rows.filter((r) => r.outputType === 'text').length,
      image: rows.filter((r) => r.outputType === 'image').length,
      video: rows.filter((r) => r.outputType === 'video').length,
      platformServiceFeeCredits: rows.reduce((sum, r) => sum + (r.platformServiceFeeCredits ?? 0), 0),
      lastUsedAt: rows[0]?.createdAt.toISOString() ?? null,
    }

    recentUsage = rows.slice(0, 20).map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      outputType: r.outputType,
      billingMode: r.billingMode,
      status: r.status,
      providerCostPaidBy: r.providerCostPaidBy,
      promptChars: r.promptChars,
      platformServiceFeeCredits: r.platformServiceFeeCredits,
      errorCode: r.errorCode,
    }))
  } catch {
    usageSummaryUnavailable = true
  }

  const health = computeHealth(account, usageSummary)

  return jsonOk({
    account,
    usageSummary: usageSummaryUnavailable ? null : usageSummary,
    recentUsage: usageSummaryUnavailable ? [] : recentUsage,
    health,
    usageSummaryUnavailable,
  })
}
