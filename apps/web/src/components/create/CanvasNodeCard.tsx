'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'asset' | 'template' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'queued' | 'running' | 'generating' | 'done' | 'error'
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
  resultText?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  metadataJson?: unknown
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
  onOpenTextEditor?: () => void
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

function getStatusLabel(status: VisualCanvasNodeStatus) {
  if (status === 'queued') return '排队中'
  if (status === 'running' || status === 'generating') return '运行中'
  if (status === 'done') return '完成'
  if (status === 'error') return '失败'
  return '待运行'
}

function summarizeTextError(errorMessage?: string) {
  const message = errorMessage?.trim()
  if (!message) return '生成失败，请重试。'
  const lower = message.toLowerCase()
  if ((message.includes('KIMI_TEXT_FAILED') || message.includes('KIMI_REQUEST_TIMEOUT')) && lower.includes('abort')) {
    return 'Kimi 请求超时或被中断，请重试。'
  }
  if (message.includes('KIMI_REQUEST_TIMEOUT')) return 'Kimi 请求超时或被中断，请重试。'
  return message.length > 200 ? `${message.slice(0, 200)}...` : message
}

function metadataRecord(metadataJson: unknown) {
  return metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
    ? metadataJson as Record<string, unknown>
    : {}
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest([
    'button',
    'input',
    'textarea',
    'select',
    'a',
    'video',
    'audio',
    '[contenteditable="true"]',
    '[data-no-node-drag="true"]',
    '[data-connection-handle="true"]',
    '.canvas-node-dialog',
    '.canvas-prompt-box',
    '.canvas-context-menu',
    '.canvas-node-add-menu',
    '.canvas-node-create-menu',
    '.canvas-side-panel',
  ].join(',')))
}

function aspectRatioFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    if (Math.abs(value - 1.777) < 0.04) return 16 / 9
    if (Math.abs(value - 1) < 0.04) return 1
    if (Math.abs(value - 0.5625) < 0.04) return 9 / 16
    return value
  }
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === '16:9') return 16 / 9
  if (normalized === '9:16') return 9 / 16
  if (normalized === '1:1') return 1
  if (normalized === '4:3') return 4 / 3
  if (normalized === '3:4') return 3 / 4
  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric > 0 ? aspectRatioFromValue(numeric) : null
}

function aspectRatioCss(value: number) {
  if (Math.abs(value - 16 / 9) < 0.04) return '16 / 9'
  if (Math.abs(value - 9 / 16) < 0.04) return '9 / 16'
  if (Math.abs(value - 1) < 0.04) return '1 / 1'
  if (Math.abs(value - 4 / 3) < 0.04) return '4 / 3'
  if (Math.abs(value - 3 / 4) < 0.04) return '3 / 4'
  return `${Math.max(0.1, value).toFixed(4)} / 1`
}

function resolveImageAspectRatio(node: VisualCanvasNode, naturalRatio: number | null) {
  const metadata = metadataRecord(node.metadataJson)
  const params = metadata.params && typeof metadata.params === 'object' && !Array.isArray(metadata.params)
    ? metadata.params as Record<string, unknown>
    : {}
  const generationParams = metadata.generationParams && typeof metadata.generationParams === 'object' && !Array.isArray(metadata.generationParams)
    ? metadata.generationParams as Record<string, unknown>
    : {}
  const nodeParams = (node as VisualCanvasNode & { params?: unknown }).params
  const nodeParamsRecord = nodeParams && typeof nodeParams === 'object' && !Array.isArray(nodeParams)
    ? nodeParams as Record<string, unknown>
    : {}
  return aspectRatioFromValue(metadata.aspectRatio)
    ?? aspectRatioFromValue((node as VisualCanvasNode & { aspectRatio?: unknown }).aspectRatio)
    ?? aspectRatioFromValue(params.aspectRatio)
    ?? aspectRatioFromValue(params.ratio)
    ?? aspectRatioFromValue(generationParams.aspectRatio)
    ?? aspectRatioFromValue(generationParams.ratio)
    ?? aspectRatioFromValue(nodeParamsRecord.aspectRatio)
    ?? aspectRatioFromValue(nodeParamsRecord.ratio)
    ?? aspectRatioFromValue(node.ratio)
    ?? naturalRatio
    ?? 16 / 9
}

function resolveVideoAspectRatio(node: VisualCanvasNode) {
  const metadata = metadataRecord(node.metadataJson)
  const params = metadata.params && typeof metadata.params === 'object' && !Array.isArray(metadata.params)
    ? metadata.params as Record<string, unknown>
    : {}
  const generationParams = metadata.generationParams && typeof metadata.generationParams === 'object' && !Array.isArray(metadata.generationParams)
    ? metadata.generationParams as Record<string, unknown>
    : {}
  const nodeParams = (node as VisualCanvasNode & { params?: unknown }).params
  const nodeParamsRecord = nodeParams && typeof nodeParams === 'object' && !Array.isArray(nodeParams)
    ? nodeParams as Record<string, unknown>
    : {}
  return aspectRatioFromValue(metadata.aspectRatio)
    ?? aspectRatioFromValue((node as VisualCanvasNode & { aspectRatio?: unknown }).aspectRatio)
    ?? aspectRatioFromValue(params.aspectRatio)
    ?? aspectRatioFromValue(params.ratio)
    ?? aspectRatioFromValue(generationParams.aspectRatio)
    ?? aspectRatioFromValue(generationParams.ratio)
    ?? aspectRatioFromValue(nodeParamsRecord.aspectRatio)
    ?? aspectRatioFromValue(nodeParamsRecord.ratio)
    ?? aspectRatioFromValue(node.ratio)
    ?? 16 / 9
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
  onOpenTextEditor,
  dragging = false,
}: CanvasNodeCardProps) {
  const meta = NODE_META[node.kind]
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [imageLinkCopied, setImageLinkCopied] = useState(false)
  const [imageNaturalRatio, setImageNaturalRatio] = useState<number | null>(null)
  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false)
  const [videoLoadFailed, setVideoLoadFailed] = useState(false)
  const [videoLinkCopied, setVideoLinkCopied] = useState(false)
  const videoPreviewUrl = node.kind === 'video'
    ? node.resultVideoUrl || (node.preview?.type === 'remote-video' ? node.preview.url : undefined)
    : undefined
  const nodeMetadata = metadataRecord(node.metadataJson)
  const videoProviderLabel = node.providerId || (typeof nodeMetadata.providerId === 'string' ? nodeMetadata.providerId : '')
  const videoModelLabel = typeof nodeMetadata.model === 'string' ? nodeMetadata.model : node.model
  const textResult = node.resultText?.trim() ? node.resultText : ''
  const textErrorSummary = node.status === 'error' ? summarizeTextError(node.errorMessage) : ''
  const textDisplay = node.status === 'queued'
    ? '排队中...'
    : node.status === 'running' || node.status === 'generating'
      ? '正在生成文本...'
      : textResult || textErrorSummary || '生成结果会显示在这里。'
  const textIsPlaceholder = !textResult && !textErrorSummary && node.status !== 'queued' && node.status !== 'running' && node.status !== 'generating'
  const className = [
    'canvas-node-card',
    `node-${node.kind}`,
    active ? 'is-active' : '',
    dragging ? 'is-dragging' : '',
    node.status === 'generating' || node.status === 'running' ? 'is-generating' : '',
  ].filter(Boolean).join(' ')
  const imageAspectRatioValue = node.kind === 'image' ? resolveImageAspectRatio(node, imageNaturalRatio) : 16 / 9
  const imageAspectRatioCssValue = aspectRatioCss(imageAspectRatioValue)
  const imageFrameStyle = node.kind === 'image'
    ? {
        '--image-aspect-ratio': imageAspectRatioCssValue,
        aspectRatio: imageAspectRatioCssValue,
        height: imageAspectRatioValue < 1 ? '100%' : 'auto',
        maxHeight: '100%',
        maxWidth: '100%',
        width: imageAspectRatioValue < 1 ? 'auto' : '100%',
      } as CSSProperties
    : undefined
  const videoAspectRatioValue = node.kind === 'video' ? resolveVideoAspectRatio(node) : 16 / 9
  const videoAspectRatioCssValue = aspectRatioCss(videoAspectRatioValue)
  const videoFrameStyle = node.kind === 'video'
    ? {
        '--video-aspect-ratio': videoAspectRatioCssValue,
        aspectRatio: videoAspectRatioCssValue,
        height: videoAspectRatioValue < 1 ? '100%' : 'auto',
        maxHeight: '100%',
        maxWidth: '100%',
        width: videoAspectRatioValue < 1 ? 'auto' : '100%',
      } as CSSProperties
    : undefined

  useEffect(() => {
    setImageLoadFailed(false)
    setImagePreviewOpen(false)
    setImageLinkCopied(false)
    setImageNaturalRatio(null)
  }, [node.resultImageUrl])

  useEffect(() => {
    setVideoPreviewOpen(false)
    setVideoLoadFailed(false)
    setVideoLinkCopied(false)
  }, [videoPreviewUrl])

  const copyImageLink = async () => {
    if (!node.resultImageUrl) return
    try {
      await navigator.clipboard?.writeText(node.resultImageUrl)
      setImageLinkCopied(true)
      window.setTimeout(() => setImageLinkCopied(false), 1200)
    } catch {
      setImageLinkCopied(false)
    }
  }

  const copyVideoLink = async () => {
    if (!videoPreviewUrl) return
    try {
      await navigator.clipboard?.writeText(videoPreviewUrl)
      setVideoLinkCopied(true)
      window.setTimeout(() => setVideoLinkCopied(false), 1200)
    } catch {
      setVideoLinkCopied(false)
    }
  }

  const openVideoInNewTab = () => {
    if (!videoPreviewUrl) return
    window.open(videoPreviewUrl, '_blank', 'noopener,noreferrer')
  }

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
        if (isInteractiveTarget(event.target)) return
        event.stopPropagation()
        onDragStart(event)
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
        data-canvas-connector="true"
        data-connection-handle="true"
        data-node-id={node.id}
        data-handle="left"
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
        data-canvas-connector="true"
        data-connection-handle="true"
        data-node-id={node.id}
        data-handle="right"
      >
        +
      </button>

      <div
        className="relative z-[1] flex h-full flex-col"
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
            <span className={`canvas-node-status-text status-${node.status}`}>{getStatusLabel(node.status)}</span>
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
          {node.kind === 'text' ? (
            <button
              type="button"
              data-no-node-drag="true"
              className={`canvas-node-text-result ${textIsPlaceholder ? 'is-placeholder' : ''} ${node.status === 'error' ? 'is-error' : ''}`}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
              }}
              onWheel={(event) => {
                event.stopPropagation()
              }}
              onWheelCapture={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSelect()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenTextEditor?.()
              }}
              aria-label="查看或编辑文本结果"
            >
              {node.status === 'error' && textResult ? (
                <span className="canvas-node-text-error">{textErrorSummary}</span>
              ) : null}
              <span className="canvas-node-text-copy">{textDisplay}</span>
            </button>
          ) : node.status === 'done' ? (
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
                  ...(node.kind === 'image' ? imageFrameStyle : {}),
                  ...(node.kind === 'video' ? videoFrameStyle : {}),
                } as CSSProperties
                : node.kind === 'image' ? imageFrameStyle : node.kind === 'video' ? videoFrameStyle : undefined}
            >
              {node.kind === 'video' && videoPreviewUrl ? (
                <div
                  className="canvas-node-video-button"
                  role="button"
                  tabIndex={0}
                  data-no-node-drag="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onWheel={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect()
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (videoLoadFailed || !videoPreviewUrl) return
                    setVideoPreviewOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    if (videoLoadFailed) return
                    setVideoPreviewOpen(true)
                  }}
                  aria-label="预览视频"
                >
                  {videoLoadFailed ? (
                    <span className="canvas-node-video-error">视频无法加载</span>
                  ) : (
                    <>
                      <video
                        className="canvas-node-preview-video"
                        src={videoPreviewUrl}
                        poster={node.preview?.poster}
                        muted
                        playsInline
                        preload="metadata"
                        onError={() => setVideoLoadFailed(true)}
                      />
                      <span className="canvas-node-video-play" aria-hidden="true">▶</span>
                    </>
                  )}
                </div>
              ) : null}
              {node.kind === 'image' && node.resultImageUrl ? (
                <button
                  type="button"
                  data-no-node-drag="true"
                  className="canvas-node-image-button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect()
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!node.resultImageUrl) return
                    setImagePreviewOpen(true)
                  }}
                  aria-label="预览图片"
                >
                  {imageLoadFailed ? (
                    <span className="canvas-node-image-error">图片无法加载</span>
                  ) : (
                    <img
                      src={node.resultImageUrl}
                      alt={node.title}
                      className="canvas-node-preview-image"
                      loading="lazy"
                      onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          setImageNaturalRatio(naturalWidth / naturalHeight)
                        }
                      }}
                      onError={() => setImageLoadFailed(true)}
                    />
                  )}
                </button>
              ) : null}
              <div className="canvas-node-preview-copy">
                {node.resultText || node.resultPreview || node.outputLabel || '结果已生成。'}
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
          ) : node.status === 'generating' || node.status === 'running' || node.status === 'queued' ? (
            <div className="canvas-node-preview is-generating-preview">
              <div className="canvas-node-loading-bar" />
              <div className="canvas-node-preview-copy">
                {node.kind === 'video'
                  ? (node.resultPreview || node.outputLabel || (node.status === 'queued' ? '排队中...' : '视频生成中，请稍后查询结果'))
                  : node.resultPreview || node.outputLabel || (node.status === 'queued' ? '排队中...' : '运行中...')}
              </div>
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
      {imagePreviewOpen && node.resultImageUrl ? (
        <div
          className="canvas-image-preview-backdrop"
          role="presentation"
          data-no-node-drag="true"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) setImagePreviewOpen(false)
          }}
        >
          <section
            className="canvas-image-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="图片预览"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="canvas-image-preview-head">
              <span>{node.title}</span>
              <button type="button" onClick={() => setImagePreviewOpen(false)} aria-label="关闭图片预览">×</button>
            </div>
            {imageLoadFailed ? (
              <div className="canvas-image-preview-error">图片无法加载</div>
            ) : (
              <img src={node.resultImageUrl} alt={node.title} className="canvas-image-preview-media" />
            )}
            <div className="canvas-image-preview-actions">
              <button type="button" onClick={() => { void copyImageLink() }}>
                {imageLinkCopied ? '已复制' : '复制图片链接'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {videoPreviewOpen && videoPreviewUrl ? (
        <div
          className="canvas-video-preview-backdrop"
          role="presentation"
          data-no-node-drag="true"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) setVideoPreviewOpen(false)
          }}
        >
          <section
            className="canvas-video-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="视频预览"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="canvas-video-preview-head">
              <div className="canvas-video-preview-title">
                <span>视频预览</span>
                <small>{[videoProviderLabel, videoModelLabel, node.title].filter(Boolean).join(' / ')}</small>
              </div>
              <button type="button" onClick={() => setVideoPreviewOpen(false)} aria-label="关闭视频预览">×</button>
            </div>
            {videoLoadFailed ? (
              <div className="canvas-video-preview-error">视频无法加载</div>
            ) : (
              <video
                src={videoPreviewUrl}
                className="canvas-video-preview-media"
                controls
                autoPlay
                playsInline
                onError={() => setVideoLoadFailed(true)}
              />
            )}
            <div className="canvas-video-preview-actions">
              <button type="button" onClick={() => { void copyVideoLink() }}>
                {videoLinkCopied ? '已复制' : '复制视频链接'}
              </button>
              <button type="button" onClick={openVideoInNewTab}>新标签页打开</button>
              <button type="button" onClick={() => setVideoPreviewOpen(false)}>关闭</button>
            </div>
          </section>
        </div>
      ) : null}
    </motion.div>
  )
}
