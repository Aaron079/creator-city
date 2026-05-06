import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { listCreditPackages } from '@/lib/billing/packages'
import { getProviderStatuses } from '@/lib/billing/payment-router'
import { getOrCreateWallet } from '@/lib/credits/server'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function providerStatus(configured: boolean, missing: string[]) {
  return {
    status: configured ? 'configured' : 'not-configured',
    missing,
  }
}

async function safe<T>(key: string, task: () => Promise<T> | T): Promise<{ key: string; value?: T; error?: string }> {
  try {
    return { key, value: await task() }
  } catch (error) {
    return { key, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function GET() {
  const [authResult, packagesResult, providerStatusesResult, chinaResult] = await Promise.all([
    safe('auth', () => getCurrentUser()),
    safe('packages', () => listCreditPackages()),
    safe('providerStatuses', () => getProviderStatuses()),
    safe('chinaPaymentStatus', () => {
      const payments = getChinaPaymentConfigurations()
      return {
        providers: {
          alipay: providerStatus(payments.alipay.configured, payments.alipay.missing),
          wechatpay: providerStatus(payments.wechatpay.configured, payments.wechatpay.missing),
        },
      }
    }),
  ])

  const user = authResult.value ?? null
  const walletResult = user
    ? await safe('walletSummary', async () => {
        const wallet = await getOrCreateWallet(user.id)
        return {
          id: wallet.id,
          userId: wallet.userId,
          balanceCredits: wallet.balance + wallet.frozenBalance,
          reservedCredits: wallet.frozenBalance,
          availableCredits: wallet.balance,
          lifetimePurchasedCredits: wallet.totalPurchased,
          lifetimeSpentCredits: wallet.totalConsumed,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt,
        }
      })
    : { key: 'walletSummary' }

  const errors: Record<string, string> = {}
  for (const result of [authResult, packagesResult, providerStatusesResult, chinaResult, walletResult]) {
    if (result.error) errors[result.key] = result.error
  }

  return NextResponse.json({
    success: true,
    auth: {
      authenticated: Boolean(user),
      user,
    },
    packages: packagesResult.value ?? [],
    providerStatuses: providerStatusesResult.value ?? {},
    chinaPaymentStatus: chinaResult.value ?? {
      providers: {
        alipay: providerStatus(false, ['ALIPAY_*']),
        wechatpay: providerStatus(false, ['WECHATPAY_*']),
      },
    },
    walletSummary: walletResult.value ?? null,
    errors,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
