'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ImageIcon,
  Plus,
  Square,
  Text,
  Video,
} from 'lucide-react'
import type { VisualCanvasNodeKind } from '@/components/create/CanvasNodeCard'
import { SettingsHoverMenu } from '@/components/navigation/SettingsHoverMenu'

interface CanvasToolDockProps {
  onAddNode: (kind: VisualCanvasNodeKind, presetTitle?: string) => void
  activeTool: string
  onToolSelect: (tool: string) => void
  isAddMenuOpen: boolean
  onToggleAddMenu: () => void
  hasActiveGenerations: boolean
  onStopAllGenerations: () => void
}

const NODE_OPTIONS: Array<{
  id: string
  kind: VisualCanvasNodeKind
  icon: typeof Text
  label: string
  hint: string
}> = [
  { id: 'text', kind: 'text', icon: Text, label: '文本', hint: '脚本、广告词、品牌文案' },
  { id: 'image', kind: 'image', icon: ImageIcon, label: '图片', hint: '关键画面、角色、场景图' },
  { id: 'video', kind: 'video', icon: Video, label: '视频', hint: '生成镜头、动作和转场' },
]

export function CanvasToolDock({
  onAddNode,
  activeTool,
  onToolSelect,
  isAddMenuOpen,
  onToggleAddMenu,
  hasActiveGenerations,
  onStopAllGenerations,
}: CanvasToolDockProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  return (
    <div className="absolute left-6 top-1/2 z-[1100] -translate-y-1/2">
      <div className="canvas-toolbar-shell">
        <div className="flex flex-col gap-2">
          {/* Add node */}
          <button
            type="button"
            onClick={() => {
              onToolSelect('add')
              setIsUserMenuOpen(false)
              onToggleAddMenu()
            }}
            className={`canvas-toolbar-button ${activeTool === 'add' || isAddMenuOpen ? 'is-active' : ''}`}
            title="添加节点"
            aria-label="添加节点"
            data-no-node-drag="true"
          >
            <Plus size={24} strokeWidth={2.35} />
            <span className="canvas-hover-tooltip" aria-hidden="true">添加节点</span>
          </button>

          {/* Stop all generations — shown only when active */}
          {hasActiveGenerations ? (
            <button
              type="button"
              onClick={() => {
                onToolSelect('stop')
                onStopAllGenerations()
              }}
              className="canvas-toolbar-button"
              style={{ color: '#f87171' }}
              title="停止所有生成"
              aria-label="停止所有生成"
              data-no-node-drag="true"
            >
              <Square size={22} strokeWidth={2.5} fill="currentColor" />
              <span className="canvas-hover-tooltip" aria-hidden="true">停止所有生成</span>
            </button>
          ) : null}

          <div className="canvas-toolbar-divider" />

          {/* User menu */}
          <div className="canvas-toolbar-user-wrap">
            <button
              type="button"
              className={`canvas-toolbar-button ${isUserMenuOpen ? 'is-active' : ''}`}
              title="当前用户"
              aria-label="当前用户"
              data-no-node-drag="true"
              onClick={() => {
                setIsUserMenuOpen((current) => !current)
                onToolSelect('user')
              }}
            >
              <span className="canvas-toolbar-avatar" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>U</span>
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
                  <a href="/dashboard" className="canvas-user-menu-item" style={{ fontWeight: 600 }}>工作台</a>
                  <a href="/me" className="canvas-user-menu-item">我的工作台</a>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 8px' }} />
                  <a href="/projects" className="canvas-user-menu-item">项目中心</a>
                  <a href="/assets" className="canvas-user-menu-item">资产中心</a>
                  <a href="/tasks" className="canvas-user-menu-item">生成任务</a>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 8px' }} />
                  <a href="/providers" className="canvas-user-menu-item">API 中心</a>
                  <a href="/" className="canvas-user-menu-item">退出当前画布</a>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="canvas-toolbar-divider" />

          {/* Settings hover menu */}
          <SettingsHoverMenu />
        </div>
      </div>

      {/* Add node menu */}
      <AnimatePresence>
        {isAddMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="canvas-add-menu"
            data-no-node-drag="true"
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
                      onAddNode(option.kind)
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
