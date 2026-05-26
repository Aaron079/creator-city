// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All demands, users, companies are mock/preview data only. No real orders, no payments, no DB writes.

export const HERO = {
  title: 'Creator City 需求广场预览',
  tagline: '把创意需求变成可报价、可协作、可交付的影视创作任务。',
  statusChips: [
    { label: '静态预览', color: '#a78bfa' },
    { label: 'Mock 需求', color: '#6b7280' },
    { label: '不创建订单', color: '#f59e0b' },
    { label: '不接支付', color: '#f59e0b' },
    { label: '不写数据库', color: '#ef4444' },
    { label: '不触发生成', color: '#ef4444' },
  ],
}

export const REASONS: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: '❓',
    title: '项目方说不清需求',
    description: '大多数创作需求在最初只是模糊想法，缺乏风格、时长、素材、交付格式与版权边界的清晰定义。',
  },
  {
    icon: '🔍',
    title: '创作者需要稳定项目来源',
    description: '优质创作者需要清晰、可信、结构化的项目信息来判断是否值得报价，碎片化需求导致大量无效沟通。',
  },
  {
    icon: '⚠️',
    title: '非结构化需求导致交付失控',
    description: '未约定修改次数、预算边界、版权归属和交付格式，是创作项目纠纷的主要来源。',
  },
  {
    icon: '🤖',
    title: 'AI 影视任务需要精确参数',
    description: 'AI 生成工作流要求提前明确风格、分辨率、时长、素材来源和 provider 授权，否则生成结果无法满足交付标准。',
  },
  {
    icon: '🔄',
    title: '需求广场让"想法"变成可执行 Brief',
    description: '结构化需求发布流程强制项目方在发单前明确核心要素，极大降低沟通成本和交付风险。',
  },
]

export type DemandType = {
  id: string
  label: string
  icon: string
  description: string
}

export const DEMAND_TYPES: DemandType[] = [
  { id: 'brand-ad', label: '品牌广告片', icon: '📺', description: '商业品牌形象与产品推广视频，含 TVC、短视频广告' },
  { id: 'product-demo', label: '产品展示视频', icon: '📦', description: '电商、SaaS、消费品的功能与卖点展示' },
  { id: 'short-drama', label: '短剧预告', icon: '🎭', description: '竖屏短剧、横屏剧集的预告片与宣传物料' },
  { id: 'comic-motion', label: '漫剧/动态漫画', icon: '📖', description: '静态漫画转动态、AI 漫改视频内容' },
  { id: 'game-design', label: '游戏角色设定', icon: '🎮', description: '游戏角色、武器、场景的概念设计与参考图' },
  { id: 'concept-art', label: '场景概念设计', icon: '🎨', description: '电影、游戏、短剧场景的视觉风格与参考板' },
  { id: 'storyboard', label: '分镜脚本', icon: '📋', description: '视频项目的分镜图、脚本文档和视觉指导' },
  { id: 'ai-video', label: 'AI 视频生成', icon: '🤖', description: '使用 AI 工具批量生成、筛选和交付视频镜头' },
  { id: 'editing', label: '视频剪辑', icon: '✂️', description: '素材精剪、混剪、字幕、配音、特效合成' },
  { id: 'social-media', label: '社媒短视频', icon: '📱', description: '小红书、抖音、视频号等平台的竖版内容生产' },
  { id: 'live-clip', label: '直播切片包装', icon: '🎞️', description: '直播精彩片段切片、封面制作与视觉包装' },
  { id: 'corporate', label: '企业宣传片', icon: '🏢', description: '品牌故事、企业文化、发布会视觉等大型项目' },
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
  status: 'mock'
  urgency?: 'normal' | 'urgent'
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
    description: '面向高端消费电子新品发布，15 秒竖版与横版各一，强调产品质感与未来科技感，需 4K 交付与英文字幕版本。',
    status: 'mock',
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
    description: '竖屏短剧第一季发布前的预告片，时长 60–90 秒，需展示主要角色与核心冲突，古风战争美学，含配音和字幕。',
    status: 'mock',
    urgency: 'urgent',
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
    description: '开放世界 RPG 新作，需要 3 个主要角色的全套设定图（正面/侧面/背面）及 2 个场景概念板，交付 PSD + PNG。',
    status: 'mock',
  },
  {
    id: 'd4',
    title: '电商产品展示短视频',
    category: '产品展示视频',
    budgetMin: 2000,
    budgetMax: 8000,
    durationDays: '3–5 天',
    roles: ['AI 视频师', '剪辑'],
    styles: ['清爽', '转化导向', '短平快'],
    description: '护肤品新品上市，需要 3 条竖版种草视频（15 秒 / 30 秒 / 60 秒），突出成分故事与使用感受，小红书规格。',
    status: 'mock',
  },
  {
    id: 'd5',
    title: '品牌社媒系列短片',
    category: '社媒短视频',
    budgetMin: 15000,
    budgetMax: 50000,
    durationDays: '15–30 天',
    roles: ['策划', 'AI 导演', '剪辑', 'AI 视频师'],
    styles: ['系列化', '年轻化', '传播感'],
    description: '某新消费品牌季度内容矩阵，12 条竖版短视频，统一视觉语言与品牌调性，按周分批交付，需配完整排期。',
    status: 'mock',
  },
  {
    id: 'd6',
    title: '企业发布会开场视觉',
    category: '企业宣传片',
    budgetMin: 20000,
    budgetMax: 80000,
    durationDays: '20–30 天',
    roles: ['创意总监', '视觉设计师', '动效师', '后期'],
    styles: ['大气', '科技', '舞台视觉'],
    description: '年度新品发布会开场视频，时长 3–5 分钟，需配合现场 LED 屏规格（分辨率 7680×1080），含音效与配乐版权。',
    status: 'mock',
    urgency: 'urgent',
  },
]

export const BRIEF_FIELDS: Array<{ field: string; type: string; example: string; required: boolean }> = [
  { field: '项目名称', type: '文本', example: '品牌新品 15 秒广告片', required: true },
  { field: '内容类型', type: '选择', example: '品牌广告片 / 短剧预告 / AI 视频生成', required: true },
  { field: '目标用途', type: '文本', example: '小红书推广 / 发布会现场 / 官网首页', required: true },
  { field: '参考风格', type: '文本 + 链接', example: '科技感、极简、参考 Apple 发布会风格', required: true },
  { field: '目标时长', type: '数字', example: '15 秒 / 60 秒 / 3 分钟', required: true },
  { field: '预算区间', type: '范围', example: '¥8,000 – ¥20,000', required: true },
  { field: '交付周期', type: '天数', example: '7–10 天', required: true },
  { field: '是否已有脚本', type: '是/否', example: '已有完整脚本 / 需要创作者提供', required: false },
  { field: '是否已有素材', type: '是/否', example: '已有产品图 / 需 AI 生成', required: false },
  { field: '所需创作者角色', type: '多选', example: 'AI 导演、AI 视频师、剪辑', required: true },
  { field: '输出格式', type: '选择', example: 'MP4 1080p / 4K ProRes / 竖版 9:16', required: true },
  { field: '修改轮次', type: '数字', example: '2 次', required: true },
  { field: '商业授权要求', type: '选择', example: '全媒体独家授权 / 平台限定授权', required: true },
  { field: '音乐/字体/肖像权说明', type: '文本', example: '使用版权音乐需创作者负责 / 不含真人肖像', required: false },
  { field: '验收标准', type: '文本', example: '4K 分辨率、无水印、符合参考风格 80% 以上', required: true },
]

export const PROPOSAL_FLOW: Array<{ step: number; icon: string; title: string; description: string; note?: string }> = [
  { step: 1, icon: '📋', title: '查看需求 Brief', description: '创作者浏览结构化需求卡片，了解项目类型、预算、周期和所需角色。' },
  { step: 2, icon: '🔍', title: '判断匹配度', description: '对比个人技能标签、可用时间窗口与历史案例，决定是否值得报价。' },
  { step: 3, icon: '✍️', title: '提交方案说明', description: '创作者撰写方案：包含创作思路、工具链、对风格的理解与作品集引用。' },
  { step: 4, icon: '💰', title: '给出报价与承诺', description: '明确报价金额、交付周期、修改次数和版权授权范围。', note: '当前不提交真实报价，不创建交易' },
  { step: 5, icon: '🔎', title: '项目方筛选方案', description: '项目方对比收到的方案，按报价、案例质量、创作者信誉排序。' },
  { step: 6, icon: '🤝', title: '双方确认范围', description: '选定创作者后，双方确认 brief 最终版本、付款节点与验收标准。' },
  { step: 7, icon: '🚀', title: '进入托管/里程碑交付', description: '未来版本：首付款托管 → 分阶段交付 → 验收释放尾款。', note: '当前不实现真实托管与支付' },
]

export const FILTER_TAGS: Array<{ dimension: string; values: string[] }> = [
  { dimension: '内容类型', values: ['品牌广告', '短剧', 'AI 视频', '社媒内容', '游戏', '企业宣传'] },
  { dimension: '预算区间', values: ['¥2,000–¥5,000', '¥5,000–¥20,000', '¥20,000–¥50,000', '¥50,000+'] },
  { dimension: '交付周期', values: ['3 天内', '7 天内', '14 天内', '30 天内'] },
  { dimension: '所需角色', values: ['AI 导演', 'AI 视频师', '编剧', '剪辑', '概念设计', '后期'] },
  { dimension: '风格标签', values: ['电影感', '科技', '古风', '清爽', '大气', '年轻化'] },
  { dimension: '项目状态', values: ['开放报价', '已选定', '进行中', '已完成'] },
  { dimension: '是否急单', values: ['急单 (48h)', '正常排期'] },
  { dimension: '是否企业客户', values: ['企业', '个人', '团队'] },
  { dimension: '版权授权', values: ['全媒体独家', '平台限定', '可商量'] },
  { dimension: '是否可远程', values: ['纯远程', '可到场', '线下优先'] },
]

export const PROJECT_OWNER_VALUES: Array<{ icon: string; title: string; description: string }> = [
  { icon: '📝', title: '更容易说清需求', description: '结构化 Brief 模板引导项目方在发单前把想法转化成可执行参数，减少沟通往复。' },
  { icon: '⚖️', title: '更容易比较方案', description: '所有报价方案使用统一格式，报价、周期、修改次数、授权范围一目了然，降低对比成本。' },
  { icon: '💬', title: '降低沟通成本', description: '需求结构化后，创作者在报价阶段已充分理解项目，无需大量前期沟通澄清。' },
  { icon: '🛡️', title: '降低交付失控风险', description: '预算、周期、修改次数和验收标准提前锁定，大幅减少"范围蔓延"和交付纠纷。' },
  { icon: '⚡', title: '版权边界提前明确', description: '音乐、字体、肖像权、AI 模型 provider 授权要求在发单阶段确认，避免交付后版权争议。' },
  { icon: '🔄', title: '需求沉淀进工作流', description: '项目方发布的需求可以直接沉淀进 Creator City 项目工作台，联通 AI 生成和后期流程。' },
]

export const CREATOR_VALUES: Array<{ icon: string; title: string; description: string }> = [
  { icon: '📌', title: '更稳定的项目来源', description: '结构化需求广场提供持续的可筛选项目列表，不依赖私人关系或随机推荐。' },
  { icon: '🗂️', title: '需求结构更清楚', description: '每个需求都包含预算、周期、风格、角色要求，创作者能快速判断是否值得报价。' },
  { icon: '💡', title: '展示专业能力', description: '方案提交格式鼓励创作者展示思路、工具链和作品集，而不仅仅是最低报价。' },
  { icon: '⭐', title: '积累案例和评分', description: '每个成功交付项目都会形成可展示的案例和评分记录，直接提升创作者主页权重。' },
  { icon: '🔗', title: '连接套餐与作品集', description: '创作者的报价套餐和作品集可以直接挂载到需求响应中，形成完整的能力展示闭环。' },
  { icon: '🏆', title: '形成信誉体系', description: '按时交付率、客户满意度、响应速度将共同构成创作者信誉分，影响未来匹配优先级。' },
]

export const RISKS_AND_BOUNDARIES: Array<{ title: string; content: string; level: 'warning' | 'info' }> = [
  { title: '当前不是正式需求广场', content: '本页面为静态预览，当前不支持真实需求发布、不保存 Brief、不创建订单。', level: 'warning' },
  { title: '不发布真实需求', content: '页面内所有需求卡片均为 Mock 数据，不代表真实项目、真实公司或真实客户。', level: 'warning' },
  { title: '不接支付、不创建交易', content: '当前无法提交报价、无法接单、无法完成付款或托管，所有流程步骤为规划中功能。', level: 'warning' },
  { title: '商业项目必须核查授权', content: '正式上线后，所有商业项目方须确认版权、肖像权、音乐授权、字体授权及 AI 模型 provider 授权，平台不承担因授权缺失引发的法律责任。', level: 'info' },
  { title: '报价、托管、抽佣需正式协议', content: '创作者佣金抽成、资金托管和争议仲裁规则将在正式上线前通过平台服务协议明确，当前规则仅为规划参考。', level: 'info' },
  { title: '不展示真实用户数据', content: '平台上线前，不在预览页展示任何真实注册用户的需求、报价或交付记录。', level: 'info' },
]

export type RoadmapStage = {
  stage: number
  title: string
  description: string
  status: 'done' | 'active' | 'planned'
  quarter: string
}

export const ROADMAP: RoadmapStage[] = [
  { stage: 1, title: 'Preview', description: '静态需求广场方案页（当前）', status: 'active', quarter: '2026 Q2' },
  { stage: 2, title: 'Brief Builder', description: '结构化需求发布器，项目方可填写并保存 Brief', status: 'planned', quarter: '2026 Q3' },
  { stage: 3, title: 'Demand Board', description: '公开需求列表，创作者可浏览与筛选', status: 'planned', quarter: '2026 Q3' },
  { stage: 4, title: 'Proposal Flow', description: '创作者提交报价方案，项目方在线比较', status: 'planned', quarter: '2026 Q3' },
  { stage: 5, title: 'Matching', description: '基于技能标签与历史评分的创作者智能推荐', status: 'planned', quarter: '2026 Q4' },
  { stage: 6, title: 'Milestone', description: '里程碑阶段验收，分阶段交付与确认', status: 'planned', quarter: '2026 Q4' },
  { stage: 7, title: 'Escrow', description: '资金托管与分阶段释放', status: 'planned', quarter: '2027 Q1' },
  { stage: 8, title: 'Dispute Center', description: '中立争议仲裁与版权处理', status: 'planned', quarter: '2027 Q1' },
  { stage: 9, title: 'Reputation', description: '创作者信誉评分、项目方诚信体系', status: 'planned', quarter: '2027 Q2' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者市场预览', href: '/marketplace-preview', description: '了解整体创作者市场规划' },
  { label: '创作者主页预览', href: '/creator-profile-preview', description: '查看创作者如何展示作品集' },
  { label: '报价与方案流程预览', href: '/proposal-flow-preview', description: '查看创作者如何提交方案与报价' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '生成任务', href: '/tasks', description: '查看 AI 生成任务状态' },
  { label: '社区', href: '/community', description: '与创作者交流' },
  { label: '定价预览', href: '/pricing-preview', description: '了解平台收费计划' },
  { label: '协议版权', href: '/terms-preview', description: '服务条款与版权说明' },
  { label: '企业版预览', href: '/enterprise-preview', description: '企业部署方案' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
