import { DashboardShell } from '@/components/layout/DashboardShell'

export default function BillingSuccessPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-white">支付处理中</h1>
        <p className="mt-3 text-sm text-white/55">
          City 积分已停用。历史订单以服务端核对结果为准；如已付款但状态未更新，请联系管理员核对。
        </p>
        <a className="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950" href="/account/credits">查看历史账单</a>
      </main>
    </DashboardShell>
  )
}
