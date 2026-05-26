// No POST, no PUT, no DELETE. Static data only. Not connected to generation.

export const HERO = {
  title: '阶段交付',
  tagline: '把一次创作合作拆成需求确认、风格确认、初版交付、修改验收与最终交付，让项目方和创作者在每个节点都有清晰边界。',
  statusChips: [
    { label: '节点验收', color: '#0891b2' },
    { label: '交付物清单', color: '#7c3aed' },
    { label: '修改边界', color: '#d97706' },
    { label: '版本记录', color: '#16a34a' },
    { label: '风险提示', color: '#dc2626' },
    { label: '托管结算', color: '#6366f1' },
  ],
}

export type DeliveryStage = {
  index: number
  title: string
  goal: string
  deliverables: string[]
  acceptanceItems: string[]
  riskNote: string
  triggerPayment?: boolean
}

export const DELIVERY_STAGES: DeliveryStage[] = [
  {
    index: 1,
    title: '需求确认',
    goal: '双方就 Brief 最终版本达成一致，明确预算上限、交付格式与商业授权范围后正式启动。',
    deliverables: ['理解确认函', '疑问清单', '初步可行性评估'],
    acceptanceItems: ['Brief 最终版本', '预算与周期锁定', '商业授权类型'],
    riskNote: '此阶段未确认即开工是项目争议最主要来源。',
  },
  {
    index: 2,
    title: '风格确认',
    goal: '交付 2–3 个镜头样片，验证视觉方向、色调与氛围，在小规模生成阶段对齐风格。',
    deliverables: ['样片视频（低清/水印预览）', '模型选择说明', '色调与氛围参考'],
    acceptanceItems: ['风格方向通过', '模型授权确认', '色调与氛围确认'],
    riskNote: '跳过风格确认直接全量生成，返工成本最高。',
  },
  {
    index: 3,
    title: '初版交付',
    goal: '完整初版视频提交，进入第一轮正式修改周期，书面记录待反馈项。',
    deliverables: ['完整初版视频', '素材使用清单', '待反馈项列表'],
    acceptanceItems: ['整体方向确认', '修改意见书面提交', '是否占用修改轮次'],
    riskNote: '口头修改需求未留痕是最常见的争议触发点。',
    triggerPayment: false,
  },
  {
    index: 4,
    title: '修改回合',
    goal: '根据书面反馈逐轮提交修改版，超出约定轮次前书面确认是否加收。',
    deliverables: ['修改版视频', '修改对照说明', '剩余修改轮次说明'],
    acceptanceItems: ['修改是否满足要求', '当前已用轮次确认', '是否需要下一轮'],
    riskNote: '超出修改轮次应书面同意后方可继续，否则加收费用。',
  },
  {
    index: 5,
    title: '最终交付',
    goal: '终版全套文件交付，含所有约定格式与发布版本，触发尾款结算节点。',
    deliverables: ['终版视频（4K/1080p）', '字幕/配音版本', '多平台发布格式', '封面图'],
    acceptanceItems: ['文件规格确认', '内容质量确认', '支付尾款节点确认'],
    riskNote: '终版确认后应立即完成支付，避免拖欠。',
    triggerPayment: true,
  },
  {
    index: 6,
    title: '结算准备',
    goal: '完成版权转移、授权文件交付与项目归档，进入托管结算流程。',
    deliverables: ['素材来源清单', '音乐/字体授权文件', 'AI 模型 provider 条款说明', '商用范围声明'],
    acceptanceItems: ['授权范围确认', '版权转移确认', '归档完成确认'],
    riskNote: '授权文件缺失是影视内容商业使用最大的法律风险。',
    triggerPayment: true,
  },
]

export type DeliverableType = {
  icon: string
  label: string
  description: string
}

export const DELIVERABLE_TYPES: DeliverableType[] = [
  { icon: '📋', label: '分镜脚本', description: '叙事结构、镜头逻辑与关键画面说明文档' },
  { icon: '🎨', label: '视觉参考板', description: '风格样例、色调参考、氛围标签集合' },
  { icon: '🖼️', label: '静帧图', description: '关键画面静帧图，PNG 或 PSD 格式' },
  { icon: '🎬', label: '视频初版', description: '带水印低清预览，用于方向确认' },
  { icon: '📝', label: '修改说明', description: '逐条对照项目方反馈的修改说明文档' },
  { icon: '📦', label: '最终文件', description: '全套终版文件，含 4K、1080p、多格式' },
  { icon: '⚖️', label: '授权声明', description: '版权归属、模型授权、商业使用范围文件' },
  { icon: '✅', label: '验收记录', description: '每阶段验收结果与时间戳存档凭证' },
]

export type AcceptanceBoundary = {
  icon: string
  title: string
  description: string
  tip: string
}

export const ACCEPTANCE_BOUNDARIES: AcceptanceBoundary[] = [
  {
    icon: '🔄',
    title: '修改轮次',
    description: '免费修改次数在报价方案阶段约定，超出部分以书面形式确认后按次计费。',
    tip: '超出轮次需书面同意，不可口头要求继续修改',
  },
  {
    icon: '✅',
    title: '验收标准',
    description: '按 Brief 字段与方案说明逐项对照验收，达标项书面确认，未达标项书面提出修改意见。',
    tip: '验收依据是 Brief + 方案，不是主观感受',
  },
  {
    icon: '📁',
    title: '版本记录',
    description: '每次修改提交均生成平台时间戳记录，修改意见以书面形式提交并留存，防止口头沟通失真。',
    tip: '所有沟通留痕，避免"我没说要改这个"',
  },
  {
    icon: '🛡️',
    title: '风险升级',
    description: '当双方对验收结果产生争议时，进入托管结算争议流程，由平台凭交付凭证进行仲裁。',
    tip: '争议处理依据：交付凭证 + 书面沟通记录',
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
  { index: 2, label: '创作者主页', href: '/creator-profile-preview' },
  { index: 3, label: '需求广场', href: '/demand-board-preview' },
  { index: 4, label: '报价方案', href: '/proposal-flow-preview' },
  { index: 5, label: '阶段交付', href: '/milestone-delivery-preview', current: true },
  { index: 6, label: '托管结算', href: '/escrow-preview' },
]
