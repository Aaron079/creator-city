'use client'

import { useCallback, useState } from 'react'
import type { ChinaPaymentClientType, ChinaPaymentProvider } from '@/lib/payment/china/types'

export type ChinaCheckoutResult = {
  success: boolean
  errorCode?: string
  message?: string
  provider?: ChinaPaymentProvider
  outTradeNo?: string
  formHtml?: string
  paymentUrl?: string
  qrCodeUrl?: string
  checkoutStarted?: boolean
}

type CreateChinaCheckoutInput = {
  provider: ChinaPaymentProvider
  packageId: string
  clientType?: ChinaPaymentClientType
}

type CreateChinaCheckoutResponse = ChinaCheckoutResult & {
  checkoutUrl?: string
}

function submitPaymentForm(formHtml: string) {
  const holder = document.createElement('div')
  holder.style.display = 'none'
  holder.innerHTML = formHtml
  const form = holder.querySelector('form')
  if (!form) throw new Error('支付表单无效')
  document.body.appendChild(holder)
  form.submit()
}

function messageForError(errorCode?: string, fallback?: string) {
  if (errorCode === 'UNAUTHORIZED') return '登录已过期，请重新登录'
  if (errorCode === 'PAYMENT_PROVIDER_NOT_CONFIGURED') return fallback ?? '支付方式尚未配置'
  if (errorCode === 'PACKAGE_NOT_FOUND') return '套餐不存在'
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
      const data = await res.json().catch(() => ({})) as CreateChinaCheckoutResponse

      if (res.status === 401 || data.errorCode === 'UNAUTHORIZED') {
        return {
          success: false,
          errorCode: 'UNAUTHORIZED',
          message: messageForError('UNAUTHORIZED', data.message),
        }
      }

      if (!res.ok || data.success === false) {
        return {
          success: false,
          errorCode: data.errorCode,
          message: messageForError(data.errorCode, data.message),
        }
      }

      if (data.formHtml) {
        submitPaymentForm(data.formHtml)
        return { ...data, success: true, checkoutStarted: true }
      }

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return { ...data, success: true, checkoutStarted: true }
      }

      if (data.qrCodeUrl) {
        return {
          ...data,
          success: true,
          message: `请打开支付链接完成付款：${data.qrCodeUrl}`,
        }
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
        return { ...data, success: true, checkoutStarted: true }
      }

      return {
        ...data,
        success: true,
        message: data.message ?? '支付订单已创建，请使用返回的 provider payload 完成支付。',
      }
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
