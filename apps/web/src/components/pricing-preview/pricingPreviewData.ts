// /pricing-preview — Static pricing preview data
// Pure TypeScript data. No API calls, no DB, no generation triggers.
// Prices are marked as preview — they do NOT represent final pricing.

export type RevenueStatus = '核心原则' | '规划中' | '长期规划' | '未来规划'
export type PlanTier = 'free' | 'pro' | 'studio' | 'enterprise'

export interface RevenueModel {
  id: string
  letter: string
  name: string
  tagline: string
  description: string
  highlights: string[]
  status: RevenueStatus
}

export interface PricingPlan {
  tier: PlanTier
  name: string
  subtitle: string
  price: string
  priceNote: string
  audience: string
  features: string[]
  cta: string
  highlighted: boolean
}

export interface CommissionStep {
  step: number
  label: string
  detail: string
}

export interface ApiCostPrinciple {
  icon: string
  title: string
  body: string
}

export interface InvestorHighlight {
  dimension: string
  mechanic: string
}

export interface RiskBoundary {
  item: string
}

export interface QuickLink {
  label: string
  href: string
  description: string
}

// ── Revenue models ────────────────────────────────────────────────────────────

export const revenueModels: RevenueModel[] = [
  {
    id: 'subscription',
    letter: 'A',
    name: '平台订阅',
    tagline: '面向创作者与团队',
    description: '为个人创作者和团队提供项目管理、资产管理、任务中心、协作和生成工作台能力，按月或按年订阅。',
    highlights: [
      '项目管理与资产库',
      '任务中心与状态追踪',
      '高级协作与团队权限',
      'API 中心统一接入',
    ],
    status: '规划中',
  },
  {
    id: 'commission',
    letter: 'B',
    name: '创作者市场抽佣',
    tagline: '项目方 × 创作者双边撮合',
    description: '项目方在平台发布需求，创作者报价接单，平台提供托管、验收与争议处理，未来对每笔成交收取 30% 服务费。',
    highlights: [
      '项目委托与交付管理',
      '双方确认 + 平台托管',
      '争议处理机制',
      '未来抽佣 30%（预览）',
    ],
    status: '规划中',
  },
  {
    id: 'enterprise',
    letter: 'C',
    name: '企业 / 本地部署',
    tagline: '影视、广告、MCN、短剧团队',
    description: '为影视公司、广告公司、MCN 机构和短剧团队提供私有化部署、本地数据管理和团队权限定制。',
    highlights: [
      '私有化部署选项',
      '本地数据管理',
      '自定义团队权限',
      '专属集成支持',
    ],
    status: '长期规划',
  },
  {
    id: 'ads',
    letter: 'D',
    name: '广告与推荐位',
    tagline: '社区、市场、工具页商业曝光',
    description: '在社区、创作者市场和工具页中提供品牌、工具和服务商的商业推广位，覆盖精准的内容创作者群体。',
    highlights: [
      '社区信息流推荐位',
      '市场搜索结果置顶',
      '工具页 Banner 曝光',
      '精准创作者圈层覆盖',
    ],
    status: '未来规划',
  },
  {
    id: 'api-passthrough',
    letter: 'E',
    name: 'API 自付费模式',
    tagline: '用户直接承担第三方 API 成本',
    description: '平台不代收 AI provider（图片 / 视频生成 API）费用，用户自行绑定 API Key 或按用量支付。平台赚平台服务费与增值服务收入，降低平台现金流压力。',
    highlights: [
      'API 成本由用户直接承担',
      '平台不抽取 provider 费用',
      '平台赚服务费与增值收入',
      '降低平台资金风险',
    ],
    status: '核心原则',
  },
]

// ── Pricing plans ─────────────────────────────────────────────────────────────

export const pricingPlans: PricingPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    subtitle: '探索版',
    price: '¥0',
    priceNote: '永久免费，功能受限',
    audience: '适合体验平台与社区',
    features: [
      '基础项目空间（1–3 个）',
      '少量资产存储',
      '基础任务查看',
      '社区只读访问',
      '有限生成次数',
    ],
    cta: '即将开放',
    highlighted: false,
  },
  {
    tier: 'pro',
    name: 'Pro',
    subtitle: '创作者版',
    price: '¥99–199',
    priceNote: '/ 月，预览价格，不代表最终定价',
    audience: '适合个人创作者和小团队',
    features: [
      '更多项目空间',
      '资产管理与版本追踪',
      '任务中心全功能',
      'API 中心统一接入',
      '创作者市场入口',
      '优先生成队列',
    ],
    cta: '即将开放',
    highlighted: true,
  },
  {
    tier: 'studio',
    name: 'Studio',
    subtitle: '工作室版',
    price: '¥499–999',
    priceNote: '/ 月，预览价格，不代表最终定价',
    audience: '适合广告、短剧、影视工作室',
    features: [
      '团队协作与权限管理',
      '多项目空间',
      '商业交付管理',
      '高级资产库',
      '团队任务中心',
      '专属支持通道',
    ],
    cta: '即将开放',
    highlighted: false,
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    subtitle: '企业版',
    price: '联系我们',
    priceNote: '按需定价，私有化部署',
    audience: '影视公司、广告集团、MCN、短剧平台',
    features: [
      '私有化 / 本地部署',
      '企业级权限体系',
      '定制工作流集成',
      'SLA 保障',
      '专属实施支持',
      '数据隔离与合规',
    ],
    cta: '联系合作',
    highlighted: false,
  },
]

// ── Commission flow ───────────────────────────────────────────────────────────

export const commissionFlow: CommissionStep[] = [
  { step: 1, label: '项目方发布需求', detail: '描述项目类型、预算、交付时间和期望风格' },
  { step: 2, label: '创作者报价', detail: '创作者查看需求，提交报价和作品案例' },
  { step: 3, label: '双方确认订单', detail: '项目方选择创作者，平台托管资金，订单成立' },
  { step: 4, label: '创作者生成并交付', detail: '创作者在平台完成生产，提交交付物' },
  { step: 5, label: '平台验收与争议处理', detail: '项目方确认验收；如有争议，平台介入处理' },
  { step: 6, label: '平台抽佣 30%（预览）', detail: '交付确认后，平台收取服务费，创作者获得余额' },
]

// ── API cost principles ───────────────────────────────────────────────────────

export const apiCostPrinciples: ApiCostPrinciple[] = [
  {
    icon: '⚡',
    title: 'API 成本用户直承',
    body: '图片 / 视频生成等 AI provider 费用由用户直接承担，通过用户自有 API Key 或按量充值。平台不居中赚取 provider 差价。',
  },
  {
    icon: '🏗',
    title: '平台赚服务与工具价值',
    body: '平台收入来自订阅、抽佣、广告和增值服务——而非从 AI API 上加价。这是一个工具平台，不是 API 中间商。',
  },
  {
    icon: '📉',
    title: '降低平台资金风险',
    body: '平台不垫付 AI 生成费用，大幅降低资金压力。生成成本高峰（如视频生成爆发）不会直接冲击平台现金流。',
  },
  {
    icon: '🔎',
    title: '用户对成本完全透明',
    body: '用户清楚知道每次生成的成本来源，可以自选 provider、自控成本，避免意外账单。',
  },
]

// ── Investor highlights ───────────────────────────────────────────────────────

export const investorHighlights: InvestorHighlight[] = [
  { dimension: '工具使用频率', mechanic: '高频生成任务带来日活留存，用户每天都要用平台生产内容' },
  { dimension: '项目资产沉淀', mechanic: '用户的图片、视频、项目结构存在平台，迁移成本极高' },
  { dimension: '社区关系网络', mechanic: '创作者 × 项目方社区关系形成网络效应，新用户需要在平台找到合作者' },
  { dimension: '市场交易闭环', mechanic: '委托→生产→交付→评价的闭环让平台成为可信任的商业中介' },
  { dimension: '企业高客单价', mechanic: '私有化部署和定制集成服务提供高利润的 B 端收入支柱' },
  { dimension: '专业工作流差异化', mechanic: '对标国际专业影视生产工具，远超通用 AI 生图工具的专业深度' },
]

// ── Risks and boundaries ──────────────────────────────────────────────────────

export const risksAndBoundaries: RiskBoundary[] = [
  { item: '本页为静态商业模式预览，不代表真实收费标准' },
  { item: '价格均为占位预览，最终定价以正式上线公告为准' },
  { item: '本页不接支付，不创建订单，不保存任何用户数据' },
  { item: '抽佣比例（30%）为预览，正式上线前将基于市场调研确定' },
  { item: '后续商业化须单独设计权限、订单、支付、发票、合规与风控体系' },
  { item: '企业部署方案需定制设计，联系合作前不作承诺' },
  { item: '本页不修改任何导航、API 或生成链路' },
]

// ── Quick links ───────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard', description: '进入项目工作台' },
  { label: '路线图', href: '/roadmap', description: '查看产品路线图' },
  { label: '社区', href: '/community', description: '探索创作者社区' },
  { label: '诊断帮助', href: '/help', description: '获取使用帮助' },
  { label: '工作空间', href: '/projects', description: '管理我的项目' },
]
