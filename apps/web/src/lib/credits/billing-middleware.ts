/**
 * Server-side billing helpers for generate routes.
 * Reserve → generate → settle/release pattern using session cookie auth + direct Prisma.
 */
import { getCurrentUser } from '@/lib/auth/current-user'
import { estimateGenerationCredits } from '@/lib/billing/estimate'
import { reserveCreditsForJob } from '@/lib/billing/reserve'
import { settleJobCredits, releaseJobCredits } from '@/lib/billing/settle'
import { InsufficientCreditsError } from '@/lib/billing/errors'
import { getOrCreateWallet } from '@/lib/credits/server'
import { getToolProviderById } from '@/lib/tools/provider-catalog'
import { getGatewayProvider } from '@/lib/providers/catalog'
import { checkEnvKeys } from '@/lib/providers/env'
import { isDbConnectionError } from '@/lib/db-error'
import type { GenerateResponse } from '@/lib/providers/types'

export type BillingIdempotencyContext = {
  billingRequestId: string
  source: 'header' | 'body' | 'server-derived'
  projectId?: string
  nodeId?: string
  route: string
}

type BillingSetupContext = {
  projectId?: string
  nodeId?: string
  route?: string
  billingRequestId?: string
  billingRequestSource?: BillingIdempotencyContext['source']
}

export interface BillingContext {
  userId: string
  billingJobId: string | null
  estimatedCredits: number
  billingIdempotency?: BillingIdempotencyContext | null
  billingIdempotencyWarning?: 'BILLING_IDEMPOTENCY_CONTEXT_MISSING'
}

export type BillingSetupResult =
  | { ok: true; ctx: BillingContext }
  | {
      ok: false
      errorResponse: {
        success: false
        message: string
        errorCode: string
        providerId: string
        mode: 'unavailable'
        status: 'failed'
        requiredCredits?: number
        availableCredits?: number
      }
      status: number
    }

function detectProviderKind(providerId: string): 'mock' | 'not-configured' | 'real' {
  const toolProvider = getToolProviderById(providerId)
  if (toolProvider?.status === 'mock') return 'mock'
  const gatewayEntry = getGatewayProvider(providerId)
  if (!gatewayEntry) return 'not-configured'
  if (!checkEnvKeys(gatewayEntry.envKeys).configured) return 'not-configured'
  return 'real'
}

const BILLING_IDEMPOTENCY_HEADERS = [
  'Idempotency-Key',
  'X-Idempotency-Key',
  'X-Creator-Request-Id',
] as const

type HeadersLike = {
  get(name: string): string | null
}

function headersFromRequest(req: unknown): HeadersLike | null {
  if (!req || typeof req !== 'object') return null
  const headers = (req as { headers?: unknown }).headers
  if (!headers || typeof headers !== 'object') return null
  const get = (headers as { get?: unknown }).get
  if (typeof get !== 'function') return null
  return { get: (name: string) => get.call(headers, name) as string | null }
}

function routeFromRequest(req: unknown, fallback?: string): string {
  if (fallback) return fallback
  if (!req || typeof req !== 'object') return 'unknown'
  const nextUrl = (req as { nextUrl?: { pathname?: unknown } }).nextUrl
  if (typeof nextUrl?.pathname === 'string' && nextUrl.pathname) return nextUrl.pathname
  const url = (req as { url?: unknown }).url
  if (typeof url !== 'string' || !url) return 'unknown'
  try {
    return new URL(url).pathname
  } catch {
    return 'unknown'
  }
}

function normalizeBillingRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) return null
  return trimmed
}

export function getBillingIdempotencyContext(
  req: unknown,
  context?: BillingSetupContext,
): BillingIdempotencyContext | null {
  const bodyBillingRequestId = normalizeBillingRequestId(context?.billingRequestId)
  if (bodyBillingRequestId) {
    return {
      billingRequestId: bodyBillingRequestId,
      source: context?.billingRequestSource ?? 'body',
      projectId: context?.projectId,
      nodeId: context?.nodeId,
      route: routeFromRequest(req, context?.route),
    }
  }

  const headers = headersFromRequest(req)
  if (!headers) return null
  for (const header of BILLING_IDEMPOTENCY_HEADERS) {
    const billingRequestId = normalizeBillingRequestId(headers.get(header))
    if (billingRequestId) {
      return {
        billingRequestId,
        source: 'header',
        projectId: context?.projectId,
        nodeId: context?.nodeId,
        route: routeFromRequest(req, context?.route),
      }
    }
  }
  return null
}

export async function setupBilling(
  req: unknown,
  providerId: string,
  nodeType: string,
  prompt: string,
  context?: BillingSetupContext,
): Promise<BillingSetupResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      ok: false,
      errorResponse: {
        success: false,
        message: '请先登录以使用生成功能。',
        errorCode: 'UNAUTHENTICATED',
        providerId,
        mode: 'unavailable',
        status: 'failed',
      },
      status: 401,
    }
  }

  const billingIdempotency = getBillingIdempotencyContext(req, context)
  const billingIdempotencyWarning = billingIdempotency
    ? undefined
    : 'BILLING_IDEMPOTENCY_CONTEXT_MISSING' as const

  const kind = detectProviderKind(providerId)

  // Not-configured: pass through without charging — generate returns PROVIDER_NOT_CONFIGURED
  if (kind === 'not-configured') {
    return { ok: true, ctx: { userId: user.id, billingJobId: null, estimatedCredits: 0, billingIdempotency, billingIdempotencyWarning } }
  }

  // Mock: charge 1 credit if available, otherwise allow free
  if (kind === 'mock') {
    let wallet
    try {
      wallet = await getOrCreateWallet(user.id)
    } catch (walletErr) {
      if (isDbConnectionError(walletErr)) {
        console.error('[billing] wallet DB unavailable (mock path)', walletErr)
        return { ok: false, errorResponse: { success: false, message: '数据库连接繁忙，请稍后重试。', errorCode: 'DB_CONNECTION_UNAVAILABLE', providerId, mode: 'unavailable' as const, status: 'failed' as const }, status: 503 }
      }
      throw walletErr
    }
    if (wallet.balance >= 1) {
      try {
        const reserve = await reserveCreditsForJob({ userId: user.id, estimatedCredits: 1, providerId, nodeType, prompt, projectId: context?.projectId, nodeId: context?.nodeId, billingRequestId: billingIdempotency?.billingRequestId, billingRequestSource: billingIdempotency?.source, billingRoute: billingIdempotency?.route })
        return { ok: true, ctx: { userId: user.id, billingJobId: reserve.jobId, estimatedCredits: 1, billingIdempotency, billingIdempotencyWarning } }
      } catch {
        // Fall through to free mock on any error
      }
    }
    return { ok: true, ctx: { userId: user.id, billingJobId: null, estimatedCredits: 0, billingIdempotency, billingIdempotencyWarning } }
  }

  // Real provider: estimate, check balance, reserve
  const estimated = estimateGenerationCredits({ nodeType, providerId })
  let wallet
  try {
    wallet = await getOrCreateWallet(user.id)
  } catch (walletErr) {
    if (isDbConnectionError(walletErr)) {
      console.error('[billing] wallet DB unavailable (real path)', walletErr)
      return { ok: false, errorResponse: { success: false, message: '数据库连接繁忙，请稍后重试。', errorCode: 'DB_CONNECTION_UNAVAILABLE', providerId, mode: 'unavailable' as const, status: 'failed' as const }, status: 503 }
    }
    throw walletErr
  }

  if (wallet.balance < estimated) {
    return {
      ok: false,
      errorResponse: {
        success: false,
        message: `积分不足，预计需要 ${estimated}，当前可用 ${wallet.balance}`,
        errorCode: 'INSUFFICIENT_CREDITS',
        requiredCredits: estimated,
        availableCredits: wallet.balance,
        providerId,
        mode: 'unavailable',
        status: 'failed',
      },
      status: 402,
    }
  }

  try {
    const reserve = await reserveCreditsForJob({ userId: user.id, estimatedCredits: estimated, providerId, nodeType, prompt, projectId: context?.projectId, nodeId: context?.nodeId, billingRequestId: billingIdempotency?.billingRequestId, billingRequestSource: billingIdempotency?.source, billingRoute: billingIdempotency?.route })
    return { ok: true, ctx: { userId: user.id, billingJobId: reserve.jobId, estimatedCredits: estimated, billingIdempotency, billingIdempotencyWarning } }
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return {
        ok: false,
        errorResponse: {
          success: false,
          message: err.message,
          errorCode: 'INSUFFICIENT_CREDITS',
          requiredCredits: err.requiredCredits,
          availableCredits: err.availableCredits,
          providerId,
          mode: 'unavailable',
          status: 'failed',
        },
        status: 402,
      }
    }
    if (isDbConnectionError(err)) {
      console.error('[billing] reserve DB unavailable', err)
      return {
        ok: false,
        errorResponse: {
          success: false,
          message: '数据库连接繁忙，请稍后重试。',
          errorCode: 'DB_CONNECTION_UNAVAILABLE',
          providerId,
          mode: 'unavailable',
          status: 'failed',
        },
        status: 503,
      }
    }
    const message = err instanceof Error ? err.message : '积分预留失败'
    return {
      ok: false,
      errorResponse: {
        success: false,
        message,
        errorCode: 'BILLING_ERROR',
        providerId,
        mode: 'unavailable',
        status: 'failed',
      },
      status: 500,
    }
  }
}

export async function finalizeBilling(
  response: GenerateResponse,
  billingJobId: string | null,
): Promise<GenerateResponse> {
  if (!billingJobId) return response

  try {
    if (response.success && response.status === 'succeeded') {
      await settleJobCredits(billingJobId)
    } else {
      await releaseJobCredits(billingJobId)
    }
  } catch (err) {
    console.error('[billing] finalize failed', billingJobId, err)
  }

  return { ...response, billingJobId }
}
