'use client'

import { useState } from 'react'

const PACKAGE_REFS = [
  { name: 'Starter', credits: 500, label: '轻量体验' },
  { name: 'Creator', credits: 1500, label: '日常创作' },
  { name: 'Studio', credits: 5500, label: '视频创作' },
  { name: 'Team', credits: 15000, label: '团队生产' },
  { name: 'Enterprise', credits: 50000, label: '工作室规模' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 rounded border border-white/15 px-2 py-0.5 text-xs text-white/50 hover:border-white/30 hover:text-white/75 transition"
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

export function ManualRechargePanel({ orderId }: { orderId?: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm">

      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base font-semibold text-white">转账充值</span>
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-200">
          测试期
        </span>
      </div>

      <p className="mb-5 text-white/55 leading-relaxed">
        当前自动支付正在接入中。测试期可通过线下转账充值 Creator City Credits。
        转账完成后联系管理员确认到账，积分将在确认后发放到你的账户。
      </p>

      {/* Step flow */}
      <div className="mb-5 grid gap-2">
        {[
          { step: '1', text: '在下方选择套餐，点击"购买"提交充值申请' },
          { step: '2', text: '记录申请编号，通过微信/支付宝/银行转账打款' },
          { step: '3', text: '转账备注填写申请编号或注册邮箱' },
          { step: '4', text: '联系管理员，管理员确认到账后发放 credits' },
        ].map(({ step, text }) => (
          <div key={step} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60">
              {step}
            </span>
            <span className="text-white/55 leading-relaxed">{text}</span>
          </div>
        ))}
      </div>

      {/* Submitted order confirmation */}
      {orderId ? (
        <div className="mb-5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-emerald-300/70">
            申请已提交 — 等待管理员确认
          </div>
          <div className="mt-2 flex items-center">
            <span className="text-xs text-white/40 mr-2">申请编号：</span>
            <code className="font-mono text-xs text-emerald-200 break-all">{orderId}</code>
            <CopyButton text={orderId} />
          </div>
          <p className="mt-3 text-xs text-white/45 leading-relaxed">
            请在转账备注中填写此申请编号或你的注册邮箱，以便管理员核对。
            积分在管理员确认到账后自动发放，刷新页面可查看余额变化。
          </p>
        </div>
      ) : null}

      {/* Payment methods placeholder */}
      <div className="mb-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
          收款方式
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: '微信收款', status: '即将配置' },
            { label: '支付宝', status: '即将配置' },
            { label: '银行转账', status: '联系管理员获取' },
          ].map(({ label, status }) => (
            <div
              key={label}
              className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-3 text-center"
            >
              <div className="text-sm font-medium text-white/60">{label}</div>
              <div className="mt-1 text-xs text-white/30">{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Package reference */}
      <div className="mb-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/30">
          套餐参考（请在下方选择套餐后提交申请）
        </p>
        <div className="grid gap-1.5 sm:grid-cols-5">
          {PACKAGE_REFS.map((pkg) => (
            <div
              key={pkg.name}
              className="rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-2 text-center"
            >
              <div className="text-xs font-semibold text-white/70">{pkg.name}</div>
              <div className="mt-0.5 text-sm font-bold text-cyan-200/90">{pkg.credits.toLocaleString()}</div>
              <div className="mt-0.5 text-xs text-white/30">{pkg.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin contact notice */}
      <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
        <p className="text-xs leading-relaxed text-white/40">
          如有问题，请通过群组或联系方式找到管理员，提供申请编号和转账截图。
          Credits 到账后将显示在画布右上角余额徽章。
        </p>
      </div>

    </section>
  )
}
