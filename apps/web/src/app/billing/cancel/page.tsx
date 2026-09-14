import { DashboardShell } from '@/components/layout/DashboardShell'

export default function BillingCancelPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-white">支付已取消</h1>
        <p className="mt-3 text-sm text-white/55">City 积分已停用，不再创建新购买订单。历史订单状态请查看账单。</p>
        <a className="mt-6 inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-white/75" href="/account/credits">查看历史账单</a>
      </main>
    </DashboardShell>
  )
}
