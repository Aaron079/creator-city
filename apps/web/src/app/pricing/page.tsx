import Link from 'next/link'
import { DashboardShell } from '@/components/layout/DashboardShell'

export const metadata = {
  title: '会员价格 | Creator City',
  description: 'Creator City 100 元/月会员订阅 — 创作工作台使用权益说明',
}

const benefits = [
  '使用 Creator City 创作工作台（画布、节点、多轨生成）',
  '管理资产库和创作者主页',
  '浏览 Marketplace 并申请授权合作',
  '使用 BYOK 接入自己的 AI Provider（API 费用直接支付给服务商）',
  '后续会员权益持续扩展',
]

const notIncluded = [
  '第三方 AI API 调用成本（OpenAI / DeepSeek / 火山 Ark 等由你直接支付给服务商）',
  'Marketplace 平台担保交易（第一版为作品展示与授权合作意向）',
]

export default function PricingPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30">会员价格</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight text-white">Creator City 会员</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            第一版采用会员订阅模式。会员费是平台服务费，不包含第三方 AI API 调用成本。
          </p>
        </div>

        {/* Price card */}
        <section className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-8">
          <div className="flex items-end gap-2">
            <span className="text-5xl font-light text-white">¥100</span>
            <span className="mb-1 text-base text-white/40">/ 月</span>
          </div>
          <p className="mt-2 text-sm text-white/40">按月订阅 · 人工审核开通</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/account/membership"
              className="rounded-full bg-violet-500 px-5 py-2 text-sm font-medium text-white hover:bg-violet-400 transition-colors"
            >
              开通会员
            </Link>
            <Link
              href="/account/providers"
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm text-white/70 hover:border-white/25 transition-colors"
            >
              添加 API Key（BYOK）
            </Link>
          </div>
        </section>

        {/* Included */}
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-sm font-semibold text-white/70">会员权益</h2>
          <ul className="mt-4 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-white/55">
                <span className="mt-0.5 shrink-0 text-violet-400">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </section>

        {/* Not included */}
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-sm font-semibold text-white/50">不包含的费用</h2>
          <ul className="mt-4 space-y-3">
            {notIncluded.map((n) => (
              <li key={n} className="flex items-start gap-3 text-sm text-white/35">
                <span className="mt-0.5 shrink-0 text-white/20">×</span>
                {n}
              </li>
            ))}
          </ul>
        </section>

        {/* How to pay */}
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">开通流程</h2>
          <ol className="space-y-2 text-sm text-white/45 list-decimal list-inside">
            <li>前往<Link href="/account/membership" className="text-violet-300/80 underline underline-offset-2 ml-1">会员中心</Link>提交开通申请</li>
            <li>按照页面说明完成线下转账，填写付款备注</li>
            <li>管理员人工核实后开通会员（通常 1 个工作日内）</li>
            <li>会员有效期 30 天，续费可叠加累积</li>
          </ol>
          <p className="text-xs text-white/25 pt-1">
            会员费一经管理员审批开通后不退款。如有疑问请在提交前联系管理员确认。
          </p>
        </section>

        {/* BYOK note */}
        <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6">
          <h2 className="text-sm font-semibold text-white/50">关于 AI 生成费用</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/40">
            Creator City 会员费不包含第三方 AI API 调用成本。AI 图片/视频/文本生成使用你自己绑定的 API Key（BYOK），
            费用由你直接支付给 DeepSeek、OpenAI、火山 Ark 等服务商，不经过 Creator City 平台积分。
          </p>
          <Link
            href="/account/providers"
            className="mt-4 inline-flex items-center gap-1 text-sm text-violet-300/70 hover:text-violet-300 underline underline-offset-2"
          >
            前往绑定 Provider API Key →
          </Link>
        </section>

      </main>
    </DashboardShell>
  )
}
