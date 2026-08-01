'use client'

import React, { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
  buildStoryboardReferenceExtractionMetadata,
  type StoryboardReferenceExtractionMetadata,
} from '@/lib/canvas/storyboardReferenceExtract'
import {
  buildStoryboardReferenceUploadFormData,
  cropStoryboardReferenceToBlob,
} from '@/lib/canvas/storyboardReferenceCrop'
import {
  STORYBOARD_GRID_CORS_ERROR_MESSAGE,
  STORYBOARD_GRID_MAX_DIMENSION,
} from '@/lib/canvas/storyboardGridCrop'
import { referenceExtractionQuality } from '@/lib/canvas/tool-result-quality'
import { ToolResultQualityStrip } from '@/components/create/ToolResultQualityStrip'

export type StoryboardReferenceSourceNode = {
  id: string
  title?: string | null
  prompt?: string | null
  mediaUrl: string
  assetId?: string | null
}

export type ReferenceSelection = {
  id: string
  label: string
  order: number
  crop: { x: number; y: number; width: number; height: number }
  status?: 'ready' | 'uploading' | 'uploaded' | 'error'
  assetId?: string
  assetUrl?: string
  createdNodeId?: string
  error?: string
}

export type StoryboardReferenceUploadedAsset = {
  assetId: string
  assetUrl: string
  title: string
  metadata: StoryboardReferenceExtractionMetadata
}

export type StoryboardReferenceSessionSummary = {
  version: 2
  toolId: typeof STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID
  extractionSessionId: string
  sourceNodeId: string
  sourceAssetId: string
  selectionCount: number
  uploadedCount: number
  createdNodeCount: number
  failedCount: number
  uploadedAssetIds: string[]
  createdNodeIds: string[]
  failedSelectionIds: string[]
  updatedAt: string
}

type StoryboardReferenceExtractorPanelProps = {
  projectId: string
  workflowId?: string
  sourceNode: StoryboardReferenceSourceNode | null
  onCreateReferenceNode: (reference: StoryboardReferenceUploadedAsset, placementIndex: number, total: number) => string | null
  onUpdateSourceSession: (summary: StoryboardReferenceSessionSummary) => void
  onClose: () => void
  testInitialSelections?: ReferenceSelection[]
  testProcessingDependencies?: {
    cropToBlob?: typeof cropStoryboardReferenceToBlob
    fetchImpl?: typeof fetch
  }
}

type ImageSize = { width: number; height: number }

const MIN_SELECTION_PIXELS = 12

function createExtractionSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `reference-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function selectionStatusLabel(selection: ReferenceSelection) {
  if (selection.status === 'uploading') return '处理中'
  if (selection.status === 'uploaded') return selection.createdNodeId ? '已放入画布' : '已入库'
  if (selection.status === 'error') return '失败'
  return '待提取'
}

function normalizedRect(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function isValidSelectionCrop(crop: ReferenceSelection['crop'], imageSize: ImageSize | null) {
  if (!imageSize) return false
  return (
    Number.isFinite(crop.x) &&
    Number.isFinite(crop.y) &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    crop.width >= MIN_SELECTION_PIXELS &&
    crop.height >= MIN_SELECTION_PIXELS &&
    crop.x + crop.width <= imageSize.width &&
    crop.y + crop.height <= imageSize.height
  )
}

export function appendReferenceSelection(
  selections: ReferenceSelection[],
  selection: Omit<ReferenceSelection, 'order'>,
): ReferenceSelection[] {
  return [...selections, { ...selection, order: selections.length }]
}

export type ReferenceSelectionAction = 'upload-and-create' | 'create-node-retry' | 'none'

export function getReferenceSelectionAction(selection: ReferenceSelection): ReferenceSelectionAction {
  if (selection.createdNodeId) return 'none'
  if (selection.assetId && selection.assetUrl) return 'create-node-retry'
  if (selection.status !== 'uploaded') return 'upload-and-create'
  return 'none'
}

export async function processStoryboardReferenceSelection({
  selection,
  sourceAssetId,
  sourceNodeId,
  extractionSessionId,
  image,
  imageSize,
  projectId,
  workflowId,
  total,
  onCreateReferenceNode,
  cropToBlob = cropStoryboardReferenceToBlob,
  fetchImpl = fetch,
}: {
  selection: ReferenceSelection
  sourceAssetId: string
  sourceNodeId: string
  extractionSessionId: string
  image: HTMLImageElement
  imageSize: ImageSize
  projectId: string
  workflowId?: string
  total: number
  onCreateReferenceNode: StoryboardReferenceExtractorPanelProps['onCreateReferenceNode']
  cropToBlob?: typeof cropStoryboardReferenceToBlob
  fetchImpl?: typeof fetch
}): Promise<ReferenceSelection> {
  const action = getReferenceSelectionAction(selection)
  if (action === 'none') throw new Error('Reference selection does not require processing.')

  const metadata = buildStoryboardReferenceExtractionMetadata({
    sourceAssetId,
    sourceNodeId,
    extractionSessionId,
    index: selection.order,
    crop: selection.crop,
    image: imageSize,
  })
  let uploaded: StoryboardReferenceUploadedAsset
  if (action === 'create-node-retry') {
    uploaded = {
      assetId: selection.assetId!,
      assetUrl: selection.assetUrl!,
      title: selection.label,
      metadata,
    }
  } else {
    const blob = await cropToBlob(image, metadata.cropBox)
    const response = await fetchImpl('/api/assets/upload', {
      method: 'POST',
      credentials: 'include',
      body: buildStoryboardReferenceUploadFormData({
        blob,
        projectId,
        workflowId,
        assetNodeId: sourceNodeId,
        title: selection.label,
        metadata,
      }),
    })
    const data = await response.json().catch(() => ({})) as {
      success?: boolean
      message?: string
      errorCode?: string
      asset?: { id?: string; url?: string | null }
    }
    if (!response.ok || !data.success || !data.asset?.id || !data.asset.url) {
      throw new Error(data.message ?? data.errorCode ?? '参考图上传失败。')
    }
    uploaded = {
      assetId: data.asset.id,
      assetUrl: data.asset.url,
      title: selection.label,
      metadata,
    }
  }

  let createdNodeId: string | null = null
  let nodeError = ''
  try {
    createdNodeId = onCreateReferenceNode(uploaded, selection.order, total)
  } catch (error) {
    nodeError = error instanceof Error ? error.message : '参考节点创建失败。'
  }
  if (!createdNodeId && !nodeError) {
    nodeError = '参考节点创建失败，资产已入库，可再次点击确认重试。'
  }
  return {
    ...selection,
    status: 'uploaded',
    assetId: uploaded.assetId,
    assetUrl: uploaded.assetUrl,
    ...(createdNodeId ? { createdNodeId } : {}),
    ...(nodeError ? { error: nodeError } : {}),
  }
}

function moveReferenceSelection(selections: ReferenceSelection[], id: string, direction: -1 | 1) {
  const currentIndex = selections.findIndex((selection) => selection.id === id)
  const targetIndex = currentIndex + direction
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= selections.length) return selections
  const next = [...selections]
  const [selection] = next.splice(currentIndex, 1)
  if (!selection) return selections
  next.splice(targetIndex, 0, selection)
  return next.map((item, order) => ({ ...item, order }))
}

function stopPanelEvent(event: React.SyntheticEvent) {
  event.stopPropagation()
}

export function StoryboardReferenceExtractorPanel({
  projectId,
  workflowId,
  sourceNode,
  onCreateReferenceNode,
  onUpdateSourceSession,
  onClose,
  testInitialSelections,
  testProcessingDependencies,
}: StoryboardReferenceExtractorPanelProps) {
  const [sessionId] = useState(createExtractionSessionId)
  const [imageSize, setImageSize] = useState<ImageSize | null>(null)
  const [selections, setSelections] = useState<ReferenceSelection[]>(() => (
    testInitialSelections?.map((selection) => ({ ...selection, crop: { ...selection.crop } })) ?? []
  ))
  const [draftCrop, setDraftCrop] = useState<ReferenceSelection['crop'] | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('请选择或拖拽参考区域。')
  const [isProcessing, setIsProcessing] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const nextSelectionNumber = useRef(1)

  const sourceLabel = sourceNode?.title || sourceNode?.prompt || (sourceNode ? '来源图像' : '')
  const hasProjectId = Boolean(projectId.trim())
  const hasSourceIdentity = Boolean(sourceNode?.id.trim() && sourceNode.assetId?.trim())
  const validSelections = useMemo(
    () => selections.filter((selection) => isValidSelectionCrop(selection.crop, imageSize)),
    [imageSize, selections],
  )
  const uploadedSelections = selections.filter((selection) => selection.status === 'uploaded' && selection.assetId)
  const createdSelections = selections.filter((selection) => Boolean(selection.createdNodeId))
  const failedSelections = selections.filter((selection) => selection.status === 'error' || Boolean(selection.error))
  const canConfirm = hasProjectId && hasSourceIdentity && Boolean(imageRef.current && imageSize) && validSelections.length > 0 && !isProcessing
  const quality = useMemo(() => referenceExtractionQuality({
    sourceLabel,
    selectedCount: validSelections.length,
    uploadedCount: uploadedSelections.length,
    createdNodeCount: createdSelections.length,
    errorCount: failedSelections.length,
    isProcessing,
    uploadError: failedSelections[0]?.error,
  }), [createdSelections.length, failedSelections, isProcessing, sourceLabel, uploadedSelections.length, validSelections.length])

  const pointerToImagePoint = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const image = imageRef.current
    const size = imageSize
    if (!image || !size) return null
    const rect = image.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: Math.max(0, Math.min(size.width, ((event.clientX - rect.left) / rect.width) * size.width)),
      y: Math.max(0, Math.min(size.height, ((event.clientY - rect.top) / rect.height) * size.height)),
    }
  }, [imageSize])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointerToImagePoint(event)
    if (!point || isProcessing) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragStart(point)
    setDraftCrop({ x: point.x, y: point.y, width: 0, height: 0 })
    setMessage('拖拽以框选参考区域。')
  }, [isProcessing, pointerToImagePoint])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart) return
    const point = pointerToImagePoint(event)
    if (!point) return
    event.preventDefault()
    event.stopPropagation()
    setDraftCrop(normalizedRect(dragStart, point))
  }, [dragStart, pointerToImagePoint])

  const finishPointerSelection = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStart) return
    const point = pointerToImagePoint(event)
    const crop = point ? normalizedRect(dragStart, point) : draftCrop
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released after leaving the image.
    }
    setDragStart(null)
    setDraftCrop(null)
    if (!crop || !isValidSelectionCrop(crop, imageSize)) {
      setMessage(`选区至少需要 ${MIN_SELECTION_PIXELS}px，且必须位于图像范围内。`)
      return
    }
    const ordinal = nextSelectionNumber.current
    nextSelectionNumber.current += 1
    const id = `reference-${sessionId}-${ordinal}`
    setSelections((current) => appendReferenceSelection(current, {
      id,
      label: `参考图 ${ordinal}`,
      crop,
      status: 'ready',
    }))
    setSelectedId(id)
    setMessage('已添加参考区域。可在右侧调整名称、顺序或删除。')
  }, [draftCrop, dragStart, imageSize, pointerToImagePoint, sessionId])

  const updateSelection = useCallback((id: string, patch: Partial<ReferenceSelection>) => {
    setSelections((current) => current.map((selection) => (
      selection.id === id ? { ...selection, ...patch } : selection
    )))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || !sourceNode?.assetId || !sourceNode.id || !imageRef.current || !imageSize) return
    const image = imageRef.current
    const queue = selections.filter((selection) => (
      isValidSelectionCrop(selection.crop, imageSize) && getReferenceSelectionAction(selection) !== 'none'
    ))
    if (queue.length === 0) return

    setIsProcessing(true)
    setMessage('正在按顺序裁切并保存参考图。')
    let next = selections.map((selection) => ({ ...selection }))
    const total = validSelections.length

    for (const selection of queue) {
      const currentIndex = next.findIndex((item) => item.id === selection.id)
      if (currentIndex < 0) continue
      const current = next[currentIndex]
      if (!current) continue
      next[currentIndex] = { ...current, status: 'uploading', error: undefined }
      setSelections([...next])
      try {
        next[currentIndex] = await processStoryboardReferenceSelection({
          selection: current,
          sourceAssetId: sourceNode.assetId,
          sourceNodeId: sourceNode.id,
          extractionSessionId: sessionId,
          image,
          imageSize,
          projectId,
          workflowId,
          total,
          onCreateReferenceNode,
          ...testProcessingDependencies,
        })
      } catch (error) {
        next[currentIndex] = {
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : '裁切或上传参考图失败。',
        }
      }
      setSelections([...next])
    }

    const uploaded = next.filter((selection) => selection.status === 'uploaded' && selection.assetId)
    const created = next.filter((selection) => Boolean(selection.createdNodeId))
    const failed = next.filter((selection) => selection.status === 'error' || Boolean(selection.error))
    onUpdateSourceSession({
      version: 2,
      toolId: STORYBOARD_REFERENCE_EXTRACTOR_TOOL_ID,
      extractionSessionId: sessionId,
      sourceNodeId: sourceNode.id,
      sourceAssetId: sourceNode.assetId,
      selectionCount: validSelections.length,
      uploadedCount: uploaded.length,
      createdNodeCount: created.length,
      failedCount: failed.length,
      uploadedAssetIds: uploaded.flatMap((selection) => selection.assetId ? [selection.assetId] : []),
      createdNodeIds: created.flatMap((selection) => selection.createdNodeId ? [selection.createdNodeId] : []),
      failedSelectionIds: failed.map((selection) => selection.id),
      updatedAt: new Date().toISOString(),
    })
    setIsProcessing(false)
    setMessage(failed.length > 0 ? '部分参考图未完成，已入库的参考图可再次确认重试。' : '参考图已按顺序保存。')
  }, [canConfirm, imageSize, onCreateReferenceNode, onUpdateSourceSession, projectId, selections, sessionId, sourceNode?.assetId, sourceNode?.id, testProcessingDependencies, validSelections.length, workflowId])

  const previewStyle = useCallback((crop: ReferenceSelection['crop']) => {
    if (!imageSize) return undefined
    return {
      left: `${(crop.x / imageSize.width) * 100}%`,
      top: `${(crop.y / imageSize.height) * 100}%`,
      width: `${(crop.width / imageSize.width) * 100}%`,
      height: `${(crop.height / imageSize.height) * 100}%`,
    }
  }, [imageSize])

  return (
    <aside
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[92vh] w-[min(960px,calc(100vw-112px))] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1016]/98 text-white shadow-2xl backdrop-blur-xl"
      data-testid="storyboard-reference-extractor-panel"
      data-no-node-drag="true"
      onPointerDown={stopPanelEvent}
      onMouseDown={stopPanelEvent}
      onClick={stopPanelEvent}
      onWheel={stopPanelEvent}
    >
      <header className="flex items-start justify-between border-b border-white/8 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Storyboard Reference Extractor</p>
          <h2 className="mt-0.5 truncate text-[15px] font-semibold text-white/90">分镜参考提取</h2>
          <p className="mt-1 text-[11px] text-white/42">自由框选可复用参考图，确认后才会裁切入库。</p>
        </div>
        <button
          type="button"
          className="ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-[18px] leading-none text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="关闭分镜参考提取"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(310px,0.85fr)] overflow-hidden max-md:grid-cols-1">
        <section className="min-h-0 overflow-y-auto border-r border-white/8 p-5 max-md:border-r-0 max-md:border-b">
          <div className="relative overflow-auto rounded-xl border border-white/10 bg-black/45 p-3">
            {sourceNode?.mediaUrl ? (
              <div className="relative mx-auto inline-block max-w-full align-top">
                <img
                  ref={imageRef}
                  src={sourceNode.mediaUrl}
                  alt={sourceLabel || '分镜来源图'}
                  crossOrigin="anonymous"
                  draggable={false}
                  className="block h-auto max-h-[55vh] max-w-full select-none rounded-lg"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    if (image.naturalWidth > STORYBOARD_GRID_MAX_DIMENSION || image.naturalHeight > STORYBOARD_GRID_MAX_DIMENSION) {
                      setImageSize(null)
                      setMessage(`图片尺寸超过 ${STORYBOARD_GRID_MAX_DIMENSION}px，V1 暂不处理。`)
                      return
                    }
                    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
                      setImageSize(null)
                      setMessage(STORYBOARD_GRID_CORS_ERROR_MESSAGE)
                      return
                    }
                    setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
                    setMessage((current) => current === '请选择或拖拽参考区域。' ? '拖拽图像以添加任意参考区域。' : current)
                  }}
                  onError={() => setMessage(STORYBOARD_GRID_CORS_ERROR_MESSAGE)}
                />
                <div
                  className="absolute inset-0 touch-none cursor-crosshair"
                  data-testid="storyboard-reference-selection-canvas"
                  role="presentation"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishPointerSelection}
                  onPointerCancel={finishPointerSelection}
                >
                  {selections.map((selection) => (
                    <div
                      key={selection.id}
                      className={`pointer-events-none absolute border ${selectedId === selection.id ? 'border-cyan-200 bg-cyan-200/15' : 'border-white/60 bg-white/[0.04]'}`}
                      style={previewStyle(selection.crop)}
                    >
                      <span className="absolute left-0 top-0 -translate-y-full rounded-t bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white/85">{selection.label}</span>
                    </div>
                  ))}
                  {draftCrop ? <div className="pointer-events-none absolute border border-dashed border-cyan-200 bg-cyan-200/10" style={previewStyle(draftCrop)} /> : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[240px] items-center justify-center text-[12px] text-white/40">请选择一个已有图片结果的节点。</div>
            )}
          </div>
          <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2 text-[11px] leading-relaxed text-white/52">{message}</p>
          {!hasProjectId ? <p className="mt-2 text-[10px] text-amber-200/80">请先保存项目后再提取参考图。</p> : null}
          {!sourceNode?.assetId ? <p className="mt-2 text-[10px] text-amber-200/80">当前图片缺少稳定 assetId，暂时不能提取参考图。</p> : null}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-white/8 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-white/75">参考区域 {validSelections.length}</p>
                <p className="mt-0.5 text-[10px] text-white/35">按当前顺序逐个裁切、入库并创建节点</p>
              </div>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={() => { void handleConfirm() }}
                className="shrink-0 rounded-lg border border-cyan-300/25 bg-cyan-300/12 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-35"
              >
                确认提取
              </button>
            </div>
            <div className="mt-3"><ToolResultQualityStrip summary={quality} /></div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5">
            {selections.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] leading-relaxed text-white/38">请选择或拖拽参考区域。</p>
            ) : selections.map((selection, index) => (
              <article
                key={selection.id}
                className={`rounded-lg border p-3 ${selectedId === selection.id ? 'border-cyan-300/35 bg-cyan-300/[0.06]' : 'border-white/10 bg-white/[0.035]'}`}
                onClick={() => setSelectedId(selection.id)}
              >
                <div className="flex items-center gap-2">
                  <input
                    value={selection.label}
                    aria-label={`${selection.label} 名称`}
                    onChange={(event) => updateSelection(selection.id, { label: event.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] text-white/82 outline-none focus:border-cyan-300/45"
                  />
                  <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/42">{selectionStatusLabel(selection)}</span>
                </div>
                <p className="mt-1.5 text-[10px] text-white/35">区域 {Math.round(selection.crop.width)} × {Math.round(selection.crop.height)} px</p>
                {selection.error ? <p className="mt-1 text-[10px] leading-relaxed text-amber-200/80">{selection.error}</p> : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" disabled={index === 0 || isProcessing} onClick={() => setSelections((current) => moveReferenceSelection(current, selection.id, -1))} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/52 disabled:opacity-30">上移</button>
                  <button type="button" disabled={index === selections.length - 1 || isProcessing} onClick={() => setSelections((current) => moveReferenceSelection(current, selection.id, 1))} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/52 disabled:opacity-30">下移</button>
                  <button type="button" disabled={isProcessing} onClick={() => { setSelections((current) => current.filter((item) => item.id !== selection.id).map((item, order) => ({ ...item, order }))); setSelectedId((current) => current === selection.id ? null : current) }} className="rounded-md border border-rose-300/20 bg-rose-300/[0.08] px-2 py-1 text-[10px] text-rose-100/80 disabled:opacity-30">删除</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
