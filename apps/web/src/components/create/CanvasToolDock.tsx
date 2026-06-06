'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Clapperboard,
  ImageIcon,
  Layers,
  Plus,
  Square,
  Text,
  UserRound,
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
  lexiconOpen: boolean
  onLexiconToggle: () => void
  variantPlannerOpen: boolean
  onVariantPlannerToggle: () => void
  characterLockOpen: boolean
  onCharacterLockToggle: () => void
}

// ─── node options ──────────────────────────────────────────────────────────────

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

// ─── tool group definitions ────────────────────────────────────────────────────

type ToolGroupId = 'director' | 'asset' | 'character'

interface ToolGroupItem {
  id: 'camera-lexicon' | 'asset-variant-planner' | 'character-lock'
  label: string
  description: string
  Icon: typeof Clapperboard
}

interface ToolGroup {
  id: ToolGroupId
  label: string
  labelEn: string
  Icon: typeof Clapperboard
  description: string
  items: ToolGroupItem[]
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'director',
    label: '导演',
    labelEn: 'Director',
    Icon: Clapperboard,
    description: '镜头语言 · 画面构图 · 运镜指导',
    items: [
      {
        id: 'camera-lexicon',
        label: '镜头词典',
        description: '插入专业镜头词汇到 Prompt',
        Icon: Clapperboard,
      },
    ],
  },
  {
    id: 'asset',
    label: '资产',
    labelEn: 'Asset',
    Icon: Layers,
    description: '变体规划 · 资产对比 · 素材整理',
    items: [
      {
        id: 'asset-variant-planner',
        label: '变体规划器',
        description: '生成当前节点的变体方向建议',
        Icon: Layers,
      },
    ],
  },
  {
    id: 'character',
    label: '角色',
    labelEn: 'Character',
    Icon: UserRound,
    description: '角色卡 · 一致性描述 · 角色绑定',
    items: [
      {
        id: 'character-lock',
        label: '角色锁定',
        description: '注册角色卡，追加一致性描述到 Prompt',
        Icon: UserRound,
      },
    ],
  },
]

// ─── component ─────────────────────────────────────────────────────────────────

export function CanvasToolDock({
  onAddNode,
  activeTool,
  onToolSelect,
  isAddMenuOpen,
  onToggleAddMenu,
  hasActiveGenerations,
  onStopAllGenerations,
  lexiconOpen,
  onLexiconToggle,
  variantPlannerOpen,
  onVariantPlannerToggle,
  characterLockOpen,
  onCharacterLockToggle,
}: CanvasToolDockProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [openGroupId, setOpenGroupId] = useState<ToolGroupId | null>(null)

  // Which group has an active panel (panel is open)
  const activeGroupId: ToolGroupId | null =
    lexiconOpen ? 'director'
    : variantPlannerOpen ? 'asset'
    : characterLockOpen ? 'character'
    : null

  const toggleGroup = (groupId: ToolGroupId) => {
    setOpenGroupId((current) => (current === groupId ? null : groupId))
    // Close add menu and user menu when opening a group sub-nav
    if (isAddMenuOpen) onToggleAddMenu()
    setIsUserMenuOpen(false)
  }

  const handleToolItemClick = (itemId: ToolGroupItem['id']) => {
    setOpenGroupId(null)
    if (itemId === 'camera-lexicon') onLexiconToggle()
    else if (itemId === 'asset-variant-planner') onVariantPlannerToggle()
    else if (itemId === 'character-lock') onCharacterLockToggle()
  }

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
              setOpenGroupId(null)
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

          {/* Tool group buttons — Director / Asset / Character */}
          {TOOL_GROUPS.map((group) => {
            const GroupIcon = group.Icon
            const hasActiveTool = activeGroupId === group.id
            const isSubNavOpen = openGroupId === group.id
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`canvas-toolbar-button ${hasActiveTool || isSubNavOpen ? 'is-active' : ''}`}
                title={`${group.label} / ${group.labelEn}`}
                aria-label={`${group.label}工具组`}
                aria-expanded={isSubNavOpen}
                data-no-node-drag="true"
              >
                <GroupIcon size={20} strokeWidth={1.8} />
                <span className="canvas-hover-tooltip" aria-hidden="true">{group.label}</span>
              </button>
            )
          })}

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
                setOpenGroupId(null)
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

      {/* Tool group sub-navigation */}
      <AnimatePresence>
        {openGroupId ? (() => {
          const group = TOOL_GROUPS.find((g) => g.id === openGroupId)
          if (!group) return null
          return (
            <motion.div
              key={openGroupId}
              initial={{ opacity: 0, x: -10, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="canvas-add-menu"
              data-no-node-drag="true"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Group header */}
              <div className="canvas-add-menu-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <group.Icon size={16} strokeWidth={1.8} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                  <div>
                    <div className="canvas-add-menu-label" style={{ fontSize: 13 }}>
                      {group.label} / {group.labelEn}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                      {group.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tool items */}
              <div className="space-y-2">
                {group.items.map((item) => {
                  const ItemIcon = item.Icon
                  const isActive =
                    (item.id === 'camera-lexicon' && lexiconOpen) ||
                    (item.id === 'asset-variant-planner' && variantPlannerOpen) ||
                    (item.id === 'character-lock' && characterLockOpen)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToolItemClick(item.id)}
                      className="canvas-add-option"
                      style={isActive ? {
                        background: 'rgba(29, 160, 219, 0.12)',
                        border: '1px solid rgba(29, 160, 219, 0.25)',
                        borderRadius: 16,
                      } : undefined}
                    >
                      <span className="canvas-add-option-icon">
                        <ItemIcon
                          size={22}
                          strokeWidth={2}
                          style={{ color: isActive ? 'rgb(29, 160, 219)' : undefined }}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="canvas-add-option-title" style={{ color: isActive ? 'rgba(255,255,255,0.9)' : undefined }}>
                          {item.label}
                          {isActive ? (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(29,160,219,0.9)', fontWeight: 600 }}>
                              已打开
                            </span>
                          ) : null}
                        </span>
                        <span className="canvas-add-option-hint">{item.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Future tools notice */}
              <div style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.07)',
                fontSize: 10,
                color: 'rgba(255,255,255,0.22)',
                lineHeight: 1.5,
              }}>
                {openGroupId === 'director' && '未来：Shot Doctor · Motion Director · Composition Coach'}
                {openGroupId === 'asset' && '未来：A/B Compare · Keyframe Extractor · Asset Export Pack'}
                {openGroupId === 'character' && '未来：Consistency Checker · Multi-character Binding · Card Manager'}
              </div>
            </motion.div>
          )
        })() : null}
      </AnimatePresence>
    </div>
  )
}
