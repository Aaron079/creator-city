'use client'

import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { NODE_TOOL_REGISTRY } from './nodeToolRegistry'
import type { NodeToolCategory } from './nodeToolTypes'

const CATEGORY_LABELS: Record<NodeToolCategory, string> = {
  'prompt-direction': '提示词与导演参数',
  'image-edit': '画面编辑',
  'analysis-preview': '分析与预览',
}

const CATEGORY_ORDER: NodeToolCategory[] = ['prompt-direction', 'image-edit', 'analysis-preview']

interface NodeToolCenterProps {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult: boolean
  caps: { removeBackground?: boolean; upscale?: boolean }
  onAction: (actionId: string) => void
}

export function NodeToolCenter({ nodeKind, hasMediaResult, caps, onAction }: NodeToolCenterProps) {
  const isVisual = nodeKind === 'image' || nodeKind === 'video'

  const enabledTools = NODE_TOOL_REGISTRY.filter((tool) => {
    if (!tool.supportedKinds.includes(nodeKind)) return false
    if (tool.requiresMedia && !hasMediaResult) return false
    if (tool.capabilityKey === 'removeBackground' && !caps.removeBackground) return false
    if (tool.capabilityKey === 'upscale' && !caps.upscale) return false
    // image-edit category only shown for image nodes with media
    if (tool.category === 'image-edit' && !(nodeKind === 'image' && hasMediaResult)) return false
    return true
  })

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    tools: enabledTools.filter((t) => t.category === cat),
  })).filter(({ tools }) => tools.length > 0)

  if (byCategory.length === 0) {
    return (
      <div className="ntb-menu ntb-menu-wide" data-no-node-drag="true">
        <div style={{ padding: '12px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {isVisual ? '暂无可用工具' : '文本节点暂无工具'}
        </div>
      </div>
    )
  }

  return (
    <div className="ntb-menu ntb-menu-wide" data-no-node-drag="true">
      {byCategory.map(({ cat, tools }, catIdx) => (
        <div key={cat}>
          {catIdx > 0 && <div className="ntb-menu-divider" />}
          <div className="ntb-menu-section-title">{CATEGORY_LABELS[cat]}</div>
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              data-no-node-drag="true"
              className="ntb-menu-item"
              onClick={() => onAction(tool.openActionId)}
            >
              <span className="ntb-menu-item-icon">{tool.icon}</span>
              {tool.label}
              {tool.executionType === 'preview' && (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>预览</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
