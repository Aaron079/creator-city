// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.

export const MARKETPLACE_HERO = {
  title: '创作者市场',
  subtitle: 'Creator Marketplace',
  description: '连接创意需求与 AI 创作能力。在这里，品牌方发布需求，AI 创作者接单交付，平台保障质量与权益。',
  statusChips: [
    { label: '规划中', color: '#a78bfa' },
    { label: '尚未上线', color: '#f59e0b' },
    { label: '仅供预览', color: '#6b7280' },
  ],
}

export type MarketRole = {
  id: string
  title: string
  titleEn: string
  icon: string
  description: string
  capabilities: string[]
  badge?: string
}

export const MARKET_ROLES: MarketRole[] = [
  {
    id: 'client',
    title: '需求方 / 品牌方',
    titleEn: 'Client / Brand',
    icon: '🏢',
    description: '发布视频创作需求，设定预算与交付要求，验收并支付尾款。',
    capabilities: ['发布项目需求', '选择创作者', '审核交付物', '付款与评分'],
    badge: '甲方',
  },
  {
    id: 'director',
    title: 'AI 导演',
    titleEn: 'AI Director',
    icon: '🎬',
    description: '负责整体创意方向，统筹剧本、分镜与视频生成流程。',
    capabilities: ['撰写剧本框架', '生成分镜脚本', '调度 AI 工具', '最终剪辑审核'],
    badge: '核心角色',
  },
  {
    id: 'writer',
    title: '创意编剧',
    titleEn: 'Creative Writer',
    icon: '✍️',
    description: '负责文案、对白与故事结构，配合导演完成剧本创作。',
    capabilities: ['品牌文案策划', '剧本对白写作', '多版本修改', '风格适配'],
  },
  {
    id: 'artist',
    title: '概念艺术家',
    titleEn: 'Concept Artist',
    icon: '🎨',
    description: '负责视觉风格定义，生成角色参考、场景参考与风格圣经。',
    capabilities: ['角色视觉设计', '场景参考生成', '色彩风格规范', '品牌视觉提炼'],
  },
  {
    id: 'ai-video-artist',
    title: 'AI 视频创作者',
    titleEn: 'AI Video Artist',
    icon: '🤖',
    description: '使用 Creator City 工作台批量生成视频镜头，保证画面连续性与交付质量。',
    capabilities: ['多模型视频生成', '镜头连续性管控', '批量生成与筛选', '画面质检'],
    badge: '主力生产',
  },
  {
    id: 'editor',
    title: '后期剪辑师',
    titleEn: 'Video Editor',
    icon: '✂️',
    description: '对生成的视频素材进行精剪、配乐与最终交付包装。',
    capabilities: ['AI 素材精剪', '配乐音效', '字幕与特效', '多格式导出'],
  },
]

export type ServiceCard = {
  id: string
  category: string
  title: string
  priceRmb: number
  deliveryDays: number
  sellerName: string
  sellerLevel: string
  rating: number
  reviewCount: number
  tags: string[]
}

export const SERVICE_CARDS: ServiceCard[] = [
  {
    id: 's1',
    category: '品牌视频',
    title: '30秒品牌宣传视频 · AI生成 · 4K',
    priceRmb: 1200,
    deliveryDays: 3,
    sellerName: '云镜视觉',
    sellerLevel: 'Pro',
    rating: 4.9,
    reviewCount: 47,
    tags: ['AI生成', '品牌宣传', '4K'],
  },
  {
    id: 's2',
    category: '产品展示',
    title: '电商产品三维展示视频 · 15秒',
    priceRmb: 680,
    deliveryDays: 2,
    sellerName: '像素工坊',
    sellerLevel: 'Pro',
    rating: 4.8,
    reviewCount: 132,
    tags: ['电商', '产品', '三维'],
  },
  {
    id: 's3',
    category: '故事短片',
    title: '企业故事短片 · 60秒 · 含配音',
    priceRmb: 2800,
    deliveryDays: 5,
    sellerName: 'Nova导演室',
    sellerLevel: 'Elite',
    rating: 5.0,
    reviewCount: 23,
    tags: ['故事片', '企业', '配音'],
  },
  {
    id: 's4',
    category: '社交内容',
    title: '小红书竖版种草视频 · 3条打包',
    priceRmb: 960,
    deliveryDays: 2,
    sellerName: '内容星球',
    sellerLevel: 'Pro',
    rating: 4.7,
    reviewCount: 88,
    tags: ['小红书', '竖版', '种草'],
  },
  {
    id: 's5',
    category: '概念艺术',
    title: '品牌视觉圣经 · 角色+场景+色彩',
    priceRmb: 1800,
    deliveryDays: 4,
    sellerName: '幻境艺坊',
    sellerLevel: 'Elite',
    rating: 4.9,
    reviewCount: 31,
    tags: ['概念设计', '视觉圣经', '品牌'],
  },
  {
    id: 's6',
    category: '剧本创作',
    title: '品牌广告剧本 · 含3次修改',
    priceRmb: 480,
    deliveryDays: 2,
    sellerName: '字幕君',
    sellerLevel: 'Standard',
    rating: 4.6,
    reviewCount: 215,
    tags: ['剧本', '广告', '修改'],
  },
  {
    id: 's7',
    category: '直播切片',
    title: '直播精彩切片混剪 · 5条',
    priceRmb: 350,
    deliveryDays: 1,
    sellerName: '快剪速递',
    sellerLevel: 'Standard',
    rating: 4.5,
    reviewCount: 407,
    tags: ['直播', '切片', '混剪'],
  },
  {
    id: 's8',
    category: '教育内容',
    title: '在线课程讲解视频 · 每10分钟',
    priceRmb: 420,
    deliveryDays: 3,
    sellerName: '知课工作室',
    sellerLevel: 'Pro',
    rating: 4.8,
    reviewCount: 62,
    tags: ['教育', '课程', '讲解'],
  },
  {
    id: 's9',
    category: '音乐MV',
    title: 'AI 音乐 MV 生成 · 3分钟',
    priceRmb: 3200,
    deliveryDays: 6,
    sellerName: 'SynthFrame',
    sellerLevel: 'Elite',
    rating: 4.9,
    reviewCount: 18,
    tags: ['MV', '音乐', 'AI'],
  },
  {
    id: 's10',
    category: '游戏宣传',
    title: '手游宣传片 · 30秒 · 含特效',
    priceRmb: 2200,
    deliveryDays: 4,
    sellerName: '龙鳞影视',
    sellerLevel: 'Elite',
    rating: 5.0,
    reviewCount: 9,
    tags: ['游戏', '宣传', '特效'],
  },
  {
    id: 's11',
    category: '房产展示',
    title: '楼盘航拍+AI渲染联拍展示',
    priceRmb: 1600,
    deliveryDays: 3,
    sellerName: '空镜视觉',
    sellerLevel: 'Pro',
    rating: 4.7,
    reviewCount: 44,
    tags: ['房产', '航拍', 'AI渲染'],
  },
  {
    id: 's12',
    category: '节日营销',
    title: '节日营销短视频 · 全套5条',
    priceRmb: 1400,
    deliveryDays: 3,
    sellerName: '节令创意',
    sellerLevel: 'Pro',
    rating: 4.8,
    reviewCount: 73,
    tags: ['节日', '营销', '套餐'],
  },
]

export const COMMISSION_FLOW: Array<{ step: number; title: string; description: string; icon: string }> = [
  { step: 1, icon: '📋', title: '发布需求', description: '需求方填写项目简介、预算、交付格式与截止日期，平台自动生成需求摘要。' },
  { step: 2, icon: '🔍', title: '创作者浏览', description: '平台内认证创作者浏览公开需求，支持按类别、预算、交付时间过滤。' },
  { step: 3, icon: '✋', title: '创作者投标', description: '创作者提交报价与作品集，需求方可查看所有投标并比对报价与案例。' },
  { step: 4, icon: '🤝', title: '需求方选定', description: '需求方选定创作者，平台冻结首付款（总价 50%）至托管账户。' },
  { step: 5, icon: '🎬', title: '正式创作', description: '创作者在 Creator City 工作台完成创作，使用 AI 生成与剪辑工具交付。' },
  { step: 6, icon: '📦', title: '提交交付物', description: '创作者上传视频文件并附上交付说明，平台记录版本与时间戳。' },
  { step: 7, icon: '🔎', title: '需求方验收', description: '需求方在 72 小时内完成验收，可提出最多 2 次修改要求。' },
  { step: 8, icon: '✅', title: '确认交付', description: '验收通过后，平台释放尾款给创作者，平台收取 30% 服务费。' },
  { step: 9, icon: '⭐', title: '双向评分', description: '双方完成评分，创作者信誉与需求方诚信分更新，影响未来匹配权重。' },
]

export const COMMISSION_MODEL = {
  platformRate: 30,
  creatorRate: 70,
  escrowDays: 3,
  modificationLimit: 2,
  disputeWindowDays: 7,
  features: [
    { label: '资金托管', description: '首付款冻结于平台托管账户，交付验收后释放，避免跑路风险。' },
    { label: '争议仲裁', description: '平台提供 7 天争议期，中立介入评判交付质量，保障双方权益。' },
    { label: '版权归属', description: '交付验收后，版权自动转移给需求方，创作者保留署名权（可协商放弃）。' },
    { label: '税务合规', description: '平台统一开具增值税发票，创作者收入报税由平台代扣代缴（规划中）。' },
    { label: '评分信誉', description: '双向评分体系，高信誉创作者获得优先展示权重，劣质需求方限制发单。' },
  ],
}

export type CreatorProfileCapability = {
  title: string
  description: string
  icon: string
}

export const CREATOR_PROFILE_CAPABILITIES: CreatorProfileCapability[] = [
  { icon: '🆔', title: '身份认证', description: '实名认证 + 平台内容历史背书，提升需求方信任度。' },
  { icon: '🎞️', title: '作品集展示', description: '直接挂载 Creator City 生成的视频作品，动态更新无需手动上传。' },
  { icon: '⚡', title: '技能标签', description: '标注擅长类别（品牌、游戏、教育等）与主力 AI 工具组合。' },
  { icon: '📊', title: '交付数据', description: '公开历史接单数量、平均交付时长、按时交付率、客户满意度。' },
  { icon: '💬', title: '客户评价', description: '历史合作方评价公开展示，支持需求方验证真实交付记录。' },
  { icon: '💰', title: '收入概览', description: '创作者可查看本月收入、累计收益与平台手续费明细（私密数据）。' },
]

export type DemandCard = {
  id: string
  title: string
  category: string
  budgetRmb: number
  deliveryDays: number
  description: string
  requirements: string[]
  clientName: string
  postedAt: string
}

export const MOCK_DEMAND_CARDS: DemandCard[] = [
  {
    id: 'd1',
    title: '新能源汽车品牌 60 秒宣传片',
    category: '品牌宣传',
    budgetRmb: 8000,
    deliveryDays: 7,
    description: '面向 Z 世代消费者，突出智能驾驶与续航里程，风格科技感强，需附英文字幕版本。',
    requirements: ['4K 分辨率', '英文字幕', '含品牌 Logo 片尾', '交付 MP4 + ProRes'],
    clientName: '未来出行科技',
    postedAt: '2小时前',
  },
  {
    id: 'd2',
    title: '护肤品小红书内容矩阵 · 每月 8 条',
    category: '社交内容',
    budgetRmb: 4800,
    deliveryDays: 5,
    description: '每月持续合作，竖版 9:16，时长 30-60 秒，突出成分故事与用户真实感，禁止过度滤镜。',
    requirements: ['竖版 9:16', '30-60秒每条', '真实感风格', '禁止过度滤镜'],
    clientName: '悦颜品牌部',
    postedAt: '5小时前',
  },
  {
    id: 'd3',
    title: '教育 SaaS 产品功能演示视频',
    category: '产品演示',
    budgetRmb: 2200,
    deliveryDays: 4,
    description: '面向 B 端采购方，清晰展示产品核心功能，风格简洁专业，需配配音和字幕，时长约 2 分钟。',
    requirements: ['配音（普通话）', '字幕（中英双语）', '2分钟内', '1080p'],
    clientName: '云学企服',
    postedAt: '昨天',
  },
  {
    id: 'd4',
    title: '独立游戏上线预告片 · Steam 版本',
    category: '游戏宣传',
    budgetRmb: 6500,
    deliveryDays: 10,
    description: '横版动作手游 PC 移植版，Steam 上线宣传，风格像素朋克，时长 45-90 秒，需附 Steam 规格版本。',
    requirements: ['像素朋克风格', '45-90秒', 'Steam 规格', '含特效'],
    clientName: '八位像素工作室',
    postedAt: '2天前',
  },
]

export const TRUST_MECHANISMS: Array<{ title: string; description: string; icon: string }> = [
  { icon: '🔒', title: '资金全程托管', description: '首付款在接单时冻结，不经创作者账户，验收通过后自动释放，需求方无法任意拒付。' },
  { icon: '📋', title: '交付版本记录', description: '每次提交交付物均生成不可篡改的版本记录，含时间戳与文件指纹，防止"我没收到"纠纷。' },
  { icon: '⚖️', title: '平台中立仲裁', description: '争议期内由平台审核交付物与沟通记录，按需求文档判定是否达标，避免主观争议。' },
  { icon: '⭐', title: '双向评分体系', description: '创作者与需求方均有公开信誉分。恶意拒付或频繁跑单的用户将被限制平台使用权。' },
  { icon: '🛡️', title: '版权自动转移', description: '验收付款完成后，平台自动记录版权转移，支持出具书面版权证明（规划中）。' },
]

export const RISKS_AND_BOUNDARIES: Array<{ title: string; content: string }> = [
  {
    title: '平台不承担的风险',
    content: '平台不对创作内容的商业效果负责。视频播放量、转化率等营销结果不在交付保障范围内。创作者提供的是创作服务，不提供营销效果保证。',
  },
  {
    title: '内容合规红线',
    content: '所有交付内容须符合中国法律法规，禁止涉及政治敏感、虚假广告、未成年人不适内容。违规内容导致的法律责任由发布需求方与创作者共同承担。',
  },
  {
    title: '平台当前限制',
    content: '市场功能尚在规划阶段，现阶段不支持真实交易。本预览页所有价格、创作者、需求均为示例数据，不代表真实可用服务。',
  },
  {
    title: '创作者准入门槛',
    content: '正式上线后，创作者需通过平台内容审核（提交 3 件作品样本），并完成实名认证，方可开启接单权限。',
  },
]

export const ROADMAP_STAGES: Array<{ stage: number; title: string; status: 'done' | 'active' | 'planned'; quarter: string }> = [
  { stage: 1, title: 'AI 创作工作台上线', status: 'done', quarter: '2025 Q4' },
  { stage: 2, title: '图片 / 视频稳定生成', status: 'done', quarter: '2025 Q4' },
  { stage: 3, title: '项目协作多人工作区', status: 'active', quarter: '2026 Q1' },
  { stage: 4, title: '创作者主页与作品集', status: 'planned', quarter: '2026 Q2' },
  { stage: 5, title: '需求广场内测（邀请制）', status: 'planned', quarter: '2026 Q2' },
  { stage: 6, title: '托管支付与结算', status: 'planned', quarter: '2026 Q3' },
  { stage: 7, title: '信誉评分系统上线', status: 'planned', quarter: '2026 Q3' },
  { stage: 8, title: '创作者市场公测', status: 'planned', quarter: '2026 Q4' },
  { stage: 9, title: '版权存证与争议仲裁', status: 'planned', quarter: '2027 Q1' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者主页预览', href: '/creator-profile-preview', description: '查看创作者如何展示作品集与服务' },
  { label: '需求广场预览', href: '/demand-board-preview', description: '查看项目方如何发布结构化需求' },
  { label: '工作台', href: '/create', description: '开始 AI 视频创作' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '企业版预览', href: '/enterprise-preview', description: '了解企业部署方案' },
  { label: '本地部署', href: '/local-deploy-preview', description: '私有化部署说明' },
  { label: '定价预览', href: '/pricing-preview', description: '了解平台收费计划' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
