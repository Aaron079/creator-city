import styles from './agent.module.css'
import type { AgentPageContext, AgentQuickActionId } from '@/lib/agent/types'

export function AgentQuickActions({
  context,
  disabled,
  onAction,
}: {
  context: AgentPageContext
  disabled: boolean
  onAction: (actionId: AgentQuickActionId) => void
}) {
  return (
    <div className={styles.quickActions} aria-label="Creator City Agent 快捷动作">
      {context.quickActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={styles.chip}
          title={action.description}
          onClick={() => onAction(action.id)}
          disabled={disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
