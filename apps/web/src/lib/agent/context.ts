import type { AgentPageContext, AgentQuickAction } from '@/lib/agent/types'

const BASE_ACTIONS: AgentQuickAction[] = [
  { id: 'navigate:create', label: 'AI 画布', description: '打开 AI 创作画布' },
  { id: 'navigate:projects', label: '项目', description: '查看项目列表' },
  { id: 'navigate:community', label: '社群', description: '进入社群页面' },
  { id: 'navigate:tools', label: '工具/API', description: '查看工具和 provider 状态' },
  { id: 'navigate:my-api', label: '我的 API', description: '管理 Provider API 账户' },
  { id: 'ask:api-key-guide', label: 'API Key 指南', description: '如何获取和填写各 Provider 的 API Key' },
  { id: 'navigate:client-delivery', label: '客户交付', description: '进入客户审片与交付确认' },
  { id: 'copy-current-link', label: '复制链接', description: '复制当前页面链接' },
  { id: 'explain-current-page', label: '解释页面', description: '说明当前页面能做什么' },
  { id: 'suggest-next-step', label: '下一步', description: '根据当前页面给下一步建议' },
]

const ME_ACTION: AgentQuickAction = {
  id: 'navigate:me',
  label: '我的工作台',
  description: '打开个人工作台',
}

function getProjectIdFromPath(pathname: string) {
  const match = pathname.match(/^\/(?:projects|review)\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

function pageConfig(pathname: string) {
  if (pathname === '/') {
    return {
      routeName: '首页',
      pageSummary: 'Creator City 首页，用来进入创作、项目、社群、模板和工具入口。',
      suggestedQuestions: ['我应该从哪里开始？', '如何进入 AI 画布？', '哪里查看项目和工具？'],
      visibleActions: ['进入 AI 画布', '打开项目', '打开社群', '查看工具/API'],
    }
  }

  if (pathname.startsWith('/create')) {
    return {
      routeName: 'AI 画布',
      pageSummary: 'AI 画布用于创建文本、图片、视频、音频和交付节点，可以双击画布创建节点，用右侧 + 创建下游节点。',
      suggestedQuestions: ['如何开始创作？', '如何创建下一个节点？', 'API Key 是什么？怎么填？', '如何用自己的 DeepSeek / OpenAI Key？', '如何进入客户交付？'],
      visibleActions: ['双击画布创建节点', '点击节点打开对话框', '参数参考', '客户交付', '复制画布链接'],
    }
  }

  if (pathname === '/projects') {
    return {
      routeName: '项目',
      pageSummary: '项目页用于查看和进入已有项目，继续项目首页、工作区、团队和审片流程。',
      suggestedQuestions: ['哪些项目需要我处理？', '如何进入某个项目？', '怎么去客户交付？'],
      visibleActions: ['查看项目列表', '进入项目首页', '打开审片/交付'],
    }
  }

  if (pathname.startsWith('/projects/')) {
    return {
      routeName: '项目首页',
      pageSummary: '项目首页聚合当前项目的工作区、团队、版本、交付和审片入口。',
      suggestedQuestions: ['这个项目下一步是什么？', '怎么进入审片？', '怎么打开团队或交付？'],
      visibleActions: ['项目工作区', 'Review', '客户交付', '团队管理'],
    }
  }

  if (pathname.startsWith('/community')) {
    return {
      routeName: '社群',
      pageSummary: '社群页用于查看创作者动态、连接团队和发现协作机会。',
      suggestedQuestions: ['这个页面能做什么？', '如何回到项目？', '如何开始创作？'],
      visibleActions: ['浏览社群', '回到 AI 画布', '查看项目'],
    }
  }

  if (pathname.startsWith('/templates')) {
    return {
      routeName: '模板库',
      pageSummary: '模板库用于选择创作流程模板，帮助你更快启动项目或画布工作流。',
      suggestedQuestions: ['怎么使用模板？', '模板会创建什么？', '如何回到画布？'],
      visibleActions: ['选择模板', '进入 AI 画布', '查看项目'],
    }
  }

  if (pathname.startsWith('/tools')) {
    return {
      routeName: '工具/API',
      pageSummary: '工具/API 页用于查看 provider、模型、API key 配置状态和可用能力。',
      suggestedQuestions: ['哪些工具已配置？', '哪些模型需要 API key？', '怎么测试 provider？'],
      visibleActions: ['查看 provider 状态', '检查 not-configured / mock / bridge-only', '进入 AI 画布测试'],
    }
  }

  if (pathname.startsWith('/me')) {
    return {
      routeName: '我的工作台',
      pageSummary: '我的工作台用于查看个人任务、邀请、项目提醒和需要处理的审片事项。',
      suggestedQuestions: ['我现在要处理什么？', '哪里看邀请？', '如何进入相关项目？'],
      visibleActions: ['查看任务', '处理邀请', '进入项目或 Review'],
    }
  }

  if (pathname.startsWith('/review/')) {
    return {
      routeName: '审片/客户交付',
      pageSummary: '审片/客户交付页用于客户查看版本、提交反馈、确认交付和处理审批。',
      suggestedQuestions: ['如何确认交付？', '如何提交反馈？', '这个页面哪些动作对客户可见？'],
      visibleActions: ['查看版本', '客户确认', '交付审批', '反馈与 resolution loop'],
    }
  }

  if (pathname.startsWith('/dashboard')) {
    return {
      routeName: 'Dashboard',
      pageSummary: 'Dashboard 用于集中查看项目进度、提醒、授权、排期和团队状态。',
      suggestedQuestions: ['哪些事项最紧急？', '怎么进入项目？', '怎么查看团队和排期？'],
      visibleActions: ['项目总览', '动作队列', '提醒', '排期', '团队'],
    }
  }

  if (pathname.startsWith('/pricing-preview')) {
    return {
      routeName: '价格与费用说明',
      pageSummary: '静态页面：展示当前费用模式、Service Credits 草案（未启用）、未来商业化方向预览。不接支付，不启用收费，不改任何业务逻辑。',
      suggestedQuestions: ['我的 API 会扣费吗？', '平台服务费是什么？', '充值积分是给 Provider 吗？', '当前什么情况下扣费？'],
      visibleActions: ['查看当前费用模式', '查看 Service Credits 草案', '查看费用 FAQ', 'API Key 指南', '我的 API 账户'],
    }
  }

  if (pathname.startsWith('/help/api-keys')) {
    return {
      routeName: 'API Key 接入指南',
      pageSummary: '静态教程页：如何获取各 Provider 的 API Key 并接入 Creator City。包含 DeepSeek、OpenAI、Kimi、Seedream Image 等接入步骤，以及 BYOK 费用说明（当前不扣平台积分）。',
      suggestedQuestions: ['DeepSeek API Key 怎么获取？', 'OpenAI key 在哪里？', '使用我的 API 会扣费吗？', '认证失败怎么排查？'],
      visibleActions: ['查看各 Provider 接入步骤', '前往模型账户中心添加账户', '查看常见错误排查', '返回帮助中心'],
    }
  }

  if (pathname.startsWith('/help')) {
    return {
      routeName: '帮助中心',
      pageSummary: '诊断帮助中心：快速定位图片、视频、资产、任务、登录与部署问题。包含常见错误排查和 API Key 接入指南入口。',
      suggestedQuestions: ['图片生成失败怎么办？', '视频生成没有结果？', 'API Key 怎么填？', '怎么排查登录问题？'],
      visibleActions: ['查看诊断说明', 'API Key 接入指南', '我的 API 账户'],
    }
  }

  if (pathname.startsWith('/account/credits')) {
    return {
      routeName: '平台积分 / 充值',
      pageSummary: '查看平台 credits 余额、充值和消费记录。Creator City credits 是平台额度，用于代付模型调用，不等于 Provider 账户充值。',
      suggestedQuestions: ['充值后积分去哪了？', '充值是给 OpenAI / DeepSeek 充值吗？', '平台服务费会扣我的积分吗？'],
      visibleActions: ['查看余额', '购买积分', '费用说明 →/pricing-preview', '我的 API →/account/providers'],
    }
  }

  if (pathname.startsWith('/account/usage')) {
    return {
      routeName: '用量历史',
      pageSummary: '查看生成用量记录，包括使用模式（平台额度 / 我的 API）、生成类型、状态和用量统计。平台服务费字段当前显示为 0。',
      suggestedQuestions: ['哪些生成走的是我的 API？', '平台服务费是什么？', '用量怎么查看？'],
      visibleActions: ['查看用量列表', '过滤生成类型', '费用说明 →/pricing-preview'],
    }
  }

  return {
    routeName: '当前页面',
    pageSummary: '这是 Creator City 的一个工作页面，我可以帮你解释可见入口、导航到主要板块并建议下一步。',
    suggestedQuestions: ['这个页面能做什么？', '下一步该做什么？', '怎么回到 AI 画布？'],
    visibleActions: ['解释当前页面', '导航到主要板块', '复制当前链接'],
  }
}

export function getAgentPageContext(pathname: string): AgentPageContext {
  const config = pageConfig(pathname)
  const projectId = getProjectIdFromPath(pathname)

  return {
    pathname,
    projectId,
    routeName: config.routeName,
    pageSummary: config.pageSummary,
    visibleActions: config.visibleActions,
    suggestedQuestions: config.suggestedQuestions,
    quickActions: [...BASE_ACTIONS, ME_ACTION],
    toolAvailabilitySummary: '工具状态以 /tools 页面为准；未配置 API key 的能力必须标记为 not-configured、mock 或 bridge-only。',
  }
}
