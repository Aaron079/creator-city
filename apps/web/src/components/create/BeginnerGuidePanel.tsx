'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'guide' | 'apikey' | 'providers' | 'debug'

type QAItem = {
  id: string
  q: string
  a: string
  link?: { href: string; label: string }
}

type ProviderInfo = {
  id: string
  name: string
  purpose: string
  steps: string[]
  notes?: string[]
  status: 'text-pilot' | 'future'
  statusLabel: string
}

// ── Static data ────────────────────────────────────────────────────────────────

const GUIDE_ITEMS: QAItem[] = [
  {
    id: 'start',
    q: '我第一次使用，应该从哪里开始？',
    a: '点击左侧「+」添加一个「文本」节点，在弹出的对话框里输入你的想法（例如"写一段山地越野广告词"），然后点击「生成」。中国版默认使用 DeepSeek，无需额外配置。',
  },
  {
    id: 'image-video',
    q: '如何继续生成图片或视频？',
    a: '文本节点生成完成后，拖动节点右侧的连线圆点，选择「图片生成」或「视频生成」创建下游节点，填写 Prompt 后点击生成。图片用 Volcengine Seedream，视频用 Volcengine Seedance，均为中国版默认 Provider。',
  },
  {
    id: 'assets',
    q: '素材在哪里找回？',
    a: '所有生成成功的图片/视频都保存在资产库。即使节点状态显示失败，只要曾经生成成功，也可以前往 /assets 找回。',
    link: { href: '/assets', label: '→ 打开资产库' },
  },
  {
    id: 'switch',
    q: '如何切换 Provider？',
    a: '点击节点卡片，在对话框顶部的 Provider 下拉框中选择 DeepSeek、Kimi、Volcengine 等可用 Provider，当前选择自动保存到该节点，不影响其他节点。',
  },
]

const APIKEY_ITEMS: QAItem[] = [
  {
    id: 'what',
    q: 'API Key 是什么？我需要它吗？',
    a: 'API Key 是 Provider 控制台生成的访问密钥（通常以 sk- 开头），用于让第三方应用直接调用该 Provider 的 AI 能力。普通用户完全不需要 API Key，使用平台额度即可创作。API Key 是给专业用户和团队的可选能力。',
  },
  {
    id: 'not-password',
    q: 'API Key 和登录密码有什么区别？',
    a: 'API Key 不是你的网页登录邮箱/密码。它是在 Provider 的开发者控制台（如 DeepSeek 开放平台、OpenAI Platform）单独生成的，一串随机字符。填写时必须填这个控制台生成的 Key，填登录密码会导致"认证失败"。',
  },
  {
    id: 'byok-vs-credits',
    q: '平台额度 vs 我的 API 账户，有什么区别？',
    a: '平台额度：购买 Creator City 积分，由平台代付 API 调用费用，适合轻度用户，无需管理 Key。\n\n我的 API 账户：接入自己的 Provider API Key，API 调用费用由你直接支付给服务商（DeepSeek、OpenAI 等），Creator City 只收取平台服务费（工作台、协作、交易），不代扣 API 费用。',
  },
  {
    id: 'security',
    q: 'API Key 安全吗？怎么保护？',
    a: 'Creator City 对 API Key 加密存储，保存后只显示末 4 位，不可反向查看完整 Key。\n\n安全提醒：\n· 不要把 API Key 截图或发给他人\n· 不要填写网页登录账号密码\n· 如果 Key 疑似泄露，请立即去对应 Provider 控制台撤销并重新生成\n· Creator City 不会把你的 Key 用于平台其他用户',
  },
  {
    id: 'where-add',
    q: '在哪里添加我的 API 账户？',
    a: '前往「我的 API → Provider API 账户」管理页面，点击「添加 API 账户」，选择 Provider，填写账户名称和 API Key 后保存。添加后可以点「测试连接」验证 Key 是否有效。',
    link: { href: '/account/providers', label: '→ 前往 我的 API' },
  },
]

const MAIN_PROVIDERS: ProviderInfo[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    purpose: '中文文本、推理、低成本文本生成',
    steps: [
      '前往 DeepSeek 官方开放平台并登录账号',
      '进入「API Keys / API 密钥」页面',
      '创建新的 API Key 并完整复制',
      '在 Creator City → 我的 API → 添加账户',
      'Provider 选「DeepSeek V4 Flash」或「V4 Pro」',
      '粘贴 API Key，保存后点击「测试连接」',
    ],
    notes: [
      '不要填写 DeepSeek 登录邮箱/密码',
      '认证失败请检查 Key 是否完整、账户是否有余额',
    ],
    status: 'text-pilot',
    statusLabel: '当前文本试点支持',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    purpose: '文本、多模态、Agent、通用能力',
    steps: [
      '前往 OpenAI Platform 并登录账号',
      '进入「API keys / Project API keys」',
      '点击「Create new secret key」，完整复制（仅展示一次）',
      '在 Creator City → 我的 API → 添加账户',
      'Provider 选「OpenAI GPT」，粘贴 Key，保存',
    ],
    notes: [
      '不是 ChatGPT 网页登录密码，是 Platform 控制台生成的 Key',
      '账户需有可用 API 余额或订阅额度',
    ],
    status: 'text-pilot',
    statusLabel: '当前文本试点支持',
  },
  {
    id: 'kimi',
    name: 'Kimi / Moonshot',
    purpose: '中文长文本、文档、剧本、创意内容',
    steps: [
      '前往 Kimi / Moonshot AI 开放平台并登录',
      '找到「API Key / API 密钥」管理页面',
      '创建并完整复制 API Key',
      '在 Creator City → 我的 API → 添加账户',
      'Provider 选「Kimi K2.6」，粘贴 Key，保存',
    ],
    notes: [
      '不要填写网页登录密码',
      '限流或额度不足时，前往 Kimi 控制台检查余额',
    ],
    status: 'text-pilot',
    statusLabel: '当前文本试点支持',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    purpose: '多模态、长上下文、图片理解、文本生成',
    steps: [
      '前往 Google AI Studio 并登录账号',
      '在「API Keys」中创建 Gemini API Key',
      '复制 API Key',
      '当前 Creator City 暂无 Gemini 选项，后续接入后可在「我的 API」填写',
    ],
    notes: [
      'API Key 绝不能放到公开页面或截图分享',
      '需确认地区可用性和账单开通状态',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    purpose: '长文本、写作、分析、代码、剧本',
    steps: [
      '前往 Anthropic Console 并登录账号',
      '在「Account Settings / API Keys」中生成 API Key',
      '复制 API Key',
      '当前 Creator City 暂无 Claude 选项，后续接入后可在「我的 API」填写',
    ],
    notes: [
      '只使用官方 Anthropic 控制台的 Key，不要使用来源不明的中转 Key',
      '不要填写 Claude 网页登录密码',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'aliyun',
    name: '阿里 DashScope / 通义千问',
    purpose: '中国区文本、多模态、企业 API',
    steps: [
      '前往阿里云 DashScope / 通义千问控制台',
      '开通服务并创建 API Key',
      '复制 API Key',
      '当前 Creator City 暂无该 Provider 选项，后续接入后可在「我的 API」填写',
    ],
    notes: [
      '可能需要阿里云账号、实名认证、余额开通',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'volcengine',
    name: '火山引擎 / 豆包',
    purpose: '中国区文本、图片、视频、多模态',
    steps: [
      '前往火山引擎控制台，找到方舟/豆包相关 API Key 管理',
      '创建并复制密钥',
      '当前平台已通过平台侧支持火山图片/视频生成，BYOK 后续支持',
    ],
    notes: [
      '部分服务使用 Access Key + Secret Key，非单个 sk-key',
      '当前平台侧火山用于图片/视频，用户自有 BYOK 暂未开放',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
]

const MORE_PROVIDERS: ProviderInfo[] = [
  {
    id: 'tencent',
    name: '腾讯混元',
    purpose: '中国区文本、多模态、企业场景',
    steps: [
      '前往腾讯云控制台，开通混元大模型服务',
      '在访问管理中创建 SecretId / SecretKey',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: ['腾讯云通常是 SecretId+SecretKey 组合，非单个 sk-key，表单后续适配'],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'baidu',
    name: '百度千帆 / 文心',
    purpose: '中国区文本、多模态、企业模型',
    steps: [
      '前往百度智能云千帆控制台，创建应用',
      '获取 API Key / Secret Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: ['百度通常需要 API Key + Secret Key 组合，后续适配'],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM / Zhipu AI',
    purpose: '中文文本、Agent、代码、知识库',
    steps: [
      '前往智谱 AI 开放平台并登录',
      '在「API Keys / 密钥管理」中创建 Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'runway',
    name: 'Runway',
    purpose: '视频生成、图生视频、视频编辑',
    steps: [
      '前往 Runway 官方开发者/API 平台',
      '生成 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'kling',
    name: 'Kling / 可灵',
    purpose: '图生视频、文生视频',
    steps: [
      '前往可灵官方开放平台',
      '创建 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: ['部分功能可能需要企业认证，请以官方控制台为准'],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'minimax',
    name: 'MiniMax / 海螺',
    purpose: '视频、语音、文本、多模态',
    steps: [
      '前往 MiniMax 开放平台并登录',
      '创建 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    purpose: 'AI 配音、语音合成、声音克隆',
    steps: [
      '前往 ElevenLabs 账号设置 / API Keys',
      '创建 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: ['声音克隆涉及授权合规，只使用有权使用的声音'],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'stability',
    name: 'Stability AI',
    purpose: '图像生成、图像编辑',
    steps: [
      '前往 Stability AI 平台获取 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    purpose: '开源模型托管、图片/视频/音频多模型 API',
    steps: [
      '前往 Replicate Account / API tokens，创建 token',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: ['费用按模型和硬件消耗计算，非固定价格'],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'fal',
    name: 'Fal.ai',
    purpose: '图像、视频、实时生成、多媒体模型',
    steps: [
      '前往 fal.ai Dashboard / API keys，创建并复制 key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
  {
    id: 'openrouter',
    name: 'Together / Fireworks / Groq / OpenRouter',
    purpose: '多模型聚合、开源大模型、低延迟推理',
    steps: [
      '前往对应平台 Dashboard，创建 API Key',
      '后续 Creator City 接入后可在「我的 API」填写',
    ],
    notes: [
      'OpenRouter 是聚合平台，需在 OpenRouter 中配置模型和余额',
      'Groq 主打低延迟推理场景',
    ],
    status: 'future',
    statusLabel: '教程预留，后续支持',
  },
]

const DEBUG_ITEMS: QAItem[] = [
  {
    id: 'fail',
    q: '生成失败了怎么办？',
    a: '「Provider 额度不足」→ 在节点对话框切换至 DeepSeek 或其他可用 Provider。\n「数据库连接繁忙」→ 稍等几秒再重试，系统会自动降低保存频率。\n「网络错误」→ 刷新页面后重试。\n「认证失败」→ 如果你用了我的 API，检查 API Key 是否正确（不是登录密码）、是否有余额。',
  },
  {
    id: 'provider',
    q: '如何切换 Provider？',
    a: '点击节点卡片，打开编辑对话框，在顶部的 Provider 下拉框中选择 DeepSeek、Kimi、Volcengine 等可用 Provider。当前选择自动保存到该节点，不影响其他节点。',
  },
  {
    id: 'quota',
    q: '平台额度不足怎么办？',
    a: '可以前往账号设置充值平台额度，或者在「我的 API」连接自己的 Provider API Key（费用直接由你支付给 Provider，Creator City 不代扣）。',
    link: { href: '/account/providers', label: '→ 我的 API 账户' },
  },
  {
    id: 'reload',
    q: '刷新/重新打开画布后，节点状态变了？',
    a: '刷新后画布会保留节点，但正在生成中的节点会降级为"已停止"状态（errorCode: generation_stopped_on_reload），防止重复扣费。如果节点内容已生成，可以在资产库找回。',
    link: { href: '/assets', label: '→ 资产库' },
  },
]

// ── Style helpers ──────────────────────────────────────────────────────────────

const S = {
  tabBtn: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 4px',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #818cf8' : '2px solid transparent',
    color: active ? '#c7d2fe' : 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 0.3,
    transition: 'color 0.15s ease, border-color 0.15s ease',
  }),
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase' as const,
    padding: '8px 16px 4px',
  },
  pilotBadge: {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.4,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid rgba(110,231,183,0.30)',
    background: 'rgba(110,231,183,0.07)',
    color: '#6ee7b7',
    marginLeft: 6,
    verticalAlign: 'middle',
    flexShrink: 0,
  } as React.CSSProperties,
  futureBadge: {
    display: 'inline-block',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.4,
    padding: '1px 6px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 6,
    verticalAlign: 'middle',
    flexShrink: 0,
  } as React.CSSProperties,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function QAAccordion({ items }: { items: QAItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div style={{ padding: '4px 0' }}>
      {items.map(({ id, q, a, link }) => {
        const expanded = expandedId === id
        return (
          <div key={id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: expanded ? '#c7d2fe' : '#94a3b8', lineHeight: 1.45, flex: 1 }}>
                {q}
              </span>
              <span style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.25)',
                flexShrink: 0,
                marginTop: 1,
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease',
                display: 'inline-block',
              }}>›</span>
            </button>
            {expanded && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>
                  {a}
                </p>
                {link && (
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 600, textDecoration: 'none', letterSpacing: 0.2 }}
                  >
                    {link.label}
                  </a>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProviderAccordion({ providers }: { providers: ProviderInfo[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div>
      {providers.map((p) => {
        const expanded = expandedId === p.id
        return (
          <div key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : p.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 8,
                padding: '9px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: expanded ? '#c7d2fe' : '#94a3b8', lineHeight: 1.4 }}>
                    {p.name}
                  </span>
                  <span style={p.status === 'text-pilot' ? S.pilotBadge : S.futureBadge}>
                    {p.statusLabel}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', lineHeight: 1.4 }}>{p.purpose}</span>
              </div>
              <span style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.25)',
                flexShrink: 0,
                marginTop: 2,
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s ease',
                display: 'inline-block',
              }}>›</span>
            </button>
            {expanded && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {p.steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', lineHeight: 1.65 }}>{step}</li>
                  ))}
                </ol>
                {p.notes && p.notes.length > 0 && (
                  <div style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {p.notes.map((note, i) => (
                      <p key={i} style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>
                        注意：{note}
                      </p>
                    ))}
                  </div>
                )}
                {p.status === 'future' && (
                  <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.22)', lineHeight: 1.5 }}>
                    ⚠ 教程预留，当前 Creator City 暂未开放该 Provider 的「我的 API」生成。能写进教程 ≠ 当前已接入。
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BeginnerGuidePanel() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('guide')
  const [showMoreProviders, setShowMoreProviders] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-no-node-drag="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          background: open ? 'rgba(99,102,241,0.22)' : 'rgba(8,10,20,0.84)',
          border: `1px solid ${open ? 'rgba(99,102,241,0.50)' : 'rgba(255,255,255,0.10)'}`,
          borderRadius: 999,
          color: open ? '#c7d2fe' : 'rgba(255,255,255,0.52)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.42)',
          letterSpacing: 0.3,
          transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
          userSelect: 'none',
        }}
        title={open ? '关闭帮助' : 'Creator City 帮助'}
        aria-label={open ? '关闭帮助' : 'Creator City 帮助'}
        aria-expanded={open}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>✦</span>
        <span>帮助</span>
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Creator City 帮助助手"
          data-no-node-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 60,
            right: 20,
            zIndex: 200,
            width: 380,
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            background: 'rgba(8,10,20,0.96)',
            border: '1px solid rgba(99,102,241,0.28)',
            borderRadius: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.64)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: -0.2 }}>
                Creator City 帮助助手
              </span>
              <br />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
                静态文档 · 无 AI 调用 · 点击展开
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.32)', fontSize: 20, cursor: 'pointer', padding: '2px 6px', borderRadius: 6, lineHeight: 1, flexShrink: 0 }}
              aria-label="关闭帮助"
            >×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {(['guide', 'apikey', 'providers', 'debug'] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = { guide: '新手', apikey: 'API Key', providers: 'Provider', debug: '排查' }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={S.tabBtn(activeTab === tab)}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>

          {/* Tab: 新手 */}
          {activeTab === 'guide' && (
            <QAAccordion items={GUIDE_ITEMS} />
          )}

          {/* Tab: API Key */}
          {activeTab === 'apikey' && (
            <div>
              {/* Top notice */}
              <div style={{ margin: '10px 14px 0', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(129,140,248,0.20)', background: 'rgba(129,140,248,0.06)' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(199,210,254,0.80)', lineHeight: 1.65 }}>
                  <strong>普通用户不需要 API Key，</strong>使用平台额度即可创作。我的 API 账户是给专业用户和团队的可选能力。
                </p>
              </div>
              <QAAccordion items={APIKEY_ITEMS} />
            </div>
          )}

          {/* Tab: Provider 指南 */}
          {activeTab === 'providers' && (
            <div>
              {/* Disclaimer */}
              <div style={{ margin: '10px 14px 6px', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,200,100,0.15)', background: 'rgba(255,200,100,0.05)' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,200,100,0.75)', lineHeight: 1.65 }}>
                  能写进教程 ≠ 当前已接入生成。当前只有 DeepSeek / OpenAI / Kimi 支持文本试点，其余均为教程预留。
                </p>
              </div>

              {/* Main providers */}
              <div style={S.sectionLabel}>常用 Provider</div>
              <ProviderAccordion providers={MAIN_PROVIDERS} />

              {/* More providers toggle */}
              <button
                type="button"
                onClick={() => setShowMoreProviders((v) => !v)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.28)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                <span>更多创作 Provider（{MORE_PROVIDERS.length} 个，教程预留）</span>
                <span style={{ transform: showMoreProviders ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', display: 'inline-block', fontSize: 14 }}>›</span>
              </button>
              {showMoreProviders && (
                <ProviderAccordion providers={MORE_PROVIDERS} />
              )}

              {/* Security notice */}
              <div style={{ margin: '8px 14px 12px', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.28)', lineHeight: 1.7 }}>
                  安全提醒：不要把 API Key 发给他人、截图公开或填入网页登录密码。Creator City 只加密保存你的 Key，默认只显示末 4 位。Provider API 费用由你直接支付给服务商，Creator City 不代扣，只收取平台服务费（工作台/协作/交易）。
                </p>
              </div>
            </div>
          )}

          {/* Tab: 排查 */}
          {activeTab === 'debug' && (
            <QAAccordion items={DEBUG_ITEMS} />
          )}

          {/* Footer */}
          <div style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <a
              href="/account/providers"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#a78bfa', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 8, fontWeight: 600 }}
            >
              我的 API
            </a>
            <a
              href="/assets"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#6ee7b7', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(110,231,183,0.22)', borderRadius: 8, fontWeight: 600 }}
            >
              资产库
            </a>
            <a
              href="/providers"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontWeight: 600 }}
            >
              Provider 状态
            </a>
          </div>
        </div>
      )}
    </>
  )
}
