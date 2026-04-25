'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

interface CanvasToolDockProps {
  onAddNode: (kind: VisualCanvasNodeKind, presetTitle?: string) => void
  activeTool: string
  onToolSelect: (tool: string) => void
  isAddMenuOpen: boolean
  onToggleAddMenu: () => void
}

const TOOLS = [
  { id: 'add', label: '添加', icon: '+' },
  { id: 'media', label: '素材', icon: '◫' },
  { id: 'layers', label: '图层', icon: '≣' },
  { id: 'comments', label: '评论', icon: '◌' },
  { id: 'history', label: '历史', icon: '↺' },
  { id: 'tools', label: '工具', icon: '⌘' },
  { id: 'user', label: '用户', icon: '◍' },
] as const

const NODE_OPTIONS: Array<{
  id: string
  kind: VisualCanvasNodeKind
  icon: string
  label: string
  hint: string
  presetTitle?: string
}> = [
  { id: 'text', kind: 'text', icon: '✦', label: '文本', hint: '写脚本、文案与创意方向' },
  { id: 'image', kind: 'image', icon: '◫', label: '图片', hint: '先做视觉风格与关键画面' },
  { id: 'video', kind: 'video', icon: '▣', label: '视频', hint: '直接生成镜头与动作' },
  { id: 'audio', kind: 'audio', icon: '♫', label: '音频', hint: '音乐、音效与旁白' },
  { id: 'image-editor', kind: 'image', icon: '✎', label: '图片编辑器', hint: '抠图、换背景与图像改写', presetTitle: '图片编辑器' },
  { id: 'world', kind: 'world', icon: '◎', label: '3D 世界', hint: '空间、场景与世界观搭建' },
  { id: 'upload', kind: 'upload', icon: '↑', label: '上传', hint: '导入图片、视频与参考素材' },
]

export function CanvasToolDock({
  onAddNode,
  activeTool,
  onToolSelect,
  isAddMenuOpen,
  onToggleAddMenu,
}: CanvasToolDockProps) {
  return (
    <div className="absolute left-6 top-1/2 z-40 -translate-y-1/2">
      <div className="canvas-toolbar-shell">
        <div className="flex flex-col gap-2">
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  if (tool.id === 'add') {
                    onToggleAddMenu()
                    return
                  }
                  onToolSelect(tool.id)
                }}
                className={`canvas-toolbar-button ${active || (tool.id === 'add' && isAddMenuOpen) ? 'is-active' : ''}`}
                title={tool.label}
              >
                {tool.id === 'user' ? <span className="canvas-toolbar-avatar">A</span> : tool.icon}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {isAddMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="canvas-add-menu"
          >
            <div className="canvas-add-menu-header">
              <div className="canvas-add-menu-label">Add</div>
              <div className="canvas-add-menu-title">向画布插入一个轻量节点</div>
            </div>

            <div className="space-y-2">
              {NODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onAddNode(option.kind, option.presetTitle)
                    onToggleAddMenu()
                  }}
                  className="canvas-add-option"
                >
                  <span className="canvas-add-option-icon">{option.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="canvas-add-option-title">{option.label}</span>
                    <span className="canvas-add-option-hint">{option.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
