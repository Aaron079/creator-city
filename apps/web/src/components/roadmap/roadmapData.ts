// Static roadmap data — read-only, no API, no DB, no generation triggers
// All content is documentation/planning data only

export type PhaseStatus = '已完成' | '已冻结' | '持续增强' | '规划中' | '后续开启' | '长期规划'
export type RiskLevel = 'A' | 'B' | 'C' | 'D' | 'E'

export interface RoadmapItem {
  label: string
}

export interface RoadmapPhase {
  id: string
  phase: string
  title: string
  subtitle: string
  status: PhaseStatus
  accent: string
  items: RoadmapItem[]
}

export interface FrozenRule {
  rule: string
  reason: string
}

export interface NextStep {
  label: string
  route: string | null
  taskType: string
  available: boolean
}

export interface RiskLevelEntry {
  level: RiskLevel
  label: string
  desc: string
  examples: string[]
  color: string
  bg: string
  border: string
}

export interface QuickLink {
  label: string
  href: string
  desc: string
}

// ── Phases ────────────────────────────────────────────────────────────────────

export const roadmapPhases: RoadmapPhase[] = [
  {
    id: 'phase-1',
    phase: 'Phase 1',
    title: '稳定生成链路',
    subtitle: '图片与视频生成的最小可用闭环，已上线、已冻结。',
    status: '已冻结',
    accent: '#6ee7b7',
    items: [
      { label: '图片生成：Prompt → Seedream → OSS → Canvas' },
      { label: '视频生成：Prompt → Seedance → OSS → Canvas' },
      { label: '节点保存与刷新恢复（localStorage 草稿 + DB 双保险）' },
      { label: '媒体双击放大 Lightbox（createPortal + z-99999）' },
      { label: 'Polling 上限：图片 12 次 / 视频 24 次，超时自动停止' },
      { label: '刷新降级：active 节点状态降级，不自动续发 POST' },
      { label: 'Canvas save 失败不清空节点' },
      { label: 'Provider 状态展示 + 错误码 / 错误阶段 / 链路追踪' },
    ],
  },
  {
    id: 'phase-2',
    phase: 'Phase 2',
    title: '生产管理中心',
    subtitle: '项目、资产、任务、API、工作台的核心管理界面。',
    status: '持续增强',
    accent: '#93c5fd',
    items: [
      { label: '工作台 /dashboard — 聚合生产数据与待办' },
      { label: '项目中心 /projects — 多项目管理与切换' },
      { label: '资产库 /assets — 图片与视频资产归档' },
      { label: '生成任务中心 /tasks — 任务状态与历史记录' },
      { label: 'API 中心 /providers — Provider 状态与 Key 管理' },
      { label: '诊断帮助 /help — 常见问题排查与错误码指南' },
      { label: '设置中心 /settings — 账号、偏好与团队入口' },
      { label: '创作者市场 /marketplace — 只读预览，无真实交易' },
      { label: '社区 /community — 频道预览与协作入口' },
    ],
  },
  {
    id: 'phase-3',
    phase: 'Phase 3',
    title: '安全开发体系',
    subtitle: '冻结模块边界、回归验收清单与 Claude Code 任务模板的完整工程守则。',
    status: '已完成',
    accent: '#c4b5fd',
    items: [
      { label: '冻结模块文档 LOCKED_STABLE_MODULES.md' },
      { label: '安全开发边界 SAFE_DEVELOPMENT_BOUNDARIES.md — A/B/C/D/E 任务分级' },
      { label: '回归验收清单 REGRESSION_CHECKLIST.md — 提交前 + 部署后' },
      { label: '后续安全路线图 NEXT_FEATURE_SAFE_PLAN.md' },
      { label: 'Claude Code 任务模板 CLAUDE_CODE_TASK_TEMPLATE.md' },
      { label: '生成链路守则 GENERATION_PIPELINE_GUARDRAILS.md' },
      { label: 'UI 验收守则 UI_ACCEPTANCE_CHECKLIST.md' },
      { label: '新页面先独立建，验收后再单独接导航' },
      { label: 'git diff 越界立即停止，不自行修复' },
    ],
  },
  {
    id: 'phase-4',
    phase: 'Phase 4',
    title: '社区与创作者市场',
    subtitle: '从只读预览迈向真实交易与协作的社区平台。',
    status: '规划中',
    accent: '#fcd34d',
    items: [
      { label: '创作者社群 — 频道讨论、动态发布' },
      { label: '项目讨论区 — 需求帖、求助帖、合作帖' },
      { label: '招募协作 — 组队入口与技能标注' },
      { label: '创作者市场 — 真实服务发布与浏览' },
      { label: '委托服务 — 需求发布、报价、确认流程' },
      { label: '平台抽佣模型预留（30% 比例参考）' },
      { label: '内容审核与举报机制' },
      { label: '创作者认证与评分体系' },
    ],
  },
  {
    id: 'phase-5',
    phase: 'Phase 5',
    title: '专业影视工具层',
    subtitle: '在稳定生成链路之上叠加专业导演工具，必须 feature flag 默认关闭。',
    status: '后续开启',
    accent: '#fb923c',
    items: [
      { label: '镜头语言库 — 运镜方式、景别、景深参考' },
      { label: '分镜参考系统 — 画面构图与时序管理' },
      { label: '角色一致性 — 角色外形在多个节点间保持统一' },
      { label: '资产版本管理 — 图层、迭代与对比回溯' },
      { label: '组合预览系统 — 多节点组合成完整影片预览' },
      { label: 'Agent / Skill 市场 — 开放第三方 Agent 接入' },
      { label: '所有工具必须 feature flag 默认关闭' },
      { label: '不得污染图片/视频生成 payload' },
    ],
  },
  {
    id: 'phase-6',
    phase: 'Phase 6',
    title: '团队与商业化',
    subtitle: '企业级权限、本地部署与完整商业闭环。',
    status: '长期规划',
    accent: '#f472b6',
    items: [
      { label: '团队权限 — 角色、成员、邀请链接' },
      { label: '项目协作 — 多人实时编辑与评审' },
      { label: '订单 / 合同 / 交付确认 — 完整委托闭环' },
      { label: '计费与额度 — 订阅套餐与生成额度管理' },
      { label: '企业部署 — SaaS 私有化与 API 开放' },
      { label: '本地部署 — 私有云与离线模型支持' },
      { label: '合规与版权管理 — 生成资产归属与授权链路' },
    ],
  },
]

// ── Frozen rules ──────────────────────────────────────────────────────────────

export const frozenRules: FrozenRule[] = [
  {
    rule: '非修复任务不得修改 /create',
    reason: '画布节点、生成触发、保存/恢复逻辑是核心数据路径，任何回归都会导致用户资产丢失。',
  },
  {
    rule: '非生成修复不得修改 generate route / cn-executor',
    reason: '图片/视频生成链路是平台直接收益来源，payload 污染或 polling 破坏会导致大范围服务中断。',
  },
  {
    rule: '新页面不得修改 canvas API / media proxy',
    reason: 'canvas 保存失败会清空节点，media proxy 鉴权破坏会导致已保存媒体不可见。',
  },
  {
    rule: '新页面先独立验收，再单独任务接导航',
    reason: '导航链接无对应 page.tsx 会产生生产 404（Incident 2026-05-25, commit 86447d4）。',
  },
  {
    rule: 'git diff 越界必须立即停止，不得自行修复',
    reason: '自行修复越界风险的行为会掩盖边界违反，导致无法追溯回归来源。',
  },
]

// ── Recommended next steps ────────────────────────────────────────────────────

export const recommendedNextSteps: NextStep[] = [
  {
    label: '/design-system 静态设计规范页',
    route: '/design-system',
    taskType: 'A类',
    available: false,
  },
  {
    label: '/pricing-preview 商业模式预览页',
    route: '/pricing-preview',
    taskType: 'A类',
    available: false,
  },
  {
    label: '/terms-preview 协议与版权规则页',
    route: '/terms-preview',
    taskType: 'A类',
    available: false,
  },
  {
    label: '/roadmap 导航入口（单独任务）',
    route: null,
    taskType: 'C类',
    available: false,
  },
  {
    label: '/api/platform/stats 只读统计 API',
    route: null,
    taskType: 'B类',
    available: false,
  },
]

// ── Risk levels ───────────────────────────────────────────────────────────────

export const riskLevels: RiskLevelEntry[] = [
  {
    level: 'A',
    label: 'A 类 — 最安全',
    desc: 'docs only / 独立静态页面（不接导航）',
    examples: ['新增 docs/*.md', '新建 /roadmap、/design-system（无导航）', '新建静态数据文件'],
    color: '#6ee7b7',
    bg: 'rgba(6,78,59,0.25)',
    border: 'rgba(110,231,183,0.20)',
  },
  {
    level: 'B',
    label: 'B 类 — 低风险',
    desc: '新增只读 GET API / 新建读取只读 API 的页面',
    examples: ['新建 /api/platform/stats', '新建读取此 API 的页面'],
    color: '#93c5fd',
    bg: 'rgba(30,58,138,0.22)',
    border: 'rgba(147,197,253,0.18)',
  },
  {
    level: 'C',
    label: 'C 类 — 中风险',
    desc: '新增导航入口（必须目标页面已存在且已验收）',
    examples: ['为 /roadmap 加 SettingsHoverMenu 入口', '在 TopNavigation 加链接'],
    color: '#fcd34d',
    bg: 'rgba(120,53,15,0.22)',
    border: 'rgba(252,211,77,0.18)',
  },
  {
    level: 'D',
    label: 'D 类 — 高风险，需明确授权',
    desc: '修改已有页面、API 或组件',
    examples: ['修改 /settings 已有章节', '修改 /community 已有 feed'],
    color: '#fb923c',
    bg: 'rgba(124,45,18,0.22)',
    border: 'rgba(251,146,60,0.18)',
  },
  {
    level: 'E',
    label: 'E 类 — 默认禁止',
    desc: '触碰 /create / generate / canvas / media proxy / cn-executor',
    examples: ['修改 VisualCanvasWorkspace', '改 generate/image/route.ts', '改 cn-executor'],
    color: '#f87171',
    bg: 'rgba(127,29,29,0.28)',
    border: 'rgba(248,113,113,0.20)',
  },
]

// ── Quick links ───────────────────────────────────────────────────────────────

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard', desc: '查看生产概览' },
  { label: '创作画布', href: '/create', desc: '图片与视频生成' },
  { label: '项目中心', href: '/projects', desc: '管理所有项目' },
  { label: '诊断帮助', href: '/help', desc: '排查常见问题' },
]
