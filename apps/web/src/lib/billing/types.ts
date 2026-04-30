export type BillingRegion = 'CN' | 'GLOBAL'
export type PaymentProvider = 'alipay' | 'wechat' | 'stripe' | 'paddle' | 'manual'
export type BillingCurrency = 'CNY' | 'USD' | 'EUR' | 'HKD' | 'JPY'
export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
export type LedgerType =
  | 'purchase'
  | 'bonus'
  | 'reserve'
  | 'settle'
  | 'release'
  | 'refund'
  | 'admin_adjustment'
  | 'expire'

export interface CreditPackagePrice {
  region: BillingRegion
  provider: PaymentProvider
  currency: BillingCurrency
  amount: number
  externalPriceId?: string
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  bonusCredits: number
  isActive: boolean
  prices: CreditPackagePrice[]
  description?: string | null
}

export interface UserWallet {
  id?: string
  userId?: string
  balanceCredits: number
  reservedCredits: number
  availableCredits: number
  lifetimePurchasedCredits: number
  lifetimeSpentCredits: number
  createdAt?: string
  updatedAt?: string
}

export interface CreditLedgerEntry {
  id: string
  userId?: string
  walletId?: string
  type: LedgerType
  amountCredits: number
  balanceAfter: number
  relatedPaymentOrderId?: string | null
  relatedGenerationJobId?: string | null
  description?: string | null
  createdAt: string
}

export interface PaymentOrder {
  id: string
  userId: string
  packageId?: string | null
  region: BillingRegion
  provider: PaymentProvider
  status: PaymentOrderStatus
  amount: number
  currency: BillingCurrency
  creditsGranted: number
  externalOrderId?: string | null
  externalPaymentId?: string | null
  externalCustomerId?: string | null
  rawNotifyJson?: unknown
  createdAt: string
  paidAt?: string | null
}

export interface CheckoutResult {
  status: 'ready' | 'pending' | 'not-configured'
  provider: PaymentProvider
  message: string
  orderId?: string
  checkoutUrl?: string
  qrCodeUrl?: string
  providerOrderPayload?: unknown
}
