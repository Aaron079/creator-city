'use client'

import { motion } from 'framer-motion'
import {
  getCanvasProvider,
  getCanvasProviderLabel,
  type CanvasProviderKind,
} from '@/lib/tools/provider-groups'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'asset' | 'template' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'generating' | 'done'

export interface VisualCanvasNode {
  id: string
  type: VisualCanvasNodeKind
  kind: VisualCanvasNodeKind
  title: string
  subtitle: string
  prompt: string
  model: string
  providerId: string
  stage: string
  ratio?: string
  status: VisualCanvasNodeStatus
  resultPreview?: string
  outputLabel?: string
  x: number
  y: number
  width: number
  height: number
  createdAt: number
}

interface CanvasNodeCardProps {
  node: VisualCanvasNode
  active: boolean
  onSelect: () => void
  onPromptChange: (value: string) => void
  onModelChange: (value: string) => void
  onRatioChange?: (value: string) => void
  onGenerate: () => void
  onUpload: () => void
  onAddNext: (event: React.MouseEvent<HTMLButtonElement>) => void
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onOpenContextMenu: (event: React.MouseEvent<HTMLElement>) => void
  dragging?: boolean
}

const NODE_META: Record<VisualCanvasNodeKind, { icon: string; label: string; empty: string }> = {
  text: {
    icon: '✦',
    label: '文本',
    empty: '脚本、文案或创意方向会显示在这里。',
  },
  image: {
    icon: '◫',
    label: '图片',
    empty: '关键画面、参考帧或图片结果占位。',
  },
  video: {
    icon: '▣',
    label: '视频',
    empty: '镜头、运动和视频生成结果会显示在这里。',
  },
  audio: {
    icon: '♫',
    label: '音频',
    empty: '旁白、音乐或声音结果占位。',
  },
  asset: {
    icon: '↑',
    label: '素材',
    empty: '上传或引用的素材会显示在这里。',
  },
  template: {
    icon: '◧',
    label: '模板',
    empty: '模板流程占位。',
  },
  delivery: {
    icon: '✓',
    label: '交付',
    empty: '交付摘要与客户确认信息。',
  },
  world: {
    icon: '◎',
    label: '3D 世界',
    empty: '空间、场景和世界观结构。',
  },
  upload: {
    icon: '↑',
    label: '上传',
    empty: '上传素材占位。',
  },
}

const STATUS_META: Record<VisualCanvasNodeStatus, { label: string; summary: string }> = {
  idle: { label: 'Idle', summary: '等待生成' },
  generating: { label: 'Generating', summary: '正在模拟生成结果' },
  done: { label: 'Done', summary: '结果已就绪，可继续迭代' },
}

function getProviderKind(kind: VisualCanvasNodeKind): CanvasProviderKind {
  if (kind === 'asset' || kind === 'template') return 'upload'
  return kind as CanvasProviderKind
}

export function CanvasNodeCard({
  node,
  active,
  onSelect,
  onGenerate,
  onUpload,
  onAddNext,
  onDragStart,
  onOpenContextMenu,
  dragging = false,
}: CanvasNodeCardProps) {
  const meta = NODE_META[node.kind]
  const status = STATUS_META[node.status]
  const providerKind = getProviderKind(node.kind)
  const provider = getCanvasProvider(providerKind, node.providerId)
  const providerLabel = provider?.displayName ?? getCanvasProviderLabel(providerKind, node.model)
  const className = [
    'canvas-node-card',
    `node-${node.kind}`,
    active ? 'is-active' : '',
    dragging ? 'is-dragging' : '',
    node.status === 'generating' ? 'is-generating' : '',
  ].filter(Boolean).join(' ')

  return (
    <motion.div
      role="button"
      tabIndex={0}
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`${className} group text-left`}
      style={{ width: node.width, height: node.height }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onOpenContextMenu(event)
      }}
    >
      <div className="canvas-node-topline" />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        className="canvas-node-connector is-left"
        aria-label="Select upstream connector"
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onAddNext(event)
        }}
        className="canvas-node-connector is-right"
        aria-label="Add next node"
      >
        +
      </button>

      <div className="relative z-[1] flex h-full flex-col">
        <div
          className="canvas-node-header"
          onPointerDown={onDragStart}
        >
          <div className="min-w-0 flex items-center gap-2">
            <span className="canvas-node-icon">{meta.icon}</span>
            <div className="min-w-0">
              <div className="canvas-node-kind">{meta.label}</div>
              <div className="canvas-node-title">{node.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`canvas-node-status status-${node.status}`}>
              {status.label}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenContextMenu(event)
              }}
              className="canvas-node-more"
              aria-label="Node options"
            >
              ...
            </button>
          </div>
        </div>

        <div className="canvas-node-body">
          {node.status === 'done' ? (
            <div className={`canvas-node-preview preview-${node.kind}`}>
              <div className="canvas-node-preview-label">Result Preview</div>
              <div className="canvas-node-preview-copy">
                {node.resultPreview ?? node.outputLabel ?? status.summary}
              </div>
            </div>
          ) : node.status === 'generating' ? (
            <div className="canvas-node-preview is-generating-preview">
              <div className="canvas-node-preview-label">Generating</div>
              <div className="canvas-node-preview-copy">{status.summary}</div>
            </div>
          ) : (
            <div className={`canvas-node-empty empty-${node.kind}`}>
              <span className="canvas-node-empty-icon">{meta.icon}</span>
              <span>{meta.empty}</span>
            </div>
          )}
        </div>

        <div className="canvas-node-footer">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="canvas-node-provider">{providerLabel}</span>
              {node.ratio ? <span className="canvas-node-provider">{node.ratio}</span> : null}
            </div>
            <p className="canvas-node-summary">
              {node.prompt || node.resultPreview || node.outputLabel || status.summary}
            </p>
          </div>

          <div className="canvas-node-actions">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onAddNext(event)
              }}
              className="canvas-secondary-button"
            >
              后续 +
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onUpload()
              }}
              className="canvas-secondary-button"
            >
              上传
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onGenerate()
              }}
              className="canvas-secondary-button"
            >
              {node.status === 'generating' ? '节点生成中' : '节点生成'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
