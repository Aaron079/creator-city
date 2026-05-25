// /enterprise-preview — Static enterprise version preview data
// Pure TypeScript data. No API calls, no DB, no generation triggers.
// No payment, no order creation, no enterprise account creation. Preview only.

export interface TargetCustomer {
  id: string
  letter: string
  name: string
  subtitle: string
  useCases: string[]
}

export interface EnterpriseCapability {
  name: string
  description: string
  status: '规划中' | '企业版预览'
}

export interface WorkflowStep {
  step: number
  role: string
  action: string
  detail: string
}

export interface PermissionRole {
  role: string
  subtitle: string
  canView: boolean
  canEdit: boolean
  canGenerate: boolean
  canManageMembers: boolean
  canExport: boolean
  canViewCost: boolean
}

export interface SecurityItem {
  icon: string
  title: string
  detail: string
}

export interface EnterprisePlan {
  id: string
  name: string
  subtitle: string
  audience: string
  features: string[]
  cta: string
  highlighted: boolean
}

export interface ValuePoint {
  icon: string
  title: string
  body: string
}

export interface OnboardingStep {
  step: number
  label: string
  detail: string
}

export interface RiskBoundary {
  item: string
}

export interface QuickLink {
  label: string
  href: string
}

// ── Target customers ──────────────────────────────────────────────────────────

export const targetCustomers: TargetCustomer[] = [
  {
    id: 'film',
    letter: 'A',
    name: '影视制作公司',
    subtitle: 'Film & TV Production',
    useCases: ['长片、剧集前期开发', '宣发视觉概念生产', '概念分镜与视觉开发', '项目资产沉淀与复用'],
  },
  {
    id: 'advertising',
    letter: 'B',
    name: '广告公司',
    subtitle: 'Advertising Agency',
    useCases: ['品牌片、TVC 分镜预览', '产品视觉与提案样片', '多轮提案快速迭代', '客户提案视觉增强'],
  },
  {
    id: 'mcn',
    letter: 'C',
    name: 'MCN / 内容机构',
    subtitle: 'MCN & Content Studio',
    useCases: ['多账号内容批量生产', '素材库统一管理', '团队协作与任务分配', '平台内容规模化'],
  },
  {
    id: 'short-drama',
    letter: 'D',
    name: '短剧 / 漫剧团队',
    subtitle: 'Short Drama Studio',
    useCases: ['角色 / 场景视觉资产建立', '分镜图 + AI 视频生成', '剧集素材复用与版本管理', '快速剧集生产流水线'],
  },
  {
    id: 'brand',
    letter: 'E',
    name: '品牌市场部',
    subtitle: 'Brand & Marketing',
    useCases: ['产品视觉与社媒内容', '活动宣传视频', '内部创意资产库', '跨地区内容本地化'],
  },
]

// ── Enterprise capabilities ───────────────────────────────────────────────────

export const enterpriseCapabilities: EnterpriseCapability[] = [
  { name: '团队项目空间', description: '多项目并行，成员各自访问对应项目', status: '规划中' },
  { name: '成员权限管理', description: '细粒度角色权限，控制查看/编辑/生成/导出', status: '规划中' },
  { name: '私有资产库', description: '企业级共享素材、角色、场景、风格资产', status: '规划中' },
  { name: '生成任务审计', description: '全团队生成任务日志，追溯操作与成本', status: '规划中' },
  { name: 'API Provider 统一配置', description: '团队共享 API provider 配置，统一计费', status: '规划中' },
  { name: '成本与额度管理', description: '按项目或成员设置生成额度上限', status: '企业版预览' },
  { name: '项目模板', description: '沉淀工作流模板，新项目直接复用', status: '规划中' },
  { name: '角色/场景/镜头资产复用', description: '跨项目复用视觉资产，保持品牌一致性', status: '规划中' },
  { name: '多人协作', description: '成员同时在项目中工作，权限互不干扰', status: '规划中' },
  { name: '企业级导出', description: '批量导出、格式选择、版本打包', status: '规划中' },
  { name: '私有部署 / 本地部署', description: '支持企业服务器或本地工作站部署', status: '企业版预览' },
  { name: '合规与日志', description: '操作日志、访问记录，满足企业合规需求', status: '规划中' },
]

// ── Workflow steps ────────────────────────────────────────────────────────────

export const workflowSteps: WorkflowStep[] = [
  { step: 1, role: '制片', action: '创建项目', detail: '设置项目信息、团队成员与交付时间' },
  { step: 2, role: '编剧', action: '整理脚本与分场', detail: '录入剧本结构、场景划分与角色设定' },
  { step: 3, role: '导演', action: '生成分镜方案', detail: '基于脚本生成镜头方案与视觉参考' },
  { step: 4, role: '美术', action: '建立角色/场景视觉', detail: '生成并沉淀角色外观、场景风格资产' },
  { step: 5, role: 'AI 视频师', action: '生成动态样片', detail: '将分镜和视觉资产转化为视频段落' },
  { step: 6, role: '剪辑', action: '整理素材与版本', detail: '汇总生成结果，整理版本与输出包' },
  { step: 7, role: '项目负责人', action: '审核交付', detail: '内部审核确认，标注修改意见' },
  { step: 8, role: '客户', action: '确认输出', detail: '客户查看最终版本，确认交付' },
]

// ── Permission roles ──────────────────────────────────────────────────────────

export const permissionRoles: PermissionRole[] = [
  { role: 'Owner', subtitle: '管理员',    canView: true,  canEdit: true,  canGenerate: true,  canManageMembers: true,  canExport: true,  canViewCost: true  },
  { role: 'Producer', subtitle: '制片',  canView: true,  canEdit: true,  canGenerate: true,  canManageMembers: true,  canExport: true,  canViewCost: true  },
  { role: 'Director', subtitle: '导演',  canView: true,  canEdit: true,  canGenerate: true,  canManageMembers: false, canExport: true,  canViewCost: false },
  { role: 'Writer', subtitle: '编剧',    canView: true,  canEdit: true,  canGenerate: false, canManageMembers: false, canExport: false, canViewCost: false },
  { role: 'Artist', subtitle: '美术',    canView: true,  canEdit: true,  canGenerate: true,  canManageMembers: false, canExport: true,  canViewCost: false },
  { role: 'Video Artist', subtitle: 'AI 视频师', canView: true, canEdit: true, canGenerate: true, canManageMembers: false, canExport: true, canViewCost: false },
  { role: 'Editor', subtitle: '剪辑',    canView: true,  canEdit: true,  canGenerate: false, canManageMembers: false, canExport: true,  canViewCost: false },
  { role: 'Client Viewer', subtitle: '客户查看者', canView: true, canEdit: false, canGenerate: false, canManageMembers: false, canExport: false, canViewCost: false },
]

export const permissionColumns = [
  { key: 'canView',          label: '查看项目' },
  { key: 'canEdit',          label: '编辑节点' },
  { key: 'canGenerate',      label: '生成素材' },
  { key: 'canManageMembers', label: '管理成员' },
  { key: 'canExport',        label: '导出资产' },
  { key: 'canViewCost',      label: '查看成本' },
] as const

// ── Security items ────────────────────────────────────────────────────────────

export const securityItems: SecurityItem[] = [
  { icon: '🔒', title: '项目数据隔离', detail: '不同项目的数据相互隔离，成员只能访问被授权的项目' },
  { icon: '👥', title: '成员权限管理', detail: '细粒度角色权限体系，按职能分配可操作范围' },
  { icon: '📁', title: '资产访问控制', detail: '素材和生成结果按项目隔离，防止未授权访问' },
  { icon: '🔑', title: 'API key 统一托管', detail: 'API key 统一由管理员配置，成员无需接触密钥原文' },
  { icon: '📋', title: '审计日志', detail: '全团队操作和生成任务可追溯，支持合规审计' },
  { icon: '🗄', title: '私有存储接入', detail: '支持企业 NAS、私有 OSS 或 S3 兼容存储' },
  { icon: '🖥', title: '本地部署选项', detail: '企业服务器或本地工作站部署，数据不出企业' },
  { icon: '💾', title: '备份与恢复', detail: '支持定期数据备份和灾难恢复策略' },
  { icon: '✅', title: '合规审批流程', detail: '可配置内容审批节点，满足品牌和合规要求' },
]

// ── Enterprise plans ──────────────────────────────────────────────────────────

export const enterprisePlans: EnterprisePlan[] = [
  {
    id: 'studio-team',
    name: 'Studio Team',
    subtitle: '工作室团队版',
    audience: '5–20 人创意团队',
    features: [
      '多项目空间（并行管理）',
      '成员角色与权限管理',
      '团队资产库',
      '生成任务中心',
      '基础审计日志',
    ],
    cta: '即将开放',
    highlighted: false,
  },
  {
    id: 'production-company',
    name: 'Production Co.',
    subtitle: '影视/广告制作公司版',
    audience: '专业制作公司和广告公司',
    features: [
      '多项目并行与模板复用',
      '完整权限与审计体系',
      '私有资产库与版本管理',
      '成本与额度管理',
      '企业级导出与交付管理',
    ],
    cta: '联系商务',
    highlighted: true,
  },
  {
    id: 'enterprise-private',
    name: 'Enterprise Private',
    subtitle: '企业私有版',
    audience: '需要私有部署和数据隔离的大型企业',
    features: [
      '私有服务器 / 本地部署',
      '企业 Auth（LDAP / SSO）',
      '私有存储与 API 网关',
      'SLA 与专属技术支持',
      '定制集成与合规配置',
    ],
    cta: '联系商务',
    highlighted: false,
  },
]

// ── Value points ──────────────────────────────────────────────────────────────

export const valuePoints: ValuePoint[] = [
  { icon: '⚡', title: '降低创意试错成本', body: 'AI 生成分镜和样片的成本远低于传统拍摄，大幅压缩概念开发阶段的支出。' },
  { icon: '⏱', title: '缩短视觉开发周期', body: '从剧本到可视化分镜的时间从数天压缩到数小时，加快提案和立项节奏。' },
  { icon: '🗂', title: '沉淀组织级资产', body: '角色、场景、风格资产在项目间复用，形成企业专属的 AI 视觉知识库。' },
  { icon: '🔍', title: '提升协作透明度', body: '所有生成任务、版本和审核记录可追溯，成员之间协作更清晰高效。' },
  { icon: '💰', title: '管控 AI 生成成本', body: '按项目或成员设置额度上限，避免 API 成本失控，实现可预测的运营支出。' },
  { icon: '🎯', title: '增强客户提案表现', body: '可视化分镜和动态样片让提案更直观，提升客户决策信心和成交率。' },
  { icon: '🧠', title: '形成 AI 生产方法论', body: '工作流模板沉淀团队最佳实践，新成员快速上手，组织整体效率持续提升。' },
]

// ── Onboarding flow ───────────────────────────────────────────────────────────

export const onboardingFlow: OnboardingStep[] = [
  { step: 1, label: '企业需求沟通', detail: '了解团队规模、工作流类型、数据安全要求和部署偏好' },
  { step: 2, label: '试点项目选择', detail: '选择一个真实项目作为 pilot，验证平台匹配度' },
  { step: 3, label: '工作流配置', detail: '根据团队职能配置项目空间、资产库和生成工作流' },
  { step: 4, label: '成员与权限设置', detail: '创建成员账号，配置角色权限和项目访问范围' },
  { step: 5, label: 'API / 模型接入', detail: '统一配置 AI provider API key，按需设置额度上限' },
  { step: 6, label: '资产迁移', detail: '将现有素材、角色视觉和风格资产导入平台资产库' },
  { step: 7, label: '团队培训', detail: '工作流培训，帮助团队掌握生成、协作和资产管理方法' },
  { step: 8, label: '正式上线', detail: '切换到正式环境，持续收集反馈并优化工作流配置' },
]

// ── Risks and boundaries ──────────────────────────────────────────────────────

export const risksAndBoundaries: RiskBoundary[] = [
  { item: '本页不是正式企业版发布，不代表当前版本已支持企业服务' },
  { item: '当前不创建企业账号，不提供企业服务合同' },
  { item: '当前不接支付，不创建任何订单' },
  { item: '当前不写数据库，不保存任何企业信息' },
  { item: '企业部署涉及数据安全、权限、合规、运维和 SLA，需要单独评估' },
  { item: '正式上线前需要设计企业服务协议、数据处理协议和 SLA 条款' },
  { item: '本页所有能力和套餐均为规划预览，实际交付以正式协议为准' },
]

// ── Quick links ───────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard' },
  { label: '关于', href: '/about' },
  { label: '路线图', href: '/roadmap' },
  { label: '本地部署预览', href: '/local-deploy-preview' },
  { label: '商业模式预览', href: '/pricing-preview' },
  { label: '协议预览', href: '/terms-preview' },
  { label: '诊断帮助', href: '/help' },
]
