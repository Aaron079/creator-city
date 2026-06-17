'use client'

import { useState, type CSSProperties } from 'react'
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
}

function stopEvent(e: React.MouseEvent | React.PointerEvent) {
  e.stopPropagation()
  e.preventDefault()
}

export function AssetAgentToolbar({
  nodeKind,
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
}: AssetAgentToolbarProps) {
  const [reframeOpen, setReframeOpen] = useState(false)
  const [clipMenuOpen, setClipMenuOpen] = useState(false)
  const [assetMenuOpen, setAssetMenuOpen] = useState(false)
  const [directorMenuOpen, setDirectorMenuOpen] = useState(false)

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
      {/* Node indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 4px', borderRight: '1px solid rgba(255,255,255,0.08)', marginRight: 2 }}>
        <span style={{ fontSize: 12, opacity: 0.35 }}>
          {nodeKind === 'image' ? '🖼' : nodeKind === 'video' ? '🎬' : '📝'}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nodeTitle || (nodeKind === 'image' ? '图片' : nodeKind === 'video' ? '视频' : '文本')}
        </span>
      </div>

      {/* Director — camera control + lexicon (image/video only) */}
      {nodeKind === 'image' || nodeKind === 'video' ? (
        <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
          <button
            type="button"
            data-no-node-drag="true"
            className={`asset-agent-btn${directorMenuOpen ? ' is-active' : ''}`}
            onClick={(e) => { stopEvent(e); setDirectorMenuOpen((v) => !v); setReframeOpen(false); setClipMenuOpen(false); setAssetMenuOpen(false) }}
            title="导演工具"
          >
            <span className="asset-agent-btn-icon">🎥</span>
            <span className="asset-agent-btn-label">导演</span>
          </button>
          {directorMenuOpen ? (
            <div className="asset-agent-reframe-popover" data-no-node-drag="true">
              <div className="asset-agent-reframe-title">导演工具</div>
              <button
                type="button"
                data-no-node-drag="true"
                className="asset-agent-reframe-chip"
                onClick={(e) => { stopEvent(e); onOpenCameraControl?.(); setDirectorMenuOpen(false) }}
              >
                🎥 摄影机控制
              </button>
              <button
                type="button"
                data-no-node-drag="true"
                className="asset-agent-reframe-chip"
                onClick={(e) => { stopEvent(e); onOpenCameraLexicon?.(); setDirectorMenuOpen(false) }}
              >
                📷 镜头词典
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Scene lighting (image/video only) */}
      {nodeKind === 'image' || nodeKind === 'video' ? (
        <button
          type="button"
          data-no-node-drag="true"
          className="asset-agent-btn"
          onClick={(e) => { stopEvent(e); onOpenSceneLighting?.() }}
          title="场景光线"
        >
          <span className="asset-agent-btn-icon">💡</span>
          <span className="asset-agent-btn-label">光线</span>
        </button>
      ) : null}

      {/* Prompt booster (all node kinds) */}
      <button
        type="button"
        data-no-node-drag="true"
        className="asset-agent-btn"
        onClick={(e) => { stopEvent(e); onOpenPromptBooster?.() }}
        title="提示词增强器"
      >
        <span className="asset-agent-btn-icon">✨</span>
        <span className="asset-agent-btn-label">提示词</span>
      </button>

      {/* Media tools — image/video only */}
      {nodeKind === 'image' || nodeKind === 'video' ? (
      <>
      <div className="asset-agent-toolbar-divider" />
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

      {/* Clip — post-production suite (Color Grade Palette available; others coming soon) */}
      <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
        <button
          type="button"
          data-no-node-drag="true"
          className={`asset-agent-btn${clipMenuOpen ? ' is-active' : ''}`}
          onClick={(e) => { stopEvent(e); setClipMenuOpen((v) => !v); setReframeOpen(false) }}
          title="剪辑套件 — 后期处理工具"
        >
          <span className="asset-agent-btn-icon">✂</span>
          <span className="asset-agent-btn-label">剪辑</span>
        </button>
        {clipMenuOpen ? (
          <div className="asset-agent-reframe-popover" data-no-node-drag="true">
            <div className="asset-agent-reframe-title">后期套件</div>
            <button
              type="button"
              data-no-node-drag="true"
              className="asset-agent-reframe-chip"
              onClick={(e) => { stopEvent(e); onOpenColorGrade?.(); setClipMenuOpen(false) }}
            >
              🎛 调色盘
            </button>
            <button
              type="button"
              data-no-node-drag="true"
              className="asset-agent-reframe-chip"
              onClick={(e) => { stopEvent(e); onOpenLookPackage?.(); setClipMenuOpen(false) }}
            >
              🎨 视觉风格包
            </button>
            <div style={{ padding: '4px 10px 2px', fontSize: 10, color: 'rgba(255,255,255,0.22)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>✂ 剪辑建议 <span style={{ fontSize: 8, opacity: 0.6 }}>soon</span></span>
              <span>◧ 转场 <span style={{ fontSize: 8, opacity: 0.6 }}>soon</span></span>
              <span>♪ 音频 <span style={{ fontSize: 8, opacity: 0.6 }}>soon</span></span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Asset — library link + variant/compare/keyframe tools */}
      <div className="asset-agent-toolbar-group" style={{ position: 'relative' }}>
        <button
          type="button"
          data-no-node-drag="true"
          className={`asset-agent-btn${assetMenuOpen ? ' is-active' : ''}`}
          onClick={(e) => { stopEvent(e); setAssetMenuOpen((v) => !v); setReframeOpen(false); setClipMenuOpen(false) }}
          title="资产工具 — 入库、变体规划等"
        >
          <span className="asset-agent-btn-icon">⊕</span>
          <span className="asset-agent-btn-label">资产</span>
        </button>
        {assetMenuOpen ? (
          <div className="asset-agent-reframe-popover" data-no-node-drag="true">
            <div className="asset-agent-reframe-title">资产操作</div>
            {assetId ? (
              <a
                href={`/assets?highlight=${assetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="asset-agent-reframe-chip"
                style={{ display: 'block', textDecoration: 'none' }}
                onClick={(e) => { e.stopPropagation(); setAssetMenuOpen(false) }}
              >
                ↗ 打开资产详情
              </a>
            ) : (
              <a
                href={nodeId ? `/assets?nodeId=${nodeId}` : '/assets'}
                target="_blank"
                rel="noopener noreferrer"
                className="asset-agent-reframe-chip"
                style={{ display: 'block', textDecoration: 'none' }}
                onClick={(e) => { e.stopPropagation(); setAssetMenuOpen(false) }}
              >
                ↗ 前往资产库
              </a>
            )}
            {onOpenVariantPlanner ? (
              <button
                type="button"
                data-no-node-drag="true"
                className="asset-agent-reframe-chip"
                onClick={(e) => { stopEvent(e); onOpenVariantPlanner(); setAssetMenuOpen(false) }}
              >
                ⬡ 资产变体规划
              </button>
            ) : null}
            {onOpenABCompare ? (
              <button
                type="button"
                data-no-node-drag="true"
                className="asset-agent-reframe-chip"
                onClick={(e) => { stopEvent(e); onOpenABCompare(); setAssetMenuOpen(false) }}
              >
                ⚖ 版本对比
              </button>
            ) : null}
            {nodeKind === 'video' && onOpenKeyframeExtractor ? (
              <button
                type="button"
                data-no-node-drag="true"
                className="asset-agent-reframe-chip"
                onClick={(e) => { stopEvent(e); onOpenKeyframeExtractor(); setAssetMenuOpen(false) }}
              >
                🎞 关键帧提取
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      </>) : null}
    </div>
  )
}
