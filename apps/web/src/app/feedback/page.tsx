// /feedback — Static feedback collection guide.
// No DB, no API calls, no generation chain. Pure informational page.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '反馈 | Creator City',
  description: '向 Creator City 团队提交试用反馈、问题报告或功能建议。',
}

const FEEDBACK_ITEMS = [
  { label: '你的账号邮箱', desc: '方便管理员查询你的账号状态' },
  { label: '问题描述', desc: '发生了什么？你期望的结果是什么？' },
  { label: '操作步骤', desc: '按顺序描述你做了什么，以便复现' },
  { label: '截图 / 视频（如有）', desc: '特别是报错信息、网络错误、生成失败等' },
  { label: '浏览器 / 设备', desc: '例如：Chrome / macOS，或微信内置浏览器 / iOS' },
]

const CATEGORIES = [
  { icon: '🖼', title: '图片生成问题', examples: ['生成失败 / 超时', '结果未出现在画布', 'API Key 错误'] },
  { icon: '💾', title: '保存 / 加载问题', examples: ['画布丢失', '保存按钮无响应', '历史项目打不开'] },
  { icon: '★', title: '会员相关', examples: ['付款后未开通', '会员到期后仍显示会员', '开通申请被拒'] },
  { icon: '⚡', title: 'API Key / Provider', examples: ['Key 填写后仍提示无效', 'Endpoint ID 找不到', '测试连接一直超时'] },
  { icon: '🛍', title: 'Marketplace / 意向', examples: ['提交意向失败', '卖方看不到意向', '状态不更新'] },
  { icon: '💬', title: '功能建议 / 其他', examples: ['体验改进建议', '想要新功能', '内容或文案问题'] },
]

export default function FeedbackPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0b', color: '#fff' }}>
      <div className="mx-auto max-w-2xl px-4 py-10 pb-20">

        {/* Nav */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
          >
            ← 返回首页
          </Link>
          <Link
            href="/help"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55 transition hover:border-white/20 hover:text-white"
          >
            帮助中心
          </Link>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/30">首批用户试用 · 反馈渠道</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-3">提交反馈</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Creator City 目前处于首批用户试用阶段。你的反馈将直接帮助改进产品。
            请通过下方联系方式提交反馈，管理员通常在 1 个工作日内回复。
          </p>
        </div>

        {/* Contact */}
        <section className="mb-8 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/60 mb-4">反馈联系方式</p>
          <p className="text-sm text-white/60 leading-relaxed mb-4">
            请将反馈发送至管理员提供的联系方式（微信 / 邮件），或通过邀请时获得的渠道联系。
          </p>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-white/35 leading-relaxed">
              如果你是通过邀请链接注册的，请通过邀请你的渠道（微信群 / 邮件 / 社群）提交反馈。<br />
              管理员会在收到反馈后 1 个工作日内回复处理结果。
            </p>
          </div>
        </section>

        {/* What to include */}
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30 mb-4">反馈时请包含以下信息</p>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
            {FEEDBACK_ITEMS.map((item) => (
              <div key={item.label} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border border-white/15 bg-white/[0.05] flex items-center justify-center">
                  <span className="text-[9px] text-white/40 font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/75">{item.label}</p>
                  <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30 mb-4">反馈分类参考</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{cat.icon}</span>
                  <p className="text-sm font-medium text-white/70">{cat.title}</p>
                </div>
                <ul className="space-y-1">
                  {cat.examples.map((ex) => (
                    <li key={ex} className="text-xs text-white/35 leading-relaxed">· {ex}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Useful links */}
        <section className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30 mb-4">提交前先自助排查</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/help"
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-sm text-white/60 hover:border-white/[0.14] hover:text-white transition"
            >
              <span className="flex items-center gap-2.5"><span>🔍</span> 诊断帮助中心</span>
              <span className="text-white/20 text-xs">→</span>
            </Link>
            <Link
              href="/help/api-keys"
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-sm text-white/60 hover:border-white/[0.14] hover:text-white transition"
            >
              <span className="flex items-center gap-2.5"><span>📖</span> API Key 接入指南</span>
              <span className="text-white/20 text-xs">→</span>
            </Link>
            <Link
              href="/account/providers"
              className="flex items-center justify-between gap-3 rounded-xl border border-violet-500/15 bg-violet-500/[0.03] px-4 py-3.5 text-sm text-violet-300/70 hover:border-violet-500/25 hover:text-violet-200 transition"
            >
              <span className="flex items-center gap-2.5"><span>⚡</span> 我的 API 账户管理</span>
              <span className="text-violet-300/25 text-xs">→</span>
            </Link>
          </div>
        </section>

        {/* Notice */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 text-xs text-white/30 leading-relaxed space-y-1.5">
          <p className="font-semibold text-white/40">试用期说明</p>
          <p>· 首批试用为邀请制，非公开注册阶段。</p>
          <p>· 平台积分充值暂未开放，第一版为会员订阅 + 自带 API Key（BYOK）模式。</p>
          <p>· 会员费一经开通不退款，如有疑问请在提交申请前联系管理员确认。</p>
          <p>· Marketplace 当前仅展示与意向登记，不代表授权成交，不触发资金托管。</p>
        </div>

      </div>
    </div>
  )
}
