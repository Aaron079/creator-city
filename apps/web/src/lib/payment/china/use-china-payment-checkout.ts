'use client'

import { useCallback, useState } from 'react'
import type { ChinaPaymentClientType, ChinaPaymentProvider } from '@/lib/payment/china/types'

export type ChinaCheckoutResult = {
  success: boolean
  errorCode?: string
  message?: string
  provider?: ChinaPaymentProvider
  mode?: 'qr' | 'redirect' | 'form'
  orderId?: string
  outTradeNo?: string
  qrCode?: string
  qrCodeUrl?: string
  paymentUrl?: string
  checkoutUrl?: string
  amountCnyFen?: number
  packageName?: string
  credits?: number
  expiresAt?: string
  rawCode?: string
  rawSubCode?: string
  rawMessage?: string
  rawSubMessage?: string
}

type CreateChinaCheckoutInput = {
  provider: ChinaPaymentProvider
  packageId: string
  clientType?: ChinaPaymentClientType
}

function messageForError(errorCode?: string, fallback?: string, rawSubMessage?: string) {
  if (errorCode === 'UNAUTHORIZED') return '登录已过期，请重新登录'
  if (errorCode === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return fallback ?? '支付方式尚未配置'
  if (errorCode === 'PACKAGE_NOT_FOUND') return '套餐不存在'
  if (errorCode === 'ALIPAY_SIGN_FAILED') return '支付宝签名失败，请检查应用私钥、支付宝公钥和 charset 配置。'
  if (errorCode === 'ALIPAY_PRECREATE_FAILED') return rawSubMessage ?? fallback ?? '支付宝预下单失败'
  if (errorCode === 'ALIPAY_NON_JSON_RESPONSE') return fallback ?? '支付宝网关返回非 JSON 响应'
  return fallback ?? '创建订单失败'
}

export function useChinaPaymentCheckout() {
  const [payingPackageId, setPayingPackageId] = useState<string | null>(null)

  const createPayment = useCallback(async ({
    provider,
    packageId,
    clientType = 'pc',
  }: CreateChinaCheckoutInput): Promise<ChinaCheckoutResult> => {
    if (payingPackageId) {
      return { success: false, message: '支付订单正在创建中' }
    }

    setPayingPackageId(packageId)
    try {
      const res = await fetch('/api/payment/china/create', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ provider, packageId, clientType }),
      })
      const raw = await res.text()
      let data: ChinaCheckoutResult | null
      try {
        data = raw ? JSON.parse(raw) as ChinaCheckoutResult : null
      } catch {
        return {
          success: false,
          errorCode: 'NON_JSON_RESPONSE',
          message: `支付接口返回非 JSON 响应，HTTP ${res.status}：${raw.slice(0, 300)}`,
        }
      }

      if (res.status === 401 || data?.errorCode === 'UNAUTHORIZED') {
        return {
          success: false,
          errorCode: 'UNAUTHORIZED',
          message: messageForError('UNAUTHORIZED', data?.message),
        }
      }

      if (!data) {
        return {
          success: false,
          errorCode: 'EMPTY_RESPONSE',
          message: `支付接口返回空响应，HTTP ${res.status}`,
        }
      }

      if (!res.ok || data.success === false) {
        return {
          ...data,
          success: false,
          message: messageForError(
            data.errorCode,
            data.rawMessage ? `${data.message ?? '创建订单失败'}：${data.rawMessage}` : data.message,
            data.rawSubMessage,
          ),
        }
      }

      return { ...data, success: true }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '网络错误，未创建支付订单。',
      }
    } finally {
      setPayingPackageId(null)
    }
  }, [payingPackageId])

  return { payingPackageId, createPayment }
}
