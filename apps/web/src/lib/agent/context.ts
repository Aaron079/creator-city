import type { AgentPageContext, AgentQuickAction } from '@/lib/agent/types'

const BASE_ACTIONS: AgentQuickAction[] = [
  { id: 'navigate:create', label: 'AI 画布', description: '打开 AI 创作画布' },
  { id: 'navigate:projects', label: '项目', description: '查看项目列表' },
  { id: 'navigate:community', label: '社群', description: '进入社群页面' },
  { id: 'navigate:tools', label: '工具/API', description: '查看工具和 provider 状态' },
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
      suggestedQuestions: ['如何开始创作？', '如何创建下一个节点？', '如何进入客户交付？', '当前工具是真实 API 还是 mock？'],
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
