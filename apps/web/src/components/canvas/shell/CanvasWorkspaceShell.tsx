'use client'

import type { ReactNode } from 'react'
import styles from './canvasWorkspaceShell.module.css'

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
}: CanvasWorkspaceShellProps) {
  const hasLeftRail = showLeftRail && leftRail != null
  const hasRightInspector = showRightInspector && rightInspector != null
  const hasBottomDock = showBottomDock && bottomDock != null

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
          <div className={styles.rightInspector} data-canvas-region="right-inspector">
            {rightInspector}
          </div>
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
