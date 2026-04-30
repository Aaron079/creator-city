import { fetchWallet as fetchServerWallet } from '@/lib/credits/billing-client'
import type { UserWallet } from './types'

export async function getOrCreateWallet(userId: string, authToken?: string): Promise<UserWallet> {
  if (!authToken) {
    return {
      userId,
      balanceCredits: 0,
      reservedCredits: 0,
      availableCredits: 0,
      lifetimePurchasedCredits: 0,
      lifetimeSpentCredits: 0,
    }
  }
  return getWalletBalance(authToken)
}

export async function getWalletBalance(authToken: string): Promise<UserWallet> {
  const wallet = await fetchServerWallet(authToken)
  const balanceCredits = wallet.balance
  const reservedCredits = wallet.frozenBalance
  return {
    balanceCredits,
    reservedCredits,
    availableCredits: balanceCredits,
    lifetimePurchasedCredits: wallet.totalPurchased,
    lifetimeSpentCredits: wallet.totalConsumed,
  }
}

export async function grantCredits(): Promise<never> {
  throw new Error('Credits can only be granted by verified backend webhook or admin confirmation.')
}

export async function reserveCredits(): Promise<never> {
  throw new Error('Generation routes reserve credits through the backend billing service.')
}

export async function settleReservedCredits(): Promise<never> {
  throw new Error('Generation routes settle credits through the backend billing service.')
}

export async function releaseReservedCredits(): Promise<never> {
  throw new Error('Generation routes release credits through the backend billing service.')
}

export async function refundCredits(): Promise<never> {
  throw new Error('Refunds must be performed by backend ledger operations.')
}
