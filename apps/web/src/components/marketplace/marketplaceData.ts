// Static marketplace data — no API calls, no DB, no secrets, no env values
// All creator/project data is MOCK/DEMO — not real users or real orders

export type ServiceStatus = '预览' | '即将开放'
export type CreatorRole = '导演' | '编剧' | 'AI 视频师' | 'AI 图像师' | '美术指导' | '剪辑师' | '制片' | '声音设计师'
export type ProjectStatus = '招募中' | '预览'

export interface MarketplaceStat {
  label: string
  value: string
  note: string
}

export interface ServiceCategory {
  title: string
  description: string
  status: ServiceStatus
}

export interface CreatorService {
  name: string
  role: CreatorRole
  specialty: string[]
  priceFrom: string
  deliveryDays: string
  tags: string[]
}

export interface ProjectRequest {
  title: string
  type: string
  budgetRange: string
  summary: string
  deadline: string
  status: ProjectStatus
}

export interface MarketplaceRule {
  title: string
  detail: string
}

export interface SafetyTip {
  tip: string
}

export interface QuickLink {
  label: string
  href: string
  desc: string
}

// ── Stats ────────────────────────────────────────────────────────────────────

export const marketplaceStats: MarketplaceStat[] = [
  { label: '入驻创作者', value: '128+', note: '预览数据' },
  { label: '可委托服务', value: '36 类', note: '预览数据' },
  { label: '项目需求', value: '24 条', note: '预览数据' },
  { label: '平均交付周期', value: '5 天', note: '预览估算' },
]

// ── Service Categories ───────────────────────────────────────────────────────

export const serviceCategories: ServiceCategory[] = [
  {
    title: 'AI 广告片',
    description: '利用 AI 视频生成完成品牌广告、产品推广视频，快速交付高质量商业内容。',
    status: '预览',
  },
  {
    title: 'AI 短剧 / 漫剧',
    description: '分集连续剧叙事、角色一致性保持，结合 AI 生成完成漫剧或短剧项目。',
    status: '预览',
  },
  {
    title: 'AI 视频生成',
    description: '镜头级别的 AI 视频生成服务，包含运镜设计、节奏控制和风格锁定。',
    status: '预览',
  },
  {
    title: 'AI 图像视觉',
    description: '品牌视觉、角色设计、场景图、概念图，AI 辅助图像批量生成与风格统一。',
    status: '预览',
  },
  {
    title: '分镜 / 脚本',
    description: '影视级别分镜拆解、脚本创作和镜头语言设计，适配 AI 生成工作流。',
    status: '即将开放',
  },
  {
    title: '剪辑 / 后期',
    description: 'AI 素材整合、剪辑节奏设计、调色和字幕，完成最终交付版本。',
    status: '即将开放',
  },
  {
    title: '选角 / 角色设计',
    description: 'AI 角色外观设计、风格一致性锁定，支持连续剧集的角色视觉管理。',
    status: '即将开放',
  },
  {
    title: '商业品牌视觉',
    description: '品牌整体视觉风格系统设计，包含主视觉、延展物料和 AI 生成素材库。',
    status: '即将开放',
  },
]

// ── Creator Services (all mock/demo — not real user data) ───────────────────

export const creatorServices: CreatorService[] = [
  {
    name: 'creator_demo_A1',
    role: 'AI 视频师',
    specialty: ['AI 广告片', 'AI 短剧'],
    priceFrom: '¥2,999 起',
    deliveryDays: '5 个工作日',
    tags: ['Seedance', '电影感', '品牌广告'],
  },
  {
    name: 'creator_demo_A2',
    role: '导演',
    specialty: ['商业广告', '品牌纪录片'],
    priceFrom: '¥9,999 起',
    deliveryDays: '14 个工作日',
    tags: ['影视级', '导演统筹', 'AI 协作'],
  },
  {
    name: 'creator_demo_A3',
    role: '编剧',
    specialty: ['分镜脚本', '短剧叙事'],
    priceFrom: '¥1,999 起',
    deliveryDays: '3 个工作日',
    tags: ['剧本结构', 'AI 协作', '短视频'],
  },
  {
    name: 'creator_demo_A4',
    role: 'AI 图像师',
    specialty: ['品牌视觉', '概念图', '角色设计'],
    priceFrom: '¥1,499 起',
    deliveryDays: '3 个工作日',
    tags: ['Seedream', '风格统一', '批量生成'],
  },
  {
    name: 'creator_demo_A5',
    role: '美术指导',
    specialty: ['视觉风格', '调色', '品牌一致性'],
    priceFrom: '¥4,999 起',
    deliveryDays: '7 个工作日',
    tags: ['美术统筹', 'AI 辅助', '影视美学'],
  },
  {
    name: 'creator_demo_A6',
    role: '剪辑师',
    specialty: ['AI 素材剪辑', '短视频节奏'],
    priceFrom: '¥999 起',
    deliveryDays: '2 个工作日',
    tags: ['快速交付', '节奏感', 'AI 素材'],
  },
  {
    name: 'creator_demo_A7',
    role: '制片',
    specialty: ['项目协调', '交付管理'],
    priceFrom: '¥6,999 起',
    deliveryDays: '10 个工作日',
    tags: ['全流程', '多方协调', '质量把控'],
  },
  {
    name: 'creator_demo_A8',
    role: '声音设计师',
    specialty: ['音效设计', '电影音效'],
    priceFrom: '¥1,999 起',
    deliveryDays: '5 个工作日',
    tags: ['电影感', '低频氛围', '远程协作'],
  },
]

// ── Project Requests (all mock/demo — not real orders) ──────────────────────

export const projectRequests: ProjectRequest[] = [
  {
    title: '30 秒产品广告片制作',
    type: 'AI 广告片',
    budgetRange: '¥5,000 – ¥15,000',
    summary: '面向国内市场的智能硬件产品推广视频，需要电影感镜头和品牌调性一致的视觉风格。',
    deadline: '2026-06-30',
    status: '招募中',
  },
  {
    title: 'AI 短剧制作团队招募（12 集）',
    type: 'AI 短剧 / 漫剧',
    budgetRange: '¥20,000 – ¥50,000',
    summary: '都市轻喜剧风格，每集 3–5 分钟，需要导演、编剧和 AI 视频师配合完成连续剧集制作。',
    deadline: '2026-07-15',
    status: '招募中',
  },
  {
    title: '品牌视觉系列图像生成',
    type: 'AI 图像视觉',
    budgetRange: '¥3,000 – ¥8,000',
    summary: '科技品牌视觉物料，包含主视觉、产品场景图和概念图，统一风格体系，批量输出。',
    deadline: '2026-06-15',
    status: '预览',
  },
  {
    title: '漫剧分镜脚本创作',
    type: '分镜 / 脚本',
    budgetRange: '¥2,000 – ¥5,000',
    summary: '6 集漫剧的分镜脚本，需要适配 AI 生成工作流，角色外观和场景描述清晰可复现。',
    deadline: '2026-07-01',
    status: '招募中',
  },
  {
    title: '纪录片风格企业宣传片',
    type: 'AI 广告片',
    budgetRange: '¥30,000 – ¥80,000',
    summary: '面向 B 端客户的企业形象片，纪录片叙事风格，需要导演、制片和后期协作完成。',
    deadline: '2026-08-01',
    status: '预览',
  },
]

// ── Marketplace Rules ────────────────────────────────────────────────────────

export const marketplaceRules: MarketplaceRule[] = [
  {
    title: '直接沟通报价',
    detail: '项目方与创作者通过平台消息直接沟通需求范围、价格和修改次数，平台不参与谈判。',
  },
  {
    title: '交付确认与争议处理',
    detail: '平台后续将提供托管、交付确认和争议处理机制，本轮预览阶段不接入支付。',
  },
  {
    title: '平台服务费',
    detail: '平台未来将向交易双方收取服务费（创作者侧预计约 30%），具体比例以正式上线版本为准。',
  },
  {
    title: '本轮不接支付',
    detail: '当前页面为只读预览，不接单、不支付、不写入订单数据、不创建合同记录。',
  },
]

// ── Safety Tips ──────────────────────────────────────────────────────────────

export const safetyTips: SafetyTip[] = [
  { tip: '不要在平台外泄露 API key、账户 token 或任何访问凭证。' },
  { tip: '商业素材上传前需确认版权归属，未授权素材不得用于商业交付。' },
  { tip: '在沟通期明确交付范围、格式、修改次数和最终使用权限。' },
  { tip: '平台后续将支持项目权限、合同记录和正式结算，敬请关注。' },
]

// ── Quick Links ──────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard', desc: '项目总览与快速入口' },
  { label: '社区中心', href: '/community', desc: '创作者交流与灵感分享' },
  { label: '项目中心', href: '/projects', desc: '管理你的创作项目' },
  { label: '资产中心', href: '/assets', desc: '图片/视频资产管理' },
  { label: '生成任务', href: '/tasks', desc: '查看图片/视频生成记录' },
  { label: 'API 中心', href: '/providers', desc: '查看模型与 Provider 状态' },
  { label: '设置中心', href: '/settings', desc: '账号、偏好与团队管理' },
  { label: '诊断帮助', href: '/help', desc: '排查生成、OSS、登录问题' },
]
