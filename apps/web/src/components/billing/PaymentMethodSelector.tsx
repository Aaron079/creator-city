'use client'

import type { BillingRegion, PaymentProvider } from '@/lib/billing/types'
import type { PaymentConfiguration } from '@/lib/payments/types'

const LABELS: Record<PaymentProvider, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
  stripe: 'Stripe',
  paddle: 'Paddle',
  manual: '人工充值',
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
  const providers: PaymentProvider[] = region === 'CN' ? ['alipay', 'wechat', 'manual'] : ['stripe', 'paddle']
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {providers.map((provider) => {
        const configured = statuses[provider]?.configured
        const disabled = provider !== 'manual' && !configured
        return (
          <button
            key={provider}
            type="button"
            disabled={disabled}
            onClick={() => onChange(provider)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              value === provider ? 'border-cyan-300/50 bg-cyan-300/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/70'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-white/25'}`}
          >
            <span className="block font-medium">{LABELS[provider]}</span>
            <span className="mt-1 block text-xs text-white/40">{disabled ? 'not-configured · 需要配置环境变量' : 'available'}</span>
          </button>
        )
      })}
    </div>
  )
}
