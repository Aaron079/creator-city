'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

interface CanvasToolDockProps {
  onAddNode: (kind: VisualCanvasNodeKind) => void
  activeTool: string
  onToolSelect: (tool: string) => void
  isAddMenuOpen: boolean
  onToggleAddMenu: () => void
}

const TOOLS = [
  { id: 'add', label: '添加节点', icon: '+' },
  { id: 'files', label: '文件 / 资源', icon: '⌂' },
  { id: 'layers', label: '分层 / 列表', icon: '≣' },
  { id: 'comments', label: '评论', icon: '◌' },
  { id: 'history', label: '历史', icon: '↺' },
  { id: 'settings', label: '设置', icon: '⚙' },
] as const

const NODE_OPTIONS: Array<{ id: VisualCanvasNodeKind; label: string; hint: string }> = [
  { id: 'text', label: '文本', hint: 'Brief / 文案 / 脚本' },
  { id: 'image', label: '图片', hint: '生成图像与参考' },
  { id: 'video', label: '视频', hint: '镜头与视频生成' },
  { id: 'audio', label: '音频', hint: '配乐 / 音效 / 旁白' },
  { id: 'world', label: '3D 世界', hint: '空间与场景结构' },
  { id: 'upload', label: '上传', hint: '导入参考资产' },
]

export function CanvasToolDock({
  onAddNode,
  activeTool,
  onToolSelect,
  isAddMenuOpen,
  onToggleAddMenu,
}: CanvasToolDockProps) {
  return (
    <div className="absolute left-5 top-1/2 z-20 -translate-y-1/2">
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
                {tool.icon}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {isAddMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="canvas-add-menu"
          >
            <div className="mb-2 px-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/34">Add Node</div>
              <div className="mt-1 text-sm font-light tracking-[-0.03em] text-white">把一个新阶段插进工作流</div>
            </div>
            <div className="space-y-2">
              {NODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onAddNode(option.id)
                    onToggleAddMenu()
                  }}
                  className="canvas-add-option"
                >
                  <div className="text-sm text-white">{option.label}</div>
                  <div className="mt-1 text-[11px] text-white/46">{option.hint}</div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
