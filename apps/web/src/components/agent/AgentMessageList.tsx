import styles from './agent.module.css'
import type { AgentMessage } from '@/lib/agent/types'

export function AgentMessageList({
  messages,
  isLoading,
}: {
  messages: AgentMessage[]
  isLoading: boolean
}) {
  if (messages.length === 0) {
    return (
      <div className={styles.messageList}>
        <article className={`${styles.message} ${styles.messageAssistant}`}>
          <div className={styles.messageContent}>可以直接问我。</div>
        </article>
      </div>
    )
  }

  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
        <article
          key={message.id}
          className={`${styles.message} ${message.role === 'user' ? styles.messageUser : styles.messageAssistant} ${message.mode === 'error' ? styles.messageError : ''}`}
        >
          <div className={styles.messageMeta}>
            {message.role === 'user' ? '你' : 'Creator City'}
          </div>
          <div className={styles.messageContent}>{message.content}</div>
        </article>
      ))}
      {isLoading ? (
        <article className={`${styles.message} ${styles.messageAssistant}`}>
          <div className={styles.messageMeta}>Creator City Agent</div>
          <div className={styles.thinking}>思考中…</div>
        </article>
      ) : null}
    </div>
  )
}
