import { getClientDeliveryHref } from '@/lib/routing/actions'
import { explainCurrentPage, suggestNextStep } from '@/lib/agent/local-assistant'
import type { AgentPageContext, AgentQuickActionId } from '@/lib/agent/types'

const API_KEY_GUIDE_REPLY = `Creator City 主流 Provider API Key 接入指南

━━ 什么是 API Key？
API Key 是 Provider 控制台生成的访问密钥（通常以 sk- 开头），与你的网页登录密码完全不同。
普通用户不需要 API Key，使用平台额度即可创作。API Key 是给专业用户的可选能力。

━━ 当前支持（文本试点）
· DeepSeek — 前往 DeepSeek 开放平台 → API Keys → 创建 Key → Creator City「我的 API」选 DeepSeek V4 Flash/Pro → 粘贴保存
· OpenAI — 前往 OpenAI Platform → API keys → Create new secret key → 选 OpenAI GPT → 粘贴保存
· Kimi — 前往 Kimi/Moonshot 开放平台 → API 密钥 → 创建 Key → 选 Kimi K2.6 → 粘贴保存

━━ 教程预留（后续支持）
Gemini / Claude / 阿里 DashScope / 火山引擎 / 腾讯混元 / 百度千帆 / 智谱 GLM /
Runway / Kling / MiniMax / ElevenLabs / Stability / Replicate / Fal.ai / OpenRouter

━━ 通用操作路径
我的 API → Provider API 账户 → 添加账户 → 选 Provider → 填账户名称 → 粘贴 API Key → 保存 → 测试连接

━━ 安全提醒
不要填登录密码；不要截图或分享 Key；Creator City 只加密保存，默认只显示末 4 位；Provider 费用由你直接支付给服务商，Creator City 不代扣。

你可以继续问：「DeepSeek API Key 怎么获取？」「OpenAI key 在哪里找？」「Kimi 怎么接？」`

export function getAgentActionHref(actionId: AgentQuickActionId, context: AgentPageContext) {
  switch (actionId) {
    case 'navigate:create':
      return '/create'
    case 'navigate:projects':
      return '/projects'
    case 'navigate:community':
      return '/community'
    case 'navigate:tools':
      return '/tools'
    case 'navigate:me':
      return '/me'
    case 'navigate:my-api':
      return '/account/providers'
    case 'navigate:client-delivery':
      return getClientDeliveryHref(context.projectId)
    default:
      return null
  }
}

export function getAgentLocalActionReply(actionId: AgentQuickActionId, context: AgentPageContext) {
  if (actionId === 'explain-current-page') return explainCurrentPage(context)
  if (actionId === 'suggest-next-step') return suggestNextStep(context)
  if (actionId === 'copy-current-link') return '当前链接已复制。'
  if (actionId === 'ask:api-key-guide') return API_KEY_GUIDE_REPLY

  const href = getAgentActionHref(actionId, context)
  return href ? `已打开：${href}` : '这个快捷动作暂时无法执行。'
}

export async function copyCurrentLink() {
  if (typeof window === 'undefined') return false
  const href = window.location.href

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(href)
      return true
    }
  } catch {
    // Fall through to prompt fallback.
  }

  try {
    window.prompt('复制这个链接', href)
    return true
  } catch {
    return false
  }
}
