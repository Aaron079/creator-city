'use client'

import { useRef, type CSSProperties } from 'react'
import { motion } from 'framer-motion'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'asset' | 'template' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'generating' | 'done' | 'error'
export type VisualCanvasNodePreview = {
  type: 'none' | 'placeholder-video' | 'remote-video'
  url?: string
  poster?: string
  licenseType?: string
  attribution?: string
  gradientFrom?: string
  gradientTo?: string
}

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
  errorMessage?: string
  preview?: VisualCanvasNodePreview
  resultImageUrl?: string
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
  onAddPrev: (event: React.PointerEvent<HTMLButtonElement>) => void
  onAddNext: (event: React.PointerEvent<HTMLButtonElement>) => void
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onOpenContextMenu: (event: React.MouseEvent<HTMLElement>) => void
  onEdit: () => void
  dragging?: boolean
}

const NODE_META: Record<VisualCanvasNodeKind, { icon: string; label: string; empty: string }> = {
  text: {
    icon: '✦',
    label: 'Text',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  image: {
    icon: '◫',
    label: 'Image',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  video: {
    icon: '▻',
    label: 'Video',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  audio: {
    icon: '♫',
    label: 'Audio',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  asset: {
    icon: '↑',
    label: 'Asset',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  template: {
    icon: '◧',
    label: 'Template',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  delivery: {
    icon: '✓',
    label: 'Delivery',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  world: {
    icon: '◎',
    label: 'World',
    empty: '点击编辑，生成内容会显示在这里。',
  },
  upload: {
    icon: '↑',
    label: 'Upload',
    empty: '点击编辑，生成内容会显示在这里。',
  },
}

function getResultPreviewClass(kind: VisualCanvasNodeKind) {
  if (kind === 'image') return 'is-image-result'
  if (kind === 'video') return 'is-video-result'
  if (kind === 'audio') return 'is-audio-result'
  return ''
}

export function CanvasNodeCard({
  node,
  active,
  onSelect,
  onAddPrev,
  onAddNext,
  onDragStart,
  onOpenContextMenu,
  onEdit,
  dragging = false,
}: CanvasNodeCardProps) {
  const meta = NODE_META[node.kind]
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
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
      onPointerDown={(event) => {
        if (event.button !== 0) return
        pointerDownPos.current = { x: event.clientX, y: event.clientY }
      }}
      onClick={(event) => {
        const down = pointerDownPos.current
        if (down && (Math.abs(event.clientX - down.x) > 6 || Math.abs(event.clientY - down.y) > 6)) return
        onSelect()
        onEdit()
      }}
      onDoubleClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onEdit()
      }}
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
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddPrev(event)
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        className="canvas-node-connector is-left"
        aria-label="Add previous node"
      >
        +
      </button>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onAddNext(event)
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        className="canvas-node-connector is-right"
        aria-label="Add next node"
      >
        +
      </button>

      <div
        className="relative z-[1] flex h-full flex-col"
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const el = event.target as HTMLElement
          if (el.closest('button')) return
          pointerDownPos.current = { x: event.clientX, y: event.clientY }
          onDragStart(event)
        }}
      >
        <div className="canvas-node-header">
          <div className="min-w-0 flex items-center gap-2">
            <span className="canvas-node-icon">{meta.icon}</span>
            <div className="min-w-0">
              <div className="canvas-node-kind">{meta.label}</div>
              <div className="canvas-node-title">{node.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`canvas-node-status-dot status-${node.status}`} aria-hidden="true" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpenContextMenu(event)
              }}
              className="canvas-node-more"
              aria-label="Node options"
            >
              ···
            </button>
          </div>
        </div>

        <div className="canvas-node-body">
          {node.status === 'done' ? (
            <div
              className={`canvas-node-preview preview-${node.kind} ${getResultPreviewClass(node.kind)} ${node.preview?.type === 'placeholder-video' ? 'has-placeholder-preview' : ''}`}
              onMouseEnter={(event) => {
                event.currentTarget.querySelector('video')?.play().catch(() => undefined)
              }}
              onMouseLeave={(event) => {
                const video = event.currentTarget.querySelector('video')
                if (!video) return
                video.pause()
                video.currentTime = 0
              }}
              style={node.preview?.gradientFrom && node.preview?.gradientTo
                ? {
                  '--node-preview-from': node.preview.gradientFrom,
                  '--node-preview-to': node.preview.gradientTo,
                } as CSSProperties
                : undefined}
            >
              {node.preview?.type === 'remote-video' && node.preview.url ? (
                <video
                  className="canvas-node-preview-video"
                  src={node.preview.url}
                  poster={node.preview.poster}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : null}
              <div className="canvas-node-preview-copy">
                {node.resultPreview ?? node.outputLabel ?? '结果已生成。'}
                {node.preview?.type === 'placeholder-video' ? (
                  <span className="canvas-node-preview-license">合法占位预览 · 无第三方素材</span>
                ) : null}
                {node.preview?.type === 'remote-video' ? (
                  <span className="canvas-node-preview-license">
                    {node.preview.licenseType === 'original' ? '生成结果' : '参考预览'} · {node.preview.attribution ?? node.preview.licenseType ?? 'licensed source'}
                  </span>
                ) : null}
              </div>
            </div>
          ) : node.status === 'generating' ? (
            <div className="canvas-node-preview is-generating-preview">
              <div className="canvas-node-loading-bar" />
              <div className="canvas-node-preview-copy">生成中</div>
            </div>
          ) : node.status === 'error' ? (
            <div className="canvas-node-preview is-error-preview">
              <div className="canvas-node-preview-copy">{node.errorMessage || '生成失败，点击重试。'}</div>
            </div>
          ) : (
            <div className={`canvas-node-empty empty-${node.kind}`}>
              <span>{meta.empty}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
