'use client'

import { useState, type CSSProperties, type RefObject } from 'react'

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
  videoRef?: RefObject<HTMLVideoElement | null>
}

type ScreenshotStatus = 'idle' | 'ok' | 'cors-error' | 'error'

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
  videoRef,
}: AssetAgentToolbarProps) {
  const [reframeOpen, setReframeOpen] = useState(false)
  const [screenshotStatus, setScreenshotStatus] = useState<ScreenshotStatus>('idle')

  function handleDownload(e: React.MouseEvent) {
    stopEvent(e)
    // Try anchor download first; browser may redirect to same-origin for cross-origin
    const a = document.createElement('a')
    a.href = mediaUrl
    a.download = `${nodeTitle || 'creator-city-asset'}`
    a.rel = 'noopener noreferrer'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function handleScreenshot(e: React.MouseEvent) {
    stopEvent(e)
    const video = videoRef?.current
    if (!video) return
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const cvs = document.createElement('canvas')
    cvs.width = w
    cvs.height = h
    const ctx = cvs.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(video, 0, 0, w, h)
      cvs.toBlob((blob) => {
        if (!blob) { setScreenshotStatus('error'); setTimeout(() => setScreenshotStatus('idle'), 2500); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${nodeTitle || 'frame'}-screenshot.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setScreenshotStatus('ok')
        setTimeout(() => setScreenshotStatus('idle'), 2500)
      }, 'image/png')
    } catch {
      // Canvas tainted by CORS — video is cross-origin and not flagged crossorigin
      setScreenshotStatus('cors-error')
      setTimeout(() => setScreenshotStatus('idle'), 3000)
    }
  }

  const screenshotLabel: Record<ScreenshotStatus, string> = {
    idle: '截图',
    ok: '已截图 ✓',
    'cors-error': '跨域受限',
    error: '截图失败',
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

      {/* Screenshot — video only, enabled */}
      {nodeKind === 'video' ? (
        <button
          type="button"
          data-no-node-drag="true"
          className={`asset-agent-btn${screenshotStatus === 'ok' ? ' is-success' : screenshotStatus !== 'idle' ? ' is-error-state' : ''}`}
          onClick={handleScreenshot}
          title={screenshotStatus === 'cors-error' ? '视频跨域限制，无法截帧。稍后支持服务端截图。' : '截取当前帧为 PNG'}
        >
          <span className="asset-agent-btn-icon">◉</span>
          <span className="asset-agent-btn-label">{screenshotLabel[screenshotStatus]}</span>
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
