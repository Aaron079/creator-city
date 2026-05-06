'use client'

import { useEffect, useState } from 'react'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { CreditPackageGrid } from '@/components/billing/CreditPackageGrid'
import { ManualRechargePanel } from '@/components/billing/ManualRechargePanel'
import { PaymentMethodSelector } from '@/components/billing/PaymentMethodSelector'
import { PaymentStatusNotice } from '@/components/billing/PaymentStatusNotice'
import { AlipayQrPaymentModal, type AlipayQrPayment } from '@/components/billing/AlipayQrPaymentModal'
import type { BillingRegion, CreditPackage, PaymentProvider, UserWallet } from '@/lib/billing/types'
import type { PaymentConfiguration } from '@/lib/payments/types'
import type { AuthUserPublic } from '@/lib/auth/client'
import { useChinaPaymentCheckout, type ChinaCheckoutResult } from '@/lib/payment/china/use-china-payment-checkout'
import {
  readChinaPaymentStatusCache,
  readPackagesCache,
  readWalletCache,
  writeChinaPaymentStatusCache,
  writePackagesCache,
  writeWalletCache,
  type ChinaPaymentStatusCache,
} from '@/lib/billing/client-cache'

const EMPTY_STATUS: PaymentConfiguration = { enabled: false, configured: false, missing: [] }

interface ChinaPaymentStatusResponse {
  providers?: {
    alipay?: { status?: 'configured' | 'not-configured'; missing?: string[] }
    wechatpay?: { status?: 'configured' | 'not-configured'; missing?: string[] }
  }
}

interface BillingBootstrapResponse {
  auth?: {
    authenticated?: boolean
    user?: AuthUserPublic | null
  }
  packages?: CreditPackage[]
  providerStatuses?: Record<PaymentProvider, PaymentConfiguration>
  chinaPaymentStatus?: ChinaPaymentStatusResponse
  walletSummary?: UserWallet | null
}

function perfLog(label: string, startedAt: number) {
  if (process.env.NODE_ENV === 'production' || typeof performance === 'undefined') return
  console.debug(`[perf] billing:${label}`, Math.round(performance.now() - startedAt))
}

function toPaymentConfiguration(provider?: { status?: 'checking' | 'configured' | 'not-configured'; missing?: string[] }): PaymentConfiguration {
  return {
    enabled: true,
    configured: provider?.status === 'configured',
    missing: provider?.missing ?? [],
  }
}

function toAlipayQrPayment(result: ChinaCheckoutResult, packageId: string, pkg?: CreditPackage): AlipayQrPayment | null {
  if (result.provider !== 'alipay' || result.mode !== 'qr' || !result.outTradeNo || !result.qrCode) return null
  return {
    packageId,
    packageName: result.packageName ?? pkg?.name ?? 'Creator City Credits',
    amountCnyFen: result.amountCnyFen ?? pkg?.prices.find((item) => item.region === 'CN' && item.provider === 'alipay')?.amount ?? 0,
    credits: result.credits ?? (pkg ? pkg.credits + pkg.bonusCredits : 0),
    outTradeNo: result.outTradeNo,
    qrCode: result.qrCode,
    expiresAt: result.expiresAt,
  }
}

export default function BillingPage() {
  const { payingPackageId, createPayment } = useChinaPaymentCheckout()
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [packagesHydratedFromCache, setPackagesHydratedFromCache] = useState(false)
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
  const [qrPayment, setQrPayment] = useState<AlipayQrPayment | null>(null)
  const [, setWalletSummary] = useState<UserWallet | null>(null)

  useEffect(() => {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    perfLog('init', startedAt)

    const cachedPackages = readPackagesCache()
    if (cachedPackages?.value.length) {
      setPackages(cachedPackages.value)
      setPackagesHydratedFromCache(true)
      perfLog('packages', startedAt)
    }
    const cachedChinaStatus = readChinaPaymentStatusCache()
    if (cachedChinaStatus?.value.providers) {
      setStatuses((current) => ({
        ...current,
        alipay: toPaymentConfiguration(cachedChinaStatus.value.providers?.alipay),
        wechat: toPaymentConfiguration(cachedChinaStatus.value.providers?.wechatpay),
      }))
      perfLog('payment-status', startedAt)
    }
    const cachedWallet = readWalletCache()
    if (cachedWallet?.value) {
      setWalletSummary(cachedWallet.value)
      perfLog('wallet', startedAt)
    }

    void (async () => {
      try {
        const bootstrapRes = await fetch('/api/billing/bootstrap', {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await bootstrapRes.json().catch(() => null) as BillingBootstrapResponse | null
        const auth = data?.auth
        setAuthStatus(auth?.authenticated ? 'authenticated' : 'unauthenticated')
        perfLog('auth', startedAt)
        if (data?.packages?.length) {
          setPackages(data.packages)
          writePackagesCache(data.packages)
        }
        perfLog('packages', startedAt)
        const chinaStatus = data?.chinaPaymentStatus
        if (chinaStatus?.providers) {
          writeChinaPaymentStatusCache(chinaStatus as ChinaPaymentStatusCache)
        }
        setStatuses({
          ...data?.providerStatuses,
          alipay: toPaymentConfiguration(chinaStatus?.providers?.alipay),
          wechat: toPaymentConfiguration(chinaStatus?.providers?.wechatpay),
          manual: data?.providerStatuses?.manual ?? { enabled: true, configured: true, missing: [] },
        } as Record<PaymentProvider, PaymentConfiguration>)
        perfLog('payment-status', startedAt)
        if (data?.walletSummary) {
          setWalletSummary(data.walletSummary)
          writeWalletCache(data.walletSummary)
        }
        perfLog('wallet', startedAt)
      } catch {
        setAuthStatus('unauthenticated')
        if (!cachedPackages?.value.length) {
          setNotice({ type: 'error', message: '充值页数据加载失败，请稍后重试。' })
        }
      } finally {
        perfLog('first-render', startedAt)
      }
    })()
  }, [])

  const changeRegion = (next: BillingRegion) => {
    setRegion(next)
    setProvider(next === 'CN' ? 'alipay' : 'stripe')
    setNotice(null)
  }

  const createAlipayQr = async (packageId: string) => {
    const pkg = packages.find((item) => item.id === packageId)
    const result = await createPayment({ provider: 'alipay', packageId })
    if (!result.success) {
      setNotice({ type: 'error', message: result.message ?? '创建支付宝订单失败', errorCode: result.errorCode })
      return null
    }
    const qr = toAlipayQrPayment(result, packageId, pkg)
    if (!qr) {
      setNotice({ type: 'error', message: '支付宝未返回可用二维码订单。' })
      return null
    }
    setNotice(null)
    setQrPayment(qr)
    return qr
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

      if (provider === 'alipay') {
        await createAlipayQr(packageId)
        return
      }

      if (provider === 'wechat') {
        setNotice({ type: 'error', message: '微信支付暂未接入真实支付。' })
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
        status?: string
        errorCode?: string
        message?: string
        checkoutUrl?: string
        paymentUrl?: string
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
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else setNotice({ type: 'info', message: data.message ?? '支付订单已创建。' })
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

        {packages.length > 0 ? (
          <>
            {packagesHydratedFromCache ? (
              <p className="mb-3 text-xs text-white/35">已先显示本地缓存套餐，正在后台同步最新状态。</p>
            ) : null}
            <CreditPackageGrid packages={packages} region={region} provider={provider} buyingId={buyingId ?? payingPackageId} onBuy={buy} />
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="min-h-[190px] animate-pulse rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="h-4 w-28 rounded bg-white/10" />
                <div className="mt-5 h-8 w-24 rounded bg-white/10" />
                <div className="mt-3 h-3 w-36 rounded bg-white/10" />
                <div className="mt-8 h-9 rounded-lg bg-white/10" />
              </div>
            ))}
          </div>
        )}
      </main>
      <AlipayQrPaymentModal
        payment={qrPayment}
        onClose={() => setQrPayment(null)}
        onRefresh={createAlipayQr}
        onPaid={async () => {
          const walletRes = await fetch('/api/credits/wallet', { credentials: 'include', cache: 'no-store' }).catch(() => null)
          if (walletRes?.ok) {
            const wallet = await walletRes.json().catch(() => null) as UserWallet | null
            if (wallet) {
              setWalletSummary(wallet)
              writeWalletCache(wallet)
            }
          }
          setNotice({ type: 'success', message: '支付成功，积分已到账。' })
        }}
      />
    </DashboardShell>
  )
}
