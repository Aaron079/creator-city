'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  Boxes,
  Folder,
  History,
  ImageIcon,
  ImagePlus,
  ListPlus,
  MessageCircle,
  Plus,
  Text,
  Upload,
  UserRound,
  Video,
} from 'lucide-react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'

interface CanvasToolDockProps {
  onAddNode: (kind: VisualCanvasNodeKind, presetTitle?: string) => void
  activeTool: string
  onToolSelect: (tool: string) => void
  isAddMenuOpen: boolean
  onToggleAddMenu: () => void
  commentsEnabled: boolean
  onOpenAssetsPanel: () => void
  onOpenTemplatePanel: () => void
  onToggleCommentsPanel: () => void
  onOpenHistoryPanel: () => void
  onOpenImageEditor: () => void
}

const TOOLS = [
  { id: 'add', label: '添加节点', icon: Plus },
  { id: 'assets', label: '素材库', icon: Folder },
  { id: 'templates', label: '模板', icon: ListPlus },
  { id: 'comments', label: '打开评论模式', icon: MessageCircle },
  { id: 'history', label: '历史', icon: History },
  { id: 'image-editor', label: '高级编辑', icon: ImagePlus },
] as const

const NODE_OPTIONS: Array<{
  id: string
  kind: VisualCanvasNodeKind
  icon: typeof Text
  label: string
  hint: string
  presetTitle?: string
}> = [
  { id: 'text', kind: 'text', icon: Text, label: '文本', hint: '脚本、广告词、品牌文案' },
  { id: 'image', kind: 'image', icon: ImageIcon, label: '图片', hint: '关键画面、角色、场景图' },
  { id: 'video', kind: 'video', icon: Video, label: '视频', hint: '生成镜头、动作和转场' },
  { id: 'audio', kind: 'audio', icon: AudioLines, label: '音频', hint: '音乐、音效与旁白' },
  { id: 'world', kind: 'world', icon: Boxes, label: '3D 世界', hint: '空间、场景与世界观搭建' },
  { id: 'upload', kind: 'upload', icon: Upload, label: '上传', hint: '导入图片、视频与参考素材' },
]

export function CanvasToolDock({
  onAddNode,
  activeTool,
  onToolSelect,
  isAddMenuOpen,
  onToggleAddMenu,
  commentsEnabled,
  onOpenAssetsPanel,
  onOpenTemplatePanel,
  onToggleCommentsPanel,
  onOpenHistoryPanel,
  onOpenImageEditor,
}: CanvasToolDockProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleToolAction = (toolId: (typeof TOOLS)[number]['id']) => {
    onToolSelect(toolId)
    setIsUserMenuOpen(false)
    if (toolId === 'add') {
      onToggleAddMenu()
      return
    }
    if (toolId === 'assets') {
      onOpenAssetsPanel()
      return
    }
    if (toolId === 'templates') {
      onOpenTemplatePanel()
      return
    }
    if (toolId === 'comments') {
      onToggleCommentsPanel()
      return
    }
    if (toolId === 'history') {
      onOpenHistoryPanel()
      return
    }
    if (toolId === 'image-editor') {
      onOpenImageEditor()
    }
  }

  return (
    <div className="absolute left-6 top-1/2 z-[1100] -translate-y-1/2">
      <div className="canvas-toolbar-shell">
        <div className="flex flex-col gap-2">
          {TOOLS.map((tool) => {
            const active = activeTool === tool.id
            const tooltip = tool.id === 'comments' && commentsEnabled ? '关闭评论模式' : tool.label
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleToolAction(tool.id)}
                className={`canvas-toolbar-button ${active || (tool.id === 'add' && isAddMenuOpen) || (tool.id === 'comments' && commentsEnabled) ? 'is-active' : ''}`}
                title={tooltip}
                aria-label={tooltip}
                data-tooltip={tooltip}
              >
                <Icon size={24} strokeWidth={2.35} />
                <span className="canvas-hover-tooltip" aria-hidden="true">{tooltip}</span>
              </button>
            )
          })}
          <div className="canvas-toolbar-divider" />
          <div className="canvas-toolbar-user-wrap">
            <button
              type="button"
              className={`canvas-toolbar-button ${isUserMenuOpen ? 'is-active' : ''}`}
              title="当前用户"
              aria-label="当前用户"
              data-tooltip="当前用户"
              onClick={() => {
                setIsUserMenuOpen((current) => !current)
                onToolSelect('user')
              }}
            >
              <span className="canvas-toolbar-avatar"><UserRound size={18} strokeWidth={2.2} /></span>
              <span className="canvas-hover-tooltip" aria-hidden="true">当前用户</span>
            </button>
            <AnimatePresence>
              {isUserMenuOpen ? (
                <motion.div
                  initial={{ opacity: 0, x: -8, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="canvas-user-menu"
                >
                  <a href="/me" className="canvas-user-menu-item">我的工作台</a>
                  <a href="/projects" className="canvas-user-menu-item">项目</a>
                  <a href="/" className="canvas-user-menu-item">退出当前画布</a>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
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
              <div className="canvas-add-menu-label">添加节点</div>
            </div>

            <div className="space-y-2">
              {NODE_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onAddNode(option.kind, option.presetTitle)
                      onToggleAddMenu()
                    }}
                    className="canvas-add-option"
                  >
                    <span className="canvas-add-option-icon"><Icon size={24} strokeWidth={2.3} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="canvas-add-option-title">{option.label}</span>
                      <span className="canvas-add-option-hint">{option.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
