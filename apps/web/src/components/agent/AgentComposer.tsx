'use client'

import { useState } from 'react'
import styles from './agent.module.css'

export function AgentComposer({
  disabled,
  onSend,
}: {
  disabled: boolean
  onSend: (value: string) => void
}) {
  const [value, setValue] = useState('')

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    setValue('')
    onSend(trimmed)
  }

  return (
    <div className={styles.composer}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="问我当前页面、下一步、客户交付或工具状态…"
        className={styles.input}
        rows={2}
        disabled={disabled}
      />
      <button
        type="button"
        className={styles.sendButton}
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="发送给 Creator City Agent"
      >
        ↑
      </button>
    </div>
  )
}
