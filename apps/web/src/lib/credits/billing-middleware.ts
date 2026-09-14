import { getGenerationAccess } from '@/lib/generation/access'
import { settleJobCredits, releaseJobCredits } from '@/lib/billing/settle'
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
      }
      status: number
    }

// Retain the call contract for existing generators; new requests never touch a credit wallet.
export async function setupBilling(
  _req: unknown,
  providerId: string,
  _nodeType: string,
  _prompt: string,
  _context?: { projectId?: string; nodeId?: string },
): Promise<BillingSetupResult> {
  const access = await getGenerationAccess()
  if (!access.ok) {
    return {
      ok: false,
      errorResponse: {
        success: false,
        message: access.message,
        errorCode: access.errorCode,
        providerId,
        mode: 'unavailable',
        status: 'failed',
      },
      status: access.status,
    }
  }
  return { ok: true, ctx: { userId: access.user.id, billingJobId: null, estimatedCredits: 0 } }
}

// Only historical jobs have a reserved credit ID. Preserve their reconciliation.
export async function finalizeBilling(response: GenerateResponse, billingJobId: string | null): Promise<GenerateResponse> {
  if (!billingJobId) return response
  try {
    if (response.success && response.status === 'succeeded') await settleJobCredits(billingJobId)
    else if (response.status === 'failed') await releaseJobCredits(billingJobId)
  } catch (err) {
    console.error('[billing] historical finalize failed', billingJobId, err)
  }
  return { ...response, billingJobId }
}
