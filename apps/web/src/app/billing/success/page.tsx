import { DashboardShell } from '@/components/layout/DashboardShell'

export default function BillingSuccessPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-white">支付处理中</h1>
        <p className="mt-3 text-sm text-white/55">
          Credits 会在后端 webhook 验签成功后入账。如果页面已返回但余额未更新，请稍后刷新账单。
        </p>
        <a className="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950" href="/account/credits">查看我的积分</a>
      </main>
    </DashboardShell>
  )
}
