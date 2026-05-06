'use client'

import type { CreditPackage, UserWallet } from '@/lib/billing/types'

export const BILLING_PACKAGES_CACHE_KEY = 'creator-city:billing-packages-cache'
export const CHINA_PAYMENT_STATUS_CACHE_KEY = 'creator-city:china-payment-status-cache'
export const WALLET_CACHE_KEY = 'creator-city:wallet-cache'

export interface CacheEnvelope<T> {
  value: T
  updatedAt: string
}

export interface ChinaPaymentStatusCache {
  providers?: {
    alipay?: { status?: 'checking' | 'configured' | 'not-configured'; missing?: string[] }
    wechatpay?: { status?: 'checking' | 'configured' | 'not-configured'; missing?: string[] }
  }
}

export function readClientCache<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as CacheEnvelope<T> : null
  } catch {
    return null
  }
}

export function writeClientCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify({ value, updatedAt: new Date().toISOString() }))
  } catch {
    // Caches are only an acceleration layer.
  }
}

export function readPackagesCache() {
  return readClientCache<CreditPackage[]>(BILLING_PACKAGES_CACHE_KEY)
}

export function writePackagesCache(packages: CreditPackage[]) {
  writeClientCache(BILLING_PACKAGES_CACHE_KEY, packages)
}

export function readChinaPaymentStatusCache() {
  return readClientCache<ChinaPaymentStatusCache>(CHINA_PAYMENT_STATUS_CACHE_KEY)
}

export function writeChinaPaymentStatusCache(status: ChinaPaymentStatusCache) {
  writeClientCache(CHINA_PAYMENT_STATUS_CACHE_KEY, status)
}

export function readWalletCache() {
  return readClientCache<UserWallet>(WALLET_CACHE_KEY)
}

export function writeWalletCache(wallet: UserWallet) {
  writeClientCache(WALLET_CACHE_KEY, wallet)
}
