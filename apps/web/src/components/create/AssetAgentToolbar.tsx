'use client'

import type { CSSProperties, MouseEvent } from 'react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

export type ReframeMode = 'original' | 'wide' | 'medium' | 'close' | 'extreme-close'
export type NodeContextCategory = 'task' | 'tools' | 'assets'

const REFRAME_SCALES: Record<ReframeMode, number> = {
  original: 1,
  wide: 0.82,
  medium: 1.08,
  close: 1.18,
  'extreme-close': 1.35,
}

export function getReframeStyle(mode: ReframeMode): CSSProperties {
  const scale = REFRAME_SCALES[mode]
  if (scale === 1) return {}
  return { transform: `scale(${scale})`, transition: 'transform 0.25s ease', transformOrigin: 'center' }
}

export interface AssetAgentToolbarProps {
  nodeKind: VisualCanvasNodeKind
  nodeTitle: string
  activeCategory: NodeContextCategory | null
  onCategoryChange: (category: NodeContextCategory) => void
}

function stopEvent(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
}

export function AssetAgentToolbar({
  nodeKind,
  nodeTitle,
  activeCategory,
  onCategoryChange,
}: AssetAgentToolbarProps) {
  const kindIcon = nodeKind === 'image' ? '🖼' : nodeKind === 'video' ? '🎬' : '📝'
  const kindLabel = nodeKind === 'image' ? 'Image' : nodeKind === 'video' ? 'Video' : 'Text'
  const categories: Array<{ id: NodeContextCategory; icon: string; label: string }> = [
    { id: 'task', icon: '◎', label: '任务' },
    { id: 'tools', icon: '⚙', label: '工具' },
    { id: 'assets', icon: '⊕', label: '资产' },
  ]

  return (
    <div
      className="asset-agent-toolbar"
      data-no-node-drag="true"
      onPointerDown={stopEvent}
      onMouseDown={stopEvent}
      onClick={stopEvent}
    >
      <div className="asset-agent-toolbar-identity">
        <span className="asset-agent-toolbar-kind-icon">{kindIcon}</span>
        <span className="asset-agent-toolbar-kind-label">
          {kindLabel}{nodeTitle ? ` · ${nodeTitle}` : ''}
        </span>
      </div>

      <div className="asset-agent-toolbar-group" aria-label="节点操作分类">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            data-no-node-drag="true"
            className={`asset-agent-btn${activeCategory === category.id ? ' is-active' : ''}`}
            aria-pressed={activeCategory === category.id}
            onClick={(event) => {
              stopEvent(event)
              onCategoryChange(category.id)
            }}
            title={category.label}
          >
            <span className="asset-agent-btn-icon">{category.icon}</span>
            <span className="asset-agent-btn-label">{category.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
