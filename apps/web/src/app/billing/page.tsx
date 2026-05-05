'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CreditPackageGrid } from '@/components/billing/CreditPackageGrid'
import { ManualRechargePanel } from '@/components/billing/ManualRechargePanel'
import { PaymentMethodSelector } from '@/components/billing/PaymentMethodSelector'
import { PaymentStatusNotice } from '@/components/billing/PaymentStatusNotice'
import { useAuthStore } from '@/store/auth.store'
import type { BillingRegion, CreditPackage, PaymentProvider } from '@/lib/billing/types'
import type { PaymentConfiguration } from '@/lib/payments/types'

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
  const { token, isAuthenticated } = useAuthStore()
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [statuses, setStatuses] = useState<Record<PaymentProvider, PaymentConfiguration>>({
    alipay: EMPTY_STATUS,
    wechat: EMPTY_STATUS,
    stripe: EMPTY_STATUS,
    paddle: EMPTY_STATUS,
    manual: { enabled: true, configured: true, missing: [] },
  })
  const [region, setRegion] = useState<BillingRegion>('CN')
  const [provider, setProvider] = useState<PaymentProvider>('manual')
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null)
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
    setProvider(next === 'CN' ? 'manual' : 'stripe')
    setNotice(null)
  }

  const buy = async (packageId: string) => {
    if (!token || !isAuthenticated) {
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
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId, region, paymentMethod: provider }),
      })
      const data = await res.json() as { status?: string; message?: string; checkoutUrl?: string; orderId?: string }
      if (data.status === 'not-configured') {
        setNotice({ type: 'error', message: `not-configured：${data.message ?? '该支付方式尚未配置'}` })
        return
      }
      if (!res.ok) {
        setNotice({ type: 'error', message: data.message ?? '创建订单失败' })
        return
      }
      if (provider === 'manual') {
        setManualOrderId(data.orderId)
        setNotice({ type: 'success', message: '人工充值 pending 订单已创建，等待管理员确认。' })
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

        {notice ? <div className="mb-5"><PaymentStatusNotice type={notice.type} message={notice.message} /></div> : null}
        {provider === 'manual' ? <div className="mb-5"><ManualRechargePanel orderId={manualOrderId} /></div> : null}

        <CreditPackageGrid packages={packages} region={region} provider={provider} buyingId={buyingId} onBuy={buy} />
      </main>
    </DashboardShell>
  )
}
