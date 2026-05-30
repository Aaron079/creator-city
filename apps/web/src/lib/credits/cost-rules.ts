import { estimateStaticCredits } from '@/lib/credits/shared-cost-rules'

/**
 * Client-side credit cost estimator for UI display.
 * Delegates to shared-cost-rules — single source of truth.
 * Signature preserved: called as estimateCreditCost(providerId, nodeType)
 * in VisualCanvasWorkspace and billing/pricing.ts.
 */
export function estimateCreditCost(providerId: string, nodeType: string): number {
  return estimateStaticCredits({ nodeType, providerId }).credits
}
