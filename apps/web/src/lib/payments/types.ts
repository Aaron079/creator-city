import type { CheckoutResult, PaymentOrder } from '@/lib/billing/types'

export interface PaymentConfiguration {
  enabled: boolean
  configured: boolean
  missing: string[]
}

export interface PaymentAdapter {
  configuration(): PaymentConfiguration
  createCheckout(order: PaymentOrder): Promise<CheckoutResult>
}
