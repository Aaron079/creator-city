import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'
import { ManualRechargeAdminPanel } from '@/components/admin/ManualRechargeAdminPanel'
import { AdminChinaPaymentsClient, type AdminChinaPaymentOrder } from './AdminChinaPaymentsClient'

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs ${configured ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
      {configured ? 'configured' : 'not-configured'}
    </span>
  )
}

function getPackageName(order: {
  package: { name: string } | null
  rawNotifyJson: unknown
}) {
  if (order.package?.name) return order.package.name
  if (!order.rawNotifyJson || typeof order.rawNotifyJson !== 'object') return null
  const packageName = (order.rawNotifyJson as Record<string, unknown>).packageName
  return typeof packageName === 'string' ? packageName : null
}

async function getRecentChinaPaymentOrders(): Promise<AdminChinaPaymentOrder[]> {
  const orders = await db.paymentOrder.findMany({
    where: {
      region: 'CN',
      provider: { in: ['alipay', 'wechatpay'] },
    },
    include: {
      package: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return orders.map((order) => ({
    id: order.id,
    outTradeNo: order.externalOrderId,
    userId: order.userId,
    provider: order.provider,
    packageName: getPackageName(order),
    credits: order.credits,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  }))
}

export default async function AdminChinaPaymentsPage() {
  const user = await getCurrentUser()
  const configs = getChinaPaymentConfigurations()
  const simulationEnabled = process.env.PAYMENT_SANDBOX_SIMULATION_ENABLED === 'true'

  if (!user) {
    return (
      <DashboardShell>
        <div className="p-8 text-sm text-red-400">请先登录管理员账户。</div>
      </DashboardShell>
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <DashboardShell>
        <div className="p-8 text-sm text-red-400">无权限：仅管理员可访问。</div>
      </DashboardShell>
    )
  }

  let orders: AdminChinaPaymentOrder[] = []
  let ordersLoadError = false
  try {
    orders = await getRecentChinaPaymentOrders()
  } catch {
    ordersLoadError = true
  }

  return (
    <DashboardShell>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">中国支付中台</h1>
        <p className="mt-2 text-sm text-white/50">
          展示支付宝与微信支付配置状态，并提供沙箱模式下的管理员模拟支付入账。
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

        {ordersLoadError && (
          <div className="mt-6 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            订单列表暂时无法加载，请稍后刷新。
          </div>
        )}

        {/* ── 区块 A：人工充值申请（需管理员逐笔审批）── */}
        <div className="mt-8">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[11px] uppercase tracking-widest text-white/25">人工审批通道</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
          <p className="mb-1 text-xs text-white/30">
            用户通过 /billing?region=CN&amp;method=manual 提交转账充值申请，由管理员核对线下到账后逐笔审批发放。
          </p>
        </div>
        <ManualRechargeAdminPanel />

        {/* ── 区块 B：自动支付 / 沙箱订单（支付宝/微信回调自动入账）── */}
        <div className="mt-10">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-[11px] uppercase tracking-widest text-white/25">自动支付通道</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
          <p className="mb-1 text-xs text-white/30">
            支付宝 / 微信自动支付订单，验签通过后由 webhook 自动入账，无需人工操作。沙箱期间可由管理员触发模拟入账验证链路。
          </p>
        </div>
        <AdminChinaPaymentsClient orders={orders} simulationEnabled={simulationEnabled} />
      </main>
    </DashboardShell>
  )
}
