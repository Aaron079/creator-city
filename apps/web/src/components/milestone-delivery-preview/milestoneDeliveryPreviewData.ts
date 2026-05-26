// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All milestones, projects, deliveries are mock/preview only. No real orders, payments, or DB writes.

export const HERO = {
  title: 'Creator City 阶段交付预览',
  tagline: '从需求确认到最终交付，把每个创作阶段变成清晰的验收节点。',
  statusChips: [
    { label: '静态预览', color: '#a78bfa' },
    { label: 'Mock 里程碑', color: '#6b7280' },
    { label: '不提交交付', color: '#f59e0b' },
    { label: '不创建订单', color: '#f59e0b' },
    { label: '不接支付', color: '#ef4444' },
    { label: '不写数据库', color: '#ef4444' },
    { label: '不触发生成', color: '#ef4444' },
  ],
}

export const REASONS: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: '🔄',
    title: '影视创作通常需要多轮确认',
    description: '从脚本到分镜到样片到终版，每个阶段都可能需要项目方介入调整，一次性交付几乎不可能成功。',
  },
  {
    icon: '📊',
    title: '项目方需要实时掌握进度',
    description: '没有阶段节点，项目方只能等待，无法感知风险，也无法在早期纠偏，导致最终交付时才发现偏差。',
  },
  {
    icon: '📋',
    title: '创作者需要明确每阶段交付范围',
    description: '不明确的交付范围导致"做了很多、验收不通过"的困境。阶段交付让双方提前对齐每次应该确认什么。',
  },
  {
    icon: '📝',
    title: '修改与授权必须留痕',
    description: '修改轮次、素材来源、版权授权范围在每个阶段都应记录，防止事后争议"我没说要改这个"。',
  },
  {
    icon: '🛡️',
    title: '阶段交付减少争议与返工',
    description: '项目方在早期阶段发现问题，修改成本最低；阶段确认记录也为争议仲裁提供客观证据链。',
  },
]

export type MilestoneStage = {
  index: number
  title: string
  goal: string
  creatorDeliverables: string[]
  clientConfirmItems: string[]
  riskNote: string
  triggerPayment?: boolean
}

export const MILESTONE_STRUCTURE: MilestoneStage[] = [
  {
    index: 1,
    title: '需求确认',
    goal: '双方就项目 Brief 达成一致，无歧义后正式启动。',
    creatorDeliverables: ['理解确认函', '疑问清单', '初步可行性评估'],
    clientConfirmItems: ['Brief 最终版本', '预算上限', '交付格式', '商业授权类型'],
    riskNote: '此阶段未确认即开工是争议主要来源。',
  },
  {
    index: 2,
    title: '方案确认',
    goal: '创作者提交完整方案，项目方选定并存档。',
    creatorDeliverables: ['创意方向说明', '工具链选择', '报价明细', '修改轮次声明'],
    clientConfirmItems: ['方案选定', '首付款节点确认', '联系人确认'],
    riskNote: '方案未存档时报价变更难以追溯。',
    triggerPayment: true,
  },
  {
    index: 3,
    title: '脚本 / 分镜确认',
    goal: '确认叙事结构、镜头逻辑和关键画面，防止视频生成后才发现方向偏差。',
    creatorDeliverables: ['剧情结构文档', '分镜草稿', '关键画面说明', '节奏与时长规划'],
    clientConfirmItems: ['故事线确认', '重点镜头确认', '品牌要求核对'],
    riskNote: '跳过此阶段直接生成视频，返工成本最高。',
  },
  {
    index: 4,
    title: '风格样片',
    goal: '用 2–3 个镜头验证视觉方向，在小规模生成阶段对齐风格。',
    creatorDeliverables: ['样片视频（低清/水印）', '模型选择说明', '画面比例确认', '风格标签'],
    clientConfirmItems: ['风格通过 / 调整', '模型 provider 授权确认', '色调与氛围确认'],
    riskNote: '样片阶段的风格分歧比终版更容易纠正。',
  },
  {
    index: 5,
    title: '第一版交付',
    goal: '完整初版视频提交，进入第一轮正式修改周期。',
    creatorDeliverables: ['完整初版视频', '素材清单', '初版剪辑说明', '待反馈项列表'],
    clientConfirmItems: ['整体方向确认', '修改需求书面提交', '是否占用修改轮次确认'],
    riskNote: '口头修改需求未记录是最常见的争议触发点。',
    triggerPayment: false,
  },
  {
    index: 6,
    title: '修改版交付',
    goal: '根据书面反馈提交修改版，逐轮记录修改对照。',
    creatorDeliverables: ['修改版视频', '修改对照说明', '剩余问题列表', '剩余修改轮次说明'],
    clientConfirmItems: ['修改是否满足要求', '是否需要下一轮修改', '当前已用轮次确认'],
    riskNote: '修改超出约定轮次应书面确认加收费用。',
  },
  {
    index: 7,
    title: '最终交付',
    goal: '终版文件全套交付，含所有约定格式与发布版本。',
    creatorDeliverables: ['终版视频（4K/1080p）', '封面图', '字幕/配音版本', '多平台发布格式'],
    clientConfirmItems: ['文件格式与规格确认', '内容质量确认', '支付尾款节点确认'],
    riskNote: '终版确认后应立即完成支付，避免拖欠。',
    triggerPayment: true,
  },
  {
    index: 8,
    title: '授权与归档',
    goal: '完成版权转移、授权文件交付和项目归档，关闭项目。',
    creatorDeliverables: ['素材来源清单', '音乐/字体授权文件', '模型 provider 条款说明', '商用范围声明'],
    clientConfirmItems: ['版权转移确认', '授权范围确认', '归档完成确认'],
    riskNote: '授权文件缺失是影视内容商业使用的最大法律风险。',
  },
]

export type BoardStageStatus = 'done' | 'active' | 'pending'

export type BoardStage = {
  index: number
  title: string
  status: BoardStageStatus
  completedAt?: string
  estimatedAt?: string
}

export const MOCK_PROJECT_BOARD = {
  title: '三国题材短剧预告',
  budgetMin: 12000,
  budgetMax: 35000,
  durationDays: '10–14 天',
  creatorName: 'Nova 导演室',
  clientCode: '八位像素 · 内部编号 SJ-042',
  stages: [
    { index: 1, title: '需求确认', status: 'done', completedAt: '5月18日' },
    { index: 2, title: '方案确认', status: 'done', completedAt: '5月20日' },
    { index: 3, title: '脚本 / 分镜', status: 'done', completedAt: '5月22日' },
    { index: 4, title: '风格样片', status: 'active', estimatedAt: '5月25日' },
    { index: 5, title: '第一版交付', status: 'pending', estimatedAt: '5月28日' },
    { index: 6, title: '修改版', status: 'pending', estimatedAt: '5月30日' },
    { index: 7, title: '最终交付', status: 'pending', estimatedAt: '6月1日' },
    { index: 8, title: '授权归档', status: 'pending', estimatedAt: '6月2日' },
  ] as BoardStage[],
}

export const DELIVERY_CHECKLISTS: Array<{ stage: string; items: string[] }> = [
  {
    stage: '需求确认',
    items: ['结构化 brief', '参考风格与链接', '预算与周期', '商业授权要求'],
  },
  {
    stage: '方案确认',
    items: ['创意方向说明', '报价明细', '修改轮次', '风险边界'],
  },
  {
    stage: '脚本 / 分镜',
    items: ['剧情结构', '镜头拆解', '节奏说明', '关键画面说明'],
  },
  {
    stage: '风格样片',
    items: ['视觉风格样例', '模型/API 选择说明', '画面比例与风格标签', '低清/水印预览'],
  },
  {
    stage: '第一版交付',
    items: ['视频预览', '素材清单', '初版剪辑', '待反馈项'],
  },
  {
    stage: '修改版交付',
    items: ['修改记录', '对照说明', '剩余问题', '下一步确认'],
  },
  {
    stage: '最终交付',
    items: ['终版视频文件', '封面图', '字幕/声音版本', '发布格式'],
  },
  {
    stage: '授权归档',
    items: ['素材来源', '音乐/字体授权', '模型 provider 条款', '商用范围说明'],
  },
]

export const ACCEPTANCE_FLOW: Array<{ step: number; icon: string; title: string; description: string; note?: string }> = [
  { step: 1, icon: '📦', title: '查看阶段交付物', description: '项目方在平台查看创作者上传的阶段成果，含视频预览、文件清单和说明文档。' },
  { step: 2, icon: '📋', title: '对照 brief 和方案', description: '对比本阶段约定的交付内容与实际提交的成果，确认是否符合。' },
  { step: 3, icon: '✅', title: '标记通过 / 需修改 / 暂缓', description: '每个交付项逐一标记状态，明确哪些通过、哪些需要修改。' },
  { step: 4, icon: '💬', title: '填写反馈', description: '以书面形式提交修改意见，防止口头沟通失真；平台自动打时间戳留痕。' },
  { step: 5, icon: '🔢', title: '确认是否占用修改轮次', description: '项目方确认本次反馈是否消耗免费修改次数，超出部分需书面同意加收。' },
  { step: 6, icon: '🔄', title: '创作者提交修改版', description: '创作者根据书面反馈提交修改成果，并附上修改对照说明。' },
  { step: 7, icon: '📁', title: '最终归档', description: '验收通过后，平台生成阶段凭证记录，双方确认后项目进入下一阶段或关闭。', note: '当前不保存反馈，不提交验收' },
]

export const CREATOR_WORKFLOW: Array<{ icon: string; title: string; description: string }> = [
  { icon: '⬆️', title: '上传阶段成果', description: '按阶段清单逐项上传视频、图片、文档等交付物。' },
  { icon: '📝', title: '标注交付范围', description: '说明本次交付包含什么、不包含什么，防止验收范围争议。' },
  { icon: '🤖', title: '标注使用工具/API', description: '列明本阶段使用的 AI 模型、生成平台和后期工具，便于项目方了解成本结构。' },
  { icon: '🖼️', title: '标注素材来源', description: '说明所用图库素材、音乐、字体的授权来源，为最终授权归档做准备。' },
  { icon: '⚠️', title: '标注风险和未完成项', description: '主动说明本阶段存在的风险或因等待项目方素材而未完成的部分。' },
  { icon: '💬', title: '回复项目方反馈', description: '书面回应每条修改意见，确认是否在约定范围内，超出时说明加收标准。' },
  { icon: '🔄', title: '提交修改版', description: '完成修改后重新上传，并附修改对照说明文档。' },
  { icon: '🔔', title: '请求阶段确认', description: '提交完成后发起阶段确认请求，等待项目方书面通过。' },
]

export const STATUS_CHIPS: Array<{ label: string; color: string; description: string }> = [
  { label: '未开始', color: '#52525b', description: '该阶段尚未启动，等待前置阶段完成。' },
  { label: '进行中', color: '#a78bfa', description: '创作者正在完成本阶段交付物。' },
  { label: '待项目方确认', color: '#f59e0b', description: '创作者已提交，等待项目方审查和反馈。' },
  { label: '需修改', color: '#ef4444', description: '项目方已提交修改意见，创作者需响应。' },
  { label: '已通过', color: '#22c55e', description: '项目方已确认本阶段交付达标。' },
  { label: '已归档', color: '#0e7490', description: '阶段完成并存档，凭证已生成。' },
  { label: '已暂停', color: '#78716c', description: '项目因外部原因暂停，当前阶段冻结。' },
  { label: '有风险', color: '#dc2626', description: '当前阶段存在超期或交付风险，需要双方关注。' },
]

export const PROOF_TRAIL_FIELDS: string[] = [
  '阶段提交时间（平台时间戳）',
  '提交人（创作者身份）',
  '文件清单（文件名 + Hash）',
  '预览链接（有效期内）',
  '项目方反馈记录（含时间）',
  '修改轮次累计',
  '授权说明文档',
  '验收结果（通过 / 需修改）',
  '争议备注（如有）',
  '最终归档记录',
]

export const RISKS_AND_BOUNDARIES: Array<{ title: string; content: string; level: 'warning' | 'info' }> = [
  { title: '当前不是正式阶段交付系统', content: '本页面为静态预览，不支持真实文件提交、不保存验收记录、不创建订单。', level: 'warning' },
  { title: '不提交真实文件', content: '页面内所有阶段状态均为 Mock 数据，不代表真实项目、真实创作者或真实交付记录。', level: 'warning' },
  { title: '不接支付、不做托管', content: '当前无法触发付款释放、里程碑结算，所有支付节点为规划中功能。', level: 'warning' },
  { title: '商业项目必须核查授权', content: '正式上线后，所有交付物中涉及音乐、字体、肖像权、AI 模型授权的内容均需创作者提供证明文件，平台不承担因授权缺失引发的法律责任。', level: 'info' },
  { title: '平台抽佣、托管、退款需正式协议', content: '里程碑触发的付款节点、退款规则和争议处理条款需经法务审核后在平台服务协议中明确，当前展示内容仅为规划参考。', level: 'info' },
  { title: '不展示真实项目或客户数据', content: '平台上线前，预览页不展示任何真实注册用户的项目进度、交付记录或验收结果。', level: 'info' },
]

export type RoadmapStage = {
  stage: number
  title: string
  description: string
  status: 'done' | 'active' | 'planned'
  quarter: string
}

export const ROADMAP: RoadmapStage[] = [
  { stage: 1, title: 'Preview', description: '静态阶段交付页（当前）', status: 'active', quarter: '2026 Q2' },
  { stage: 2, title: 'Milestone Template', description: '可自定义阶段数量和交付清单的里程碑模板', status: 'planned', quarter: '2026 Q3' },
  { stage: 3, title: 'Delivery Upload', description: '创作者可上传阶段成果文件与说明', status: 'planned', quarter: '2026 Q3' },
  { stage: 4, title: 'Acceptance Flow', description: '项目方在线审查、反馈和确认阶段交付', status: 'planned', quarter: '2026 Q3' },
  { stage: 5, title: 'Revision Tracker', description: '自动统计修改轮次、留存修改记录', status: 'planned', quarter: '2026 Q4' },
  { stage: 6, title: 'Proof Archive', description: '每个阶段生成不可篡改的交付凭证', status: 'planned', quarter: '2026 Q4' },
  { stage: 7, title: 'Escrow Release', description: '里程碑验收通过后自动释放对应托管款', status: 'planned', quarter: '2027 Q1' },
  { stage: 8, title: 'Dispute Evidence', description: '生成结构化争议证据包供仲裁使用', status: 'planned', quarter: '2027 Q1' },
  { stage: 9, title: 'Reputation Update', description: '项目完成后自动更新双方信誉分', status: 'planned', quarter: '2027 Q2' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者市场预览', href: '/marketplace-preview', description: '了解整体创作者市场规划' },
  { label: '创作者主页预览', href: '/creator-profile-preview', description: '查看创作者如何展示作品集' },
  { label: '需求广场预览', href: '/demand-board-preview', description: '查看项目方如何发布需求' },
  { label: '报价与方案流程', href: '/proposal-flow-preview', description: '查看创作者如何提交方案' },
  { label: '托管与结算预览', href: '/escrow-preview', description: '阶段验收后如何进入托管、释放款和争议边界' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '生成任务', href: '/tasks', description: '查看 AI 生成任务状态' },
  { label: '社区', href: '/community', description: '与创作者交流' },
  { label: '定价预览', href: '/pricing-preview', description: '了解平台收费计划' },
  { label: '协议版权', href: '/terms-preview', description: '服务条款与版权说明' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
