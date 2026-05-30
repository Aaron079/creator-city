'use client'

import type { BillingRegion, PaymentProvider } from '@/lib/billing/types'
import type { PaymentConfiguration } from '@/lib/payments/types'

const LABELS: Record<PaymentProvider, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
  stripe: 'Stripe',
  paddle: 'Paddle',
  manual: '转账充值',
}

const DISABLED_SUBTITLE: Partial<Record<PaymentProvider, string>> = {
  alipay: '待商户配置',
  wechat: '开发中',
}

const AVAILABLE_SUBTITLE: Partial<Record<PaymentProvider, string>> = {
  manual: '联系管理员确认到账',
}

export function PaymentMethodSelector({
  region,
  value,
  statuses,
  onChange,
}: {
  region: BillingRegion
  value: PaymentProvider
  statuses: Record<PaymentProvider, PaymentConfiguration>
  onChange: (provider: PaymentProvider) => void
}) {
  const providers: PaymentProvider[] = region === 'CN' ? ['manual', 'alipay', 'wechat'] : ['stripe', 'paddle']
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {providers.map((p) => {
        const configured = statuses[p]?.configured
        const disabled = p !== 'manual' && !configured
        const subtitle = disabled
          ? (DISABLED_SUBTITLE[p] ?? '需要配置')
          : (AVAILABLE_SUBTITLE[p] ?? 'available')
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              value === p ? 'border-cyan-300/50 bg-cyan-300/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-white/25'}`}
          >
            <span className="block font-medium">{LABELS[p]}</span>
            <span className="mt-1 block text-xs text-white/40">{subtitle}</span>
          </button>
        )
      })}
    </div>
  )
}
