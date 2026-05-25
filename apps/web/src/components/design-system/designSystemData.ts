// Static design system data — read-only, no API, no DB, no generation triggers
// Reference data only. Not connected to navigation. Not used by any other module.

// ── Design Principles ─────────────────────────────────────────────────────────

export interface Principle {
  title: string
  desc: string
  icon: string
}

export const principles: Principle[] = [
  {
    title: '暗色高级',
    desc: '以极深暗色为背景基调，玻璃质感卡片叠加，突出内容层次而非界面本身。',
    icon: '◑',
  },
  {
    title: '少即是多',
    desc: '每屏只承载一个主要任务。去掉所有装饰性元素，留下功能必要内容。',
    icon: '◻',
  },
  {
    title: '卡片统一比例',
    desc: '同一页面的同类卡片保持统一高度、圆角（20–30px）、边框和内边距（16–24px）。',
    icon: '▦',
  },
  {
    title: '状态优先清晰',
    desc: '状态 chip 必须一眼可读。成功绿 / 进行中蓝 / 警告黄 / 失败红，不混用颜色语义。',
    icon: '◈',
  },
  {
    title: '中文为主，技术字段保留英文',
    desc: '界面文案优先中文。API Key、Provider ID、errorCode、URL 等技术字段保留英文原形。',
    icon: '文',
  },
  {
    title: '新功能先独立验收',
    desc: '新页面独立建立，验收通过后再接导航入口。绝不为加导航而改旧页面。',
    icon: '⊕',
  },
  {
    title: '不为美化改稳定模块',
    desc: '视觉优化不得以修改 /create、generate route、canvas API 为代价。美化只在新文件内完成。',
    icon: '⊘',
  },
]

// ── Color Tokens ──────────────────────────────────────────────────────────────

export interface ColorToken {
  name: string
  value: string
  desc: string
  textColor: string
}

export const colorTokens: ColorToken[] = [
  { name: '背景主色', value: '#05060A', desc: '全页背景基础色，接近纯黑', textColor: '#fff' },
  { name: '背景次色', value: '#080A12', desc: '卡片区域背景，略亮于主色', textColor: '#fff' },
  { name: '玻璃卡片', value: 'rgba(255,255,255,0.04)', desc: '带 backdropFilter blur 的玻璃层', textColor: '#fff' },
  { name: '边框标准', value: 'rgba(255,255,255,0.10)', desc: '卡片、按钮、输入框的默认边框', textColor: '#fff' },
  { name: '边框微弱', value: 'rgba(255,255,255,0.06)', desc: '分隔线、次级容器边框', textColor: '#fff' },
  { name: '主文字', value: '#F8FAFC', desc: '标题与重要内容', textColor: '#05060A' },
  { name: '次级文字', value: '#94A3B8', desc: '说明文字、副标题', textColor: '#05060A' },
  { name: '弱文字', value: 'rgba(255,255,255,0.30)', desc: '占位符、标签、标注', textColor: '#fff' },
  { name: '成功绿', value: '#6ee7b7', desc: '已完成、已冻结、成功状态', textColor: '#05060A' },
  { name: '信息蓝', value: '#93c5fd', desc: '进行中、持续增强、信息状态', textColor: '#05060A' },
  { name: '警告黄', value: '#fcd34d', desc: '规划中、待确认、警告状态', textColor: '#05060A' },
  { name: '橙色', value: '#fb923c', desc: '后续开启、需注意', textColor: '#05060A' },
  { name: '错误红', value: '#f87171', desc: '失败、禁止、E类越界', textColor: '#05060A' },
  { name: '高亮紫', value: '#c4b5fd', desc: '特殊标注、已完成文档体系', textColor: '#05060A' },
  { name: '粉色', value: '#f472b6', desc: '长期规划、次要高亮', textColor: '#05060A' },
]

// ── Typography ────────────────────────────────────────────────────────────────

export interface TypographySample {
  label: string
  size: string
  weight: string
  tracking: string
  color: string
  sample: string
  usage: string
}

export const typographySamples: TypographySample[] = [
  {
    label: 'Hero Title',
    size: '34px',
    weight: '300',
    tracking: '-0.05em',
    color: '#fff',
    sample: 'Creator City 设计系统',
    usage: '页面主标题，每页只出现一次',
  },
  {
    label: 'Section Title',
    size: '20px',
    weight: '400',
    tracking: '-0.02em',
    color: '#fff',
    sample: '卡片规范与状态表达',
    usage: '内容区标题，区分主要章节',
  },
  {
    label: 'Card Title',
    size: '15–17px',
    weight: '500',
    tracking: '-0.02em',
    color: '#fff',
    sample: '项目：AI 短片生成工作流',
    usage: '卡片主标题，不超过两行',
  },
  {
    label: 'Body Text',
    size: '13–14px',
    weight: '400',
    tracking: '0',
    color: 'rgba(255,255,255,0.65)',
    sample: '生成任务正在队列中等待执行，预计需要 60 秒。',
    usage: '正文说明、卡片描述',
  },
  {
    label: 'Caption',
    size: '11–12px',
    weight: '400',
    tracking: '0',
    color: 'rgba(255,255,255,0.38)',
    sample: '最后更新：3 分钟前 · creator_demo_01',
    usage: '时间戳、辅助信息、次级标注',
  },
  {
    label: 'Label / Tag',
    size: '9–10px',
    weight: '700',
    tracking: '0.18–0.24em',
    color: 'rgba(255,255,255,0.32)',
    sample: 'SECTION · SETTINGS · API CENTER',
    usage: '区块标签、状态分组标题（全大写）',
  },
  {
    label: 'Code / ID',
    size: '11–12px',
    weight: '400',
    tracking: '0.02em',
    color: '#93c5fd',
    sample: 'node_a3f8b1 · jobId: gen_0912 · OSS_UPLOAD_ERROR',
    usage: '技术 ID、errorCode、API Key 片段',
  },
]

// ── Buttons ───────────────────────────────────────────────────────────────────

export interface ButtonExample {
  label: string
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'disabled'
  desc: string
}

export const buttonExamples: ButtonExample[] = [
  { label: '进入画布', variant: 'primary', desc: '主要操作，每屏最多 1 个，引导核心行为' },
  { label: '查看详情', variant: 'secondary', desc: '次要操作，配合主按钮使用，不抢夺视觉重心' },
  { label: '返回', variant: 'ghost', desc: '辅助返回或跳转，极简样式' },
  { label: '停止生成', variant: 'danger', desc: '危险操作，仅在生成进行中显示' },
  { label: '即将开放', variant: 'disabled', desc: '功能未上线时使用，cursor: not-allowed，不可点击' },
]

// ── Status Chips ──────────────────────────────────────────────────────────────

export interface StatusChipSpec {
  label: string
  color: string
  bg: string
  border: string
  when: string
  avoid: string
}

export const statusChips: StatusChipSpec[] = [
  {
    label: '已完成',
    color: '#6ee7b7',
    bg: 'rgba(6,78,59,0.28)',
    border: 'rgba(110,231,183,0.22)',
    when: '任务、生成、交付已成功结束',
    avoid: '不用于"进行中"或"待审核"状态',
  },
  {
    label: '生成中',
    color: '#93c5fd',
    bg: 'rgba(30,58,138,0.28)',
    border: 'rgba(147,197,253,0.22)',
    when: '图片/视频节点正在调用 Seedream/Seedance 生成',
    avoid: '不用于已完成或队列等待状态',
  },
  {
    label: '排队中',
    color: '#fcd34d',
    bg: 'rgba(120,53,15,0.28)',
    border: 'rgba(252,211,77,0.22)',
    when: '任务已提交，等待 cn-executor 处理',
    avoid: '不与"生成中"混用',
  },
  {
    label: '失败',
    color: '#f87171',
    bg: 'rgba(127,29,29,0.28)',
    border: 'rgba(248,113,113,0.22)',
    when: '生成、保存或任务执行出现不可恢复错误',
    avoid: '不用于可重试的暂时性错误',
  },
  {
    label: '已保存',
    color: '#6ee7b7',
    bg: 'rgba(6,78,59,0.20)',
    border: 'rgba(110,231,183,0.16)',
    when: '画布已成功同步至数据库',
    avoid: '不在保存进行中时显示（应显示加载态）',
  },
  {
    label: '即将开放',
    color: 'rgba(255,255,255,0.30)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    when: '功能占位，尚未上线，cursor: not-allowed',
    avoid: '不用于已上线但暂时不可用的功能',
  },
  {
    label: '静态预览',
    color: '#c4b5fd',
    bg: 'rgba(91,33,182,0.20)',
    border: 'rgba(196,181,253,0.18)',
    when: '页面为只读静态展示，无 API 无 DB',
    avoid: '不用于有真实数据的页面',
  },
  {
    label: 'Mock',
    color: 'rgba(255,255,255,0.30)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.07)',
    when: '示例数据，必须标注为非真实用户/项目数据',
    avoid: '不在有真实数据时使用',
  },
  {
    label: 'Frozen',
    color: '#6ee7b7',
    bg: 'rgba(6,78,59,0.20)',
    border: 'rgba(110,231,183,0.14)',
    when: '模块已冻结，任何任务均不得修改',
    avoid: '不用于可以改动的稳定模块',
  },
]

// ── Card Examples ─────────────────────────────────────────────────────────────

export interface CardExample {
  type: string
  title: string
  subtitle: string
  meta: string
  status: string
  statusColor: string
  statusBg: string
  isDemo: boolean
}

export const cardExamples: CardExample[] = [
  {
    type: '项目卡',
    title: 'AI 短片·春日物语',
    subtitle: '导演：creator_demo_01 · 4 个节点',
    meta: '更新于 2 小时前',
    status: '生成中',
    statusColor: '#93c5fd',
    statusBg: 'rgba(30,58,138,0.28)',
    isDemo: true,
  },
  {
    type: '资产卡',
    title: '封面图_v3.png',
    subtitle: '1920×1080 · Seedream · 16:9',
    meta: '生成于 2026-05-24',
    status: '已完成',
    statusColor: '#6ee7b7',
    statusBg: 'rgba(6,78,59,0.28)',
    isDemo: true,
  },
  {
    type: '任务卡',
    title: '图片生成 #gen_0912',
    subtitle: 'node_a3f8b1 · Seedream v3',
    meta: '耗时 18s · 轮询 4 次',
    status: '已完成',
    statusColor: '#6ee7b7',
    statusBg: 'rgba(6,78,59,0.28)',
    isDemo: true,
  },
  {
    type: 'Provider 卡',
    title: 'Seedream Image',
    subtitle: '火山引擎 · 图片生成',
    meta: 'API Key 已配置',
    status: '可用',
    statusColor: '#6ee7b7',
    statusBg: 'rgba(6,78,59,0.28)',
    isDemo: false,
  },
  {
    type: '社区动态卡',
    title: '如何让 AI 保持角色一致性？',
    subtitle: 'creator_demo_02 · #角色设计',
    meta: '12 条回复 · 1 小时前',
    status: '热议',
    statusColor: '#f472b6',
    statusBg: 'rgba(131,24,67,0.22)',
    isDemo: true,
  },
  {
    type: '市场服务卡',
    title: 'AI 分镜脚本生成',
    subtitle: 'creator_demo_03 · 影视前期',
    meta: '¥ 299 起 · 3 天交付',
    status: '即将开放',
    statusColor: 'rgba(255,255,255,0.30)',
    statusBg: 'rgba(255,255,255,0.04)',
    isDemo: true,
  },
  {
    type: '设置项卡',
    title: '账号设置',
    subtitle: '用户名、邮箱、密码与登录方式',
    meta: '',
    status: '可前往',
    statusColor: 'rgba(255,255,255,0.55)',
    statusBg: 'rgba(255,255,255,0.06)',
    isDemo: false,
  },
  {
    type: '错误诊断卡',
    title: 'OSS_UPLOAD_ERROR',
    subtitle: 'Stage: upload · 生成任务 gen_0831',
    meta: '建议：检查 OSS 配置与网络连通性',
    status: '失败',
    statusColor: '#f87171',
    statusBg: 'rgba(127,29,29,0.28)',
    isDemo: false,
  },
]

// ── Empty / Error / Loading States ────────────────────────────────────────────

export interface StateExample {
  scenario: string
  title: string
  desc: string
  action: string
  icon: string
}

export const stateExamples: StateExample[] = [
  {
    scenario: '暂无项目',
    title: '还没有项目',
    desc: '在创作画布中新建第一个节点，系统将自动创建项目。',
    action: '前往画布',
    icon: '◻',
  },
  {
    scenario: '暂无资产',
    title: '资产库为空',
    desc: '生成图片或视频后，资产会自动同步至此处。',
    action: '开始生成',
    icon: '◷',
  },
  {
    scenario: '暂无任务',
    title: '没有生成记录',
    desc: '触发图片或视频生成后，任务记录会出现在此。',
    action: '前往画布',
    icon: '⊘',
  },
  {
    scenario: 'Provider 未配置',
    title: 'API Key 未配置',
    desc: '请前往 API 中心添加 Seedream 或 Seedance 的 API Key。',
    action: '前往 API 中心',
    icon: '⚙',
  },
  {
    scenario: '生成失败',
    title: '生成未能完成',
    desc: 'errorCode: OSS_UPLOAD_ERROR · 请检查网络连接后重试，或前往诊断帮助排查。',
    action: '查看诊断',
    icon: '✕',
  },
  {
    scenario: '媒体暂不可用',
    title: '媒体加载失败',
    desc: '可能原因：Session 已过期（media proxy 401）。请重新登录后刷新。',
    action: '重新登录',
    icon: '◎',
  },
  {
    scenario: '页面加载中',
    title: '正在加载…',
    desc: '首次加载画布时，节点数据从数据库同步。若超过 10 秒，请检查网络。',
    action: '',
    icon: '◌',
  },
]

// ── Media Ratios ──────────────────────────────────────────────────────────────

export interface MediaRatio {
  name: string
  ratio: string
  width: number
  height: number
  usage: string
  note: string
}

export const mediaRatios: MediaRatio[] = [
  { name: '图片节点', ratio: '16:9', width: 16, height: 9, usage: '画布图片生成默认比例', note: '与 Seedream aspectRatio 对齐' },
  { name: '视频节点', ratio: '16:9', width: 16, height: 9, usage: '画布视频生成默认比例', note: '与 Seedance aspectRatio 对齐' },
  { name: '头像 / 用户', ratio: '1:1', width: 1, height: 1, usage: '用户头像、创作者标识', note: 'border-radius: 50%' },
  { name: '竖版海报', ratio: '3:4', width: 3, height: 4, usage: '影片海报、封面预览', note: '市场服务卡可用' },
  { name: '超宽横幅', ratio: '21:9', width: 21, height: 9, usage: 'Hero 背景图、全屏展示', note: '仅用于特定展示场景' },
]

// ── Navigation Rules ──────────────────────────────────────────────────────────

export interface NavRule {
  rule: string
  reason: string
}

export const navigationRules: NavRule[] = [
  { rule: '顶部导航不堆超过 5 个主入口', reason: '超过 5 项导致视觉拥挤，用户选择困难。相似功能归并为一个入口。' },
  { rule: '相似功能归入大类入口', reason: '设置/API/帮助/任务统一归入 ⚙ 设置 hover 子菜单，不各自占顶部 slot。' },
  { rule: '左侧浮动导航只放高频核心操作', reason: '+ 新建节点 / U 撤销 / ⚙ 设置这三类高频操作。其余操作移至对话框或右键菜单。' },
  { rule: 'Hover 子菜单必须有延迟收起（≥ 120ms）', reason: '鼠标经过导航时若立即消失，极大降低可用性。80ms 延迟打开，160ms 延迟关闭。' },
  { rule: '新入口必须单独任务接入', reason: '导航是全局组件，任何修改影响所有页面。每个新入口是独立 C 类任务，单独验收。' },
  { rule: '新入口接入前必须确认目标页面已存在', reason: '导航链接无对应 page.tsx 导致生产 404（Incident 2026-05-25, commit 86447d4）。' },
]

// ── Do / Don't ────────────────────────────────────────────────────────────────

export interface DoItem {
  action: string
  reason: string
}

export interface DontItem {
  action: string
  risk: string
}

export const dos: DoItem[] = [
  { action: '新页面在独立目录中完整开发', reason: '不影响现有路由，失败回滚成本极低。' },
  { action: '静态数据先验收，验收通过再接真实 API', reason: '避免 API 调试污染页面验收。' },
  { action: '页面独立验收后再接导航入口', reason: '防止 nav link → 404 事故。' },
  { action: '每次提交前执行 git diff --name-only', reason: '确保没有误改冻结模块。' },
  { action: '未完成浏览器验收时明确声明', reason: 'type-check 通过 ≠ 功能正确，UI 必须人工确认。' },
  { action: '错误状态给出可操作的下一步建议', reason: '仅显示 errorCode 对用户无帮助，需指引操作路径。' },
]

export const donts: DontItem[] = [
  { action: '不为 UI 改 /create 组件', risk: '画布是核心数据路径，任何回归导致用户资产丢失。' },
  { action: '不为新页面改 generate route', risk: '生成链路是平台直接收益，payload 污染会导致大范围中断。' },
  { action: '不为导航改 media proxy', risk: 'proxy 鉴权破坏会使所有已保存媒体不可见。' },
  { action: '不为复用重构稳定组件', risk: '改旧组件即改其所有使用方，回归范围无法预测。' },
  { action: '不让 mock 数据伪装真实用户数据', risk: '混淆用户认知，可能引发隐私合规问题。' },
  { action: '不在同一 commit 同时加页面和导航入口', risk: '若页面有问题，导航入口和页面一起回滚，影响其它入口。' },
]

// ── Quick Links ───────────────────────────────────────────────────────────────

export interface QuickLink {
  label: string
  href: string
  desc: string
}

export const quickLinks: QuickLink[] = [
  { label: '工作台', href: '/dashboard', desc: '生产概览' },
  { label: '产品路线图', href: '/roadmap', desc: '开发阶段规划' },
  { label: '诊断帮助', href: '/help', desc: '排查问题' },
  { label: '创作画布', href: '/create', desc: '图片与视频生成' },
  { label: '项目中心', href: '/projects', desc: '管理项目' },
]
