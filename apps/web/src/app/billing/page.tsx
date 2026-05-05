'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CreditPackageGrid } from '@/components/billing/CreditPackageGrid'
import { ManualRechargePanel } from '@/components/billing/ManualRechargePanel'
import { PaymentMethodSelector } from '@/components/billing/PaymentMethodSelector'
import { PaymentStatusNotice } from '@/components/billing/PaymentStatusNotice'
import type { BillingRegion, CreditPackage, PaymentProvider } from '@/lib/billing/types'
import type { PaymentConfiguration } from '@/lib/payments/types'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { useChinaPaymentCheckout } from '@/lib/payment/china/use-china-payment-checkout'

const EMPTY_STATUS: PaymentConfiguration = { enabled: false, configured: false, missing: [] }

interface ChinaPaymentStatusResponse {
  providers?: {
    alipay?: { status?: 'configured' | 'not-configured'; missing?: string[] }
    wechatpay?: { status?: 'configured' | 'not-configured'; missing?: string[] }
  }
}

function toPaymentConfiguration(provider?: { status?: 'configured' | 'not-configured'; missing?: string[] }): PaymentConfiguration {
  return {
    enabled: true,
    configured: provider?.status === 'configured',
    missing: provider?.missing ?? [],
  }
}

export default function BillingPage() {
  const { status: authStatus } = useCurrentUser()
  const { payingPackageId, createPayment } = useChinaPaymentCheckout()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [statuses, setStatuses] = useState<Record<PaymentProvider, PaymentConfiguration>>({
    alipay: EMPTY_STATUS,
    wechat: EMPTY_STATUS,
    stripe: EMPTY_STATUS,
    paddle: EMPTY_STATUS,
    manual: { enabled: true, configured: true, missing: [] },
  })
  const [region, setRegion] = useState<BillingRegion>('CN')
  const [provider, setProvider] = useState<PaymentProvider>('alipay')
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string; errorCode?: string } | null>(null)
  const [manualOrderId, setManualOrderId] = useState<string | undefined>()

  useEffect(() => {
    void (async () => {
      const [billingRes, chinaRes] = await Promise.all([
        fetch('/api/billing/packages'),
        fetch('/api/payment/china/status', { credentials: 'include', cache: 'no-store' }),
      ])
      const data = await billingRes.json() as {
        packages: CreditPackage[]
        providerStatuses: Record<PaymentProvider, PaymentConfiguration>
      }
      const chinaStatus = chinaRes.ok
        ? await chinaRes.json() as ChinaPaymentStatusResponse
        : null
      setPackages(data.packages)
      setStatuses({
        ...data.providerStatuses,
        alipay: toPaymentConfiguration(chinaStatus?.providers?.alipay),
        wechat: toPaymentConfiguration(chinaStatus?.providers?.wechatpay),
        manual: data.providerStatuses.manual ?? { enabled: true, configured: true, missing: [] },
      })
    })()
  }, [])

  const changeRegion = (next: BillingRegion) => {
    setRegion(next)
    setProvider(next === 'CN' ? 'alipay' : 'stripe')
    setNotice(null)
  }

  const buy = async (packageId: string) => {
    if (authStatus === 'loading') {
      setNotice({ type: 'info', message: '正在确认登录状态...' })
      return
    }
    if (authStatus !== 'authenticated') {
      setNotice({ type: 'error', message: '请先登录后购买积分。' })
      return
    }
    if (provider !== 'manual' && !statuses[provider]?.configured) {
      setNotice({ type: 'error', message: 'not-configured：该支付方式尚未配置环境变量。' })
      return
    }
    setBuyingId(packageId)
    setNotice(null)
    try {
      if (provider === 'manual') {
        const pkg = packages.find((item) => item.id === packageId)
        if (!pkg) {
          setNotice({ type: 'error', message: '套餐不存在' })
          return
        }
        const res = await fetch('/api/credits/manual-recharge', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            amountCredits: pkg.credits + pkg.bonusCredits,
            note: `Billing manual recharge package: ${pkg.name}`,
          }),
        })
        const data = await res.json().catch(() => ({})) as { orderId?: string; message?: string }
        if (res.status === 401) {
          setNotice({ type: 'error', message: '登录已过期，请重新登录', errorCode: 'UNAUTHORIZED' })
          return
        }
        if (!res.ok) {
          setNotice({ type: 'error', message: data.message ?? '创建人工充值申请失败' })
          return
        }
        setManualOrderId(data.orderId)
        setNotice({ type: 'success', message: '人工充值 pending 订单已创建，等待管理员确认。' })
        return
      }

      const useChinaPayment = provider === 'alipay' || provider === 'wechat'
      if (useChinaPayment) {
        const result = await createPayment({
          provider: provider === 'wechat' ? 'wechatpay' : 'alipay',
          packageId,
        })
        if (!result.success) {
          setNotice({
            type: 'error',
            message: result.message ?? '创建订单失败',
            errorCode: result.errorCode,
          })
          return
        }
        if (!result.checkoutStarted) {
          setNotice({ type: result.qrCodeUrl ? 'info' : 'success', message: result.message ?? '支付订单已创建。' })
        }
        return
      }

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ packageId, region, paymentMethod: provider }),
      })
      const data = await res.json().catch(() => ({})) as {
        success?: boolean
        status?: string
        errorCode?: string
        message?: string
        checkoutUrl?: string
        orderId?: string
        formHtml?: string
        paymentUrl?: string
        qrCodeUrl?: string
      }
      if (res.status === 401 || data.errorCode === 'UNAUTHORIZED') {
        setNotice({ type: 'error', message: '登录已过期，请重新登录', errorCode: 'UNAUTHORIZED' })
        return
      }
      if (data.status === 'not-configured') {
        setNotice({ type: 'error', message: `not-configured：${data.message ?? '该支付方式尚未配置'}` })
        return
      }
      if (!res.ok) {
        setNotice({ type: 'error', message: data.message ?? '创建订单失败' })
        return
      }
      if (data.formHtml) {
        const holder = document.createElement('div')
        holder.style.display = 'none'
        holder.innerHTML = data.formHtml
        const form = holder.querySelector('form')
        if (!form) throw new Error('支付表单无效')
        document.body.appendChild(holder)
        form.submit()
        return
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      if (data.qrCodeUrl) {
        setNotice({ type: 'info', message: `请打开支付链接完成付款：${data.qrCodeUrl}` })
        return
      }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else setNotice({ type: 'info', message: data.message ?? '支付订单已创建，请使用返回的 provider payload 完成支付。' })
    } catch {
        setNotice({ type: 'error', message: '网络错误，未创建支付订单。' })
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">购买 Creator City Credits</h1>
            <p className="mt-2 text-sm text-white/50">积分只用于平台内生成，不可提现、转让或交易。</p>
          </div>
          <a href="/account/credits" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white">我的账单</a>
        </div>

        <div className="mb-5 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {[
            ['CN', '中国大陆'],
            ['GLOBAL', '海外'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => changeRegion(key as BillingRegion)}
              className={`rounded-md px-4 py-2 text-sm ${region === key ? 'bg-white text-slate-950' : 'text-white/60'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <PaymentMethodSelector region={region} value={provider} statuses={statuses} onChange={setProvider} />
        </div>

        {notice ? (
          <div className="mb-5">
            <PaymentStatusNotice type={notice.type} message={notice.message} />
            {notice.errorCode === 'UNAUTHORIZED' ? (
              <a href="/auth/login?next=/billing" className="mt-2 inline-flex text-sm font-semibold text-amber-100 underline">
                去登录
              </a>
            ) : null}
          </div>
        ) : null}
        {authStatus === 'loading' ? (
          <div className="mb-5 rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
            正在确认登录状态...
          </div>
        ) : null}
        {authStatus === 'unauthenticated' ? (
          <div className="mb-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            请先登录后购买积分。
            <a href="/auth/login?next=/billing" className="ml-3 font-semibold underline">去登录</a>
          </div>
        ) : null}
        {provider === 'manual' ? <div className="mb-5"><ManualRechargePanel orderId={manualOrderId} /></div> : null}

        <CreditPackageGrid packages={packages} region={region} provider={provider} buyingId={buyingId ?? payingPackageId} onBuy={buy} />
      </main>
    </DashboardShell>
  )
}
