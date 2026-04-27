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
      <div className={styles.emptyState}>
        我可以帮你理解当前页面、找到入口、解释工具状态和建议下一步。
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
            {message.role === 'user' ? '你' : message.mode === 'real' ? 'Creator City Agent · Real AI' : message.mode === 'error' ? 'Creator City Agent · Error' : 'Creator City Agent · Local Help'}
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
