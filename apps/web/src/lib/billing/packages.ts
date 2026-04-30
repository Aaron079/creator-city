import type { BillingRegion, CreditPackage, PaymentProvider } from './types'

const USD_CNY_RATE = Number(process.env.USD_CNY_RATE ?? 7.2)

function usdToCnyCents(usdCents: number) {
  return Math.round(usdCents * USD_CNY_RATE)
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'starter_500', name: 'Starter 500', credits: 500, bonusCredits: 0, isActive: true, description: '500 Creator City Credits', prices: [] },
  { id: 'creator_1500', name: 'Creator 1500', credits: 1300, bonusCredits: 200, isActive: true, description: '1500 credits including 200 bonus', prices: [] },
  { id: 'studio_5500', name: 'Studio 5500', credits: 4800, bonusCredits: 700, isActive: true, description: '5500 credits for production workflows', prices: [] },
  { id: 'team_15000', name: 'Team 15000', credits: 12500, bonusCredits: 2500, isActive: true, description: '15000 credits for team production', prices: [] },
  { id: 'enterprise_50000', name: 'Enterprise 50000', credits: 40000, bonusCredits: 10000, isActive: true, description: '50000 credits for studio-scale generation', prices: [] },
]

const USD_PRICES: Record<string, number> = {
  starter_500: 699,
  creator_1500: 1499,
  studio_5500: 4999,
  team_15000: 12999,
  enterprise_50000: 39999,
}

const CN_PROVIDERS: PaymentProvider[] = ['alipay', 'wechat', 'manual']
const GLOBAL_PROVIDERS: PaymentProvider[] = ['stripe', 'paddle']

export function listCreditPackages(): CreditPackage[] {
  return CREDIT_PACKAGES.map((pkg) => {
    const usd = USD_PRICES[pkg.id] ?? 999
    return {
      ...pkg,
      prices: [
        ...CN_PROVIDERS.map((provider) => ({
          region: 'CN' as BillingRegion,
          provider,
          currency: 'CNY' as const,
          amount: usdToCnyCents(usd),
        })),
        ...GLOBAL_PROVIDERS.map((provider) => ({
          region: 'GLOBAL' as BillingRegion,
          provider,
          currency: 'USD' as const,
          amount: usd,
        })),
      ],
    }
  })
}

export function getCreditPackage(packageId: string): CreditPackage | null {
  return listCreditPackages().find((pkg) => pkg.id === packageId && pkg.isActive) ?? null
}
