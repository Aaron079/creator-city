// /local-deploy-preview — Static local deployment preview data
// Pure TypeScript data. No API calls, no DB, no generation triggers.
// No real downloads, no real deployment commands. Preview only.

export type DeployModeStatus = '规划中' | '长期规划' | '未来规划'
export type CapabilityStatus = '规划中' | '预览' | '长期规划'
export type RoadmapPhaseStatus = '当前' | '近期' | '中期' | '长期'

export interface Reason {
  icon: string
  title: string
  body: string
}

export interface DeployMode {
  id: string
  letter: string
  name: string
  subtitle: string
  audience: string
  highlights: string[]
  status: DeployModeStatus
}

export interface Capability {
  name: string
  status: CapabilityStatus
}

export interface ArchitectureLayer {
  layer: string
  label: string
  detail: string
  accent: string
}

export interface SecurityPrinciple {
  title: string
  detail: string
}

export interface Prerequisite {
  item: string
  note: string
  optional: boolean
}

export interface RoadmapPhase {
  phase: string
  label: string
  description: string
  status: RoadmapPhaseStatus
}

export interface RiskBoundary {
  item: string
}

export interface QuickLink {
  label: string
  href: string
}

// ── Reasons ───────────────────────────────────────────────────────────────────

export const reasons: Reason[] = [
  {
    icon: '🎬',
    title: '专业素材体积大',
    body: '4K/8K 影视素材单文件可达数十 GB，云端上传成本高、耗时长，本地处理效率更高。',
  },
  {
    icon: '🔒',
    title: '商业项目需要保密',
    body: '未上映影视、广告策划和品牌素材不适合上传公有云，本地部署可保障数据安全。',
  },
  {
    icon: '🏢',
    title: '企业需要私有权限控制',
    body: '大型团队需要成员权限、项目隔离和审计日志，本地私有化部署是企业级合规要求。',
  },
  {
    icon: '💰',
    title: '本地 GPU/NAS 降低长期成本',
    body: '工作室已有 NAS 或 GPU 工作站，本地运行生成任务和资产索引可大幅降低云端费用。',
  },
  {
    icon: '📶',
    title: '网络不稳定时保持生产力',
    body: '本地版本允许在网络不稳定时整理项目、管理资产、编辑脚本，生成任务可本地排队。',
  },
]

// ── Deploy modes ──────────────────────────────────────────────────────────────

export const deployModes: DeployMode[] = [
  {
    id: 'workstation',
    letter: 'A',
    name: 'Creator Workstation',
    subtitle: '个人工作站版',
    audience: '个人导演、AI 视频创作者、独立制片',
    highlights: [
      '本地项目管理与资产库',
      '本地缓存加速访问',
      '第三方 API key 本地加密保存',
      '单用户，轻量部署',
      '网络断开时项目仍可查看',
    ],
    status: '规划中',
  },
  {
    id: 'studio-lan',
    letter: 'B',
    name: 'Studio LAN',
    subtitle: '工作室局域网版',
    audience: '广告公司、短剧团队、小型影视工作室',
    highlights: [
      '多成员在同一局域网协作',
      'NAS / 本地存储接入',
      '项目空间与成员权限（后续）',
      '共享资产库',
      '局域网内生成任务共享',
    ],
    status: '规划中',
  },
  {
    id: 'enterprise-private',
    letter: 'C',
    name: 'Enterprise Private Cloud',
    subtitle: '企业私有云版',
    audience: '影视公司、MCN、品牌内容团队',
    highlights: [
      '私有服务器部署',
      '企业权限与审计',
      '项目与数据完全隔离',
      '可接企业内部模型或 API 网关',
      '定制集成支持',
    ],
    status: '长期规划',
  },
  {
    id: 'hybrid-cloud',
    letter: 'D',
    name: 'Hybrid Cloud',
    subtitle: '混合云版',
    audience: '既要数据安全又需云端算力的团队',
    highlights: [
      '本地管理素材与项目',
      '云端调用 AI provider',
      '本地优先，云端兜底',
      '灵活的同步策略',
      '成本与安全最优平衡',
    ],
    status: '未来规划',
  },
]

// ── Capability map ────────────────────────────────────────────────────────────

export const capabilityMap: Capability[] = [
  { name: '本地项目管理', status: '规划中' },
  { name: '本地资产索引', status: '规划中' },
  { name: '本地缓存', status: '规划中' },
  { name: 'API key 本地加密保存', status: '规划中' },
  { name: '私有素材库', status: '规划中' },
  { name: '团队权限管理', status: '长期规划' },
  { name: '生成任务本地队列', status: '规划中' },
  { name: 'NAS / OSS / S3 兼容存储', status: '长期规划' },
  { name: '本地项目导出', status: '规划中' },
  { name: '审计日志', status: '长期规划' },
  { name: '离线查看项目', status: '规划中' },
  { name: '云端同步策略', status: '长期规划' },
]

// ── Architecture layers ───────────────────────────────────────────────────────

export const architectureLayers: ArchitectureLayer[] = [
  {
    layer: '01',
    label: 'Web UI',
    detail: 'Next.js 前端，运行在本地浏览器访问',
    accent: 'rgba(99,102,241,0.50)',
  },
  {
    layer: '02',
    label: 'Local API Server',
    detail: '本地 Node.js API，处理项目、资产和生成请求',
    accent: 'rgba(139,92,246,0.45)',
  },
  {
    layer: '03',
    label: 'Local Database',
    detail: 'PostgreSQL 或 SQLite，存储项目元数据（规划中）',
    accent: 'rgba(168,85,247,0.40)',
  },
  {
    layer: '04',
    label: 'Local Storage / NAS',
    detail: '本地文件系统或 NAS，存储素材、缓存和生成结果',
    accent: 'rgba(147,51,234,0.35)',
  },
  {
    layer: '05',
    label: 'Queue Worker',
    detail: '本地任务队列，处理生成和导出任务',
    accent: 'rgba(124,58,237,0.30)',
  },
  {
    layer: '06',
    label: 'Provider Adapter',
    detail: '统一接入第三方 AI provider，用户自带 API key',
    accent: 'rgba(109,40,217,0.28)',
  },
  {
    layer: '07',
    label: 'Optional Cloud Sync',
    detail: '可选：与云端同步选定项目或资产（混合云模式）',
    accent: 'rgba(91,33,182,0.22)',
  },
  {
    layer: '08',
    label: 'Enterprise Auth',
    detail: '企业版：LDAP / SSO / 私有 OAuth 接入（长期规划）',
    accent: 'rgba(76,29,149,0.18)',
  },
]

// ── Security principles ───────────────────────────────────────────────────────

export const securityPrinciples: SecurityPrinciple[] = [
  {
    title: '项目数据归用户所有',
    detail: '本地部署模式下，项目元数据、素材和生成结果全部存储在用户自己的设备或服务器上，平台不主动获取。',
  },
  {
    title: '素材留在本地或私有存储',
    detail: '图片、视频、音频素材可完全留在本地文件系统或企业 NAS，不需要上传公有云。',
  },
  {
    title: 'API key 不应暴露到公开环境',
    detail: '第三方 AI provider 的 API key 应加密保存在本地，不应出现在公开配置文件、截图或代码仓库中。',
  },
  {
    title: '企业部署须配置权限、日志和备份',
    detail: '企业私有部署需要成员权限控制、操作审计日志和定期数据备份策略，这是企业级合规的基本要求。',
  },
  {
    title: '商业交付素材应保存授权记录',
    detail: '用于商业项目的素材应保存授权协议和版权记录，企业部署应建立素材版权管理流程。',
  },
]

// ── Prerequisites ─────────────────────────────────────────────────────────────

export const prerequisites: Prerequisite[] = [
  { item: 'Node.js 20+', note: '运行 Web UI 和 Local API Server', optional: false },
  { item: 'pnpm 8+', note: '包管理器', optional: false },
  { item: 'PostgreSQL 15+ 或 SQLite', note: '项目元数据存储（规划中）', optional: false },
  { item: '本地存储目录', note: '素材、缓存和生成结果', optional: false },
  { item: '第三方 AI provider API key', note: '图片/视频生成需要用户自带 key', optional: false },
  { item: 'Docker（可选）', note: '容器化部署方案（规划中）', optional: true },
  { item: 'NAS / 网络存储', note: '局域网版和企业版推荐', optional: true },
  { item: 'GPU 工作站', note: '本地模型推理规划中（长期）', optional: true },
  { item: '网络与防火墙配置', note: '局域网/私有云访问需要', optional: true },
]

// ── Roadmap phases ────────────────────────────────────────────────────────────

export const roadmapPhases: RoadmapPhase[] = [
  {
    phase: 'Preview',
    label: '方案预览',
    description: '静态方案页，展示本地部署规划，收集需求反馈',
    status: '当前',
  },
  {
    phase: 'Alpha',
    label: '本地只读查看',
    description: '支持本地启动，只读查看现有云端项目，不支持生成',
    status: '近期',
  },
  {
    phase: 'Beta',
    label: '本地项目与资产管理',
    description: '本地项目创建、资产库、任务中心，生成仍调用云端 provider',
    status: '中期',
  },
  {
    phase: 'Studio',
    label: '局域网多人协作',
    description: '局域网多成员访问、NAS 接入、共享资产库和生成队列',
    status: '中期',
  },
  {
    phase: 'Enterprise',
    label: '私有云与权限审计',
    description: '企业私有服务器、权限体系、审计日志、企业 Auth 接入',
    status: '长期',
  },
  {
    phase: 'Offline Pack',
    label: '离线包与项目导出',
    description: '项目完整导出包，支持完全离线查看、归档和移交',
    status: '长期',
  },
]

// ── Risks and boundaries ──────────────────────────────────────────────────────

export const risksAndBoundaries: RiskBoundary[] = [
  { item: '本页不是正式发布说明，不代表当前版本已支持本地部署' },
  { item: '当前没有可下载的本地部署安装包' },
  { item: '当前不会自动执行任何部署命令或安装任何服务' },
  { item: '本地部署涉及数据库、存储、网络、安全、授权和升级策略，需要专业技术支持' },
  { item: '企业私有部署需要单独合同、技术实施和售后支持协议' },
  { item: '本地版本与云端版本的功能一致性将在正式发布前明确说明' },
  { item: '本页所有能力描述均为规划，实际交付以正式版本为准' },
]

// ── Quick links ───────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard' },
  { label: '关于', href: '/about' },
  { label: '路线图', href: '/roadmap' },
  { label: '商业模式预览', href: '/pricing-preview' },
  { label: '协议预览', href: '/terms-preview' },
  { label: '诊断帮助', href: '/help' },
]
