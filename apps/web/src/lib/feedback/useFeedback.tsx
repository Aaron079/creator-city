'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { FeedbackToast, type FeedbackItem, type FeedbackTone } from '@/components/ui/FeedbackToast'

interface FeedbackContextValue {
  show: (tone: FeedbackTone, title: string) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const show = useCallback((tone: FeedbackTone, title: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setItems((current) => [...current.slice(-3), { id, tone, title }])
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 2600)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackToast items={items} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider')
  }

  return {
    success: (title: string) => context.show('success', title),
    warning: (title: string) => context.show('warning', title),
    error: (title: string) => context.show('error', title),
    info: (title: string) => context.show('info', title),
  }
}
