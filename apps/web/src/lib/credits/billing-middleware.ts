/**
 * Server-side billing helpers for generate routes.
 * Freeze → generate → settle/refund pattern.
 */
import type { NextRequest } from 'next/server'
import { freezeCredits, settleCredits, refundCredits, updateJobExternalId, InsufficientCreditsError } from './billing-client'
import { extractBearerToken } from './jwt-decode'
import type { GenerateResponse } from '@/lib/providers/types'

export interface BillingContext {
  billingJobId: string
  estimatedCost: number
  authToken: string
}

export type BillingSetupResult =
  | { ok: true; ctx: BillingContext }
  | {
      ok: false
      errorResponse: { success: false; message: string; errorCode: string; providerId: string; mode: 'unavailable'; status: 'failed' }
      status: number
    }

export async function setupBilling(
  req: NextRequest,
  providerId: string,
  nodeType: string,
  prompt: string,
): Promise<BillingSetupResult> {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
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

  try {
    const freeze = await freezeCredits(token, { providerId, nodeType, prompt })
    return {
      ok: true,
      ctx: { billingJobId: freeze.jobId, estimatedCost: freeze.estimatedCost, authToken: token },
    }
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return {
        ok: false,
        errorResponse: {
          success: false,
          message: err.message,
          errorCode: 'INSUFFICIENT_CREDITS',
          providerId,
          mode: 'unavailable',
          status: 'failed',
        },
        status: 402,
      }
    }
    const message = err instanceof Error ? err.message : '积分扣费失败'
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
  billingJobId: string,
): Promise<GenerateResponse> {
  if (response.success) {
    if (response.jobId) {
      await updateJobExternalId(billingJobId, response.jobId)
    }
    if (response.status === 'succeeded') {
      await settleCredits(billingJobId)
    }
  } else {
    await refundCredits(billingJobId, response.message)
  }
  return { ...response, billingJobId }
}
