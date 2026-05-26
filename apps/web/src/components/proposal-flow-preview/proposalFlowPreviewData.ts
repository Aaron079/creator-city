// No POST, no PUT, no DELETE. Static data only. Not connected to generation.

export const HERO = {
  title: '报价方案',
  tagline: '把创作思路、费用构成、修改轮次、授权范围和交付边界写清楚，让项目方能比较方案，让创作者避免无限返工。',
  statusChips: [
    { label: 'RMB 报价', color: '#d97706' },
    { label: '方案结构', color: '#2563eb' },
    { label: '修改轮次', color: '#7c3aed' },
    { label: '授权范围', color: '#16a34a' },
    { label: '阶段交付', color: '#0891b2' },
    { label: '托管结算', color: '#dc2626' },
  ],
}

export type ProposalField = {
  field: string
  example: string
  required: boolean
}

export const PROPOSAL_FIELDS: ProposalField[] = [
  { field: '方案标题', example: '全流程 AI 品牌广告片 · 15s 竖横双版', required: true },
  { field: '创作方向', example: '以产品质感为核心叙事，科技极简风格，参考 Apple 发布会视觉语言', required: true },
  { field: '核心交付物', example: '15s 竖版 + 横版各一；4K MP4；含英文字幕版', required: true },
  { field: '制作周期', example: '7 个工作日；脚本确认 1 天 + 生成 3 天 + 剪辑 2 天 + 修改 1 天', required: true },
  { field: '费用构成', example: '策划 ¥2000 + AI 生成 ¥3000 + 后期 ¥3000 = ¥8000', required: true },
  { field: '修改轮次', example: '2 次大改免费；超出按 ¥500/次收取', required: true },
  { field: '授权范围', example: '全媒体独家授权 3 年；不含广播电视播出权', required: true },
  { field: '风格参考', example: '已提供参考视频 3 条；主色调 #0a0f1a 深色系', required: false },
  { field: '所需素材', example: '产品渲染图 × 3；品牌 Logo（SVG）；参考文字', required: false },
  { field: '验收标准', example: '4K 无水印；与参考风格匹配度 ≥80%；无明显画面抖动', required: true },
  { field: '不包含事项', example: '不含真人出镜；不含版权音乐授权；不含发布渠道运营', required: true },
  { field: '风险边界', example: '素材延迟超 48h 将顺延周期；AI 风格偏差超 30% 可重新生成一次', required: false },
]

export type ServiceTier = {
  id: string
  title: string
  priceLabel: string
  priceRmb: number
  deliveryDays: number
  modificationRounds: number
  scenario: string
  deliverables: string[]
  license: string
  popular?: boolean
}

export const SERVICE_TIERS: ServiceTier[] = [
  {
    id: 'basic',
    title: '基础方案',
    priceLabel: '¥1,200 起',
    priceRmb: 1200,
    deliveryDays: 3,
    modificationRounds: 1,
    scenario: '电商短视频、单条社媒内容、产品展示图',
    deliverables: ['1 条竖版视频或图片组', '1080p MP4 / PNG', '1 次修改'],
    license: '平台限定授权 1 年',
  },
  {
    id: 'standard',
    title: '标准方案',
    priceLabel: '¥2,800 起',
    priceRmb: 2800,
    deliveryDays: 5,
    modificationRounds: 2,
    scenario: '品牌广告片、短剧预告、产品发布视频',
    deliverables: ['竖版 + 横版各一', '4K MP4 + 配音字幕', '2 次修改', '源文件'],
    license: '全媒体授权 2 年',
    popular: true,
  },
  {
    id: 'flagship',
    title: '旗舰方案',
    priceLabel: '¥6,800 起',
    priceRmb: 6800,
    deliveryDays: 10,
    modificationRounds: 3,
    scenario: '发布会开场视觉、旗舰品牌故事片、大型 IP 内容',
    deliverables: ['全格式：MP4 + ProRes', '多规格版本（竖/横/方）', '无限修改 3 轮内', '视觉圣经', '版权证明'],
    license: '全媒体独家授权 + 版权转移',
  },
]

export type CompareDimension = {
  label: string
  description: string
}

export const COMPARE_DIMENSIONS: CompareDimension[] = [
  { label: '预算匹配', description: '报价是否在需求 Brief 预算区间内' },
  { label: '风格匹配', description: '方案描述与参考风格的吻合程度' },
  { label: '交付周期', description: '能否满足项目方的 deadline' },
  { label: '修改轮次', description: '免费修改次数是否足够' },
  { label: '交付物清晰度', description: '格式、分辨率、版本数量是否明确' },
  { label: '授权范围', description: '商业授权是否覆盖目标平台与期限' },
  { label: '风险边界', description: '不确定因素是否在方案中提前说明' },
  { label: '创作者信用', description: '历史评分、按时交付率、复购率' },
]

export type MarketChainLink = {
  index: number
  label: string
  href: string
  current?: boolean
}

export const MARKET_CHAIN_LINKS: MarketChainLink[] = [
  { index: 1, label: '市场总览', href: '/marketplace-preview' },
  { index: 2, label: '创作者主页', href: '/creator-profile-preview' },
  { index: 3, label: '需求广场', href: '/demand-board-preview' },
  { index: 4, label: '报价方案', href: '/proposal-flow-preview', current: true },
  { index: 5, label: '阶段交付', href: '/milestone-delivery-preview' },
  { index: 6, label: '托管结算', href: '/escrow-preview' },
]
