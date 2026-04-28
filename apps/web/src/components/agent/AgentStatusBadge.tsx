import styles from './agent.module.css'
import type { AgentReplyMode } from '@/lib/agent/types'

export function AgentStatusBadge({
  configured,
  mode,
}: {
  configured: boolean
  mode: AgentReplyMode
}) {
  const label = mode === 'error'
    ? 'Error'
    : configured && mode === 'real'
      ? 'Remote Model'
      : 'Local Mode'
  const className = mode === 'error'
    ? styles.statusError
    : configured && mode === 'real'
      ? styles.statusReal
      : styles.statusLocal

  return <span className={`${styles.statusBadge} ${className}`}>{label}</span>
}
