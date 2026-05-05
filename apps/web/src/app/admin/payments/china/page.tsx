import { DashboardShell } from '@/components/layout/DashboardShell'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${configured ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
      {configured ? 'configured' : 'not-configured'}
    </span>
  )
}

export default function AdminChinaPaymentsPage() {
  const configs = getChinaPaymentConfigurations()

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">中国支付中台</h1>
        <p className="mt-2 text-sm text-white/50">
          第一阶段只展示支付宝与微信支付配置状态。当前积分账本与人工充值逻辑保持不变。
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {Object.values(configs).map((config) => (
            <section key={config.provider} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-white">
                  {config.provider === 'alipay' ? '支付宝' : '微信支付'}
                </div>
                <StatusBadge configured={config.configured} />
              </div>
              <div className="mt-4 text-sm text-white/50">mode: {config.mode}</div>
              <div className="mt-3 text-xs leading-6 text-white/40">
                missing: {config.missing.length > 0 ? config.missing.join(', ') : 'none'}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-white/55">
          Stripe / Paddle 仍保留为海外兼容路径，但不再作为中国大陆生产主方案。中国生产支付应走
          ChinaPaymentGateway，并在验签完成后再把 PaymentOrder 入账到 UserCreditWallet 与 CreditLedger。
        </section>
      </main>
    </DashboardShell>
  )
}
