// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All proposals, users, prices are mock/preview only. No real orders, no payments, no DB writes.

export const HERO = {
  title: 'Creator City 报价与方案流程预览',
  tagline: '把创作者的判断、方案、报价、周期和交付边界结构化，让项目方更容易选择合适的人。',
  statusChips: [
    { label: '静态预览', color: '#a78bfa' },
    { label: 'Mock 方案', color: '#6b7280' },
    { label: '不提交报价', color: '#f59e0b' },
    { label: '不创建订单', color: '#f59e0b' },
    { label: '不接支付', color: '#ef4444' },
    { label: '不写数据库', color: '#ef4444' },
    { label: '不触发生成', color: '#ef4444' },
  ],
}

export const REASONS: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: '⚖️',
    title: '无结构报价难以比较',
    description: '项目方收到多个报价时，如果格式不一、维度不同，几乎无法理性决策，只能凭直觉或最低价选人。',
  },
  {
    icon: '🎯',
    title: '创作者需要展示方法，而不只是价格',
    description: '优秀的创作者应通过方案说明创作思路、工具链和交付能力，而不是在价格上内卷。',
  },
  {
    icon: '🤖',
    title: 'AI 影视任务变量多',
    description: 'AI 生成任务涉及模型选择、API 成本、图生视频迭代次数、素材授权、输出格式、修改轮次，这些必须提前明确。',
  },
  {
    icon: '🛡️',
    title: '报价结构能减少后期争议',
    description: '把修改次数、版权范围、验收标准、加急条款写入方案，是避免交付纠纷最有效的方式。',
  },
  {
    icon: '🔗',
    title: '方案、报价、里程碑可以绑定',
    description: '平台未来可以把提案内容直接转化为合同、里程碑节点和托管支付触发条件，形成闭环。',
  },
]

export const PROPOSAL_STRUCTURE_FIELDS: Array<{ field: string; description: string; required: boolean }> = [
  { field: '项目理解', description: '用自己的语言复述需求 brief，确认理解无误', required: true },
  { field: '创意方向', description: '概述将采用什么叙事或视觉逻辑来完成这个项目', required: true },
  { field: '视觉风格', description: '描述画面风格、色调、运镜方式，可附参考图', required: true },
  { field: '工作流程', description: '说明脚本→分镜→生成→剪辑→交付的执行路径', required: true },
  { field: '所需素材', description: '列出需要项目方提供的品牌素材、产品图、Logo 等', required: false },
  { field: '使用工具/API', description: '列明将使用的 AI 模型、生成平台和后期工具', required: true },
  { field: '交付内容', description: '明确交付的文件格式、分辨率、版本数量', required: true },
  { field: '交付周期', description: '总天数及各阶段节点，含等待项目方反馈的缓冲', required: true },
  { field: '修改轮次', description: '约定免费修改次数及超出收费标准', required: true },
  { field: '报价明细', description: '逐项列出费用构成，让项目方清楚钱花在哪里', required: true },
  { field: '版权与授权说明', description: '声明交付后版权归属、AI 模型授权范围、商业使用限制', required: true },
  { field: '风险提示', description: '列出可能影响交付的不确定因素，如素材延迟、风格偏差', required: false },
  { field: '验收方式', description: '约定验收标准和争议判定基准', required: true },
]

export type MockProposal = {
  id: string
  type: string
  typeColor: string
  title: string
  creatorLevel: string
  budgetRmb: number
  deliveryDays: number
  highlights: string[]
  tools: string[]
  modificationRounds: number
  includesSource: boolean
  includesCommercialRights: boolean
  status: 'mock'
}

export const MOCK_PROPOSALS: MockProposal[] = [
  {
    id: 'p1',
    type: '导演型方案',
    typeColor: '#7c3aed',
    title: '全程风格把控 + 镜头设计 + 交付统筹',
    creatorLevel: 'Elite',
    budgetRmb: 18000,
    deliveryDays: 10,
    highlights: [
      '负责整体创意方向与镜头设计',
      '统筹 AI 视频师与剪辑执行',
      '全程客户沟通与需求把控',
      '交付完整版 + 竖版裁切版',
    ],
    tools: ['Creator City', 'Kling', 'Runway'],
    modificationRounds: 3,
    includesSource: false,
    includesCommercialRights: true,
    status: 'mock',
  },
  {
    id: 'p2',
    type: 'AI 视频师方案',
    typeColor: '#0e7490',
    title: '模型选择 + 图生视频 + 镜头迭代 + 素材稳定化',
    creatorLevel: 'Pro',
    budgetRmb: 9800,
    deliveryDays: 6,
    highlights: [
      '负责 AI 视频生成与镜头筛选',
      '多模型并行对比，选最优结果',
      '角色/场景连续性控制',
      '交付原始素材包 + 精选版',
    ],
    tools: ['Creator City', 'Kling', 'Sora', 'Midjourney'],
    modificationRounds: 2,
    includesSource: true,
    includesCommercialRights: false,
    status: 'mock',
  },
  {
    id: 'p3',
    type: '全流程小团队方案',
    typeColor: '#a16207',
    title: '脚本 + 分镜 + 视觉 + 视频 + 剪辑全包',
    creatorLevel: 'Elite',
    budgetRmb: 38000,
    deliveryDays: 18,
    highlights: [
      '2–3 人配合，分工明确',
      '脚本、分镜、生成、后期全程负责',
      '含品牌视觉圣经输出',
      '交付全格式：MP4 + ProRes + 源文件',
    ],
    tools: ['Creator City', 'Kling', 'Runway', 'Midjourney', 'DaVinci'],
    modificationRounds: 4,
    includesSource: true,
    includesCommercialRights: true,
    status: 'mock',
  },
  {
    id: 'p4',
    type: '后期剪辑方案',
    typeColor: '#166534',
    title: '剪辑 + 字幕 + 节奏 + 音效 + 发布版本',
    creatorLevel: 'Pro',
    budgetRmb: 6800,
    deliveryDays: 5,
    highlights: [
      '接收已有 AI 生成素材进行精剪',
      '字幕、音效、节奏调整',
      '输出多平台规格版本',
      '含修改 2 轮 + 最终版本存档',
    ],
    tools: ['Premiere Pro', 'DaVinci', 'After Effects'],
    modificationRounds: 2,
    includesSource: false,
    includesCommercialRights: false,
    status: 'mock',
  },
]

export const QUOTE_BREAKDOWN_FIELDS: Array<{ item: string; description: string; typical?: string }> = [
  { item: '创意策划费', description: '品牌分析、创意概念、脚本大纲', typical: '¥1,000–¥5,000' },
  { item: '分镜/脚本费', description: '分镜图或详细脚本文档', typical: '¥800–¥3,000' },
  { item: '视觉设计费', description: '角色参考、场景参考、风格圣经', typical: '¥1,500–¥6,000' },
  { item: 'AI 生成成本', description: 'API 调用费、模型订阅费按实际摊算', typical: '按实计算' },
  { item: '剪辑后期费', description: '精剪、字幕、配音、音效', typical: '¥2,000–¥8,000' },
  { item: '音乐/字体/素材授权', description: '版权音乐、字体使用授权、图库素材', typical: '按实购买' },
  { item: '修改轮次', description: '超出约定轮次按次收费', typical: '¥500–¥2,000/次' },
  { item: '加急费用', description: '交付周期压缩 50% 以上时收取', typical: '总价 20–50%' },
  { item: '商业授权费用', description: '全媒体独家授权溢价', typical: '总价 10–30%' },
  { item: '税费/发票说明', description: '增值税专票由平台统一开具（规划中）', typical: '按税率计算' },
  { item: '平台未来服务费', description: '规划中，撮合抽佣', typical: '总价 30%（规划）' },
  { item: '可选托管费用', description: '资金托管手续费（规划中）', typical: '待定' },
]

export const CREATOR_FLOW: Array<{ step: number; icon: string; title: string; description: string; note?: string }> = [
  { step: 1, icon: '📋', title: '阅读需求 Brief', description: '完整阅读项目方发布的结构化需求，理解内容类型、风格、预算区间和交付要求。' },
  { step: 2, icon: '🔍', title: '判断是否匹配', description: '对比个人技能、可用时间窗口和历史案例，决定是否值得投入时间报价。' },
  { step: 3, icon: '📝', title: '选择方案模板', description: '根据项目类型选择合适的方案框架（导演型/执行型/全流程型/后期型）。' },
  { step: 4, icon: '🎨', title: '填写创意方向', description: '用自己的语言描述将如何理解和执行这个项目，展示专业判断而非简单复述。' },
  { step: 5, icon: '💰', title: '填写报价明细', description: '逐项说明费用构成，帮助项目方理解定价逻辑，而不只是看总价。' },
  { step: 6, icon: '📅', title: '填写周期和修改轮次', description: '给出合理周期估算，明确各阶段节点和免费修改上限。' },
  { step: 7, icon: '⚖️', title: '标注风险与授权边界', description: '列明版权归属、AI 模型授权范围、可能影响交付的不确定因素。' },
  { step: 8, icon: '🚀', title: '提交给项目方审核', description: '方案提交后进入平台审核状态，项目方可对比所有收到方案后决策。', note: '当前不提交真实方案' },
]

export const COMPARE_FIELDS: string[] = [
  '总报价',
  '交付周期',
  '创作者等级与评分',
  '作品集匹配度',
  '响应速度',
  '修改轮次',
  '授权范围',
  '是否全流程',
  '是否含源文件',
  '是否含商业授权',
  '风险提示完整性',
  '是否可本地部署支持',
]

export const MILESTONES: Array<{ index: number; title: string; description: string; triggerPayment?: boolean }> = [
  { index: 1, title: '需求确认', description: '双方确认 Brief 最终版本，无歧义后启动项目。' },
  { index: 2, title: '方案确认', description: '创意方向、风格参考、交付内容逐项确认并存档。' },
  { index: 3, title: '风格样片', description: '交付 2–3 个镜头样片供项目方判断方向是否一致。', triggerPayment: false },
  { index: 4, title: '第一版交付', description: '完整初版视频交付，进入第一轮修改周期。', triggerPayment: true },
  { index: 5, title: '修改版交付', description: '按约定修改轮次逐轮交付，每轮需书面确认。' },
  { index: 6, title: '最终交付', description: '终版文件交付，含所有约定格式与规格。', triggerPayment: true },
  { index: 7, title: '授权文件确认', description: '版权转移文件、AI 模型授权声明、商业授权书交付。' },
  { index: 8, title: '项目归档', description: '平台记录项目版本、时间戳与交付物 Hash，双方评分。' },
]

export const TRUST_ITEMS: Array<{ icon: string; title: string; description: string }> = [
  { icon: '📝', title: '报价留痕', description: '方案提交后生成不可篡改记录，防止事后改价争议。' },
  { icon: '📋', title: '交付范围确认', description: '每个里程碑交付物都有约定列表，验收时逐项对照。' },
  { icon: '🔄', title: '修改轮次确认', description: '轮次上限在方案阶段明确，超出部分以书面形式确认后计费。' },
  { icon: '⚖️', title: '授权边界确认', description: 'AI 模型授权范围、商业使用权利在交付前书面确认。' },
  { icon: '🖼️', title: '素材来源记录', description: '所有使用的图库素材、音乐、字体需记录来源和授权文件。' },
  { icon: '📦', title: '版本记录', description: '每次交付物都有平台生成的版本号和时间戳，防止"我没收到"纠纷。' },
  { icon: '💬', title: '项目方反馈记录', description: '修改需求以书面形式提交并留存，防止口头沟通失真。' },
  { icon: '🛡️', title: '平台未来争议处理', description: '正式上线后，平台将提供中立仲裁机制，按交付文档判定是否达标。' },
]

export const RISKS_AND_BOUNDARIES: Array<{ title: string; content: string; level: 'warning' | 'info' }> = [
  { title: '当前不是正式报价系统', content: '本页面为静态预览，不支持真实方案提交、不保存报价、不创建订单。', level: 'warning' },
  { title: '不提交真实报价', content: '页面内所有方案卡片均为 Mock 数据，不代表真实创作者或真实报价。', level: 'warning' },
  { title: '不接支付、不创建交易', content: '当前无法创建合同、无法付款或托管，所有流程步骤为规划中功能。', level: 'warning' },
  { title: '商业项目必须核查授权', content: '正式上线后，所有使用的 AI 生成内容须符合模型 provider 的商业授权条款，版权争议责任由创作者和项目方共同承担。', level: 'info' },
  { title: '平台抽佣、托管、退款需正式协议', content: '当前展示的 30% 平台服务费和托管条款仅为规划参考，正式条款需经法务审核后在平台服务协议中明确。', level: 'info' },
  { title: '不展示真实创作者或客户数据', content: '平台上线前，预览页不展示任何真实注册用户的报价、方案或交付记录。', level: 'info' },
]

export type RoadmapStage = {
  stage: number
  title: string
  description: string
  status: 'done' | 'active' | 'planned'
  quarter: string
}

export const ROADMAP: RoadmapStage[] = [
  { stage: 1, title: 'Preview', description: '静态报价流程页（当前）', status: 'active', quarter: '2026 Q2' },
  { stage: 2, title: 'Proposal Template', description: '创作者可选择方案模板并填写结构化内容', status: 'planned', quarter: '2026 Q3' },
  { stage: 3, title: 'Quote Builder', description: '逐项填写报价明细，自动汇总总价', status: 'planned', quarter: '2026 Q3' },
  { stage: 4, title: 'Compare View', description: '项目方多方案并排对比视图', status: 'planned', quarter: '2026 Q3' },
  { stage: 5, title: 'Negotiation', description: '双方可对方案条款进行协商与修改', status: 'planned', quarter: '2026 Q4' },
  { stage: 6, title: 'Milestone Contract', description: '里程碑节点确认与存档', status: 'planned', quarter: '2026 Q4' },
  { stage: 7, title: 'Escrow', description: '资金托管与分阶段释放', status: 'planned', quarter: '2027 Q1' },
  { stage: 8, title: 'Delivery Proof', description: '交付物版本记录与凭证生成', status: 'planned', quarter: '2027 Q1' },
  { stage: 9, title: 'Dispute Center', description: '平台中立仲裁与争议处理机制', status: 'planned', quarter: '2027 Q2' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者市场预览', href: '/marketplace-preview', description: '了解整体创作者市场规划' },
  { label: '创作者主页预览', href: '/creator-profile-preview', description: '查看创作者如何展示作品集' },
  { label: '需求广场预览', href: '/demand-board-preview', description: '查看项目方如何发布需求' },
  { label: '阶段交付预览', href: '/milestone-delivery-preview', description: '方案确认后如何拆解为可验收里程碑' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '生成任务', href: '/tasks', description: '查看 AI 生成任务状态' },
  { label: '社区', href: '/community', description: '与创作者交流' },
  { label: '定价预览', href: '/pricing-preview', description: '了解平台收费计划' },
  { label: '协议版权', href: '/terms-preview', description: '服务条款与版权说明' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
