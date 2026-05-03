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
import type { GenerateResponse } from '@/lib/providers/types'

export interface BillingContext {
  userId: string
  billingJobId: string | null
  estimatedCredits: number
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

// _req kept for API compatibility with existing generate route callers
export async function setupBilling(
  _req: unknown,
  providerId: string,
  nodeType: string,
  prompt: string,
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

  const kind = detectProviderKind(providerId)

  // Not-configured: pass through without charging — generate returns PROVIDER_NOT_CONFIGURED
  if (kind === 'not-configured') {
    return { ok: true, ctx: { userId: user.id, billingJobId: null, estimatedCredits: 0 } }
  }

  // Mock: charge 1 credit if available, otherwise allow free
  if (kind === 'mock') {
    const wallet = await getOrCreateWallet(user.id)
    if (wallet.balance >= 1) {
      try {
        const reserve = await reserveCreditsForJob({ userId: user.id, estimatedCredits: 1, providerId, nodeType, prompt })
        return { ok: true, ctx: { userId: user.id, billingJobId: reserve.jobId, estimatedCredits: 1 } }
      } catch {
        // Fall through to free mock on any error
      }
    }
    return { ok: true, ctx: { userId: user.id, billingJobId: null, estimatedCredits: 0 } }
  }

  // Real provider: estimate, check balance, reserve
  const estimated = estimateGenerationCredits({ nodeType, providerId })
  const wallet = await getOrCreateWallet(user.id)

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
    const reserve = await reserveCreditsForJob({ userId: user.id, estimatedCredits: estimated, providerId, nodeType, prompt })
    return { ok: true, ctx: { userId: user.id, billingJobId: reserve.jobId, estimatedCredits: estimated } }
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
