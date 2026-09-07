'use client'

import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import {
  availableNodeTools,
  contextNodeTools,
  recommendNodeTool,
} from './nodeToolRecommendation'
import type { NodeToolContextItem } from './nodeToolRecommendation'
import type { NodeToolCategory } from './nodeToolTypes'

const CATEGORY_LABELS: Record<NodeToolCategory, string> = {
  'prompt-direction': '提示词与导演参数',
  'image-edit': '画面编辑',
  'analysis-preview': '分析与预览',
}

const CATEGORY_ORDER: NodeToolCategory[] = ['prompt-direction', 'image-edit', 'analysis-preview']

export interface NodeToolCenterProps {
  nodeKind: VisualCanvasNodeKind
  hasMediaResult: boolean
  caps: { removeBackground?: boolean; upscale?: boolean }
  presentation?: 'menu' | 'context-dialog'
  onAction: (actionId: string) => void
}

export function NodeToolCenter({
  nodeKind,
  hasMediaResult,
  caps,
  presentation = 'menu',
  onAction,
}: NodeToolCenterProps) {
  const isVisual = nodeKind === 'image' || nodeKind === 'video'
  const toolInput = { nodeKind, hasMediaResult, caps }
  const items: readonly NodeToolContextItem[] = presentation === 'context-dialog'
    ? contextNodeTools(toolInput)
    : availableNodeTools(toolInput).map((tool) => ({ tool }))
  const recommendedTool = presentation === 'menu' ? recommendNodeTool(toolInput) : null

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: items.filter(({ tool }) => tool.category === cat),
  })).filter(({ items: categoryItems }) => categoryItems.length > 0)

  if (byCategory.length === 0) {
    return (
      <div className={presentation === 'context-dialog' ? 'node-tool-context-list' : 'ntb-menu ntb-menu-wide'} data-no-node-drag="true">
        <div style={{ padding: '12px 12px', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {isVisual ? '暂无可用工具' : '文本节点暂无工具'}
        </div>
      </div>
    )
  }

  return (
    <div className={presentation === 'context-dialog' ? 'node-tool-context-list' : 'ntb-menu ntb-menu-wide'} data-no-node-drag="true">
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
      {byCategory.map(({ cat, items: categoryItems }, catIdx) => (
        <div key={cat}>
          {catIdx > 0 && <div className="ntb-menu-divider" />}
          <div className="ntb-menu-section-title">{CATEGORY_LABELS[cat]}</div>
          {categoryItems.map((item) => {
            const { tool } = item
            const resultText = presentation === 'context-dialog'
              ? `${tool.outputLabel} · ${tool.primaryActionLabel}`
              : tool.executionType === 'preview' ? '预览' : undefined

            return (
            <button
              key={tool.id}
              type="button"
              data-no-node-drag="true"
              className="ntb-menu-item"
              disabled={Boolean(item.unavailableReason)}
              title={item.unavailableReason}
              onClick={() => {
                if (!item.unavailableReason) onAction(tool.openActionId)
              }}
            >
              <span className="ntb-menu-item-icon">{tool.icon}</span>
              {tool.label}
              {resultText ? (
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>{resultText}</span>
              ) : null}
              {item.unavailableReason ? (
                <span style={{ display: 'block', width: '100%', marginTop: 3, fontSize: 9, color: 'rgba(255, 190, 110, 0.78)' }}>
                  {item.unavailableReason}
                </span>
              ) : null}
            </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
