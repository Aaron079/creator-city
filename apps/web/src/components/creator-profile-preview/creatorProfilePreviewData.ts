// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.

export const PROFILE_HERO = {
  name: 'Nova 导演室',
  handle: '@novafilm',
  avatarInitials: 'N',
  avatarColor: '#7c3aed',
  tagline: 'AI 影视导演 · 品牌视频 · 概念艺术',
  bio: '专注 AI 原生内容创作，擅长品牌故事片与科幻概念视觉。使用 Creator City 工作台，从剧本到交付全链路 AI 生产。累计交付 120+ 项目，客户满意度 98%。',
  level: 'Elite',
  levelColor: '#a78bfa',
  joinedAt: '2025 年 10 月',
  location: '上海',
  statusChips: [
    { label: '接单中', color: '#22c55e' },
    { label: 'Elite 认证', color: '#a78bfa' },
    { label: '示例数据', color: '#6b7280' },
  ],
}

export type StatItem = {
  label: string
  value: string
  sub?: string
}

export const PROFILE_STATS: StatItem[] = [
  { label: '响应速度', value: '< 2h' },
  { label: '按时交付率', value: '99.2%' },
  { label: '平均评分', value: '4.97', sub: '/ 5.0' },
  { label: '复购率', value: '68%' },
  { label: '累计接单', value: '127', sub: '项目' },
]

export type SkillTag = {
  label: string
  category: 'creation' | 'tool' | 'style'
}

export const SKILL_TAGS: SkillTag[] = [
  { label: 'AI 视频生成', category: 'creation' },
  { label: '品牌剧情片', category: 'creation' },
  { label: '概念艺术', category: 'creation' },
  { label: '分镜脚本', category: 'creation' },
  { label: '后期剪辑', category: 'creation' },
  { label: 'Creator City', category: 'tool' },
  { label: 'Kling', category: 'tool' },
  { label: 'Sora', category: 'tool' },
  { label: 'Runway', category: 'tool' },
  { label: 'Midjourney', category: 'tool' },
  { label: '科幻风格', category: 'style' },
  { label: '赛博朋克', category: 'style' },
  { label: '极简主义', category: 'style' },
  { label: '新中式', category: 'style' },
]

export type PortfolioItem = {
  id: string
  title: string
  category: string
  duration: string
  description: string
  tags: string[]
  deliveredAt: string
  clientIndustry: string
  bgGradient: string
}

export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: 'p1',
    title: '新能源汽车品牌宣传片',
    category: '品牌宣传',
    duration: '60s',
    description: '面向 Z 世代，赛博朋克视觉风格，全程 AI 生成，含英文字幕版本。4K 交付。',
    tags: ['赛博朋克', '汽车', 'AI生成', '4K'],
    deliveredAt: '2025-12',
    clientIndustry: '新能源',
    bgGradient: 'linear-gradient(135deg, #0d1a2e 0%, #1a1030 100%)',
  },
  {
    id: 'p2',
    title: '护肤品概念短片系列',
    category: '产品展示',
    duration: '30s × 3',
    description: '东方美学视觉语言，Kling + Creator City 双引擎生成，小红书竖版。',
    tags: ['东方美学', '护肤', '竖版', '小红书'],
    deliveredAt: '2025-11',
    clientIndustry: '美妆',
    bgGradient: 'linear-gradient(135deg, #0a1a10 0%, #1a2005 100%)',
  },
  {
    id: 'p3',
    title: '独立游戏上线预告片',
    category: '游戏宣传',
    duration: '90s',
    description: '像素朋克风格，手绘分镜 + AI 渲染结合，Steam 规格交付，含特效合成。',
    tags: ['像素朋克', '游戏', 'Steam', '特效'],
    deliveredAt: '2025-10',
    clientIndustry: '游戏',
    bgGradient: 'linear-gradient(135deg, #1a1005 0%, #2a1a05 100%)',
  },
  {
    id: 'p4',
    title: '教育 SaaS 产品功能演示',
    category: '产品演示',
    duration: '2min',
    description: '极简风格，配专业普通话配音与中英双语字幕，面向 B 端采购决策者。',
    tags: ['极简', 'SaaS', 'B端', '双语字幕'],
    deliveredAt: '2025-09',
    clientIndustry: '教育科技',
    bgGradient: 'linear-gradient(135deg, #10101f 0%, #0a0a2a 100%)',
  },
  {
    id: 'p5',
    title: '音乐 MV · 科幻主题',
    category: '音乐MV',
    duration: '3min 20s',
    description: '独立音乐人合作，赛博朋克城市镜头，全 AI 生成，帧率稳定性优化。',
    tags: ['MV', '科幻', '赛博朋克', '独立音乐'],
    deliveredAt: '2025-08',
    clientIndustry: '音乐',
    bgGradient: 'linear-gradient(135deg, #1a0a1f 0%, #2a0a20 100%)',
  },
  {
    id: 'p6',
    title: '房地产品牌故事片',
    category: '品牌故事',
    duration: '45s',
    description: '新中式美学，航拍 + AI 渲染结合，面向高净值客群，精品楼盘上市发布。',
    tags: ['新中式', '房产', '航拍', '高端'],
    deliveredAt: '2025-07',
    clientIndustry: '房地产',
    bgGradient: 'linear-gradient(135deg, #0a1a20 0%, #0a2030 100%)',
  },
]

export type ServiceOffering = {
  id: string
  title: string
  description: string
  priceRmb: number
  deliveryDays: number
  includes: string[]
  popular?: boolean
}

export const SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'svc1',
    title: '基础视觉方案',
    description: '30 秒以内，单一风格，2 次修改，1080p 交付。',
    priceRmb: 1200,
    deliveryDays: 3,
    includes: ['剧本大纲', 'AI 视频生成', '基础剪辑', '2次修改', '1080p MP4'],
  },
  {
    id: 'svc2',
    title: '标准短片方案',
    description: '60 秒以内，含配音与字幕，3 次修改，4K 交付。',
    priceRmb: 2800,
    deliveryDays: 5,
    includes: ['完整剧本', 'AI 视频生成', '配音', '字幕', '4K 交付', '3次修改'],
    popular: true,
  },
  {
    id: 'svc3',
    title: '旗舰项目方案',
    description: '90 秒以上，全定制风格圣经，无限修改，多格式交付。',
    priceRmb: 6800,
    deliveryDays: 10,
    includes: ['视觉圣经', '完整剧本', '多镜头生成', '配音+音效', '4K+ProRes', '无限修改', '版权证明'],
  },
]

export type TrustChainItem = {
  icon: string
  title: string
  desc: string
  href: string
  linkLabel: string
}

export const TRUST_CHAIN: TrustChainItem[] = [
  {
    icon: '📋',
    title: '结构化需求',
    desc: '项目方填写统一格式 Brief，创作者清楚预算、交付格式与风格要求，减少沟通成本。',
    href: '/demand-board-preview',
    linkLabel: '查看需求广场',
  },
  {
    icon: '📄',
    title: '报价边界',
    desc: '创作者提交含修改次数、交付边界与时间节点的方案，避免无边界改稿与范围蔓延。',
    href: '/proposal-flow-preview',
    linkLabel: '查看报价流程',
  },
  {
    icon: '📦',
    title: '阶段验收',
    desc: '按里程碑交付成果，项目方逐节点验收，不一次性放款，降低双方协作风险。',
    href: '/milestone-delivery-preview',
    linkLabel: '查看阶段交付',
  },
  {
    icon: '🔐',
    title: '托管结算',
    desc: '资金托管在平台，验收通过后释放，创作者与项目方权益均有机制保障。',
    href: '/escrow-preview',
    linkLabel: '查看托管结算',
  },
]

export type MarketChainLink = {
  index: number
  label: string
  href: string
  current?: boolean
}

export const MARKET_CHAIN_LINKS: MarketChainLink[] = [
  { index: 1, label: '市场总览', href: '/marketplace-preview' },
  { index: 2, label: '创作者主页', href: '/creator-profile-preview', current: true },
  { index: 3, label: '需求广场', href: '/demand-board-preview' },
  { index: 4, label: '报价方案', href: '/proposal-flow-preview' },
  { index: 5, label: '阶段交付', href: '/milestone-delivery-preview' },
  { index: 6, label: '托管结算', href: '/escrow-preview' },
]
