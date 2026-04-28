'use client'

import { AgentComposer } from '@/components/agent/AgentComposer'
import { AgentMessageList } from '@/components/agent/AgentMessageList'
import { AgentQuickActions } from '@/components/agent/AgentQuickActions'
import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import styles from './agent.module.css'
import type { AgentMessage, AgentPageContext, AgentQuickActionId, AgentReplyMode } from '@/lib/agent/types'

export function AgentPanel({
  isLoading,
  messages,
  context,
  lastMode,
  lastConfigured,
  onClose,
  onSend,
  onAction,
}: {
  isLoading: boolean
  messages: AgentMessage[]
  context: AgentPageContext
  lastMode: AgentReplyMode
  lastConfigured: boolean
  onClose: () => void
  onSend: (value: string) => void
  onAction: (actionId: AgentQuickActionId) => void
}) {
  return (
    <section className={styles.panel} aria-label="Creator City Agent 对话框">
      <header className={styles.header}>
        <h2 className={styles.title}>Creator City</h2>
        <AgentStatusBadge configured={lastConfigured} mode={lastMode} />
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭 Creator City Agent">
          ×
        </button>
      </header>

      <AgentMessageList messages={messages} isLoading={isLoading} />
      <AgentQuickActions context={context} disabled={isLoading} onAction={onAction} />
      <AgentComposer disabled={isLoading} onSend={onSend} />
    </section>
  )
}
