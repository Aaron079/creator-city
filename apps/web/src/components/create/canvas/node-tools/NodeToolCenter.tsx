'use client'

import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import {
  availableNodeTools,
  recommendNodeTool,
} from './nodeToolRecommendation'
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
  const toolInput = { nodeKind, hasMediaResult, caps }
  const enabledTools = availableNodeTools(toolInput)
  const recommendedTool = recommendNodeTool(toolInput)

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
      {recommendedTool ? (
        <>
          <div className="ntb-menu-section-title">推荐下一步</div>
          <button
            type="button"
            data-no-node-drag="true"
            className="ntb-menu-item"
            onClick={() => onAction(recommendedTool.openActionId)}
          >
            <span className="ntb-menu-item-icon">{recommendedTool.icon}</span>
            {recommendedTool.label}
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>建议</span>
          </button>
          <div className="ntb-menu-divider" />
        </>
      ) : null}
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
