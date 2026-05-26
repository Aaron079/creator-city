// No POST, no PUT, no DELETE. Static data only. Not connected to generation.

export const HERO = {
  title: '需求广场',
  tagline: '把模糊创意拆成预算、周期、角色、风格、交付物与风险边界，让创作者能快速判断并提交报价方案。',
  statusChips: [
    { label: '预览中', color: '#a78bfa' },
    { label: '结构化 Brief', color: '#2563eb' },
    { label: 'RMB 预算', color: '#16a34a' },
    { label: '可报价', color: '#0891b2' },
    { label: '阶段交付', color: '#d97706' },
    { label: '托管结算', color: '#dc2626' },
  ],
}

export type BriefField = {
  field: string
  example: string
  required: boolean
}

export const BRIEF_FIELDS: BriefField[] = [
  { field: '项目类型', example: '品牌广告片 / 短剧预告 / AI 视频生成', required: true },
  { field: '目标受众', example: 'Z 世代女性 / B 端采购决策者 / 游戏玩家', required: true },
  { field: '片长 / 交付物', example: '15 秒竖版 + 横版各一；4K MP4', required: true },
  { field: '预算区间', example: '¥8,000 – ¥20,000', required: true },
  { field: '交付周期', example: '7–10 个工作日', required: true },
  { field: '视觉风格', example: '科技感极简 / 赛博朋克 / 新中式', required: true },
  { field: '参考方向', example: 'Apple 发布会风格 / 提供参考视频链接', required: false },
  { field: '角色需求', example: 'AI 导演、AI 视频师、后期剪辑', required: true },
  { field: '修改轮次', example: '2 次大改 + 无限小调', required: true },
  { field: '授权范围', example: '全媒体独家 3 年 / 平台限定 1 年', required: true },
  { field: '验收标准', example: '4K、无水印、符合参考风格 80% 以上', required: true },
  { field: '风险边界', example: '音乐版权由创作者负责；不含真人肖像', required: false },
]

export type MockDemand = {
  id: string
  title: string
  category: string
  budgetMin: number
  budgetMax: number
  durationDays: string
  roles: string[]
  styles: string[]
  description: string
  status: '可报价' | '需求澄清' | '等待方案'
  urgent?: boolean
}

export const MOCK_DEMANDS: MockDemand[] = [
  {
    id: 'd1',
    title: '品牌新品 15 秒广告片',
    category: '品牌广告片',
    budgetMin: 8000,
    budgetMax: 20000,
    durationDays: '7–10 天',
    roles: ['AI 导演', 'AI 视频师', '剪辑'],
    styles: ['高级', '科技', '产品特写'],
    description: '高端消费电子新品发布，15 秒竖版与横版各一，强调产品质感与未来科技感，需 4K 交付与英文字幕版本。',
    status: '可报价',
  },
  {
    id: 'd2',
    title: '三国题材短剧预告',
    category: '短剧预告',
    budgetMin: 12000,
    budgetMax: 35000,
    durationDays: '10–14 天',
    roles: ['编剧', '分镜师', 'AI 视频师', '后期'],
    styles: ['电影感', '战争', '古风'],
    description: '竖屏短剧第一季预告片，时长 60–90 秒，需展示主要角色与核心冲突，古风战争美学，含配音和字幕。',
    status: '可报价',
    urgent: true,
  },
  {
    id: 'd3',
    title: '游戏角色设定 + 场景概念',
    category: '游戏角色设定',
    budgetMin: 5000,
    budgetMax: 15000,
    durationDays: '5–8 天',
    roles: ['概念艺术家', '角色设计师'],
    styles: ['幻想', '暗黑', '写实'],
    description: '开放世界 RPG 新作，3 个主要角色全套设定图（正面/侧面/背面）及 2 个场景概念板，交付 PSD + PNG。',
    status: '等待方案',
  },
  {
    id: 'd4',
    title: '电商护肤品种草短视频',
    category: '产品展示视频',
    budgetMin: 2000,
    budgetMax: 8000,
    durationDays: '3–5 天',
    roles: ['AI 视频师', '剪辑'],
    styles: ['清爽', '转化导向', '小红书'],
    description: '护肤品新品上市，3 条竖版种草视频（15 / 30 / 60 秒），突出成分故事与使用感受，小红书规格交付。',
    status: '需求澄清',
  },
]

export type FilterDimension = {
  label: string
  values: string[]
}

export const FILTER_DIMENSIONS: FilterDimension[] = [
  { label: '预算区间', values: ['¥2,000–¥5,000', '¥5,000–¥20,000', '¥20,000–¥50,000', '¥50,000+'] },
  { label: '交付周期', values: ['3 天内', '7 天内', '14 天内', '30 天内'] },
  { label: '创作类型', values: ['品牌广告', '短剧', 'AI 视频', '社媒内容', '概念设计', '企业宣传'] },
  { label: '风格方向', values: ['电影感', '科技极简', '古风', '赛博朋克', '清爽转化'] },
  { label: '授权范围', values: ['全媒体独家', '平台限定', '可商议'] },
  { label: '修改轮次', values: ['1 次', '2 次', '3 次', '无限次'] },
  { label: '风险等级', values: ['低风险', '中风险', '需评估'] },
  { label: 'AI 辅助', values: ['全程 AI 生成', '部分 AI 辅助', '传统工作流'] },
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
  { index: 3, label: '需求广场', href: '/demand-board-preview', current: true },
  { index: 4, label: '报价方案', href: '/proposal-flow-preview' },
  { index: 5, label: '阶段交付', href: '/milestone-delivery-preview' },
  { index: 6, label: '托管结算', href: '/escrow-preview' },
]
