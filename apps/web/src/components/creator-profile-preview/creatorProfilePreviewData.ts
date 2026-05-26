// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.

export const PROFILE_HERO = {
  name: 'Nova 导演室',
  handle: '@novafilm',
  avatarInitials: 'N',
  avatarColor: '#7c3aed',
  tagline: 'AI 导演 · 品牌视频 · 概念艺术',
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
  { label: '累计接单', value: '127', sub: '个项目' },
  { label: '按时交付率', value: '99.2%', sub: '' },
  { label: '平均评分', value: '4.97', sub: '/ 5.0' },
  { label: '平均响应', value: '< 2h', sub: '' },
  { label: '复购率', value: '68%', sub: '' },
  { label: '累计收益', value: '¥--', sub: '（不公开）' },
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
  aspectRatio: string
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
    aspectRatio: '16:9',
  },
  {
    id: 'p2',
    title: '护肤品概念短片系列',
    category: '产品展示',
    duration: '30s × 3',
    description: '东方美学视觉语言，使用 Kling + Creator City 双引擎生成，小红书竖版。',
    tags: ['东方美学', '护肤', '竖版', '小红书'],
    deliveredAt: '2025-11',
    clientIndustry: '美妆',
    aspectRatio: '9:16',
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
    aspectRatio: '16:9',
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
    aspectRatio: '16:9',
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
    aspectRatio: '16:9',
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
    aspectRatio: '16:9',
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
    title: '品牌短视频 · 基础版',
    description: '30 秒以内，单一风格，2 次修改，1080p 交付。',
    priceRmb: 1200,
    deliveryDays: 3,
    includes: ['剧本大纲', 'AI 视频生成', '基础剪辑', '2次修改', '1080p MP4'],
  },
  {
    id: 'svc2',
    title: '品牌故事片 · 标准版',
    description: '60 秒以内，含配音与字幕，3 次修改，4K 交付。',
    priceRmb: 2800,
    deliveryDays: 5,
    includes: ['完整剧本', 'AI 视频生成', '配音', '字幕', '4K 交付', '3次修改'],
    popular: true,
  },
  {
    id: 'svc3',
    title: '旗舰创作套餐',
    description: '90 秒以上，全定制风格圣经，无限修改，多格式交付。',
    priceRmb: 6800,
    deliveryDays: 10,
    includes: ['视觉圣经', '完整剧本', '多镜头生成', '配音+音效', '4K+ProRes', '无限修改', '版权证明'],
  },
]

export type Review = {
  id: string
  clientName: string
  clientIndustry: string
  rating: number
  comment: string
  projectTitle: string
  deliveredAt: string
}

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    clientName: '未来出行科技',
    clientIndustry: '新能源',
    rating: 5,
    comment: '完全超出预期。AI 生成质量极高，交付速度快，沟通专业高效。会继续合作。',
    projectTitle: '新能源汽车品牌宣传片',
    deliveredAt: '2025-12',
  },
  {
    id: 'r2',
    clientName: '悦颜品牌部',
    clientIndustry: '美妆',
    rating: 5,
    comment: '东方美学把握得非常准，竖版视觉冲击力强，小红书发布后互动率提升明显。',
    projectTitle: '护肤品概念短片系列',
    deliveredAt: '2025-11',
  },
  {
    id: 'r3',
    clientName: '八位像素工作室',
    clientIndustry: '游戏',
    rating: 5,
    comment: '像素朋克风格还原完美，Steam 预告片上线后获得了玩家社区的正面反馈。',
    projectTitle: '独立游戏上线预告片',
    deliveredAt: '2025-10',
  },
  {
    id: 'r4',
    clientName: '云学企服',
    clientIndustry: '教育科技',
    rating: 4,
    comment: '产品演示逻辑清晰，配音专业，唯一建议是初稿可以更快交付，整体非常满意。',
    projectTitle: '教育 SaaS 产品功能演示',
    deliveredAt: '2025-09',
  },
]

export const WORKFLOW_STEPS: Array<{ step: number; title: string; description: string; icon: string }> = [
  { step: 1, icon: '📋', title: '需求确认', description: '接单后 2 小时内响应，与客户对齐创意方向、风格参考与交付格式。' },
  { step: 2, icon: '✍️', title: '剧本 & 分镜', description: '使用 Creator City 生成剧本大纲，配合人工审核，确保逻辑连贯。' },
  { step: 3, icon: '🎨', title: '视觉风格确定', description: '生成 3-5 张风格参考图，客户选定方向后进入正式生产。' },
  { step: 4, icon: '🤖', title: 'AI 视频生成', description: '使用多模型并行生成，从 10+ 个镜头候选中筛选最佳组合。' },
  { step: 5, icon: '✂️', title: '剪辑 & 配音', description: '精剪、配乐、配音、字幕全套后期，统一交付标准格式。' },
  { step: 6, icon: '📦', title: '交付 & 验收', description: '按约定格式交付，提供 72 小时验收期，最多 3 次修改响应。' },
]

export const TRUST_BADGES: Array<{ icon: string; title: string; description: string }> = [
  { icon: '✅', title: '实名认证', description: '平台实名认证创作者，身份可追溯。' },
  { icon: '🔒', title: '托管保障', description: '所有项目资金经平台托管，验收后释放。' },
  { icon: '📋', title: '版本记录', description: '每次交付均生成不可篡改时间戳记录。' },
  { icon: '⭐', title: '持续好评', description: '127 个项目，98% 客户满意度，可查验历史评价。' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者市场', href: '/marketplace-preview', description: '浏览所有创作者与服务' },
  { label: '工作台', href: '/create', description: '使用 AI 工作台创作' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '企业版预览', href: '/enterprise-preview', description: '了解企业部署方案' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
