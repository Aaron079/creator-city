'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './canvasWorkspaceShell.module.css'

const INSPECTOR_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getInspectorFocusables(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(INSPECTOR_FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  )
}

/**
 * Canvas Workspace Shell — structural layout container.
 *
 * Phase 1: transparent wrapper. Slots are optional and hidden when empty.
 * Phase 2+: top command bar, left rail, right inspector, bottom dock progressively activate.
 *
 * Shell knows nothing about: nodes, edges, generation, providers, save/load.
 * Shell is a pure layout primitive.
 */
export type CanvasWorkspaceShellProps = {
  /** Stage content (required) — current VisualCanvasWorkspace full output for Phase 1 */
  children: ReactNode
  /** Top command bar slot — project title, save, export (Phase 2) */
  topCommand?: ReactNode
  /** Left tool rail slot — CanvasToolDock (Phase 3) */
  leftRail?: ReactNode
  /** Right inspector slot — node metadata, generation details (Phase 4) */
  rightInspector?: ReactNode
  /** Bottom generation dock slot — prompt + provider + generate (Phase 5) */
  bottomDock?: ReactNode
  /** Modal/overlay layer slot — unified portal mount (Phase 6) */
  modalLayer?: ReactNode
  /** Whether to show left rail when provided (default: true) */
  showLeftRail?: boolean
  /** Whether to show right inspector when provided (default: false) */
  showRightInspector?: boolean
  /** Whether to show bottom dock when provided (default: false) */
  showBottomDock?: boolean
  /** Dismisses the responsive right inspector shell */
  onDismissRightInspector?: () => void
  /** Compact layout for small screens */
  compact?: boolean
}

export function CanvasWorkspaceShell({
  children,
  topCommand,
  leftRail,
  rightInspector,
  bottomDock,
  modalLayer,
  showLeftRail = true,
  showRightInspector = false,
  showBottomDock = false,
  onDismissRightInspector,
}: CanvasWorkspaceShellProps) {
  const hasLeftRail = showLeftRail && leftRail != null
  const hasRightInspector = showRightInspector && rightInspector != null
  const hasBottomDock = showBottomDock && bottomDock != null
  const [isMobileInspector, setIsMobileInspector] = useState(false)
  const inspectorPanelRef = useRef<HTMLDivElement>(null)
  const previousFocusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const syncMobileInspector = () => setIsMobileInspector(mediaQuery.matches)

    syncMobileInspector()
    mediaQuery.addEventListener('change', syncMobileInspector)
    return () => mediaQuery.removeEventListener('change', syncMobileInspector)
  }, [])

  useEffect(() => {
    if (!hasRightInspector || !isMobileInspector) {
      return
    }

    const previousFocusedElement = document.activeElement
    previousFocusedElementRef.current = previousFocusedElement instanceof HTMLElement
      ? previousFocusedElement
      : null
    const frame = window.requestAnimationFrame(() => {
      if (
        document.activeElement !== previousFocusedElement
        && document.activeElement !== document.body
      ) {
        return
      }
      const panel = inspectorPanelRef.current
      if (!panel) return
      const [firstFocusable] = getInspectorFocusables(panel)
      ;(firstFocusable ?? panel).focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
      const previous = previousFocusedElementRef.current
      previousFocusedElementRef.current = null
      if (previous?.isConnected) {
        previous.focus()
      }
    }
  }, [hasRightInspector, isMobileInspector])

  const handleInspectorPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const panel = inspectorPanelRef.current
    if (!panel || !panel.contains(event.target as Node)) return

    if (event.key === 'Escape') {
      if (event.defaultPrevented || onDismissRightInspector == null) return
      event.preventDefault()
      event.stopPropagation()
      onDismissRightInspector()
      return
    }

    if (event.key !== 'Tab' || event.defaultPrevented) return
    const focusables = getInspectorFocusables(panel)
    if (focusables.length === 0) {
      event.preventDefault()
      panel.focus()
      return
    }

    const focusedIndex = focusables.indexOf(document.activeElement as HTMLElement)
    if (event.shiftKey && focusedIndex <= 0) {
      event.preventDefault()
      focusables[focusables.length - 1]?.focus()
    } else if (!event.shiftKey && focusedIndex === focusables.length - 1) {
      event.preventDefault()
      focusables[0]?.focus()
    }
  }

  return (
    <div className={styles.shell} data-canvas-shell="true">
      {/* ── Top Command Bar ─────────────────────────────── */}
      {topCommand != null ? (
        <div className={styles.topCommand} data-canvas-region="top-command">
          {topCommand}
        </div>
      ) : null}

      {/* ── Main Region: Left Rail + Stage + Right Inspector */}
      <div className={styles.mainRegion}>
        {hasLeftRail ? (
          <div className={styles.leftRail} data-canvas-region="left-rail">
            {leftRail}
          </div>
        ) : null}

        {/* Canvas Stage — existing canvas content for Phase 1 */}
        <div className={styles.stage} data-canvas-region="stage">
          {children}
        </div>

        {hasRightInspector ? (
          <aside
            className={styles.rightInspector}
            data-canvas-region="right-inspector"
            aria-label="节点检查器"
          >
            <button
              className={styles.inspectorBackdrop}
              data-canvas-inspector-backdrop="true"
              aria-label="关闭节点检查器"
              type="button"
              onClick={onDismissRightInspector}
            />
            <div
              ref={inspectorPanelRef}
              className={styles.inspectorPanel}
              data-canvas-inspector-panel="true"
              role={isMobileInspector ? 'dialog' : undefined}
              aria-modal={isMobileInspector ? true : undefined}
              tabIndex={-1}
              onKeyDown={handleInspectorPanelKeyDown}
            >
              {rightInspector}
            </div>
          </aside>
        ) : null}
      </div>

      {/* ── Bottom Generation Dock ─────────────────────── */}
      {hasBottomDock ? (
        <div className={styles.bottomDock} data-canvas-region="bottom-dock">
          {bottomDock}
        </div>
      ) : null}

      {/* ── Modal Tool Layer ──────────────────────────── */}
      {/* Note: existing panels use position:fixed (viewport-relative) and don't need this slot.
          This is a forward-only mount point for P0-LAYOUT-6 unified modal manager. */}
      {modalLayer != null ? (
        <div className={styles.modalLayer} data-canvas-region="modal-layer">
          {modalLayer}
        </div>
      ) : null}
    </div>
  )
}
