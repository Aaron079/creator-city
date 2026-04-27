'use client'

import { AgentComposer } from '@/components/agent/AgentComposer'
import { AgentMessageList } from '@/components/agent/AgentMessageList'
import { AgentQuickActions } from '@/components/agent/AgentQuickActions'
import { AgentStatusBadge } from '@/components/agent/AgentStatusBadge'
import styles from './agent.module.css'
import type { AgentMessage, AgentPageContext, AgentQuickActionId, AgentReplyMode } from '@/lib/agent/types'

export function AgentPanel({
  apiConfigured,
  context,
  isLoading,
  lastError,
  messages,
  mode,
  onAction,
  onClose,
  onSend,
}: {
  apiConfigured: boolean
  context: AgentPageContext
  isLoading: boolean
  lastError: string
  messages: AgentMessage[]
  mode: AgentReplyMode
  onAction: (actionId: AgentQuickActionId) => void
  onClose: () => void
  onSend: (value: string) => void
}) {
  return (
    <section className={styles.panel} aria-label="Creator City Agent 对话框">
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>{context.routeName}</div>
          <h2 className={styles.title}>Creator City Agent</h2>
        </div>
        <div className={styles.headerActions}>
          <AgentStatusBadge configured={apiConfigured} mode={mode} />
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="关闭 Creator City Agent">
            ×
          </button>
        </div>
      </header>

      <div className={styles.contextCard}>
        <strong>{context.routeName}</strong>
        <span>{context.pageSummary}</span>
      </div>

      {lastError ? <div className={styles.errorCard}>{lastError}</div> : null}

      <AgentQuickActions context={context} disabled={isLoading} onAction={onAction} />
      <AgentMessageList messages={messages} isLoading={isLoading} />
      <AgentComposer disabled={isLoading} onSend={onSend} />
    </section>
  )
}
