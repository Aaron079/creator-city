'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { CHAR_REF_DRAG_MIME, type CharacterReferenceDragPayload } from './CharacterReferenceCard'
import { getNodeImageUrlSource, getNodeVideoUrlSource } from '@/lib/canvas/media-urls'
import { getAssetIntelligenceTagCount } from '@/lib/asset-intelligence'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'
import { auditNodeMedia, type MediaRecoveryAudit } from '@/lib/media/recovery-audit'

export type VisualCanvasNodeKind = 'text' | 'image' | 'video' | 'audio' | 'asset' | 'template' | 'delivery' | 'world' | 'upload'
export type VisualCanvasNodeStatus = 'idle' | 'queued' | 'running' | 'generating' | 'done' | 'error'
export type CanvasNodePreviewType = 'text' | 'image' | 'video'
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
  onOpenPreview: (type: CanvasNodePreviewType) => void
  onOpenPromptInspector?: () => void
  onOpenMediaDiagnostics?: (type: 'image' | 'video') => void
  onCreateStableCopy?: () => void
  onRecoverMedia?: (nodeId: string, patch: Partial<VisualCanvasNode>) => void
  enabledSkillCount?: number
  onOpenSkillPanel?: () => void
  creativeAssetLabel?: string
  onOpenCreativeAssets?: () => void
  onOpenAssetIntelligence?: () => void
  onAddToStoryboard?: () => void
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

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

type MediaState = {
  url: string
  source: string
  hasUrl: boolean
  loadFailed: boolean
  isExpiredLikely: boolean
}

type MediaRecoveryStatus = 'idle' | 'checking' | 'recovered' | 'unrecoverable'

function isTemporarySignedUrl(url: string) {
  const lower = url.toLowerCase()
  return [
    'x-tos-expires',
    'x-tos-signature',
    'x-amz-expires',
    'x-amz-signature',
    'x-oss-expires',
    'x-oss-signature',
    'expires=',
    'signature=',
    'security-token=',
  ].some((pattern) => lower.includes(pattern))
}

function mediaState(source: { url: string; source: string }, loadFailed: boolean): MediaState {
  return {
    ...source,
    hasUrl: Boolean(source.url),
    loadFailed,
    isExpiredLikely: Boolean(source.url && (loadFailed || isTemporarySignedUrl(source.url))),
  }
}

function mediaPersistenceStatus(value: unknown) {
  const record = metadataRecord(value)
  if (record.status === 'persisted' || record.ok === true) return 'persisted'
  if (record.status === 'failed' || record.ok === false || record.errorCode) return 'failed'
  if (record.status === 'disabled') return 'disabled'
  if (record.status === 'skipped') return 'skipped'
  return 'missing'
}

function getOriginalProviderUrl(metadata: Record<string, unknown>, kind: 'image' | 'video') {
  return kind === 'image'
    ? stringValue(metadata.originalProviderImageUrl) || stringValue(metadata.originalProviderUrl)
    : stringValue(metadata.originalProviderVideoUrl) || stringValue(metadata.originalProviderUrl)
}

function persistedRecoveryMetadata(value: unknown, recoveredAt: string) {
  const record = metadataRecord(value)
  if (record.status === 'persisted' || record.ok === true) return value
  return {
    ...record,
    status: 'persisted',
    source: stringValue(record.source) || 'media-recovery-audit',
    recoveredAt,
  }
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest([
    'button',
    'input',
    'textarea',
    'select',
    'a',
    'video[controls]',
    'audio',
    '[contenteditable="true"]',
    '[data-provider-menu="true"]',
    '[data-no-node-drag="true"]',
    '[data-connection-handle="true"]',
    '[data-node-action="true"]',
    '[data-node-preview-overlay="true"]',
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
  onOpenPreview,
  onOpenPromptInspector,
  onOpenMediaDiagnostics,
  onCreateStableCopy,
  onRecoverMedia,
  enabledSkillCount = 0,
  onOpenSkillPanel,
  creativeAssetLabel = '创作资产',
  onOpenCreativeAssets,
  onOpenAssetIntelligence,
  onAddToStoryboard,
  dragging = false,
}: CanvasNodeCardProps) {
  const meta = NODE_META[node.kind]
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const [imageNaturalRatio, setImageNaturalRatio] = useState<number | null>(null)
  const [videoLoadFailed, setVideoLoadFailed] = useState(false)
  const [charRefDragOver, setCharRefDragOver] = useState(false)
  const [copiedMediaUrl, setCopiedMediaUrl] = useState<'image' | 'video' | null>(null)
  const [mediaRecoveryStatus, setMediaRecoveryStatus] = useState<MediaRecoveryStatus>('idle')
  const recoveryAttemptKeyRef = useRef('')

  function handleVideoPreviewEnter() {
    const video = videoPreviewRef.current
    if (!video) return
    video.muted = true
    video.playsInline = true
    void video.play().catch(() => undefined)
  }

  function handleVideoPreviewLeave() {
    const video = videoPreviewRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }
  const imageMedia = mediaState(node.kind === 'image' ? getNodeImageUrlSource(node) : { url: '', source: '' }, imageLoadFailed)
  const videoMedia = mediaState(node.kind === 'video' ? getNodeVideoUrlSource(node) : { url: '', source: '' }, videoLoadFailed)
  const nodeMetadata = metadataRecord(node.metadataJson)
  const assetIntelligenceTagCount = getAssetIntelligenceTagCount(nodeMetadata.assetIntelligence)
  const persistenceStatus = mediaPersistenceStatus(nodeMetadata.mediaPersistence)
  const assetUrl = stringValue(nodeMetadata.assetUrl)
  const activeMedia = node.kind === 'image' ? imageMedia : node.kind === 'video' ? videoMedia : null
  const mediaVaultStatus = activeMedia?.hasUrl
    ? persistenceStatus === 'persisted'
      ? { label: '已保存', tone: 'persisted' }
      : persistenceStatus === 'failed'
        ? { label: '临时链接', tone: 'temporary' }
        : !assetUrl && activeMedia.isExpiredLikely
          ? { label: '可能过期', tone: 'expired' }
          : null
    : null
  const canCreateStableCopy = Boolean(onCreateStableCopy && activeMedia?.loadFailed && persistenceStatus !== 'persisted')
  const imagePreviewUrl = imageMedia.url
  const videoPreviewUrl = videoMedia.url
  const imageProxiedSrc = getProxiedMediaUrl(imagePreviewUrl)
  const videoProxiedSrc = getProxiedMediaUrl(videoPreviewUrl)
  const hasMediaResult = (node.kind === 'image' && imageMedia.hasUrl) || (node.kind === 'video' && videoMedia.hasUrl)
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
  const canOpenCreativeAssets = Boolean(onOpenCreativeAssets && (node.kind === 'text' || node.kind === 'image' || node.kind === 'video'))
  const canOpenAssetIntelligence = Boolean(onOpenAssetIntelligence && assetIntelligenceTagCount > 0 && (node.kind === 'image' || node.kind === 'video'))

  const copyMediaUrl = async (kind: 'image' | 'video', url: string) => {
    if (!url.trim()) return
    try {
      await navigator.clipboard?.writeText(url)
      setCopiedMediaUrl(kind)
      window.setTimeout(() => setCopiedMediaUrl(null), 1200)
    } catch {
      setCopiedMediaUrl(null)
    }
  }

  useEffect(() => {
    if (!onRecoverMedia || (node.kind !== 'image' && node.kind !== 'video')) return

    const mediaKind = node.kind
    const resultUrl = mediaKind === 'image' ? stringValue(node.resultImageUrl) : stringValue(node.resultVideoUrl)
    const currentUrl = mediaKind === 'image' ? imagePreviewUrl : videoPreviewUrl
    const loadFailed = mediaKind === 'image' ? imageLoadFailed : videoLoadFailed
    const originalProviderUrl = getOriginalProviderUrl(nodeMetadata, mediaKind) || (!assetUrl ? resultUrl : '')
    const shouldAudit = Boolean(currentUrl || assetUrl || originalProviderUrl)
      && (
        loadFailed
        || (assetUrl && resultUrl !== assetUrl)
        || (!assetUrl && originalProviderUrl && persistenceStatus !== 'persisted')
      )
    if (!shouldAudit) return

    const attemptKey = [
      node.id,
      mediaKind,
      resultUrl,
      currentUrl,
      assetUrl,
      originalProviderUrl,
      persistenceStatus,
      loadFailed ? 'failed' : 'ready',
    ].join('|')
    if (recoveryAttemptKeyRef.current === attemptKey) return
    recoveryAttemptKeyRef.current = attemptKey

    let cancelled = false
    setMediaRecoveryStatus('checking')

    const patchRecoveredNode = (stableUrl: string, audit: MediaRecoveryAudit, extraMetadata?: Record<string, unknown>) => {
      const recoveredAt = new Date().toISOString()
      const nextMetadata = {
        ...metadataRecord(node.metadataJson),
        assetUrl: stableUrl,
        mediaPersistence: persistedRecoveryMetadata(nodeMetadata.mediaPersistence, recoveredAt),
        recoveredFromProvider: true,
        mediaRecoveryAudit: audit,
        mediaRecoveredAt: recoveredAt,
        ...(mediaKind === 'image' && audit.providerUrl ? { originalProviderImageUrl: audit.providerUrl } : {}),
        ...(mediaKind === 'video' && audit.providerUrl ? { originalProviderVideoUrl: audit.providerUrl } : {}),
        ...(extraMetadata ?? {}),
      }
      onRecoverMedia(node.id, {
        ...(mediaKind === 'image' ? { resultImageUrl: stableUrl } : { resultVideoUrl: stableUrl }),
        metadataJson: nextMetadata,
      })
      setMediaRecoveryStatus('recovered')
    }

    void auditNodeMedia(node, mediaKind).then(async (audit) => {
      if (cancelled) return
      if (audit.assetReachable && audit.stableAssetUrl) {
        patchRecoveredNode(audit.stableAssetUrl, audit)
        return
      }

      if (!audit.hasStableAsset && audit.providerReachable && audit.providerUrl) {
        try {
          const response = await fetch('/api/media/resync', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              url: audit.providerUrl,
              type: mediaKind,
              nodeId: node.id,
              filenameHint: `${node.title || node.id || 'recovered'}-${mediaKind}.${mediaKind === 'image' ? 'png' : 'mp4'}`,
              metadata: nodeMetadata,
            }),
          })
          const data = await response.json().catch(() => ({})) as {
            success?: boolean
            stableUrl?: string
            mediaPersistence?: unknown
            diagnostic?: unknown
          }
          if (!cancelled && response.ok && data.success && data.stableUrl) {
            patchRecoveredNode(data.stableUrl, audit, {
              mediaPersistence: data.mediaPersistence
                ? { ...metadataRecord(data.mediaPersistence), status: 'persisted' }
                : persistedRecoveryMetadata(nodeMetadata.mediaPersistence, new Date().toISOString()),
              mediaResync: data,
            })
            return
          }
        } catch {
          // Fall through to the unrecoverable state when the visible media has already failed.
        }
      }

      setMediaRecoveryStatus(loadFailed && !audit.likelyRecoverable ? 'unrecoverable' : 'idle')
    }).catch(() => {
      if (!cancelled) setMediaRecoveryStatus(loadFailed ? 'unrecoverable' : 'idle')
    })

    return () => {
      cancelled = true
    }
  }, [
    assetUrl,
    imageLoadFailed,
    imagePreviewUrl,
    node,
    nodeMetadata,
    onRecoverMedia,
    persistenceStatus,
    videoLoadFailed,
    videoPreviewUrl,
  ])

  useEffect(() => {
    setImageLoadFailed(false)
    setImageNaturalRatio(null)
    setMediaRecoveryStatus('idle')
  }, [imagePreviewUrl])

  useEffect(() => {
    setVideoLoadFailed(false)
    setMediaRecoveryStatus('idle')
  }, [videoPreviewUrl])

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
        event.preventDefault()
        event.stopPropagation()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is best-effort; window-level listeners still carry the drag.
        }
        onDragStart(event)
      }}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return
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
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(CHAR_REF_DRAG_MIME)) return
        if (node.kind !== 'image' && node.kind !== 'video') return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setCharRefDragOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setCharRefDragOver(false)
      }}
      onDrop={(event) => {
        setCharRefDragOver(false)
        if (!event.dataTransfer.types.includes(CHAR_REF_DRAG_MIME)) return
        event.preventDefault()
        event.stopPropagation()
        try {
          const raw = event.dataTransfer.getData(CHAR_REF_DRAG_MIME)
          const payload = JSON.parse(raw) as CharacterReferenceDragPayload
          window.dispatchEvent(new CustomEvent('creator-city:char-ref-drop', {
            detail: {
              nodeId: node.id,
              referenceId: payload.referenceId,
              characterId: payload.characterId,
              imageUrl: payload.imageUrl,
              kind: payload.kind,
              label: payload.label,
            },
          }))
        } catch {
          // Malformed payload — ignore
        }
      }}
    >
      <div className="canvas-node-topline" />
      {charRefDragOver && (node.kind === 'image' || node.kind === 'video') ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] border-2 border-dashed border-cyan-300/70 bg-cyan-300/10">
          <div className="rounded-xl border border-cyan-200/40 bg-black/70 px-3 py-2 text-xs font-semibold text-cyan-100 backdrop-blur-sm">
            放开绑定角色参考
          </div>
        </div>
      ) : null}
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
                onOpenPreview('text')
              }}
              aria-label="查看或编辑文本结果"
            >
              {node.status === 'error' && textResult ? (
                <span className="canvas-node-text-error">{textErrorSummary}</span>
              ) : null}
              <span className="canvas-node-text-copy">{textDisplay}</span>
            </button>
          ) : hasMediaResult ? (
            <div
              className={`canvas-node-preview preview-${node.kind} ${getResultPreviewClass(node.kind)} ${node.preview?.type === 'placeholder-video' ? 'has-placeholder-preview' : ''}`}
              style={node.preview?.gradientFrom && node.preview?.gradientTo
                ? {
                  '--node-preview-from': node.preview.gradientFrom,
                  '--node-preview-to': node.preview.gradientTo,
                  ...(node.kind === 'image' ? imageFrameStyle : {}),
                  ...(node.kind === 'video' ? videoFrameStyle : {}),
                } as CSSProperties
                : node.kind === 'image' ? imageFrameStyle : node.kind === 'video' ? videoFrameStyle : undefined}
            >
              {mediaVaultStatus ? (
                <span
                  className={`absolute right-2.5 top-2.5 z-[5] inline-flex min-h-[22px] items-center rounded-full border px-2 text-[10px] font-bold leading-none backdrop-blur ${
                    mediaVaultStatus.tone === 'persisted'
                      ? 'border-emerald-300/35 bg-emerald-950/65 text-emerald-100'
                      : mediaVaultStatus.tone === 'temporary'
                        ? 'border-amber-300/35 bg-amber-950/65 text-amber-100'
                        : 'border-red-300/35 bg-red-950/65 text-red-100'
                  }`}
                >
                  {mediaVaultStatus.label}
                </span>
              ) : null}
              {node.kind === 'video' && videoPreviewUrl ? (
                <div
                  className="canvas-node-video-button"
                  role="button"
                  tabIndex={0}
                  data-no-node-drag="true"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation()
                  }}
                  onDoubleClickCapture={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!videoPreviewUrl) return
                    onOpenPreview('video')
                  }}
                  onMouseEnter={handleVideoPreviewEnter}
                  onMouseLeave={handleVideoPreviewLeave}
                  onWheel={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect()
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!videoPreviewUrl) return
                    onOpenPreview('video')
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    if (!videoPreviewUrl) return
                    onOpenPreview('video')
                  }}
                  aria-label="预览视频"
                >
                  {videoMedia.loadFailed ? (
                    <span className="canvas-node-video-error">
                      {mediaRecoveryStatus === 'checking'
                        ? '正在检查稳定资产和原始供应商链接...'
                        : '当前无法读取该媒体资产。'}
                      <button
                        type="button"
                        className="mt-2 rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/72"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void copyMediaUrl('video', videoPreviewUrl)
                        }}
                      >
                        {copiedMediaUrl === 'video' ? '已复制' : '复制视频链接'}
                      </button>
                      {onOpenMediaDiagnostics ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 text-xs font-semibold text-cyan-50"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onOpenMediaDiagnostics('video')
                          }}
                        >
                          媒体诊断
                        </button>
                      ) : null}
                      {onOpenPromptInspector ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/72"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onOpenPromptInspector()
                          }}
                        >
                          查看生成依据
                        </button>
                      ) : null}
                      {canCreateStableCopy ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-emerald-200/25 bg-emerald-200/10 px-2 py-1 text-xs font-semibold text-emerald-50"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onCreateStableCopy?.()
                          }}
                        >
                          用原 Prompt 创建稳定副本
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <>
                      <video
                        ref={videoPreviewRef}
                        className="canvas-node-preview-video"
                        src={videoProxiedSrc}
                        poster={node.preview?.poster}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ pointerEvents: 'none' }}
                        onError={() => setVideoLoadFailed(true)}
                        onLoadedMetadata={() => setVideoLoadFailed(false)}
                        onCanPlay={() => setVideoLoadFailed(false)}
                      />
                      <span className="canvas-node-video-play" aria-hidden="true">▶</span>
                    </>
                  )}
                </div>
              ) : null}
              {node.kind === 'image' && imagePreviewUrl ? (
                <div
                  className="canvas-node-image-button"
                  role="button"
                  tabIndex={0}
                  data-no-node-drag="true"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation()
                  }}
                  onDoubleClickCapture={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!imagePreviewUrl) return
                    onOpenPreview('image')
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onSelect()
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!imagePreviewUrl) return
                    onOpenPreview('image')
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    event.stopPropagation()
                    if (!imagePreviewUrl) return
                    onOpenPreview('image')
                  }}
                  aria-label="预览图片"
                >
                  {imageMedia.loadFailed ? (
                    <span className="canvas-node-image-error">
                      {mediaRecoveryStatus === 'checking'
                        ? '正在检查稳定资产和原始供应商链接...'
                        : '当前无法读取该媒体资产。'}
                      <button
                        type="button"
                        className="mt-2 rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/72"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void copyMediaUrl('image', imagePreviewUrl)
                        }}
                      >
                        {copiedMediaUrl === 'image' ? '已复制' : '复制图片链接'}
                      </button>
                      {onOpenMediaDiagnostics ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-cyan-200/25 bg-cyan-200/10 px-2 py-1 text-xs font-semibold text-cyan-50"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onOpenMediaDiagnostics('image')
                          }}
                        >
                          媒体诊断
                        </button>
                      ) : null}
                      {onOpenPromptInspector ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-white/15 bg-white/[0.08] px-2 py-1 text-xs text-white/72"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onOpenPromptInspector()
                          }}
                        >
                          查看生成依据
                        </button>
                      ) : null}
                      {canCreateStableCopy ? (
                        <button
                          type="button"
                          className="mt-2 rounded border border-emerald-200/25 bg-emerald-200/10 px-2 py-1 text-xs font-semibold text-emerald-50"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onCreateStableCopy?.()
                          }}
                        >
                          用原 Prompt 创建稳定副本
                        </button>
                      ) : null}
                    </span>
                  ) : (
                    <img
                      src={imageProxiedSrc}
                      alt={node.title}
                      className="canvas-node-preview-image"
                      loading="lazy"
                      draggable={false}
                      style={{ pointerEvents: 'none' }}
                      onLoad={(event) => {
                        setImageLoadFailed(false)
                        const { naturalWidth, naturalHeight } = event.currentTarget
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          setImageNaturalRatio(naturalWidth / naturalHeight)
                        }
                      }}
                      onError={() => setImageLoadFailed(true)}
                    />
                  )}
                </div>
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
      {enabledSkillCount > 0 ? (
        <button
          type="button"
          className="canvas-node-skill-badge"
          data-no-node-drag="true"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenSkillPanel?.()
          }}
          title="打开风格圣经"
        >
          Skills: {enabledSkillCount}
        </button>
      ) : null}
      {canOpenAssetIntelligence ? (
        <button
          type="button"
          className="absolute right-2 top-9 z-[6] inline-flex min-h-6 items-center rounded-full border border-violet-200/25 bg-violet-200/12 px-2 text-[10px] font-bold text-violet-50 shadow-sm transition hover:border-cyan-200/35 hover:bg-cyan-200/12"
          data-no-node-drag="true"
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenAssetIntelligence?.()
          }}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          title="打开智能资产"
        >
          AI Tags: {assetIntelligenceTagCount}
        </button>
      ) : null}
      {(onOpenPromptInspector || canOpenCreativeAssets || onAddToStoryboard) && (node.kind === 'text' || node.kind === 'image' || node.kind === 'video') ? (
        <div className="absolute bottom-2 left-2 z-[6] flex max-w-[calc(100%-16px)] items-center gap-1.5" data-no-node-drag="true">
          {onOpenPromptInspector ? (
            <button
              type="button"
              className="inline-flex min-h-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenPromptInspector()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="查看生成依据"
              title="查看生成依据"
            >
              生成依据
            </button>
          ) : null}
          {canOpenCreativeAssets ? (
            <button
              type="button"
              className="inline-flex min-h-6 min-w-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenCreativeAssets?.()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="打开创作资产"
              title="打开创作资产"
            >
              <span className="truncate">{creativeAssetLabel}</span>
            </button>
          ) : null}
          {onAddToStoryboard ? (
            <button
              type="button"
              className="inline-flex min-h-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/55 px-2 text-[10px] font-semibold text-white/70 shadow-sm transition hover:border-amber-200/30 hover:bg-amber-200/10 hover:text-amber-50"
              data-no-node-drag="true"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onAddToStoryboard()
              }}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              aria-label="加入分镜"
              title="加入当前分镜"
            >
              加入分镜
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  )
}
