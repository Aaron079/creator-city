// /terms-preview — Static terms and copyright preview data
// Pure TypeScript data. No API calls, no DB, no generation triggers.
// This file does NOT constitute formal legal advice or binding agreements.

export interface RuleCategory {
  id: string
  letter: string
  name: string
  tagline: string
  items: string[]
}

export interface ResponsibilityItem {
  title: string
  detail: string
}

export interface PlatformBoundaryItem {
  title: string
  detail: string
}

export interface MarketplaceStep {
  step: number
  label: string
  detail: string
}

export interface ProhibitedAction {
  item: string
  severity: 'high' | 'medium'
}

export interface RiskWarning {
  icon: string
  title: string
  body: string
}

export interface FutureLegalDoc {
  name: string
  description: string
  status: '待补齐' | '规划中' | '优先级高'
}

export interface QuickLink {
  label: string
  href: string
  description: string
}

// ── Rule overview categories ──────────────────────────────────────────────────

export const ruleOverview: RuleCategory[] = [
  {
    id: 'material-copyright',
    letter: 'A',
    name: '素材版权',
    tagline: '上传与使用第三方素材的基本规则',
    items: [
      '用户上传素材应拥有合法版权或已获得授权',
      '不应上传盗版、侵权或未授权的影视素材',
      '涉及他人肖像、品牌 Logo 或音乐的素材须有明确授权',
      '商业交付项目需确认所用素材具备商用授权',
      '素材来源和授权文件建议自行留存备查',
    ],
  },
  {
    id: 'ai-generated-content',
    letter: 'B',
    name: 'AI 生成内容',
    tagline: '生成结果的版权归属与商用限制',
    items: [
      '用户需遵守所选 AI model provider 的服务条款',
      '生成结果是否可商用需以对应 provider 条款为准，平台不代为承诺',
      '平台提供生成工具链，不自动保证所有生成内容均可商用',
      '涉及真实人物、品牌或受保护作品的生成内容须额外审慎',
      '商业投放前建议做独立的版权合规审查',
    ],
  },
  {
    id: 'api-key-security',
    letter: 'C',
    name: 'API 与密钥安全',
    tagline: '保护自己的 API 密钥与账户安全',
    items: [
      '不得泄露 API key / token / secret 给任何第三方',
      '不得在社区帖子、项目描述、截图或公开分享中暴露密钥',
      '不得恶意刷取 API token 消耗第三方服务配额',
      '第三方 API 费用由用户自行承担，平台不承担由此产生的超额费用',
      '密钥泄露应立即在对应 provider 控制台吊销并重新生成',
    ],
  },
  {
    id: 'community-content',
    letter: 'D',
    name: '社区内容',
    tagline: '创作者社区的内容发布规范',
    items: [
      '不发布侵权、违法、欺诈或具有恶意倾向的内容',
      '不冒充他人（创作者、项目方或平台官方）',
      '不在公开社区中泄露项目私密素材或合同细节',
      '不传播可能误导用户的虚假交易或评价',
      '内容一经发布须遵守所在地区的适用法律法规',
    ],
  },
  {
    id: 'marketplace-rules',
    letter: 'E',
    name: '创作者市场',
    tagline: '委托交易的基本规则预览',
    items: [
      '项目方与创作者需在订单开始前明确交付范围、价格和修改次数',
      '需明确最终版权归属（买断 / 授权 / 共有）',
      '平台未来将提供托管、验收和争议处理机制',
      '当前为预览，不接支付、不创建订单、不写数据库',
      '恶意不付款、虚假验收或故意拖延均属平台禁止行为',
    ],
  },
  {
    id: 'enterprise-deployment',
    letter: 'F',
    name: '企业 / 本地部署',
    tagline: '私有化部署客户的额外责任边界',
    items: [
      '企业客户需自行管理本地素材和生成内容的合规性',
      '私有化部署涉及成员权限和数据访问权限应按企业安全要求配置',
      '平台不主动获取企业私有化环境中的数据',
      '企业客户后续需额外签署企业服务协议',
      '本地部署如涉及个人数据处理，需满足当地隐私法规要求',
    ],
  },
]

// ── User responsibilities ─────────────────────────────────────────────────────

export const userResponsibilities: ResponsibilityItem[] = [
  {
    title: '保证素材来源合法',
    detail: '上传至平台的所有图片、视频、音频和文本素材，用户须自行确认已拥有合法权利或获得充分授权。',
  },
  {
    title: '保证 prompt 不侵权',
    detail: '输入至 AI 生成系统的 prompt 不得包含明显侵犯他人著作权、肖像权或商标权的指令。',
  },
  {
    title: '遵守第三方模型条款',
    detail: '使用平台接入的各 AI provider（图片 / 视频生成模型）须遵守对应 provider 的用户服务协议。',
  },
  {
    title: '对商业使用自行审核',
    detail: '将 AI 生成内容用于商业场景前，用户须自行完成版权合规审查，不得依赖平台的默示授权。',
  },
  {
    title: '不滥用平台能力',
    detail: '不得利用平台进行违法、欺诈、侵权或其他有损他人权益的活动。',
  },
]

// ── Platform boundaries ───────────────────────────────────────────────────────

export const platformBoundaries: PlatformBoundaryItem[] = [
  {
    title: '平台提供工具，不提供法律保证',
    detail: 'Creator City 提供项目管理、工作流和 AI 生成工具，不对用户的具体使用行为承担版权连带责任。',
  },
  {
    title: '平台不主动审核每个 prompt',
    detail: '平台不对每一个用户输入进行实时版权审查，用户对其 prompt 和生成结果的合规性负责。',
  },
  {
    title: '平台不代第三方 provider 承诺版权',
    detail: '接入的 AI model provider（如图像 / 视频生成服务）的版权政策由 provider 自行制定，平台不能超越其规定作出承诺。',
  },
  {
    title: '平台可处理举报违规内容',
    detail: '平台保留根据有效举报或风险评估，对违规内容进行屏蔽、删除或账户处理的权利。',
  },
  {
    title: '正式版需补充完整协议',
    detail: '正式商业上线前，平台将补充服务协议、隐私政策、版权投诉流程和数据处理协议等完整法律文本。',
  },
]

// ── Marketplace flow ──────────────────────────────────────────────────────────

export const marketplaceFlow: MarketplaceStep[] = [
  { step: 1, label: '项目方发布需求', detail: '描述项目类型、预算区间、交付时间和版权要求' },
  { step: 2, label: '创作者报价', detail: '提交价格、交付说明、修改次数上限和作品案例' },
  { step: 3, label: '双方确认交付范围', detail: '明确内容范围、分辨率、格式、版权归属和付款方式' },
  { step: 4, label: '创作者生成并交付', detail: '在平台内完成生产，上传交付物供项目方查看' },
  { step: 5, label: '项目方验收', detail: '在约定时间内完成验收，确认交付满足需求' },
  { step: 6, label: '平台介入（未来）', detail: '正式上线后，平台可提供资金托管、验收仲裁和争议处理' },
]

// ── Prohibited actions ────────────────────────────────────────────────────────

export const prohibitedActions: ProhibitedAction[] = [
  { item: '上传盗版影视剧、综艺或受版权保护的商业素材', severity: 'high' },
  { item: '上传未经授权的他人肖像、品牌 Logo 或音乐作品', severity: 'high' },
  { item: '泄露 API key / token / secret 至社区或公开渠道', severity: 'high' },
  { item: '恶意刷取 API token 消耗第三方服务配额', severity: 'high' },
  { item: '使用平台生成违法内容（含诈骗、违禁物、违规影像）', severity: 'high' },
  { item: '冒充官方账号、他人身份或虚假品牌进行交易', severity: 'high' },
  { item: '发布虚假交易、拒绝交付或恶意套取预付款', severity: 'medium' },
  { item: '绕过平台私下转账后拒不履行交付义务', severity: 'medium' },
  { item: '在社区中泄露他人项目的私密素材或合同内容', severity: 'medium' },
  { item: '传播虚假评价或组织刷评行为', severity: 'medium' },
]

// ── Risk warnings ─────────────────────────────────────────────────────────────

export const riskWarnings: RiskWarning[] = [
  {
    icon: '⚖️',
    title: 'AI 生成内容版权不确定性',
    body: '各国对 AI 生成内容的版权归属仍存在法律争议，用于商业场景前须咨询专业法律意见。',
  },
  {
    icon: '📄',
    title: 'Provider 条款可能变化',
    body: '第三方 AI model provider 的服务条款可能随时更新，建议定期查阅所用 provider 的最新用户协议。',
  },
  {
    icon: '🔍',
    title: '商业投放前做版权审核',
    body: '将生成内容用于广告、发行或对外销售前，应委托专业人士完成版权合规审查。',
  },
  {
    icon: '🗂',
    title: '保存授权文件和交易记录',
    body: '素材的授权协议、创作者交易记录和 prompt 备份应自行留存，以备日后版权核查。',
  },
  {
    icon: '🏢',
    title: '企业部署需额外合规审查',
    body: '私有化部署如涉及个人数据处理、跨境数据传输或特定行业（金融 / 医疗 / 政务），须满足对应监管合规要求。',
  },
]

// ── Future legal documents ────────────────────────────────────────────────────

export const futureLegalDocs: FutureLegalDoc[] = [
  { name: '用户服务协议', description: '覆盖账户注册、平台使用权利和终止条款', status: '优先级高' },
  { name: '隐私政策', description: '说明平台收集、处理和存储用户数据的方式', status: '优先级高' },
  { name: '创作者市场交易规则', description: '委托、报价、交付、验收、争议处理的完整规则', status: '规划中' },
  { name: '版权投诉与 DMCA 类流程', description: '第三方版权投诉的受理、核查和处理流程', status: '规划中' },
  { name: 'API 使用条款', description: '平台 API（如 Open API）的使用限制和责任边界', status: '待补齐' },
  { name: '企业服务协议', description: '面向企业客户的 SLA、数据责任和定制条款', status: '待补齐' },
  { name: '本地部署协议', description: '私有化部署的许可范围、数据隔离和支持边界', status: '待补齐' },
  { name: '数据处理协议（DPA）', description: '符合 GDPR / 国内个人信息保护法的数据处理协议', status: '待补齐' },
]

// ── Quick links ───────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard', description: '进入项目工作台' },
  { label: '路线图', href: '/roadmap', description: '查看产品路线图' },
  { label: '商业模式预览', href: '/pricing-preview', description: '查看定价与商业模式' },
  { label: '社区', href: '/community', description: '探索创作者社区' },
  { label: '诊断帮助', href: '/help', description: '获取使用帮助' },
]
