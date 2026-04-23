'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CommandResultList } from '@/components/command/CommandResultList'
import { CommandSearchInput } from '@/components/command/CommandSearchInput'
import { buildCommandResults, searchCommandResults, type CommandResult } from '@/lib/command/palette'
import type { WorkspacePortfolioData } from '@/lib/projects/workspace'
import type { PersonalWorkQueueData } from '@/lib/workqueue/aggregate'
import type { NotificationItem } from '@/store/notifications.store'

export function CommandPalette({
  portfolio,
  workQueue,
  notifications,
}: {
  portfolio: WorkspacePortfolioData
  workQueue: PersonalWorkQueueData
  notifications: NotificationItem[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)

  const results = useMemo(
    () => buildCommandResults({ portfolio, workQueue, notifications }),
    [notifications, portfolio, workQueue],
  )

  const filteredResults = useMemo(
    () => searchCommandResults(results, deferredQuery),
    [deferredQuery, results],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTypingTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }

      if (!open) return

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (isTypingTarget && target !== inputRef.current && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredResults.length - 1, 0)))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => Math.max(current - 1, 0))
        return
      }

      if (event.key === 'Enter') {
        const selected = filteredResults[selectedIndex]
        if (!selected) return
        event.preventDefault()
        setOpen(false)
        router.push(selected.href)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filteredResults, open, router, selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
  }, [deferredQuery, open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  function handleSelect(_: CommandResult) {
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
      >
        <span>Quick Open</span>
        <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
          ⌘K
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90] bg-[#02060d]/72 px-4 py-20 backdrop-blur-md" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220]/96 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <CommandSearchInput
              ref={inputRef}
              value={query}
              onChange={setQuery}
            />
            <div className="border-b border-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
              搜项目、页面入口、待处理事项、最近项目、Waiting For Me
            </div>
            <CommandResultList
              results={filteredResults}
              selectedIndex={selectedIndex}
              onHover={setSelectedIndex}
              onSelect={handleSelect}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
