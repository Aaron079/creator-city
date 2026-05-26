// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.

export const MARKETPLACE_HERO = {
  title: '创作者市场',
  eyebrow: 'Creator Marketplace',
  description:
    '从展示、需求、报价、交付到托管结算，\nCreator City 将创作服务变成可协作、可追踪、可交易的流程。',
  statusChips: [
    { label: '规划中', color: '#a78bfa' },
    { label: '尚未上线', color: '#f59e0b' },
    { label: '仅供预览', color: '#6b7280' },
  ],
}

export type MarketChainItem = {
  index: number
  label: string
  href: string
  desc: string
  accent: string
}

export const MARKET_CHAIN: MarketChainItem[] = [
  {
    index: 1,
    label: '市场总览',
    href: '/marketplace-preview',
    desc: '查看 Creator City 市场体系与交易闭环',
    accent: '#7c3aed',
  },
  {
    index: 2,
    label: '创作者主页',
    href: '/creator-profile-preview',
    desc: '创作者展示作品集、技能标签、服务套餐与信用保障',
    accent: '#2563eb',
  },
  {
    index: 3,
    label: '需求广场',
    href: '/demand-board-preview',
    desc: '项目方发布结构化需求，创作者理解预算、周期与风格',
    accent: '#16a34a',
  },
  {
    index: 4,
    label: '报价方案',
    href: '/proposal-flow-preview',
    desc: '创作者提交方案、报价、修改轮次与交付边界',
    accent: '#d97706',
  },
  {
    index: 5,
    label: '阶段交付',
    href: '/milestone-delivery-preview',
    desc: '按节点交付成果，降低项目方与创作者协作风险',
    accent: '#0891b2',
  },
  {
    index: 6,
    label: '托管结算',
    href: '/escrow-preview',
    desc: '用托管与结算机制保护双方权益',
    accent: '#dc2626',
  },
]

export type RolePerspective = {
  role: string
  icon: string
  headline: string
  points: string[]
  href: string
  cta: string
  accent: string
}

export const ROLE_PERSPECTIVES: RolePerspective[] = [
  {
    role: '项目方',
    icon: '🏢',
    headline: '更快找到合适创作者，明确预算与交付边界',
    points: [
      '发布结构化需求 Brief，创作者一目了然',
      '对比创作者方案与报价，自主选择',
      '按阶段验收，不一次性付款',
      '托管保障资金安全，不担心跑路',
    ],
    href: '/demand-board-preview',
    cta: '查看需求广场',
    accent: '#16a34a',
  },
  {
    role: '创作者',
    icon: '🎬',
    headline: '清楚展示能力，按阶段收款，建立信誉',
    points: [
      '作品集直接展示 Creator City 生成记录',
      '提交含边界的方案，避免无限改稿',
      '按里程碑交付成果，按阶段收款',
      '积累信誉评分，获得更多接单机会',
    ],
    href: '/creator-profile-preview',
    cta: '查看创作者主页',
    accent: '#7c3aed',
  },
]

export type TrustPillar = {
  icon: string
  title: string
  desc: string
}

export const TRUST_PILLARS: TrustPillar[] = [
  {
    icon: '📋',
    title: '结构化需求',
    desc: '需求方填写统一格式 Brief，创作者一目了然预算、交付格式与风格要求，减少沟通成本。',
  },
  {
    icon: '📄',
    title: '报价边界',
    desc: '创作者提交含修改次数、交付边界与时间节点的方案，避免无边界改稿与范围蔓延。',
  },
  {
    icon: '📦',
    title: '阶段验收',
    desc: '按里程碑提交成果，需求方逐节点验收，不一次性放款，降低双方协作风险。',
  },
  {
    icon: '🔐',
    title: '托管结算',
    desc: '资金托管在平台，验收通过后释放，创作者与需求方权益均有机制保障，无跑路风险。',
  },
]
