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
    return `${routeName}：${pageSummary}\n\n这是内部项目成员 Review Portal，不是客户交付链接。真实客户请使用 /delivery/<token>，无需登录或加入 ProjectMember。`
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

  } else if (text.includes('deepseek') && (text.includes('key') || text.includes('密钥') || text.includes('接') || text.includes('怎么') || text.includes('如何') || text.includes('获取'))) {
    content = `${prefix}DeepSeek API Key 获取步骤：

1. 前往 DeepSeek 官方开放平台并登录账号
2. 进入「API Keys / API 密钥」页面
3. 创建新 API Key 并完整复制（注意：不是登录密码）
4. 在 Creator City → 我的 API → 添加账户
5. Provider 选「DeepSeek V4 Flash」或「DeepSeek V4 Pro」
6. 粘贴 API Key，保存后点击「测试连接」

状态：当前文本试点支持，可用于文本节点 BYOK 生成。
注意：认证失败请检查 Key 是否完整、账户是否有余额。`

  } else if (text.includes('openai') && (text.includes('key') || text.includes('密钥') || text.includes('接') || text.includes('怎么') || text.includes('如何') || text.includes('获取'))) {
    content = `${prefix}OpenAI API Key 获取步骤：

1. 前往 OpenAI Platform 并登录账号
2. 进入「API keys / Project API keys」
3. 点击「Create new secret key」，完整复制（只展示一次）
4. 在 Creator City → 我的 API → 添加账户
5. Provider 选「OpenAI GPT」，粘贴 API Key，保存

状态：当前文本试点支持，可用于文本节点 BYOK 生成。
注意：不是 ChatGPT 网页登录密码，是 Platform 控制台生成的 Key；账户需有可用余额。`

  } else if ((text.includes('kimi') || text.includes('moonshot') || text.includes('月之暗面')) && (text.includes('key') || text.includes('密钥') || text.includes('接') || text.includes('怎么') || text.includes('如何') || text.includes('获取'))) {
    content = `${prefix}Kimi / Moonshot API Key 获取步骤：

1. 前往 Kimi / Moonshot AI 开放平台并登录
2. 找到「API Key / API 密钥」管理页面
3. 创建并完整复制 API Key
4. 在 Creator City → 我的 API → 添加账户
5. Provider 选「Kimi K2.6」，粘贴 API Key，保存

状态：当前文本试点支持，可用于文本节点 BYOK 生成。
注意：不要填网页登录密码；限流或额度不足时，前往 Kimi 控制台检查余额。`

  } else if ((text.includes('gemini') || text.includes('google')) && (text.includes('key') || text.includes('密钥') || text.includes('接') || text.includes('怎么') || text.includes('如何'))) {
    content = `${prefix}Google Gemini API Key 获取步骤：

1. 前往 Google AI Studio 并登录账号
2. 在「API Keys」中创建 Gemini API Key
3. 复制 API Key
4. 回到 Creator City → 我的 API → 添加账户（当前暂无 Gemini 选项，后续接入）

状态：教程预留，后续支持。当前 Creator City 暂未开放 Gemini 的「我的 API」生成。
注意：API Key 不能截图或公开分享；需确认地区可用性和账单开通状态。`

  } else if ((text.includes('claude') || text.includes('anthropic')) && (text.includes('key') || text.includes('密钥') || text.includes('接') || text.includes('怎么') || text.includes('如何'))) {
    content = `${prefix}Anthropic Claude API Key 获取步骤：

1. 前往 Anthropic Console 并登录账号
2. 在「Account Settings / API Keys」中生成 API Key
3. 复制 API Key
4. 回到 Creator City → 我的 API（当前暂无 Claude 选项，后续接入）

状态：教程预留，后续支持。当前 Creator City 暂未开放 Claude 的「我的 API」生成。
注意：只使用官方 Anthropic 控制台的 Key，不要使用来源不明的中转 Key。`

  } else if ((text.includes('阿里') || text.includes('dashscope') || text.includes('通义') || text.includes('千问')) && (text.includes('key') || text.includes('接') || text.includes('怎么') || text.includes('如何'))) {
    content = `${prefix}阿里 DashScope / 通义千问 API Key：

1. 前往阿里云 DashScope / 通义千问控制台
2. 开通服务并创建 API Key
3. 复制 API Key
4. 回到 Creator City → 我的 API（当前暂无阿里 Provider 选项，后续接入）

状态：教程预留，后续支持。
注意：可能需要阿里云账号、实名认证、余额开通。`

  } else if ((text.includes('火山') || text.includes('豆包') || text.includes('volcengine')) && (text.includes('key') || text.includes('byok') || text.includes('自己') || text.includes('接') || text.includes('怎么'))) {
    content = `${prefix}火山引擎 / 豆包 API Key：

当前 Creator City 已通过平台侧支持火山图片/视频生成（Seedream / Seedance），用户不需要自己的火山 Key 即可使用。

用户自有火山 BYOK：
1. 前往火山引擎控制台，找到方舟/豆包相关 API Key 管理
2. 创建并复制密钥
3. 后续 Creator City 接入后可在「我的 API」填写

状态：BYOK 教程预留，后续支持。注意：部分服务使用 Access Key + Secret Key，非单个 sk-key。`

  } else if ((text.includes('runway') || text.includes('kling') || text.includes('可灵') || text.includes('minimax') || text.includes('海螺') || text.includes('elevenlabs') || text.includes('配音') || text.includes('stability') || text.includes('replicate') || text.includes('fal') || text.includes('openrouter') || text.includes('groq') || text.includes('fireworks')) && (text.includes('key') || text.includes('接') || text.includes('怎么') || text.includes('如何'))) {
    content = `${prefix}图像/视频/音频 Provider API Key：

当前 Creator City 对以下 Provider 处于教程预留阶段，暂未开放「我的 API」生成：
· Runway（视频生成）
· Kling / 可灵（图生视频）
· MiniMax / 海螺（视频/语音/多模态）
· ElevenLabs（AI 配音/语音合成）
· Stability AI（图像生成）
· Replicate（多模型托管）
· Fal.ai（图像/视频/实时生成）
· OpenRouter / Groq / Fireworks（多模型聚合）

这些 Provider 的 API Key 通常可在各自官方控制台或 Dashboard 的「API Keys / API tokens」页面获取。

后续 Creator City 接入后，可在「我的 API → Provider API 账户」填写并测试连接。`

  } else if (
    text.includes('api key') || text.includes('apikey') ||
    (text.includes('key') && (text.includes('密钥') || text.includes('怎么填') || text.includes('在哪') || text.includes('如何获取') || text.includes('获取') || text.includes('填写') || text.includes('哪里找'))) ||
    text.includes('api密钥') || text.includes('key是什么') || text.includes('密钥是什么')
  ) {
    content = `${prefix}API Key 是什么？

API Key 是 Provider 控制台生成的访问密钥（通常以 sk- 开头），与你的网页登录密码完全不同。

普通用户完全不需要 API Key，使用平台额度即可创作。
API Key 是给专业用户和团队的可选能力，用于直接接入自己的 Provider 账户，费用由你直接支付给服务商。

当前支持（文本试点）：
· DeepSeek — 前往 DeepSeek 开放平台 → API Keys → 创建 Key
· OpenAI — 前往 OpenAI Platform → API keys → Create secret key
· Kimi — 前往 Kimi/Moonshot 开放平台 → API 密钥 → 创建 Key

操作路径：我的 API → Provider API 账户 → 添加账户 → 选 Provider → 填 API Key → 保存 → 测试连接

安全提醒：不要填登录密码；不要截图或分享 Key；Creator City 只加密保存，默认只显示末 4 位。

你可以进一步问：「DeepSeek API Key 怎么获取？」「OpenAI key 在哪里？」「Kimi 怎么接？」`

  } else if (
    text.includes('我的api') || text.includes('byok') || text.includes('自己的key') || text.includes('自己的api') ||
    text.includes('provider账户') || text.includes('接入账户') || text.includes('添加账户') ||
    (text.includes('自己') && (text.includes('provider') || text.includes('模型') || text.includes('账户')))
  ) {
    content = `${prefix}如何使用我的 API 账户（BYOK）？

Creator City 支持你接入自己的 Provider API Key，API 费用直接由你支付给服务商，不经过 Creator City。

操作步骤：
1. 前往「我的 API → Provider API 账户」
2. 点击「添加账户」
3. 选择 Provider（如 DeepSeek、OpenAI、Kimi）
4. 填写账户名称和 API Key（不是登录密码）
5. 保存后点击「测试连接」验证

当前支持：DeepSeek、OpenAI、Kimi（文本试点）
后续支持：Gemini、Claude、阿里、火山、Runway 等

注意：填写 API Key 时必须是 Provider 控制台生成的密钥，不是你的登录账号和密码。

点击下方「我的 API」快捷动作直接进入管理页面。`

  } else if (
    text.includes('认证失败') || text.includes('auth failed') || text.includes('key无效') ||
    (text.includes('key') && (text.includes('失败') || text.includes('错误') || text.includes('不对')))
  ) {
    content = `${prefix}API Key 认证失败排查：

常见原因：
1. 填写了网页登录密码，而不是控制台生成的 API Key
2. 复制 Key 时不完整（漏掉了开头或结尾字符）
3. API Key 已过期或被撤销
4. Provider 账户余额不足或试用额度用尽
5. 账户被 Provider 限制

解决方法：
· 前往对应 Provider 控制台重新复制 API Key
· 确认是 API Keys / API 密钥页面，不是账号设置页面
· 删除旧账户，重新在「我的 API」添加
· 去 Provider 控制台检查账户余额和状态`

  } else if (
    text.includes('平台服务费') || text.includes('service credits') ||
    text.includes('service fee') || text.includes('服务费') ||
    (text.includes('服务') && text.includes('扣'))
  ) {
    content = `${prefix}平台服务费 / Service Credits 说明：

【当前状态】
平台服务费当前未启用，显示为 0，不会扣费。
Service credits 是未来可能的平台工具服务费单位，当前也未启用。

【为什么未来可能有平台服务费？】
即使你使用自己的 API Key，平台仍提供画布、资产存储、账号加密、用量日志、协作等 SaaS 能力。
未来如果启用，会为这些平台工具服务收取费用——而不是赚 API 差价。

【未来启用的前提条件（全部满足才可考虑）】
· 生成前必须明确展示费用（用户确认后才扣）
· 失败任务必须全额退还 service credits
· 账单明细必须可查
· 必须有 feature flag 且默认关闭
· 必须提前通知并给过渡期
· 用户有可关闭 / 降级开关
· 完成 30–60 天真实用量观察

【现在】
当前平台服务费 = 0，不收，不扣，不启用。

查看完整草案：/pricing-preview`

  } else if (
    text.includes('我的api会扣') || text.includes('byok会扣') ||
    text.includes('我的api扣') || text.includes('用我的api') ||
    text.includes('使用我的api') || text.includes('连接自己') ||
    (text.includes('扣') && (text.includes('平台积分') || text.includes('platform credits'))) ||
    (text.includes('扣') && text.includes('service fee')) ||
    text.includes('不赚差价') || text.includes('差价')
  ) {
    content = `${prefix}使用「我的 API」会扣费吗？

【当前答案：不扣平台 credits，不收平台服务费】
· Provider API 费用：由你直接支付给 Provider（DeepSeek、OpenAI、火山方舟等）
· 平台模型 credits：不扣
· 平台服务费：当前未启用，显示为 0，不扣

Creator City 当前不赚 API 差价，不代收 Provider 费用，不作为 API 中间商参与计费。

如果未来启用平台服务费，会提前通知并在生成前展示费用，并且失败任务必须退还。

查看费用说明：/pricing-preview | 管理账户：/account/providers`

  } else if (
    text.includes('充值') && (text.includes('provider') || text.includes('openai') || text.includes('deepseek') || text.includes('给') || text.includes('是不是'))
  ) {
    content = `${prefix}充值 Creator City 积分是给 Provider 充值吗？

【不是】

· Creator City credits 是平台额度，用于平台代付模型调用。
· 充值后，Provider（OpenAI / DeepSeek / 火山方舟等）不会收到这笔钱。
· Provider 的 API 账单需要你自己去 Provider 控制台处理。

如果你想使用自己的 Provider 账户（BYOK），请在「我的 API → Provider API 账户」添加自己的 API Key。
Provider 费用由你直接支付给 Provider；Creator City 不参与这部分计费。

查看费用说明：/pricing-preview | 我的 API：/account/providers`

  } else if (
    (text.includes('谁') || text.includes('who')) &&
    (text.includes('收费') || text.includes('付费') || text.includes('扣费') || text.includes('计费'))
  ) {
    content = `${prefix}使用 Creator City 时谁在收费？

【平台额度模式（默认）】
· 你支付给 Creator City，Creator City 代付给 Provider。
· Creator City 负责模型调用费用。

【我的 API 模式（BYOK）】
· Provider 费用：你直接支付给 Provider（DeepSeek / OpenAI / 火山方舟等）
· Creator City：当前不代收 Provider 费用，不赚差价
· 平台服务费：当前未启用（= 0）

【未来可能变化】
如果平台启用服务费，会提前通知，并在生成前明确显示预估费用。失败任务必须退还。

查看费用说明：/pricing-preview`

  } else if (
    (text.includes('什么时候') || text.includes('何时') || text.includes('多久')) &&
    (text.includes('服务费') || text.includes('service') || text.includes('收费') || text.includes('启用'))
  ) {
    content = `${prefix}平台服务费什么时候启用？

当前没有启用时间表。

需要先完成的工作：
1. 真实用量观察（30–60 天）
2. 生成前价格展示功能
3. 失败退款机制
4. 账单明细页面
5. Feature flag + 通知机制
6. 争议处理流程

以上全部就绪后才会考虑。启用前会提前公告并给过渡期。

当前平台服务费 = 0，不启用，不扣费。`

  } else if (
    (text.includes('失败') || text.includes('退') || text.includes('refund')) &&
    (text.includes('服务费') || text.includes('service credits') || text.includes('credits'))
  ) {
    content = `${prefix}生成失败会退还 service credits 吗？

当前平台服务费未启用，所以当前不会产生服务费扣费，也不存在退款场景。

如果未来启用平台服务费：
· 失败任务必须全额退还 service credits（这是启用的必要前提条件之一）
· 退还逻辑必须在启用前完成并通过测试

当前：使用「我的 API」生成失败，只有 Provider 的 API 费用（由 Provider 决定是否退还），Creator City 不参与这部分退款。`

  } else if (
    (text.includes('普通用户') || text.includes('需要') || text.includes('必须')) &&
    (text.includes('api key') || text.includes('key') || text.includes('密钥'))
  ) {
    content = `${prefix}普通用户需要 API Key 吗？

不需要。普通用户使用平台额度（Creator City credits）即可创作，无需管理任何 API Key。

API Key 是给专业用户和工作室的可选功能：
· 接入自己的 Provider 账户（DeepSeek / OpenAI / Kimi / 火山方舟等）
· Provider 费用由你直接支付给 Provider
· Creator City 不代扣、不赚差价

操作路径：我的 API → Provider API 账户 → 添加账户

详细指南：/help/api-keys`

  } else if (
    text.includes('平台额度') || text.includes('积分') ||
    (text.includes('额度') && !text.includes('api')) ||
    text.includes('credits') ||
    (text.includes('充值') && !text.includes('api'))
  ) {
    content = `${prefix}平台额度 vs 我的 API 账户：

平台额度（默认）：
· 购买 Creator City 积分，由平台代付 API 调用费用
· 适合轻度用户，无需管理任何 API Key

我的 API 账户（可选）：
· 接入自己的 Provider API Key
· API 费用由你直接支付给服务商（DeepSeek、OpenAI 等），Creator City 不代扣
· Creator City 当前不赚 API 差价，平台服务费当前未启用

两者可以共存：当你选择「我的 API」模式时，该次生成使用你的 Key；默认仍使用平台额度。

查看费用说明：/pricing-preview`

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
      ? `当前项目会进入 /projects/${projectId}/delivery。`
      : '没有当前项目时会先进入 /projects，请先打开一个真实项目。'
    content = `${prefix}进入客户交付：点击 Agent 的"客户交付"快捷动作，或在 /create 画布右上角点击"客户"。${projectPart}`

  } else if (
    (text.includes('api') || text.includes('provider') || text.includes('模型')) &&
    !text.includes('key') && !text.includes('密钥')
  ) {
    content = `${prefix}工具/API 状态在 /tools。available 真实可用，not-configured 缺 key，mock 本地模拟，bridge-only 需外部桥接。

如果你想用自己的 API Key 生成，可以问我：「API Key 怎么填？」或点击「API Key 指南」快捷动作。`

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
    content = `${prefix}当前 Agent 处于本地帮助模式，无法直接替你生成内容。可以这样开始：\n\n1. 进入 AI 画布（/create）\n2. 双击画布创建节点，选择 Video 或 Image 类型\n3. 在节点对话框里写 prompt，选择 provider\n4. 点击「生成」\n\n点击下方"进入 AI 画布"快捷动作直接开始；在"工具/API"可查看每个 provider 的当前状态。`

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
