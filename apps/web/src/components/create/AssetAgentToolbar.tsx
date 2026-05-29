'use client'

import { useState, type CSSProperties } from 'react'

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
  nodeKind: 'image' | 'video'
  mediaUrl: string
  nodeTitle: string
  onFullscreen: () => void
  reframeMode: ReframeMode
  onReframeChange: (mode: ReframeMode) => void
}

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

export function AssetAgentToolbar({
  nodeKind,
  mediaUrl,
  nodeTitle,
  onFullscreen,
  reframeMode,
  onReframeChange,
}: AssetAgentToolbarProps) {
  const [reframeOpen, setReframeOpen] = useState(false)

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
  }

  return (
    <div
      className="asset-agent-toolbar"
      data-no-node-drag="true"
      onPointerDown={stopEvent}
      onMouseDown={stopEvent}
      onClick={stopEvent}
    >
      {/* Reframe — enabled */}
      <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
        <button
          type="button"
          className={`asset-agent-btn${reframeMode !== 'original' ? ' is-active' : ''}`}
          data-no-node-drag="true"
          onClick={(e) => { stopEvent(e); setReframeOpen((v) => !v) }}
          title="重构图预览（CSS 缩放，不消耗 API）"
        >
          <span className="asset-agent-btn-icon">⊞</span>
          <span className="asset-agent-btn-label">重构图</span>
        </button>
        {reframeOpen ? (
          <div className="asset-agent-reframe-popover" data-no-node-drag="true">
            <div className="asset-agent-reframe-title">景别预览</div>
            {REFRAME_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                data-no-node-drag="true"
                className={`asset-agent-reframe-chip${reframeMode === m.value ? ' is-selected' : ''}`}
                onClick={(e) => { stopEvent(e); onReframeChange(m.value); setReframeOpen(false) }}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Screenshot — coming soon (requires in-player video ref) */}
      {nodeKind === 'video' ? (
        <button
          type="button"
          data-no-node-drag="true"
          className="asset-agent-btn is-coming-soon"
          disabled
          title="截图 Agent — 即将上线"
        >
          <span className="asset-agent-btn-icon">◉</span>
          <span className="asset-agent-btn-label">截图</span>
          <span className="asset-agent-soon-badge">soon</span>
        </button>
      ) : null}

      {/* Download — enabled */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn"
        onClick={handleDownload}
        title="下载素材"
      >
        <span className="asset-agent-btn-icon">↓</span>
        <span className="asset-agent-btn-label">下载</span>
      </button>

      {/* Fullscreen — enabled */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn"
        onClick={(e) => { stopEvent(e); onFullscreen() }}
        title="全屏预览"
      >
        <span className="asset-agent-btn-icon">⤢</span>
        <span className="asset-agent-btn-label">全屏</span>
      </button>

      <div className="asset-agent-toolbar-divider" />

      {/* Enhance — coming soon */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn is-coming-soon"
        disabled
        title="增强 Agent — 即将上线"
      >
        <span className="asset-agent-btn-icon">✦</span>
        <span className="asset-agent-btn-label">增强</span>
        <span className="asset-agent-soon-badge">soon</span>
      </button>

      {/* Clip — coming soon */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn is-coming-soon"
        disabled
        title="剪辑 Agent — 即将上线"
      >
        <span className="asset-agent-btn-icon">✂</span>
        <span className="asset-agent-btn-label">剪辑</span>
        <span className="asset-agent-soon-badge">soon</span>
      </button>

      {/* Save to library — coming soon */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn is-coming-soon"
        disabled
        title="保存到素材库 — 即将上线"
      >
        <span className="asset-agent-btn-icon">⊕</span>
        <span className="asset-agent-btn-label">入库</span>
        <span className="asset-agent-soon-badge">soon</span>
      </button>
    </div>
  )
}
