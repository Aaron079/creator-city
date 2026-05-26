// No POST, no PUT, no DELETE. Static data only. Not connected to generation.

export const HERO = {
  title: '托管结算',
  tagline: '把项目预算、阶段验收、交付确认与争议保护放进同一套规则中，让项目方和创作者都能在明确边界下合作。',
  statusChips: [
    { label: '资金托管', color: '#6366f1' },
    { label: '阶段验收', color: '#0891b2' },
    { label: '结算规则', color: '#16a34a' },
    { label: '争议保护', color: '#dc2626' },
    { label: '退款边界', color: '#d97706' },
    { label: '平台记录', color: '#7c3aed' },
  ],
}

export type EscrowFlowNode = {
  index: number
  title: string
  forOwner: string
  forCreator: string
  boundary: string
}

export const ESCROW_FLOW_NODES: EscrowFlowNode[] = [
  {
    index: 1,
    title: '项目预算确认',
    forOwner: '付款前明确总预算与分期比例，不一次性转账',
    forCreator: '开工前确认金额与阶段占比，不凭口头承诺',
    boundary: '预算锁定后方可进入托管流程，中途变更需双方书面确认',
  },
  {
    index: 2,
    title: '阶段费用拆分',
    forOwner: '按阶段验收结果逐步释放款项，不提前一次性打款',
    forCreator: '每个阶段的收款节点在方案中明确，不追款',
    boundary: '每阶段占比在报价方案中约定，不可单方面变更',
  },
  {
    index: 3,
    title: '节点交付验收',
    forOwner: '按 Brief 与方案书面验收，有据可查，不靠主观感受',
    forCreator: '交付有时间戳记录，项目方无法否认已完成的工作',
    boundary: '验收依据是 Brief + 方案，超出约定的修改需书面同意',
  },
  {
    index: 4,
    title: '确认后释放结算',
    forOwner: '验收通过后款项释放，不需要额外催款操作',
    forCreator: '已通过阶段款项按约定节点到账，不被无故冻结',
    boundary: '款项释放仅发生在验收明确通过后，争议期不释放',
  },
  {
    index: 5,
    title: '争议进入保护',
    forOwner: '当交付与 Brief 明显不符时，可通过平台进入争议流程',
    forCreator: '平台保留的沟通记录与交付凭证构成争议证据包',
    boundary: '争议处理依据：书面沟通记录 + 交付凭证，不接口头说明',
  },
  {
    index: 6,
    title: '完成合作记录',
    forOwner: '项目完成后生成交付记录、授权文件与结算凭证',
    forCreator: '按时交付率与评价自动沉淀为市场信用，提升竞争力',
    boundary: '授权文件缺失不影响结算，但影响后续商用与版权追溯',
  },
]

export type PartyRight = {
  icon: string
  title: string
  description: string
}

export type PartyRights = {
  party: string
  color: string
  items: PartyRight[]
}

export const PARTY_RIGHTS: PartyRights[] = [
  {
    party: '项目方权益',
    color: '#818cf8',
    items: [
      { icon: '📌', title: '预算边界', description: '付款前锁定总预算与阶段比例，款项按验收结果分期释放，不一次性转账' },
      { icon: '✅', title: '验收节点', description: '每个阶段按 Brief 与方案书面验收，有据可查，不靠主观感受' },
      { icon: '🗂️', title: '交付记录', description: '每次阶段交付有时间戳与文件存证，不因口头沟通丢失上下文' },
      { icon: '⚖️', title: '争议保护', description: '当交付与 Brief 明显不符时，可通过平台进入争议流程，凭证据处理' },
    ],
  },
  {
    party: '创作者权益',
    color: '#4ade80',
    items: [
      { icon: '💰', title: '阶段收款', description: '已确认阶段款项按约定节点释放，不追款、不等拖款' },
      { icon: '🔄', title: '修改边界', description: '约定外的修改请求被记录，可作为额外计费依据，不被无限返工' },
      { icon: '📄', title: '交付凭证', description: '每阶段提交有时间戳记录，项目方无法否认已完成的工作' },
      { icon: '📈', title: '信用沉淀', description: '按时交付率、复购率与评价自动沉淀为创作者市场竞争力' },
    ],
  },
]

export type DisputeMechanism = {
  icon: string
  title: string
  description: string
  resolution: string
}

export const DISPUTE_MECHANISMS: DisputeMechanism[] = [
  {
    icon: '📋',
    title: '需求不清',
    description: '当项目方提出的修改意见与原 Brief 存在明显偏差时，双方可回到需求阶段重新澄清范围。',
    resolution: '回到 Brief 澄清，书面补充需求说明',
  },
  {
    icon: '🔄',
    title: '修改超范围',
    description: '当修改请求超出约定轮次或范围时，需书面确认是否加收费用后方可继续，不能口头要求继续修改。',
    resolution: '回到报价边界，书面确认后方可继续',
  },
  {
    icon: '🗂️',
    title: '阶段验收争议',
    description: '当项目方认为阶段成果不达标，创作者认为已满足 Brief 要求时，以书面交付记录与 Brief 为准进行核查。',
    resolution: '查看交付记录与 Brief，书面对照核查',
  },
  {
    icon: '⚖️',
    title: '结算争议',
    description: '当双方对结算金额、服务费或释放时机存在争议时，进入平台规则说明，以服务协议约定为准。',
    resolution: '进入平台规则说明，以服务协议约定为准',
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
  { index: 5, label: '阶段交付', href: '/milestone-delivery-preview' },
  { index: 6, label: '托管结算', href: '/escrow-preview', current: true },
]
