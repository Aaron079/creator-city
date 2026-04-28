'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { getAgentActionHref, getAgentLocalActionReply, copyCurrentLink } from '@/lib/agent/actions'
import { getAgentPageContext } from '@/lib/agent/context'
import type { AgentChatResponse, AgentMessage, AgentQuickActionId, AgentReplyMode } from '@/lib/agent/types'
import styles from './agent.module.css'

const STORAGE_KEY = 'creator-city-agent-messages'

function createMessage(role: AgentMessage['role'], content: string, mode?: AgentReplyMode): AgentMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now(),
    mode,
  }
}

export function FloatingAgent() {
  const pathname = usePathname() || '/'
  const context = useMemo(() => getAgentPageContext(pathname), [pathname])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [lastMode, setLastMode] = useState<AgentReplyMode>('local')
  const [lastConfigured, setLastConfigured] = useState(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as AgentMessage[]
      if (Array.isArray(parsed)) {
        setMessages(parsed.slice(-20))
      }
    } catch {
      // Ignore localStorage parse failures.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)))
    } catch {
      // localStorage can be disabled in private or embedded browsers.
    }
  }, [messages])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const appendAssistant = useCallback((content: string, replyMode: AgentReplyMode, configured: boolean) => {
    setLastMode(replyMode)
    setLastConfigured(configured)
    setMessages((current) => [...current, createMessage('assistant', content, replyMode)].slice(-20))
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    const userMessage = createMessage('user', content)
    const nextMessages = [...messagesRef.current, userMessage].slice(-20)

    setMessages(nextMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context,
        }),
      })
      const data = await response.json() as AgentChatResponse

      if (!response.ok || data.mode === 'error') {
        const message = data.message || '模型调用失败，请检查 API 配置。'
        appendAssistant(message, 'error', data.configured ?? false)
        return
      }

      appendAssistant(data.message, data.mode, data.configured ?? false)
    } catch {
      appendAssistant('模型调用失败，请检查 API 配置。', 'error', false)
    } finally {
      setIsLoading(false)
    }
  }, [appendAssistant, context])

  const handleAction = useCallback(async (actionId: AgentQuickActionId) => {
    if (actionId === 'copy-current-link') {
      await copyCurrentLink()
      appendAssistant(getAgentLocalActionReply(actionId, context), lastMode, lastConfigured)
      return
    }

    const href = getAgentActionHref(actionId, context)
    if (href) {
      window.location.href = href
      return
    }

    const reply = getAgentLocalActionReply(actionId, context)
    await sendMessage(reply)
  }, [appendAssistant, context, lastConfigured, lastMode, sendMessage])

  const isCreate = pathname.startsWith('/create')

  return (
    <div className={`${styles.root} ${isCreate ? styles.rootCreate : ''}`}>
      {isOpen ? (
        <AgentPanel
          isLoading={isLoading}
          messages={messages}
          context={context}
          lastMode={lastMode}
          lastConfigured={lastConfigured}
          onClose={() => setIsOpen(false)}
          onSend={sendMessage}
          onAction={handleAction}
        />
      ) : null}

      <button
        type="button"
        className={styles.floatingButton}
        onClick={() => setIsOpen((current) => !current)}
        aria-label="打开 Creator City Agent"
        title="Creator City Agent"
      >
        <span className={styles.agentMark}>AI</span>
        <span className={styles.buttonTooltip}>Creator City Agent</span>
      </button>
    </div>
  )
}
