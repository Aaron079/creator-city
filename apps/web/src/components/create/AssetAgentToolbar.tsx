'use client'

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { NodeToolCenter } from '@/components/create/canvas/node-tools/NodeToolCenter'

export type ReframeMode = 'original' | 'wide' | 'medium' | 'close' | 'extreme-close'

interface ReframeOption {
  label: string
  value: ReframeMode
  scale: number
}

const REFRAME_MODES: ReframeOption[] = [
  { label: '原始', value: 'original', scale: 1 },
  { label: '远景', value: 'wide', scale: 0.82 },
  { label: '中景', value: 'medium', scale: 1.08 },
  { label: '近景', value: 'close', scale: 1.18 },
  { label: '特写', value: 'extreme-close', scale: 1.35 },
]

export function getReframeStyle(mode: ReframeMode): CSSProperties {
  const entry = REFRAME_MODES.find((m) => m.value === mode)
  if (!entry || entry.scale === 1) return {}
  return { transform: `scale(${entry.scale})`, transition: 'transform 0.25s ease', transformOrigin: 'center' }
}

export interface AssetAgentToolbarProps {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult?: boolean
  mediaUrl: string
  nodeTitle: string
  nodeId?: string
  assetId?: string
  onFullscreen: () => void
  reframeMode: ReframeMode
  onReframeChange: (mode: ReframeMode) => void
  // 任务 button
  onOpenGenerationDialog?: () => void
  // Tool callbacks — delegated to NodeToolCenter
  onOpenColorGrade?: () => void
  onOpenLookPackage?: () => void
  onOpenVariantPlanner?: () => void
  onOpenABCompare?: () => void
  onOpenKeyframeExtractor?: () => void
  onOpenCameraControl?: () => void
  onOpenSceneLighting?: () => void
  onOpenCameraLexicon?: () => void
  onOpenPromptBooster?: () => void
  onOpenRemoveBackground?: () => void
  onOpenHdReconstruction?: () => void
  onOpenStoryboardGridSplit?: () => void
  // Asset Transform capability gates
  assetTransformCaps?: { removeBackground?: boolean; upscale?: boolean }
}

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

type OpenMenu = 'tools' | 'assets' | null

export function AssetAgentToolbar({
  nodeKind,
  hasMediaResult = false,
  mediaUrl,
  nodeTitle,
  nodeId,
  assetId,
  onFullscreen,
  reframeMode,
  onReframeChange,
  onOpenGenerationDialog,
  onOpenColorGrade,
  onOpenLookPackage,
  onOpenVariantPlanner,
  onOpenABCompare,
  onOpenKeyframeExtractor,
  onOpenCameraControl,
  onOpenSceneLighting,
  onOpenCameraLexicon,
  onOpenPromptBooster,
  onOpenRemoveBackground,
  onOpenHdReconstruction,
  onOpenStoryboardGridSplit,
  assetTransformCaps = {},
}: AssetAgentToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const closeAll = useCallback(() => setOpenMenu(null), [])

  function toggle(menu: NonNullable<OpenMenu>) {
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  // Close menus when selected node changes
  useEffect(() => { setOpenMenu(null) }, [nodeId])

  // Close on outside click
  useEffect(() => {
    if (!openMenu) return
    let removeHandler: (() => void) | undefined
    const id = setTimeout(() => {
      const handler = (e: PointerEvent) => {
        if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
          setOpenMenu(null)
        }
      }
      document.addEventListener('pointerdown', handler)
      removeHandler = () => document.removeEventListener('pointerdown', handler)
    }, 0)
    return () => {
      clearTimeout(id)
      removeHandler?.()
    }
  }, [openMenu])

  // Close on Escape
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openMenu])

  function handleDownload(e: React.MouseEvent) {
    stopEvent(e)
    const a = document.createElement('a')
    a.href = mediaUrl
    a.download = `${nodeTitle || 'creator-city-asset'}`
    a.rel = 'noopener noreferrer'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    closeAll()
  }

  // Map actionId from registry to the correct callback
  function handleToolAction(actionId: string) {
    closeAll()
    switch (actionId) {
      case 'camera-control':     onOpenCameraControl?.(); break
      case 'camera-lexicon':     onOpenCameraLexicon?.(); break
      case 'scene-lighting':     onOpenSceneLighting?.(); break
      case 'prompt-booster':     onOpenPromptBooster?.(); break
      case 'look-package':       onOpenLookPackage?.(); break
      case 'variant-planner':    onOpenVariantPlanner?.(); break
      case 'remove-background':  onOpenRemoveBackground?.(); break
      case 'hd-reconstruction':  onOpenHdReconstruction?.(); break
      case 'color-grade':        onOpenColorGrade?.(); break
      case 'storyboard-grid-split': onOpenStoryboardGridSplit?.(); break
      default: break
    }
  }

  const isVisual = nodeKind === 'image' || nodeKind === 'video'
  const kindIcon = nodeKind === 'image' ? '🖼' : nodeKind === 'video' ? '🎬' : '📝'
  const kindLabel = nodeKind === 'image' ? 'Image' : nodeKind === 'video' ? 'Video' : 'Text'

  return (
    <div
      ref={toolbarRef}
      className="asset-agent-toolbar"
      data-no-node-drag="true"
      onPointerDown={stopEvent}
      onMouseDown={stopEvent}
      onClick={stopEvent}
    >
      {/* Node identity label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 10px 0 4px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        marginRight: 4,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, opacity: 0.5, lineHeight: 1 }}>{kindIcon}</span>
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,0.48)',
          maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {kindLabel}{nodeTitle ? ` · ${nodeTitle}` : ''}
        </span>
      </div>

      {/* ── 任务 button — opens generation dialog ── */}
      <div className="asset-agent-toolbar-group">
        <button
          type="button"
          data-no-node-drag="true"
          className="asset-agent-btn"
          onClick={(e) => { stopEvent(e); onOpenGenerationDialog?.() }}
          title="打开任务面板"
        >
          <span className="asset-agent-btn-icon">◎</span>
          <span className="asset-agent-btn-label">任务</span>
        </button>
      </div>

      {/* ── 工具 button — opens NodeToolCenter ── */}
      <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
        <button
          type="button"
          data-no-node-drag="true"
          className={`asset-agent-btn${openMenu === 'tools' ? ' is-active' : ''}`}
          onClick={(e) => { stopEvent(e); toggle('tools') }}
          title="工具"
        >
          <span className="asset-agent-btn-icon">⚙</span>
          <span className="asset-agent-btn-label">工具</span>
        </button>
        {openMenu === 'tools' ? (
          <NodeToolCenter
            nodeKind={nodeKind}
            hasMediaResult={hasMediaResult}
            caps={assetTransformCaps}
            onAction={(actionId) => handleToolAction(actionId)}
          />
        ) : null}
      </div>

      {/* ── 资产 button — download + asset details ── */}
      {isVisual ? (
        <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
          <button
            type="button"
            data-no-node-drag="true"
            className={`asset-agent-btn${openMenu === 'assets' ? ' is-active' : ''}`}
            onClick={(e) => { stopEvent(e); toggle('assets') }}
            title="资产"
          >
            <span className="asset-agent-btn-icon">⊕</span>
            <span className="asset-agent-btn-label">资产</span>
          </button>
          {openMenu === 'assets' ? (
            <div className="ntb-menu" data-no-node-drag="true">
              {/* File */}
              <div className="ntb-menu-section-title">文件</div>
              {hasMediaResult ? (
                <button
                  type="button"
                  data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={handleDownload}
                >
                  <span className="ntb-menu-item-icon">↓</span>
                  {nodeKind === 'image' ? '下载图片' : '下载视频'}
                </button>
              ) : null}
              <button
                type="button"
                data-no-node-drag="true"
                className={`ntb-menu-item${!hasMediaResult ? ' ntb-menu-item-soon' : ''}`}
                disabled={!hasMediaResult}
                onClick={(e) => { stopEvent(e); if (hasMediaResult) { onFullscreen(); closeAll() } }}
              >
                <span className="ntb-menu-item-icon">⤢</span>
                全屏预览
              </button>
              {/* Reframe — visual nodes */}
              {isVisual && hasMediaResult ? (
                <>
                  <div className="ntb-menu-divider" />
                  <div className="ntb-menu-section-title">重构图</div>
                  <div style={{ padding: '2px 10px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {REFRAME_MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          data-no-node-drag="true"
                          style={{
                            padding: '3px 9px',
                            borderRadius: 6,
                            border: `1px solid ${reframeMode === m.value ? 'rgba(0,210,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                            background: reframeMode === m.value ? 'rgba(0,210,255,0.12)' : 'rgba(255,255,255,0.03)',
                            color: reframeMode === m.value ? 'rgba(0,210,255,0.9)' : 'rgba(255,255,255,0.58)',
                            fontSize: 11,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                            fontWeight: reframeMode === m.value ? 600 : 400,
                          }}
                          onClick={(e) => { stopEvent(e); onReframeChange(m.value) }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
              {/* Analysis tools */}
              {nodeKind === 'image' && hasMediaResult && onOpenStoryboardGridSplit ? (
                <>
                  <div className="ntb-menu-divider" />
                  <div className="ntb-menu-section-title">分镜工具</div>
                  <button
                    type="button"
                    data-no-node-drag="true"
                    className="ntb-menu-item"
                    onClick={(e) => { stopEvent(e); onOpenStoryboardGridSplit(); closeAll() }}
                  >
                    <span className="ntb-menu-item-icon">▦</span>
                    分镜拆格
                  </button>
                </>
              ) : null}
              {/* Analysis tools */}
              {(onOpenABCompare && hasMediaResult) || (nodeKind === 'video' && onOpenKeyframeExtractor && hasMediaResult) ? (
                <>
                  <div className="ntb-menu-divider" />
                  <div className="ntb-menu-section-title">分析工具</div>
                  {onOpenABCompare && hasMediaResult ? (
                    <button
                      type="button"
                      data-no-node-drag="true"
                      className="ntb-menu-item"
                      onClick={(e) => { stopEvent(e); onOpenABCompare(); closeAll() }}
                    >
                      <span className="ntb-menu-item-icon">⚖</span>
                      版本对比
                    </button>
                  ) : null}
                  {nodeKind === 'video' && onOpenKeyframeExtractor && hasMediaResult ? (
                    <button
                      type="button"
                      data-no-node-drag="true"
                      className="ntb-menu-item"
                      onClick={(e) => { stopEvent(e); onOpenKeyframeExtractor(); closeAll() }}
                    >
                      <span className="ntb-menu-item-icon">🎞</span>
                      关键帧提取
                    </button>
                  ) : null}
                </>
              ) : null}
              {/* Asset record */}
              <div className="ntb-menu-divider" />
              <div className="ntb-menu-section-title">资产记录</div>
              {assetId ? (
                <a
                  href={`/assets?highlight=${assetId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ntb-menu-item"
                  onClick={(e) => { e.stopPropagation(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">↗</span>
                  打开资产详情
                </a>
              ) : (
                <a
                  href={nodeId ? `/assets?nodeId=${nodeId}` : '/assets'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ntb-menu-item"
                  onClick={(e) => { e.stopPropagation(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">↗</span>
                  前往资产库
                </a>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
