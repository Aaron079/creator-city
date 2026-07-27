'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type StoryboardDirectorRecoveryPrompt = {
  source: 'cache' | 'draft' | 'snapshot'
  nodeCount: number
  stageCRecoveryBatchIds: string[]
  stageCRecoveryStatus: 'none' | 'merged' | 'blocked'
}

type StoryboardDirectorInteractionGateProps = {
  children: ReactNode
  recovery: StoryboardDirectorRecoveryPrompt | null
  onBeforeInternalNavigation: (href: string) => boolean
  onRestore: () => void
  onKeepServer: () => void
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const RECOVERY_Z_INDEX = 2147483647
const SAME_CONTEXT_TARGETS = new Set(['', '_self', '_parent', '_top'])

type AccessibilityState = {
  ariaHidden: string | null
  inert: string | null
}

function restoreAttribute(element: HTMLElement, name: 'aria-hidden' | 'inert', value: string | null) {
  if (value === null) element.removeAttribute(name)
  else element.setAttribute(name, value)
}

export function StoryboardDirectorInteractionGate({
  children,
  recovery,
  onBeforeInternalNavigation,
  onRestore,
  onKeepServer,
}: StoryboardDirectorInteractionGateProps) {
  const guardedContentRef = useRef<HTMLDivElement>(null)
  const recoveryOverlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const recoveryOpen = recovery !== null

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!recoveryOpen || !portalReady) return
    const recoveryOverlay = recoveryOverlayRef.current
    if (!recoveryOverlay) return
    const accessibilityStates = new Map<HTMLElement, AccessibilityState>()

    const isolateBodySibling = (element: HTMLElement) => {
      if (element === recoveryOverlay || accessibilityStates.has(element)) return
      accessibilityStates.set(element, {
        ariaHidden: element.getAttribute('aria-hidden'),
        inert: element.getAttribute('inert'),
      })
      element.setAttribute('inert', '')
      element.setAttribute('aria-hidden', 'true')
    }

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    restoreButtonRef.current?.focus()
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement) isolateBodySibling(child)
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const addedNode of Array.from(record.addedNodes)) {
          if (addedNode instanceof HTMLElement) isolateBodySibling(addedNode)
        }
      }
    })
    observer.observe(document.body, { childList: true })

    const isRecoveryTarget = (target: EventTarget | null) => (
      target instanceof Node && recoveryOverlay.contains(target)
    )
    const blockOutsidePointer = (event: Event) => {
      if (isRecoveryTarget(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const blockOutsideKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isRecoveryTarget(event.target)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      restoreButtonRef.current?.focus()
    }
    const containFocus = (event: FocusEvent) => {
      if (isRecoveryTarget(event.target)) return
      event.stopImmediatePropagation()
      restoreButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', blockOutsidePointer, true)
    document.addEventListener('click', blockOutsidePointer, true)
    document.addEventListener('keydown', blockOutsideKeyDown, true)
    document.addEventListener('focusin', containFocus, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', blockOutsidePointer, true)
      document.removeEventListener('click', blockOutsidePointer, true)
      document.removeEventListener('keydown', blockOutsideKeyDown, true)
      document.removeEventListener('focusin', containFocus, true)
      for (const [element, state] of accessibilityStates) {
        restoreAttribute(element, 'inert', state.inert)
        restoreAttribute(element, 'aria-hidden', state.ariaHidden)
      }
      const previouslyFocused = previouslyFocusedElementRef.current
      previouslyFocusedElementRef.current = null
      if (previouslyFocused?.isConnected && previouslyFocused !== document.body) {
        window.requestAnimationFrame(() => previouslyFocused.focus())
      }
    }
  }, [portalReady, recoveryOpen])

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (recoveryOpen) {
      const target = event.target
      if (target instanceof Node && guardedContentRef.current?.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return
    const target = event.target
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null
    const navigationTarget = anchor ? anchor.target.toLowerCase() : ''
    if (
      !anchor
      || anchor.hasAttribute('download')
      || !SAME_CONTEXT_TARGETS.has(navigationTarget)
    ) return

    let url: URL
    try {
      url = new URL(anchor.href, window.location.href)
    } catch {
      return
    }
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.origin !== window.location.origin
    ) return
    if (onBeforeInternalNavigation(`${url.pathname}${url.search}${url.hash}`)) return
    event.preventDefault()
    event.stopPropagation()
  }, [onBeforeInternalNavigation, recoveryOpen])

  const handleRecoveryKeyDownCapture = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex >= 0)
    if (!focusable.length) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  const stageCRecoveryStatus = recovery?.stageCRecoveryStatus ?? 'none'
  const recoveryCount = recovery?.stageCRecoveryBatchIds.length ?? 0

  const recoveryPortal = recovery && portalReady
    ? createPortal(
      <div
        ref={recoveryOverlayRef}
        className="fixed inset-0 flex items-start justify-center bg-black/70 px-4 pt-28"
        style={{
          alignItems: 'flex-start',
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          inset: 0,
          justifyContent: 'center',
          padding: '7rem 1rem 0',
          position: 'fixed',
          zIndex: RECOVERY_Z_INDEX,
        }}
        data-storyboard-director-recovery-overlay="true"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <div
          ref={dialogRef}
          className="w-[min(92vw,520px)] rounded-lg border border-amber-300/25 bg-slate-950 p-4 shadow-2xl shadow-black/40"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="canvas-draft-recovery-title"
          aria-describedby="canvas-draft-recovery-description"
          tabIndex={-1}
          onKeyDownCapture={handleRecoveryKeyDownCapture}
        >
          <div id="canvas-draft-recovery-title" className="text-sm font-semibold text-white">
            发现本地画布草稿，是否恢复？
          </div>
          <div id="canvas-draft-recovery-description" className="mt-1 text-xs text-white/50">
            服务器版本已保留。{recovery.source === 'cache' ? '本地缓存' : '本地草稿'}包含 {recovery.nodeCount} 个节点。
          </div>
          {recoveryCount > 0 && stageCRecoveryStatus === 'merged' ? (
            <div className="mt-2 text-xs font-medium text-amber-200">
              检测到 {recoveryCount} 个未完成的分镜导演批次。恢复标记已合并到服务器画布视图，确认检查前不能重复执行。
            </div>
          ) : null}
          {recoveryCount > 0 && stageCRecoveryStatus === 'blocked' ? (
            <div className="mt-2 text-xs font-medium text-amber-200">
              检测到 {recoveryCount} 个无法安全合并的分镜导演批次。画布交互已锁定，请先恢复本地草稿，或明确确认风险后使用服务器版本。
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={restoreButtonRef}
              type="button"
              onClick={onRestore}
              className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-100"
            >
              恢复草稿
            </button>
            <button
              type="button"
              onClick={onKeepServer}
              className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:border-white/25 hover:text-white"
            >
              {stageCRecoveryStatus === 'blocked'
                ? '确认风险并使用服务器版本'
                : '使用服务器版本'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null

  return (
    <div
      className="flex h-full min-h-0 w-full flex-1 flex-col"
      style={{
        display: 'flex',
        flex: '1 1 0%',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        width: '100%',
      }}
      data-storyboard-director-interaction-shell="true"
      onClickCapture={handleClickCapture}
    >
      <div
        ref={guardedContentRef}
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        style={{
          display: 'flex',
          flex: '1 1 0%',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          width: '100%',
        }}
        data-storyboard-director-guarded-content="true"
      >
        {children}
      </div>
      {recoveryPortal}
    </div>
  )
}
