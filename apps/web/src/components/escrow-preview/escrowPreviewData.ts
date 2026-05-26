// No POST, no PUT, no DELETE. Static data only. Not connected to navigation.
// All amounts, orders, escrow accounts and settlements are mock/preview only. No real payments, orders, or DB writes.

export const HERO = {
  title: 'Creator City 托管与结算预览',
  tagline: '让创作交易从报价、托管、阶段验收到最终结算都可解释、可确认、可追溯。',
  statusChips: [
    { label: '静态预览', color: '#a78bfa' },
    { label: 'Mock 结算', color: '#6b7280' },
    { label: '不接支付', color: '#f59e0b' },
    { label: '不创建订单', color: '#f59e0b' },
    { label: '不收款', color: '#ef4444' },
    { label: '不打款', color: '#ef4444' },
    { label: '不写数据库', color: '#6b7280' },
    { label: '不触发生成', color: '#6b7280' },
  ],
  ctas: [
    { label: '查看托管流程', anchor: '#escrow-flow' },
    { label: '查看抽佣模型', anchor: '#commission-model' },
  ],
}

export const REASONS: Array<{ icon: string; title: string; description: string }> = [
  { icon: '🔒', title: '项目方担心付款后无法交付', description: '在没有托管机制的情况下，项目方一次性转账后，如果创作者中途断联或质量不达标，资金难以追回。' },
  { icon: '💸', title: '创作者担心交付后无法收款', description: '创作者完成交付后，如果项目方拖款或失联，劳动成果无法获得合理回报。' },
  { icon: '📊', title: '阶段付款可以降低双方风险', description: '把项目拆成若干阶段，每阶段验收后释放对应款项，双方风险分散、目标对齐。' },
  { icon: '📋', title: '平台需要清晰说明 30% 抽佣边界', description: '平台服务费收取比例、计算方式、扣除时机必须在交易前向双方明确，不能在结算时才告知。' },
  { icon: '⚖️', title: '退款、修改、争议需要规则支撑', description: '修改轮次超出约定、风格方向偏差、延期等情形需要预先约定处理规则，而不是事后协商。' },
  { icon: '🗂️', title: '商业项目需要合同、发票、授权和凭证留痕', description: '品牌广告、影视版权、KOL 合作等场景需要完整书面记录，支撑日后版权交割、财税合规和法律举证。' },
]

export type EscrowStep = {
  index: number
  title: string
  description: string
  note?: string
}

export const ESCROW_FLOW: EscrowStep[] = [
  { index: 1, title: '项目方确认报价', description: '双方在平台内确认项目范围、交付物、时间节点和总金额。', note: undefined },
  { index: 2, title: '双方确认里程碑', description: '将项目拆解为若干阶段，明确每阶段的交付物、验收标准和对应金额比例。' },
  { index: 3, title: '项目方未来支付至托管账户', description: '（规划中）项目方将款项打入平台托管账户，创作者不能直接提取，需经阶段验收触发释放。', note: '当前不接真实支付，不创建托管账户，不处理真实资金。' },
  { index: 4, title: '创作者开始阶段交付', description: '按里程碑节点完成创作，通过平台提交阶段成果。' },
  { index: 5, title: '项目方验收阶段成果', description: '项目方对照阶段 brief 验收，确认通过或提出有据可查的修改意见。' },
  { index: 6, title: '平台未来按规则释放阶段款', description: '（规划中）阶段验收通过后，平台按协议扣除服务费，将剩余款项释放给创作者。', note: '当前不接真实支付，不创建托管账户，不处理真实资金。' },
  { index: 7, title: '最终交付后完成结算', description: '所有阶段完成、最终成果验收通过后，结算归档。' },
  { index: 8, title: '平台生成结算与凭证记录', description: '（规划中）平台自动生成阶段释放记录、服务费凭证、最终结算单，供双方下载留存。', note: '当前不接真实支付，不创建托管账户，不处理真实资金。' },
]

export const COMMISSION_MODEL = {
  exampleAmount: 10000,
  platformFee: 0.3,
  rows: [
    { label: '成交金额（示例）', value: '¥10,000', highlight: false },
    { label: '平台服务费（30%）', value: '¥3,000', highlight: false, note: '服务费比例仅为商业模型预览，正式上线前以服务协议为准。' },
    { label: '创作者收入（70%）', value: '¥7,000', highlight: true },
    { label: 'API / 模型成本', value: '按协议另定', highlight: false, note: '由创作者或项目方按实际使用量协议承担，暂不含在服务费内。' },
    { label: '税费 / 发票', value: '未来按地区与主体处理', highlight: false },
    { label: '退款 / 争议扣款', value: '按正式协议处理', highlight: false },
  ],
  disclaimer: '以上均为示例，不是实际结算。全部使用人民币（RMB）。不出现美元。不触发计算逻辑。',
}

export type StagedReleaseStage = {
  index: number
  name: string
  ratio: number
  amount: number
}

export const STAGED_RELEASE_EXAMPLE = {
  projectName: '品牌新品 15 秒广告片',
  totalAmount: 20000,
  platformFeeRate: 0.3,
  stages: [
    { index: 1, name: '需求确认', ratio: 0.10, amount: 2000 },
    { index: 2, name: '方案确认', ratio: 0.20, amount: 4000 },
    { index: 3, name: '风格样片', ratio: 0.20, amount: 4000 },
    { index: 4, name: '第一版交付', ratio: 0.25, amount: 5000 },
    { index: 5, name: '最终交付', ratio: 0.25, amount: 5000 },
  ] as StagedReleaseStage[],
  platformFeeNote: '平台服务费从每次释放款中按 30% 扣除，或在最终结算时统一扣除。当前仅为规则预览，未来需正式协议确认。',
}

export type SettlementStatusChip = {
  label: string
  color: string
  bg: string
}

export const SETTLEMENT_STATUSES: SettlementStatusChip[] = [
  { label: '待托管', color: '#71717a', bg: '#27272a' },
  { label: '已托管', color: '#60a5fa', bg: '#1e3a5f' },
  { label: '阶段待验收', color: '#fb923c', bg: '#431407' },
  { label: '阶段已通过', color: '#4ade80', bg: '#14532d' },
  { label: '待释放', color: '#a78bfa', bg: '#2e1065' },
  { label: '已释放', color: '#22c55e', bg: '#14532d' },
  { label: '退款审核中', color: '#fbbf24', bg: '#451a03' },
  { label: '争议处理中', color: '#f87171', bg: '#450a0a' },
  { label: '已结算', color: '#6ee7b7', bg: '#064e3b' },
  { label: '已归档', color: '#a1a1aa', bg: '#18181b' },
]

export const PROJECT_OWNER_PROTECTIONS: Array<{ icon: string; title: string; description: string }> = [
  { icon: '📌', title: '付款前明确范围', description: '在确认托管前锁定交付物、时间、修改轮次和格式要求。' },
  { icon: '🗓️', title: '付款前确认阶段', description: '逐阶段确认里程碑节点，对每个阶段的期望做书面确认。' },
  { icon: '✅', title: '阶段验收后释放款', description: '款项按阶段验收结果释放，不一次性全额转账给创作者。' },
  { icon: '📝', title: '可记录修改意见', description: '每轮修改意见留存平台记录，不因口头沟通丢失上下文。' },
  { icon: '🗂️', title: '可保留交付凭证', description: '每次阶段交付有记录、时间戳和文件存证。' },
  { icon: '⚖️', title: '可发起争议', description: '当阶段成果与 brief 明显不符时，可通过平台发起争议处理流程。' },
  { icon: '©️', title: '可要求授权说明', description: '最终结算时要求创作者提供素材版权、音乐、字体和 AI 模型授权说明。' },
  { icon: '📋', title: '可确认最终交付清单', description: '最终归档前按 brief 逐项核对，确保无遗漏。' },
]

export const CREATOR_PROTECTIONS: Array<{ icon: string; title: string; description: string }> = [
  { icon: '📝', title: '报价确认后再开工', description: '方案和金额得到书面确认后才开始创作，不因口头承诺陷入被动。' },
  { icon: '📸', title: '阶段成果有验收记录', description: '每个阶段提交都有时间戳和内容留存，项目方无法否认已完成的工作。' },
  { icon: '🔄', title: '修改轮次可被记录', description: '约定外的修改请求被记录，可作为后续谈判或额外计费的依据。' },
  { icon: '💰', title: '已确认阶段可申请释放款', description: '阶段验收通过后，款项按约定时间释放，不需要追款。' },
  { icon: '🗒️', title: '项目方反馈留痕', description: '每条修改意见和验收反馈都保存在平台，防止事后无凭据争议。' },
  { icon: '©️', title: '授权边界明确', description: '合同中明确授权范围，超出范围的使用方式创作者可拒绝或重新定价。' },
  { icon: '⚖️', title: '争议时有证据包', description: '平台保留的沟通记录、文件版本和时间戳构成争议证据包。' },
  { icon: '📊', title: '收入与平台服务费可解释', description: '结算单清晰列出总金额、服务费比例和最终到账金额，没有隐藏扣款。' },
]

export type DisputeScenario = {
  scenario: string
  note: string
}

export const REFUND_AND_DISPUTE_SCENARIOS: DisputeScenario[] = [
  { scenario: '项目方未提供素材', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '创作者未按阶段交付', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '风格方向争议', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '修改轮次超出约定', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '授权文件缺失', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '交付格式不符合 brief', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '项目暂停', note: '当前只是规则预览，未来需正式服务协议支持。' },
  { scenario: '不可抗力延期', note: '当前只是规则预览，未来需正式服务协议支持。' },
]

export const PROOF_ARCHIVE: string[] = [
  '报价确认记录',
  '里程碑确认记录',
  '托管状态',
  '阶段验收记录',
  '释放款记录',
  '退款申请',
  '争议证据包',
  '授权文件',
  '发票 / 税务说明',
  '最终归档',
]

export type RiskItem = {
  title: string
  content: string
  level: 'info' | 'warning'
}

export const RISKS_AND_BOUNDARIES: RiskItem[] = [
  { title: '当前不是正式支付系统', content: '本页面为静态预览，不接入任何支付能力。', level: 'warning' },
  { title: '不接入 Stripe / 支付宝 / 微信支付 / 银行卡 / 加密货币', content: '当前不集成任何第三方支付 SDK，不处理真实资金流转。', level: 'warning' },
  { title: '不创建订单 / 不创建托管账户', content: '所有数字均为 mock 示例，不写入数据库，不创建任何账户或订单记录。', level: 'warning' },
  { title: '不收款 / 不打款 / 不处理退款', content: '本预览页不触发任何资金流动，包括收款、打款、退款和争议扣款。', level: 'warning' },
  { title: '平台 30% 抽佣只是商业模型预览', content: '抽佣比例、计算方式和扣除时机尚未在服务协议中确认，正式上线前会明确告知双方。', level: 'info' },
  { title: '正式上线前必须完成合规工作', content: '包括：服务协议、隐私政策、支付合规、税务合规、争议规则、退款规则。', level: 'info' },
  { title: '商业项目必须确认版权合规', content: '包括：素材版权、肖像权、音乐、字体、AI 模型 provider 授权等，不在本平台结算范围内处理。', level: 'info' },
]

export type RoadmapStage = {
  stage: number
  title: string
  description: string
  status: 'done' | 'active' | 'planned'
  quarter: string
}

export const ROADMAP: RoadmapStage[] = [
  { stage: 1, title: 'Preview', description: '静态托管与结算预览页', status: 'active', quarter: '2026 Q2' },
  { stage: 2, title: 'Escrow Rule Builder', description: '托管规则配置界面', status: 'planned', quarter: '2026 Q3' },
  { stage: 3, title: 'Payment Provider Review', description: '支付服务商评估与接入调研', status: 'planned', quarter: '2026 Q3' },
  { stage: 4, title: 'Milestone Release', description: '阶段验收后自动释放款', status: 'planned', quarter: '2026 Q4' },
  { stage: 5, title: 'Refund Flow', description: '退款申请与审核流程', status: 'planned', quarter: '2026 Q4' },
  { stage: 6, title: 'Dispute Evidence', description: '争议证据包自动归集', status: 'planned', quarter: '2027 Q1' },
  { stage: 7, title: 'Invoice & Tax', description: '发票申请与税务信息管理', status: 'planned', quarter: '2027 Q1' },
  { stage: 8, title: 'Creator Wallet', description: '创作者收入钱包与提现', status: 'planned', quarter: '2027 Q2' },
  { stage: 9, title: 'Enterprise Billing', description: '企业客户对公结算与批量合同', status: 'planned', quarter: '2027 Q2' },
]

export const QUICK_LINKS: Array<{ label: string; href: string; description: string }> = [
  { label: '创作者市场预览', href: '/marketplace-preview', description: '了解整体创作者市场规划' },
  { label: '创作者主页预览', href: '/creator-profile-preview', description: '查看创作者如何展示作品集' },
  { label: '需求广场预览', href: '/demand-board-preview', description: '查看项目方如何发布需求' },
  { label: '报价与方案预览', href: '/proposal-flow-preview', description: '了解报价与方案流程' },
  { label: '阶段交付预览', href: '/milestone-delivery-preview', description: '查看项目如何拆解为里程碑' },
  { label: '项目中心', href: '/projects', description: '管理我的项目' },
  { label: '生成任务', href: '/tasks', description: '查看 AI 生成任务状态' },
  { label: '社区', href: '/community', description: '与创作者交流' },
  { label: '定价预览', href: '/pricing-preview', description: '了解平台收费计划' },
  { label: '协议版权', href: '/terms-preview', description: '服务条款与版权说明' },
  { label: '诊断帮助', href: '/help', description: '遇到问题？找帮助' },
]
