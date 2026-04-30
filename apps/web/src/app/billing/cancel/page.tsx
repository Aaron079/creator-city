import { DashboardShell } from '@/components/layout/DashboardShell'

export default function BillingCancelPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-white">支付已取消</h1>
        <p className="mt-3 text-sm text-white/55">未收到支付成功 webhook 前，不会发放 Creator City Credits。</p>
        <a className="mt-6 inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-white/75" href="/billing">返回购买积分</a>
      </main>
    </DashboardShell>
  )
}
