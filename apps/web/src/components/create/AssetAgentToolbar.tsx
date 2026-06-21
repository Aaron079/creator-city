'use client'

import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

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
}

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

type OpenMenu = 'download' | 'assets' | 'tools' | null

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
}: AssetAgentToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const closeAll = useCallback(() => setOpenMenu(null), [])

  function toggle(menu: NonNullable<OpenMenu>) {
    setOpenMenu((prev) => (prev === menu ? null : menu))
  }

  // Close menus when selected node changes
  useEffect(() => { setOpenMenu(null) }, [nodeId])

  // Close on outside click (bubble phase — stopPropagation inside toolbar blocks it naturally)
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
      {/* Node indicator — status label only, not interactive */}
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

      {/* ── Download — image/video only ── */}
      {isVisual ? (
        <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
          <button
            type="button"
            data-no-node-drag="true"
            className={`asset-agent-btn${openMenu === 'download' ? ' is-active' : ''}${!hasMediaResult ? ' is-coming-soon' : ''}`}
            disabled={!hasMediaResult}
            onClick={(e) => { stopEvent(e); if (hasMediaResult) toggle('download') }}
            title={hasMediaResult ? '下载' : '暂无可下载内容'}
          >
            <span className="asset-agent-btn-icon">↓</span>
            <span className="asset-agent-btn-label">下载</span>
          </button>
          {openMenu === 'download' ? (
            <div className="ntb-menu" data-no-node-drag="true">
              <div className="ntb-menu-section-title">下载</div>
              <button
                type="button"
                data-no-node-drag="true"
                className="ntb-menu-item"
                onClick={handleDownload}
              >
                <span className="ntb-menu-item-icon">↓</span>
                {nodeKind === 'image' ? '下载图片' : '下载视频'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Assets — image/video only ── */}
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
              <div className="ntb-menu-section-title">资产操作</div>
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
              {onOpenVariantPlanner ? (
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenVariantPlanner(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">⬡</span>
                  资产变体规划
                </button>
              ) : null}
              {onOpenABCompare ? (
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenABCompare(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">⚖</span>
                  版本对比
                </button>
              ) : null}
              {nodeKind === 'video' && onOpenKeyframeExtractor ? (
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenKeyframeExtractor(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">🎞</span>
                  关键帧提取
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Tools — all node kinds ── */}
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
          <div className="ntb-menu ntb-menu-wide" data-no-node-drag="true">

            {/* Director + Lighting — image/video only */}
            {isVisual ? (
              <>
                <div className="ntb-menu-section-title">🎥 导演</div>
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenCameraControl?.(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">🎥</span>
                  摄影机控制
                </button>
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenCameraLexicon?.(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">📷</span>
                  镜头词典
                </button>
                <div className="ntb-menu-divider" />
                <div className="ntb-menu-section-title">💡 光线</div>
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenSceneLighting?.(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">💡</span>
                  场景光线
                </button>
                <div className="ntb-menu-divider" />
              </>
            ) : null}

            {/* Prompt — all node kinds */}
            <div className="ntb-menu-section-title">✨ 提示词</div>
            <button
              type="button" data-no-node-drag="true"
              className="ntb-menu-item"
              onClick={(e) => { stopEvent(e); onOpenPromptBooster?.(); closeAll() }}
            >
              <span className="ntb-menu-item-icon">✨</span>
              提示词增强
            </button>

            {/* Visual tools — image/video + hasMediaResult */}
            {isVisual && hasMediaResult ? (
              <>
                <div className="ntb-menu-divider" />
                <div className="ntb-menu-section-title">🖼 画面</div>
                {/* Reframe mode chips — inline, no API cost */}
                <div style={{ padding: '2px 10px 8px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>重构图</div>
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
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onFullscreen(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">⤢</span>
                  全屏预览
                </button>
                {nodeKind === 'video' ? (
                  <button
                    type="button" data-no-node-drag="true"
                    className="ntb-menu-item ntb-menu-item-soon"
                    disabled
                  >
                    <span className="ntb-menu-item-icon">◉</span>
                    截图
                    <span className="asset-agent-soon-badge" style={{ marginLeft: 'auto' }}>soon</span>
                  </button>
                ) : null}

                {/* Post-production */}
                <div className="ntb-menu-divider" />
                <div className="ntb-menu-section-title">✂ 后期</div>
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenColorGrade?.(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">🎛</span>
                  调色盘
                </button>
                <button
                  type="button" data-no-node-drag="true"
                  className="ntb-menu-item"
                  onClick={(e) => { stopEvent(e); onOpenLookPackage?.(); closeAll() }}
                >
                  <span className="ntb-menu-item-icon">🎨</span>
                  视觉风格包
                </button>

                {/* Asset Remix — pixel-level transforms */}
                {nodeKind === 'image' && (onOpenRemoveBackground ?? onOpenHdReconstruction) ? (
                  <>
                    <div className="ntb-menu-divider" />
                    <div className="ntb-menu-section-title">⚡ 资产再创作</div>
                    {onOpenRemoveBackground ? (
                      <button
                        type="button" data-no-node-drag="true"
                        className="ntb-menu-item"
                        onClick={(e) => { stopEvent(e); onOpenRemoveBackground(); closeAll() }}
                      >
                        <span className="ntb-menu-item-icon">✂</span>
                        主体抠图
                      </button>
                    ) : null}
                    {onOpenHdReconstruction ? (
                      <button
                        type="button" data-no-node-drag="true"
                        className="ntb-menu-item"
                        onClick={(e) => { stopEvent(e); onOpenHdReconstruction(); closeAll() }}
                      >
                        <span className="ntb-menu-item-icon">⬆</span>
                        高清重建
                      </button>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
