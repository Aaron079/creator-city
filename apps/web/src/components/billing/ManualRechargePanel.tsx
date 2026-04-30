'use client'

export function ManualRechargePanel({ orderId }: { orderId?: string }) {
  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
      <div className="font-semibold">人工充值</div>
      <p className="mt-2 text-amber-100/75">
        人工充值只会创建 pending 订单。管理员确认收款后，必须在后端确认订单并写入 CreditLedger，前端不会直接加积分。
      </p>
      {orderId ? <div className="mt-3 font-mono text-xs text-amber-100/80">Order: {orderId}</div> : null}
    </section>
  )
}
