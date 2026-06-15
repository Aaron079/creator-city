// /help/api-keys — Provider API Key 接入指南
// Static informational page. No API calls, no DB access, no generation chain.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'API Key 接入指南 | Creator City',
  description:
    '了解如何在 Creator City 连接自己的 Provider API Key，包含 DeepSeek、OpenAI、Kimi、火山方舟 Seedream 等主流 Provider 的逐步教程。',
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SUPPORTED: {
  name: string
  category: string
  status: 'live' | 'coming_soon'
  statusLabel: string
  fields: string
  canvasUse: string
}[] = [
  { name: 'DeepSeek V4 Flash / Pro', category: '文本', status: 'live',         statusLabel: '✅ 已支持',          fields: 'API Key',                      canvasUse: '文本节点' },
  { name: 'Kimi K2',                 category: '文本', status: 'live',         statusLabel: '✅ 已支持',          fields: 'API Key',                      canvasUse: '文本节点' },
  { name: 'OpenAI GPT',             category: '文本', status: 'live',         statusLabel: '✅ 已支持',          fields: 'API Key',                      canvasUse: '文本节点' },
  { name: 'Seedream Image（火山方舟）', category: '图片', status: 'live',    statusLabel: '✅ 已支持',          fields: 'API Key + Endpoint ID',        canvasUse: '图片节点' },
  { name: 'Seedance Video（火山方舟）', category: '视频', status: 'coming_soon', statusLabel: '🟡 存凭证，接入中', fields: 'API Key + Endpoint ID（预留）', canvasUse: '暂不可用于 BYOK 生成' },
  { name: 'OpenAI Image（DALL-E）',  category: '图片', status: 'coming_soon', statusLabel: '🟡 后续支持',        fields: '待定',                          canvasUse: '后续' },
  { name: 'Gemini',                  category: '文本/图片', status: 'coming_soon', statusLabel: '🟡 教程预留',    fields: '待定',                          canvasUse: '后续' },
  { name: 'Claude（Anthropic）',     category: '文本', status: 'coming_soon', statusLabel: '🟡 教程预留',        fields: '待定',                          canvasUse: '后续' },
  { name: '阿里通义 / DashScope',    category: '文本/图片', status: 'coming_soon', statusLabel: '🟡 教程预留',   fields: '待定',                          canvasUse: '后续' },
  { name: '腾讯混元',               category: '文本/图片', status: 'coming_soon', statusLabel: '🟡 教程预留',    fields: '待定',                          canvasUse: '后续' },
  { name: '百度千帆',               category: '文本/图片', status: 'coming_soon', statusLabel: '🟡 教程预留',    fields: '待定',                          canvasUse: '后续' },
  { name: 'Runway / Kling / MiniMax', category: '视频', status: 'coming_soon', statusLabel: '🟡 教程预留',      fields: '待定',                          canvasUse: '后续' },
]

const STEPS: {
  provider: string
  icon: string
  live: boolean
  liveNote?: string
  steps: string[]
  warning?: string
}[] = [
  {
    provider: 'DeepSeek',
    icon: '🔷',
    live: true,
    steps: [
      '打开 DeepSeek 开放平台（platform.deepseek.com）并登录',
      '进入控制台 → API Keys / 密钥管理',
      '点击「创建 API Key」，填写名称后确认',
      '复制生成的 Key（以 sk- 开头，只显示一次）',
      '回到 Creator City → 我的 API → 模型账户中心 → 添加账户',
      '选择 DeepSeek V4 Flash（或 V4 Pro），粘贴 API Key，填写账户名称',
      '保存后点击「测试连接」验证 Key 有效性',
      '在画布文本节点中切换「我的 API 账户」即可使用',
    ],
    warning: 'API Key 只在创建时显示一次，请立即复制并妥善保存。',
  },
  {
    provider: 'OpenAI',
    icon: '⬛',
    live: true,
    steps: [
      '打开 OpenAI Platform（platform.openai.com）并登录',
      '进入左侧菜单 → API keys',
      '点击「+ Create new secret key」，命名后创建',
      '复制以 sk- 开头的密钥（只显示一次）',
      '回到 Creator City → 模型账户中心 → 添加账户',
      '选择 OpenAI GPT，粘贴 API Key，保存',
      '点击「测试连接」验证',
    ],
    warning: 'ChatGPT 的网页登录账号和密码不是 API Key。API Key 在 platform.openai.com 控制台单独创建。OpenAI 账户需要开通 API billing 并有余额，否则调用会返回额度不足错误。',
  },
  {
    provider: 'Kimi（Moonshot）',
    icon: '🌙',
    live: true,
    steps: [
      '打开 Moonshot / Kimi 开放平台（platform.moonshot.cn）并登录',
      '进入控制台 → API Key 管理',
      '创建新的 API Key，复制密钥',
      '回到 Creator City → 模型账户中心 → 添加账户',
      '选择 Kimi K2，粘贴 API Key，保存',
      '点击「测试连接」验证',
    ],
  },
  {
    provider: 'Seedream Image（火山方舟）',
    icon: '🌋',
    live: true,
    liveNote: 'Seedream 图片 BYOK 已上线，需要 API Key + Endpoint ID 两个字段。',
    steps: [
      '打开火山方舟控制台（console.volcengine.com/ark）并登录',
      '在控制台顶部菜单找到「API Key 管理」，创建并复制 API Key',
      '进入「模型接入」→ 找到 Seedream Image 模型 → 创建接入点（Endpoint）',
      '复制接入点 ID（格式类似 ep-xxxxxxxxxxxx-xxxxxxxx）',
      '回到 Creator City → 模型账户中心 → 添加账户',
      '选择「Seedream Image（火山方舟）」',
      '分别填入 API Key 和 Endpoint ID，保存账户',
      '在画布图片节点中切换「我的 API 账户」，选中该账户后生成图片',
    ],
    warning: 'Endpoint ID 是接入点 ID，不是 API Key。两者都需要填写。火山方舟的「测试连接」不会发起真实图片生成，请以画布图片节点实际生成结果为准。',
  },
  {
    provider: 'Seedance Video（火山方舟）',
    icon: '🎬',
    live: false,
    steps: [
      '当前 Seedance Video BYOK 尚未对外开放，视频生成仍走平台能力',
      '你可以在模型账户中心预先保存火山方舟的 API Key + Endpoint ID',
      '保存凭证不会触发任何生成调用，只是在账户中心记录凭证',
      '当 Seedance Video BYOK 正式上线后，凭证将自动可用',
    ],
    warning: '当前保存 Seedance Video 凭证不代表 Video BYOK 已可用。画布视频节点的 BYOK 切换尚未开放。',
  },
]

const ERRORS: { q: string; a: string }[] = [
  {
    q: '把网页登录邮箱 / 密码填进去了',
    a: '邮箱和密码不是 API Key。API Key 在 Provider 控制台的密钥管理页面单独创建，通常以 sk- 或类似格式开头。',
  },
  {
    q: '粘贴时 Key 不完整，提示认证失败',
    a: '复制时请确保选中完整的 Key。部分终端和 UI 复制时会在末尾加上空格或换行，建议粘贴后检查是否有多余字符。',
  },
  {
    q: 'OpenAI 提示额度不足 / 余额不足',
    a: 'OpenAI API 账户需要开通 API billing 并充值，和 ChatGPT Plus 订阅是独立的。请登录 platform.openai.com 检查 Billing 状态。',
  },
  {
    q: 'Seedream 生成失败，提示模型不可用',
    a: '请检查 Endpoint ID 是否填写正确，它是接入点 ID（如 ep-xxxx），不是 API Key 本身。请在火山方舟控制台确认接入点状态为"运行中"。',
  },
  {
    q: 'Key 被删除或过期后提示 auth_failed',
    a: '请到 Provider 控制台重新生成一个新 Key，然后在 Creator City 模型账户中心删除旧账户并重新添加。',
  },
  {
    q: '使用我的 API 后还是扣了平台 credits？',
    a: '使用「我的 API 账户」模式时，Creator City 不扣平台模型 credits。Provider 会直接向你的账户计费。如果你的平台 credits 有变化，请检查是否同时存在走平台额度的生成。',
  },
  {
    q: '页面一直显示生成中，没有结果',
    a: '可能是 Key 余额不足或 Endpoint 未正常运行。请到 Provider 控制台检查账户余额和接入点状态，也可以到画布节点查看错误详情。',
  },
  {
    q: 'Seedream 账户状态显示「不支持自动测试」，怎么验证是否可用？',
    a: '火山方舟限制了 /models 接口，导致 Creator City 无法自动连接测试。这不代表账户有问题。请在画布图片节点中切换「我的 API 账户」，选择该账户并生成一张图片，以实际生成结果验证账户可用性。',
  },
  {
    q: '测试连接提示「连接超时」，账户是否还能用？',
    a: '超时通常是 Provider 侧临时故障或网络波动，不代表 API Key 失效。可等待几分钟后重试，或直接在画布中尝试生成验证。如果持续超时，建议切换为平台额度模式生成，并检查 Provider 服务状态页。',
  },
  {
    q: '我使用 BYOK 生成时，Creator City 会向我收取平台服务费吗？',
    a: '当前平台服务费功能未启用（计费值为 0）。使用「我的 API 账户」模式时，Creator City 不扣取平台模型积分，也不收取平台服务费。API 调用费用由你直接支付给 Provider，Creator City 不参与计费。',
  },
]

// ── Components ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30 mb-4">
      {children}
    </p>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 ${className}`}>
      {children}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApiKeysGuidePage() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0a0b', color: '#fff' }}>
      <div className="mx-auto max-w-3xl px-4 py-10 pb-20">

        {/* Top navigation */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
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
          <Link
            href="/account/providers"
            className="rounded-lg border border-violet-500/20 bg-violet-500/[0.05] px-3.5 py-1.5 text-xs text-violet-300/70 transition hover:border-violet-500/35 hover:text-violet-200"
          >
            我的 API 账户
          </Link>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-white/25 mb-6">
          <Link href="/" className="hover:text-white/50 transition">首页</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-white/50 transition">帮助中心</Link>
          <span>/</span>
          <span className="text-white/40">API Key 接入指南</span>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-white/30">我的 API · 接入教程</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-3">API Key 接入指南</h1>
          <p className="text-sm text-white/50 leading-relaxed max-w-xl">
            API Key 是 Provider 控制台生成的访问密钥，
            <strong className="text-white/70">不是你的网页登录邮箱和密码</strong>。
            连接后，你可以在 Creator City 中使用自己的模型额度，Provider 费用由你直接支付给服务商，
            Creator City 不赚 API 差价、不作为 API 中间商参与计费。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-violet-500/25 bg-violet-500/[0.07] text-violet-300/80">
              第一版采用 BYOK 模式，请准备自己的 Provider API Key
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/35">
              API 费用由你直接支付给服务商，Creator City 不代付
            </span>
          </div>
        </div>

        {/* Section 1 — 当前支持状态 */}
        <section className="mb-8">
          <SectionLabel>当前支持状态</SectionLabel>
          <Card>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 pr-4 text-white/30 font-normal">Provider</th>
                    <th className="pb-3 pr-4 text-white/30 font-normal">类型</th>
                    <th className="pb-3 pr-4 text-white/30 font-normal">状态</th>
                    <th className="pb-3 pr-4 text-white/30 font-normal hidden sm:table-cell">需要填写</th>
                    <th className="pb-3 text-white/30 font-normal hidden sm:table-cell">画布用途</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {SUPPORTED.map((row) => (
                    <tr key={row.name} className={row.status === 'coming_soon' ? 'opacity-50' : ''}>
                      <td className="py-2.5 pr-4 text-white/75 font-medium">{row.name}</td>
                      <td className="py-2.5 pr-4 text-white/40">{row.category}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{row.statusLabel}</td>
                      <td className="py-2.5 pr-4 text-white/40 hidden sm:table-cell">{row.fields}</td>
                      <td className="py-2.5 text-white/40 hidden sm:table-cell">{row.canvasUse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[11px] text-white/20 leading-relaxed border-t border-white/[0.05] pt-3">
              「后续支持 / 教程预留」的 Provider 当前不能在 Creator City 中用 BYOK 模式生成内容，仅做信息展示。请勿据此误判为已可生成。
            </p>
          </Card>
        </section>

        {/* Section 2 — 通用填写规则 */}
        <section className="mb-8">
          <SectionLabel>账户字段说明</SectionLabel>
          <Card>
            <div className="space-y-4">
              {[
                { field: 'Provider', desc: '选择对应的 AI 服务商，例如 DeepSeek、OpenAI、Kimi、Volcengine Seedream Image 等。选择后表单会自动适配所需字段。' },
                { field: '账户名称', desc: '只是你自己看的备注，例如"我的 DeepSeek 账户"或"公司 OpenAI Key"，不影响实际调用。' },
                { field: 'API Key', desc: 'Provider 控制台生成的访问密钥。不同 Provider 格式不同，DeepSeek / OpenAI 以 sk- 开头，其他 Provider 各有不同。保存后只显示末 4 位，完整 Key 不可查看。' },
                { field: 'Endpoint ID / Model ID', desc: '只有部分 Provider（如火山方舟）需要填写。它是你在该平台为特定模型创建的接入点 ID，不是 API Key，也不是模型名称。如果 Provider 不要求，此字段不会出现。' },
                { field: '设为默认', desc: '同一 Provider 可以保存多个账户，设为默认的账户会在画布节点中优先显示。' },
              ].map((item) => (
                <div key={item.field} className="flex gap-3">
                  <div className="flex-shrink-0 w-32 text-xs font-medium text-white/60 pt-0.5">{item.field}</div>
                  <div className="text-xs text-white/40 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Section 3 — 各 Provider 教程 */}
        <section className="mb-8">
          <SectionLabel>各 Provider 接入步骤</SectionLabel>
          <div className="space-y-4">
            {STEPS.map((item) => (
              <Card key={item.provider}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{item.provider}</h3>
                      {item.live ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400/80 font-medium">✅ 已支持</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/[0.06] text-amber-400/70 font-medium">🟡 暂未开放 BYOK</span>
                      )}
                    </div>
                    {item.liveNote && (
                      <p className="text-xs text-emerald-400/60 mt-1">{item.liveNote}</p>
                    )}
                  </div>
                </div>
                <ol className="space-y-2 list-none">
                  {item.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-xs text-white/55 leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full border border-white/10 bg-white/[0.04] flex items-center justify-center text-[10px] text-white/35 font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {item.warning && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2.5">
                    <p className="text-xs text-amber-400/75 leading-relaxed">
                      <span className="font-semibold">注意：</span>{item.warning}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Section 4 — 常见错误 */}
        <section className="mb-8">
          <SectionLabel>出错了怎么办？</SectionLabel>
          <Card>
            <div className="space-y-5">
              {ERRORS.map((item, i) => (
                <div key={i} className={i < ERRORS.length - 1 ? 'border-b border-white/[0.05] pb-5' : ''}>
                  <p className="text-xs font-semibold text-white/70 mb-1.5">Q：{item.q}</p>
                  <p className="text-xs text-white/40 leading-relaxed">A：{item.a}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Section 5 — 安全说明 */}
        <section className="mb-8">
          <SectionLabel>安全说明</SectionLabel>
          <Card>
            <div className="space-y-3">
              {[
                '🔐  Creator City 使用 AES-256-GCM 加密存储 API Key，保存后只显示末 4 位，完整 Key 不可在页面查看。',
                '🚫  不要将 API Key 截图、发给他人、提交到代码仓库或粘贴到任何公开场合。',
                '🗑️  删除账户后，加密的 Key 将从数据库中永久删除，无法恢复。',
                '⚠️  如果怀疑 Key 已经泄露，请立即到 Provider 控制台删除旧 Key，并重新生成一个新的。',
                '💰  使用「我的 API 账户」模式时，Creator City 不扣除平台模型 credits。但 Provider 会直接向你的账户计费，请确保 Provider 账户有足够余额。',
                '🔒  Creator City 不会在任何 API 响应或页面中展示完整的 API Key 明文，也不会在日志中记录 Key 值。',
              ].map((item, i) => (
                <p key={i} className="text-xs text-white/45 leading-relaxed">{item}</p>
              ))}
            </div>
          </Card>
        </section>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/account/providers"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-5 py-3 text-sm text-violet-300/80 font-medium transition hover:bg-violet-500/[0.12] hover:text-violet-200"
          >
            <span>⚡</span> 前往模型账户中心添加账户
          </Link>
          <Link
            href="/help"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-white/50 transition hover:border-white/20 hover:text-white/70"
          >
            ← 返回帮助中心
          </Link>
        </div>

      </div>
    </div>
  )
}
