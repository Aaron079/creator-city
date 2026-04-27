import { getClientDeliveryHref } from '@/lib/routing/actions'
import { explainCurrentPage, suggestNextStep } from '@/lib/agent/local-assistant'
import type { AgentPageContext, AgentQuickActionId } from '@/lib/agent/types'

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
