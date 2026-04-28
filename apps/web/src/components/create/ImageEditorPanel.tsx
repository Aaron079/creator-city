'use client'

import { ImageIcon, PersonStanding, PlaySquare, Sparkles } from 'lucide-react'

interface ImageEditorPanelProps {
  nodeTitle?: string
  appliedAction?: string
  onApply: (action: string) => void
  onClose: () => void
}

const IMAGE_ACTIONS = [
  { name: '图片编辑器节点', detail: '编辑和处理图片', icon: ImageIcon },
  { name: '姿势生成器', detail: '生成角色姿态参考', icon: PersonStanding },
  { name: '涂鸦生视频', detail: '把草图转换为运动镜头', icon: PlaySquare },
  { name: '涂鸦生图', detail: '把草图转换为关键画面', icon: Sparkles },
]

export function ImageEditorPanel({
  nodeTitle: _nodeTitle,
  appliedAction,
  onApply,
  onClose,
}: ImageEditorPanelProps) {
  function handlePanelPointerDown(event: React.PointerEvent<HTMLElement>) {
    const actionEl = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-advanced-action]')
    if (!actionEl) return
    const action = actionEl.dataset.advancedAction
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    onApply(action)
  }

  return (
    <section
      className="canvas-advanced-panel"
      aria-label="高级编辑面板"
      onPointerDownCapture={handlePanelPointerDown}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="canvas-panel-kicker">高级编辑</div>
      <button type="button" className="canvas-panel-close" onClick={onClose} aria-label="关闭高级编辑" title="关闭">
        ×
      </button>

      <div className="canvas-panel-list">
        {IMAGE_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.name}
              type="button"
              data-advanced-action={action.name}
              className={`canvas-advanced-action ${appliedAction === action.name ? 'is-active' : ''}`}
              onFocus={() => {
                if (appliedAction !== action.name) onApply(action.name)
              }}
            >
              <span className="canvas-advanced-icon"><Icon size={27} strokeWidth={2.25} /></span>
              <span>
                <span className="canvas-advanced-title">{action.name}</span>
                <span className="canvas-advanced-copy">{action.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
