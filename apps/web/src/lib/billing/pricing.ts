import { estimateCreditCost } from '@/lib/credits/cost-rules'
import type { BillingCurrency } from './types'

export function formatMoney(amount: number, currency: BillingCurrency): string {
  const major = amount / 100
  if (currency === 'CNY') return `¥${major.toFixed(2)}`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major)
}

export function getCreditInternalCnyValue(): number {
  return Number(process.env.CREDIT_INTERNAL_CNY_VALUE ?? 0.05)
}

export function estimateGenerationCredits(providerId: string, nodeType: string): number {
  return estimateCreditCost(providerId, nodeType)
}
