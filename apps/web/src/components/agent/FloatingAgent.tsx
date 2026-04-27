'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AgentPanel } from '@/components/agent/AgentPanel'
import { copyCurrentLink, getAgentActionHref, getAgentLocalActionReply } from '@/lib/agent/actions'
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
  const router = useRouter()
  const context = useMemo(() => getAgentPageContext(pathname), [pathname])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [apiConfigured, setApiConfigured] = useState(false)
  const [mode, setMode] = useState<AgentReplyMode>('local')
  const [lastError, setLastError] = useState('')

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

  const appendAssistant = useCallback((content: string, replyMode: AgentReplyMode) => {
    setMessages((current) => [...current, createMessage('assistant', content, replyMode)].slice(-20))
    setMode(replyMode)
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    const userMessage = createMessage('user', content)
    const nextMessages = [...messages, userMessage].slice(-20)

    setMessages(nextMessages)
    setIsLoading(true)
    setLastError('')

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

      setApiConfigured(data.configured)
      if (!response.ok || data.mode === 'error') {
        const message = data.message || '模型调用失败，请检查 API 配置。'
        setLastError(message)
        appendAssistant(message, 'error')
        return
      }

      appendAssistant(data.message, data.mode)
    } catch {
      const message = '模型调用失败，请检查 API 配置。'
      setLastError(message)
      appendAssistant(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [appendAssistant, context, messages])

  const runAction = useCallback(async (actionId: AgentQuickActionId) => {
    setLastError('')
    setIsOpen(true)

    if (actionId === 'copy-current-link') {
      const copied = await copyCurrentLink()
      appendAssistant(copied ? '当前链接已复制。' : '复制失败，请手动复制浏览器地址栏链接。', copied ? 'local' : 'error')
      return
    }

    if (actionId === 'explain-current-page' || actionId === 'suggest-next-step') {
      appendAssistant(getAgentLocalActionReply(actionId, context), 'local')
      return
    }

    const href = getAgentActionHref(actionId, context)
    if (!href) {
      appendAssistant('这个快捷动作暂时无法执行。', 'error')
      return
    }

    appendAssistant(getAgentLocalActionReply(actionId, context), 'local')
    router.push(href)
  }, [appendAssistant, context, router])

  const isCreate = pathname.startsWith('/create')

  return (
    <div className={`${styles.root} ${isCreate ? styles.rootCreate : ''}`}>
      {isOpen ? (
        <AgentPanel
          apiConfigured={apiConfigured}
          context={context}
          isLoading={isLoading}
          lastError={lastError}
          messages={messages}
          mode={mode}
          onAction={runAction}
          onClose={() => setIsOpen(false)}
          onSend={sendMessage}
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
