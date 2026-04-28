import type { AgentMessage, AgentPageContext } from '@/lib/agent/types'

function latestUserText(messages: AgentMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? ''
}

export function explainCurrentPage(context: AgentPageContext) {
  const actions = context.visibleActions.length > 0
    ? `\n\n你现在可以做：${context.visibleActions.join('、')}。`
    : ''

  if (context.pathname.startsWith('/create')) {
    return `${context.routeName}：${context.pageSummary}\n\n常用操作：双击画布创建节点；点击节点打开节点对话框；节点右侧 + 可以创建下游节点；底部参数胶囊可以打开比例、清晰度、时长等参数；右上角“客户”会进入客户交付。${actions}`
  }

  if (context.pathname.startsWith('/tools')) {
    return `${context.routeName}：${context.pageSummary}\n\n重点看 provider 的状态：available 表示可用，not-configured 表示缺 API key，mock 表示本地模拟，bridge-only 表示需要外部桥接。${actions}`
  }

  if (context.pathname.startsWith('/review/')) {
    return `${context.routeName}：${context.pageSummary}\n\n这里适合客户查看版本、提交反馈，并在交付审批区域确认交付。外部客户页只解释当前流程，不暴露内部项目数据。${actions}`
  }

  return `${context.routeName}：${context.pageSummary}${actions}`
}

export function suggestNextStep(context: AgentPageContext) {
  if (context.pathname.startsWith('/create')) {
    return '建议下一步：先双击画布创建一个视频或图片节点，写一句清晰 prompt；如果要交给客户看，点右上角“客户”进入交付审批。需要看模型是否真实可用时，打开“工具/API”。'
  }

  if (context.pathname.startsWith('/tools')) {
    return '建议下一步：先检查关键 provider 是否 available；如果看到 not-configured，就在服务端环境变量里配置对应 API key；再回到 AI 画布创建节点测试。'
  }

  if (context.pathname.startsWith('/projects')) {
    return '建议下一步：进入最近的项目，查看 Review、工作区和交付入口；如果项目要给客户确认，使用“客户交付”快捷动作。'
  }

  if (context.pathname.startsWith('/review/')) {
    return '建议下一步：查看当前版本和交付审批区域，确认是否需要提交反馈、创建 resolution item，或完成交付确认。'
  }

  if (context.pathname.startsWith('/community')) {
    return '建议下一步：浏览社群动态或创作者线索；如果已有想法，直接进入 AI 画布开始做节点。'
  }

  return '建议下一步：如果你要开始创作，进入 AI 画布；如果要管理工作，进入项目或我的工作台；如果要检查模型能力，进入工具/API。'
}

export function buildLocalAgentReply(input: {
  messages: AgentMessage[]
  context: AgentPageContext
  apiConfigured?: boolean
}) {
  const text = latestUserText(input.messages).toLowerCase()
  const prefix = input.apiConfigured
    ? ''
    : 'Creator City Agent 当前为本地帮助模式。\n\n'

  if (!text) {
    return `${prefix}${explainCurrentPage(input.context)}`
  }

  if (text.includes('下一步') || text.includes('next')) {
    return `${prefix}${suggestNextStep(input.context)}`
  }

  if (text.includes('解释') || text.includes('这个页面') || text.includes('能做什么') || text.includes('what can')) {
    return `${prefix}${explainCurrentPage(input.context)}`
  }

  if (text.includes('客户') || text.includes('交付') || text.includes('审片') || text.includes('delivery') || text.includes('review')) {
    const projectPart = input.context.projectId ? `当前项目会进入 /review/${input.context.projectId}#delivery-approval。` : '没有当前项目时会进入 /review/order-seed-1#delivery-approval。'
    return `${prefix}进入客户交付：点击 Agent 的“客户交付”快捷动作，或在 /create 画布右上角点击“客户”。${projectPart}`
  }

  if (text.includes('工具') || text.includes('api') || text.includes('provider') || text.includes('模型')) {
    return `${prefix}工具/API 状态在 /tools。available 表示真实可用，not-configured 表示缺 API key，mock 表示本地模拟，bridge-only 表示需要外部桥接。点击“工具/API”快捷动作即可进入。`
  }

  if (text.includes('节点') || text.includes('画布') || text.includes('create')) {
    return `${prefix}/create 画布里：双击空白创建节点；点击节点打开对话框；节点右侧 + 创建下游节点；参数胶囊可改比例、清晰度、时长；右上角“客户”进入交付审批。`
  }

  if (text.includes('复制') || text.includes('链接') || text.includes('link')) {
    return `${prefix}点击“复制链接”快捷动作会复制当前页面 URL；如果浏览器 clipboard 不可用，会弹出手动复制窗口。`
  }

  return `${prefix}${explainCurrentPage(input.context)}\n\n你也可以问：${input.context.suggestedQuestions.join('、')}。`
}
