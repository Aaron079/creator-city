import type { CreatorModelRequest, CreatorModelResponse } from './types'

const MODEL_NAME = process.env.CREATOR_MODEL_NAME || 'creator-city-local'

function responseId() {
  return `cmr_${Math.random().toString(36).slice(2, 10)}`
}

function latestUserText(messages: CreatorModelRequest['messages']) {
  return [...messages].reverse().find((m) => m.role === 'user')?.content.trim().toLowerCase() ?? ''
}

function explainPage(pathname: string, routeName: string, pageSummary: string) {
  if (pathname.startsWith('/create')) {
    return `${routeName}：${pageSummary}\n\n常用操作：双击画布创建节点；点击节点打开节点对话框；节点右侧 + 创建下游节点；底部参数胶囊可改比例、清晰度、时长；右上角"客户"进入交付审批。`
  }
  if (pathname.startsWith('/tools')) {
    return `${routeName}：${pageSummary}\n\navailable 表示真实可用，not-configured 表示缺 key，mock 表示本地模拟，bridge-only 表示需外部桥接。`
  }
  if (pathname.startsWith('/community')) {
    return `${routeName}：${pageSummary}\n\n查看灵感、案例、工作流分享；点击感兴趣的内容可以进入创作。`
  }
  if (pathname.startsWith('/projects')) {
    return `${routeName}：${pageSummary}\n\n查看项目列表和待处理事项；进入单个项目可打开画布、Review 和交付。`
  }
  if (pathname.startsWith('/me')) {
    return `${routeName}：${pageSummary}\n\n查看个人工作台、邀请记录、通知和账户设置。`
  }
  if (pathname.startsWith('/review/')) {
    return `${routeName}：${pageSummary}\n\n这里适合客户查看版本、提交反馈，并在交付审批区域确认交付。外部客户页只解释当前流程。`
  }
  return `${routeName}：${pageSummary}`
}

function suggestNextStep(pathname: string) {
  if (pathname.startsWith('/create')) {
    return '建议下一步：双击画布创建节点；点击节点打开对话框；节点右侧 + 继续下游节点；右上角"客户"进入交付审批。'
  }
  if (pathname.startsWith('/tools')) {
    return '建议下一步：检查关键 provider 是否 available；not-configured 需要在服务端配置 API key；再回到 AI 画布测试。'
  }
  if (pathname.startsWith('/projects')) {
    return '建议下一步：进入项目打开画布或 Review；若要给客户确认，使用"客户交付"快捷动作。'
  }
  if (pathname.startsWith('/community')) {
    return '建议下一步：浏览社群动态；有想法可以直接进入 AI 画布创建节点。'
  }
  if (pathname.startsWith('/review/')) {
    return '建议下一步：查看当前版本，确认是否需要提交反馈或完成交付确认。'
  }
  if (pathname.startsWith('/me')) {
    return '建议下一步：查看通知和待处理事项；从"项目"进入工作区或从"AI 画布"开始创作。'
  }
  return '建议下一步：进入 AI 画布开始创作；或进入项目管理工作；或查看 /tools 检查模型能力。'
}

export async function runLocalCreatorModel(
  request: CreatorModelRequest,
): Promise<CreatorModelResponse> {
  const { messages, context } = request
  const pathname = context?.pathname ?? '/'
  const routeName = context?.routeName ?? 'Creator City'
  const pageSummary = context?.pageSummary ?? ''
  const projectId = context?.projectId

  const text = latestUserText(messages)
  const prefix = 'Creator City Agent 当前为本地帮助模式。配置自有模型 endpoint 后可启用更强推理。\n\n'

  let content: string

  if (!text) {
    content = prefix + explainPage(pathname, routeName, pageSummary)
  } else if (text.includes('下一步') || text.includes('next step')) {
    content = prefix + suggestNextStep(pathname)
  } else if (
    text.includes('能做什么') ||
    text.includes('这个页面') ||
    text.includes('解释') ||
    text.includes('what can')
  ) {
    content = prefix + explainPage(pathname, routeName, pageSummary)
  } else if (
    text.includes('工具') && (text.includes('不能用') || text.includes('为什么'))
  ) {
    content = `${prefix}标记为 not-configured 的 provider 需要配置自有 endpoint/key；mock 只做模拟，不会调用第三方 API；bridge-only 只生成桥接请求。进入 /tools 查看每个 provider 的状态。`
  } else if (
    text.includes('怎么接模型') ||
    text.includes('接入模型') ||
    text.includes('配置模型') ||
    text.includes('remote mode')
  ) {
    content = `${prefix}配置方式：在服务端环境变量设置 CREATOR_MODEL_MODE=remote、CREATOR_MODEL_ENDPOINT（你自己的模型服务地址）、CREATOR_MODEL_API_KEY（只在服务端使用，不可暴露到浏览器）。`
  } else if (
    text.includes('客户') ||
    text.includes('交付') ||
    text.includes('审片') ||
    text.includes('delivery')
  ) {
    const projectPart = projectId
      ? `当前项目会进入 /review/${projectId}#delivery-approval。`
      : '可进入 /review/order-seed-1#delivery-approval。'
    content = `${prefix}进入客户交付：点击 Agent 的"客户交付"快捷动作，或在 /create 画布右上角点击"客户"。${projectPart}`
  } else if (
    text.includes('api') ||
    text.includes('provider') ||
    text.includes('模型')
  ) {
    content = `${prefix}工具/API 状态在 /tools。available 真实可用，not-configured 缺 key，mock 本地模拟，bridge-only 需外部桥接。`
  } else if (
    text.includes('节点') ||
    text.includes('画布') ||
    text.includes('canvas')
  ) {
    content = `${prefix}/create 画布：双击空白创建节点；点击节点打开对话框；节点右侧 + 创建下游节点；参数胶囊可改比例、清晰度、时长；右上角"客户"进入交付审批。`
  } else if (
    text.includes('视频') ||
    text.includes('图片') ||
    text.includes('音频') ||
    text.includes('生成') ||
    text.includes('制作') ||
    text.includes('帮我做') ||
    text.includes('做一个') ||
    text.includes('video') ||
    text.includes('image') ||
    text.includes('generate')
  ) {
    content = `${prefix}当前 Agent 处于本地帮助模式，还没有连接自有模型 endpoint，无法直接替你生成内容。可以这样开始：\n\n1. 进入 AI 画布（/create）\n2. 双击画布创建节点，选择 Video 或 Image 类型\n3. 在节点对话框里写 prompt，底部选择 provider（如 Runway、Kling、VEO、Sora、Vidu 等）\n4. 未配置 API key 的 provider 显示 not-configured，只能 mock 模拟\n5. 配置自有模型 endpoint 后可走真实生成链路\n\n点击下方"进入 AI 画布"快捷动作直接开始；在"工具/API"可查看每个 provider 的当前状态。`
  } else {
    content = `${prefix}${explainPage(pathname, routeName, pageSummary)}`
  }

  return {
    id: responseId(),
    createdAt: new Date().toISOString(),
    mode: 'local',
    provider: 'creator-city',
    model: MODEL_NAME,
    configured: false,
    content,
  }
}
