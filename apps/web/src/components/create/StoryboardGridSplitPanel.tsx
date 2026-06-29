'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  STORYBOARD_GRID_LAYOUTS,
  STORYBOARD_GRID_SPLIT_TOOL_ID,
  buildCropMetadata,
  buildGridCells,
  detectGridLayout,
  type StoryboardGridCell,
  type StoryboardGridCropMetadata,
  type StoryboardGridLayoutId,
} from '@/lib/canvas/storyboardGridDetect'
import {
  STORYBOARD_GRID_CORS_ERROR_MESSAGE,
  buildStoryboardGridUploadFormData,
  cropImageCellToBlob,
  loadImageForCanvas,
} from '@/lib/canvas/storyboardGridCrop'

export type StoryboardGridSourceNode = {
  id: string
  title?: string | null
  prompt?: string | null
  mediaUrl: string
  assetId?: string | null
}

export type StoryboardGridUploadedCell = {
  assetId: string
  assetUrl: string
  title: string
  metadata: StoryboardGridCropMetadata
}

export type StoryboardGridSessionSummary = {
  version: 1
  toolId: typeof STORYBOARD_GRID_SPLIT_TOOL_ID
  gridSessionId: string
  layoutId: StoryboardGridLayoutId
  sourceNodeId: string
  sourceAssetId: string
  cellCount: number
  uploadedAssetIds: string[]
  updatedAt: string
}

type CellItem = {
  cell: StoryboardGridCell
  title: string
  metadata: StoryboardGridCropMetadata
  status: 'idle' | 'uploading' | 'uploaded' | 'error'
  assetId?: string
  assetUrl?: string
  error?: string
  deleted?: boolean
  createdNodeId?: string
}

interface StoryboardGridSplitPanelProps {
  projectId: string
  workflowId?: string
  sourceNode: StoryboardGridSourceNode | null
  onClose: () => void
  onCreateCellNode: (cell: StoryboardGridUploadedCell, placementIndex: number, total: number) => string | null
  onUpdateSourceSession: (summary: StoryboardGridSessionSummary) => void
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `grid-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      if (item !== undefined) await worker(item)
    }
  })
  await Promise.all(runners)
}

function statusLabel(item: CellItem) {
  if (item.deleted) return '已移除'
  if (item.status === 'uploaded') return item.createdNodeId ? '已放入画布' : '已入库'
  if (item.status === 'uploading') return '上传中'
  if (item.status === 'error') return '失败'
  return '待入库'
}

const STORYBOARD_GRID_UPLOAD_CONCURRENCY = 1

export function StoryboardGridSplitPanel({
  projectId,
  workflowId,
  sourceNode,
  onClose,
  onCreateCellNode,
  onUpdateSourceSession,
}: StoryboardGridSplitPanelProps) {
  const [sessionId] = useState(createSessionId)
  const [layoutId, setLayoutId] = useState<StoryboardGridLayoutId>('2x2')
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const [detectMessage, setDetectMessage] = useState('')
  const [items, setItems] = useState<CellItem[]>([])
  const [batchError, setBatchError] = useState('')
  const imageRef = useRef<HTMLImageElement | null>(null)

  const hasProjectId = Boolean(projectId.trim())
  const canUseSource = Boolean(sourceNode?.id && sourceNode.mediaUrl && sourceNode.assetId)

  useEffect(() => {
    let disposed = false
    imageRef.current = null
    setImageSize(null)
    setImageError('')
    setDetectMessage('')
    setBatchError('')
    if (!sourceNode?.mediaUrl) {
      setImageError('请选择一个已有图片结果的节点。')
      return
    }
    if (!sourceNode.assetId) {
      setImageError('当前图片节点缺少稳定 assetId，请先将图片导入资产库。')
      return
    }
    setLoadingImage(true)
    loadImageForCanvas(sourceNode.mediaUrl)
      .then((image) => {
        if (disposed) return
        imageRef.current = image
        setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
        try {
          const detected = detectGridLayout(image)
          if (detected.layoutId) {
            setLayoutId(detected.layoutId)
            setDetectMessage(`已识别 ${detected.layoutId}，置信度 ${(detected.confidence * 100).toFixed(0)}%。`)
          } else {
            setDetectMessage('未识别到稳定网格，请手动选择布局。')
          }
        } catch {
          setDetectMessage(STORYBOARD_GRID_CORS_ERROR_MESSAGE)
        }
      })
      .catch((error) => {
        if (!disposed) setImageError(error instanceof Error ? error.message : '图片加载失败。')
      })
      .finally(() => {
        if (!disposed) setLoadingImage(false)
      })
    return () => {
      disposed = true
    }
  }, [sourceNode?.assetId, sourceNode?.mediaUrl])

  const cells = useMemo(() => {
    if (!imageSize) return []
    return buildGridCells(layoutId, imageSize.width, imageSize.height)
  }, [imageSize, layoutId])

  useEffect(() => {
    if (!imageSize || !sourceNode?.assetId) {
      setItems([])
      return
    }
    setItems(cells.map((cell) => {
      const metadata = buildCropMetadata({
        cell,
        sourceWidth: imageSize.width,
        sourceHeight: imageSize.height,
        sourceNodeId: sourceNode.id,
        sourceAssetId: sourceNode.assetId!,
        parentAssetId: sourceNode.assetId!,
        gridSessionId: sessionId,
      })
      return {
        cell,
        title: `${sourceNode.title || '分镜'} · ${cell.index + 1}`,
        metadata,
        status: 'idle',
      }
    }))
  }, [cells, imageSize, sessionId, sourceNode?.assetId, sourceNode?.id, sourceNode?.title])

  const uploadedCells = items.filter((item) => item.status === 'uploaded' && item.assetId && item.assetUrl && !item.deleted)
  const activeItems = items.filter((item) => !item.deleted)

  const patchItem = useCallback((index: number, patch: Partial<CellItem>) => {
    setItems((current) => current.map((item) => (
      item.cell.index === index ? { ...item, ...patch } : item
    )))
  }, [])

  const uploadOne = useCallback(async (item: CellItem): Promise<StoryboardGridUploadedCell | null> => {
    if (!sourceNode?.assetId || !imageRef.current) return null
    patchItem(item.cell.index, { status: 'uploading', error: undefined })
    try {
      const blob = await cropImageCellToBlob(imageRef.current, item.cell)
      const fd = buildStoryboardGridUploadFormData({
        blob,
        projectId,
        workflowId,
        sourceNodeId: sourceNode.id,
        title: item.title,
        metadata: item.metadata,
      })
      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await response.json().catch(() => ({})) as {
        success?: boolean
        message?: string
        errorCode?: string
        asset?: { id?: string; url?: string | null; name?: string | null }
      }
      if (!response.ok || !data.success || !data.asset?.id || !data.asset.url) {
        throw new Error(data.message ?? data.errorCode ?? '上传失败')
      }
      patchItem(item.cell.index, {
        status: 'uploaded',
        assetId: data.asset.id,
        assetUrl: data.asset.url,
        error: undefined,
      })
      return {
        assetId: data.asset.id,
        assetUrl: data.asset.url,
        title: item.title,
        metadata: item.metadata,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '裁切或上传失败'
      patchItem(item.cell.index, { status: 'error', error: message })
      return null
    }
  }, [patchItem, projectId, sourceNode?.assetId, sourceNode?.id, workflowId])

  const uploadAll = useCallback(async () => {
    if (!canUseSource || !sourceNode?.assetId) return
    if (!hasProjectId) {
      setBatchError('请先保存项目后再拆格入库。')
      return
    }
    setBatchError('')
    const queue = items.filter((item) => !item.deleted && item.status !== 'uploaded')
    const uploaded: StoryboardGridUploadedCell[] = []
    await mapWithConcurrency(queue, STORYBOARD_GRID_UPLOAD_CONCURRENCY, async (item) => {
      const result = await uploadOne(item)
      if (result) uploaded.push(result)
    })
    const allUploadedIds = [
      ...uploadedCells.map((item) => item.assetId!),
      ...uploaded.map((item) => item.assetId),
    ]
    if (allUploadedIds.length > 0) {
      onUpdateSourceSession({
        version: 1,
        toolId: STORYBOARD_GRID_SPLIT_TOOL_ID,
        gridSessionId: sessionId,
        layoutId,
        sourceNodeId: sourceNode.id,
        sourceAssetId: sourceNode.assetId,
        cellCount: activeItems.length,
        uploadedAssetIds: allUploadedIds,
        updatedAt: new Date().toISOString(),
      })
    }
    if (uploaded.length !== queue.length) setBatchError('部分分镜上传失败，可对失败格单独重试。')
  }, [activeItems.length, canUseSource, hasProjectId, items, layoutId, onUpdateSourceSession, sessionId, sourceNode?.assetId, sourceNode?.id, uploadOne, uploadedCells])

  const handleCreateOne = useCallback((item: CellItem, placementIndex: number, total: number) => {
    if (item.createdNodeId) return
    if (!item.assetId || !item.assetUrl) return
    const nodeId = onCreateCellNode({
      assetId: item.assetId,
      assetUrl: item.assetUrl,
      title: item.title,
      metadata: item.metadata,
    }, placementIndex, total)
    if (nodeId) patchItem(item.cell.index, { createdNodeId: nodeId })
  }, [onCreateCellNode, patchItem])

  const createAll = useCallback(() => {
    const ready = items.filter((item) => item.status === 'uploaded' && item.assetId && item.assetUrl && !item.deleted && !item.createdNodeId)
    ready.forEach((item, idx) => handleCreateOne(item, idx, ready.length))
  }, [handleCreateOne, items])

  const previewGridStyle = useMemo(() => {
    const layout = STORYBOARD_GRID_LAYOUTS.find((item) => item.id === layoutId)
    return layout
      ? { gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))` }
      : undefined
  }, [layoutId])

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[92vh] w-[min(1040px,calc(100vw-112px))] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1016]/98 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between border-b border-white/8 px-5 pb-3 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Storyboard Grid Split</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-white/90">分镜拆格</h2>
          <p className="mt-1 text-[11px] text-white/42">客户端裁切为独立资产，不调用 Provider，不消耗积分。</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 mt-0.5 flex-shrink-0 text-[18px] leading-none text-white/25 hover:text-white/55"
          aria-label="关闭"
        >
          ×
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr] gap-0 overflow-hidden">
        <div className="min-h-0 overflow-y-auto border-r border-white/8 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {STORYBOARD_GRID_LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                type="button"
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                  layoutId === layout.id
                    ? 'border-cyan-300/40 bg-cyan-300/12 text-cyan-100'
                    : 'border-white/10 bg-white/[0.04] text-white/55 hover:bg-white/[0.08]'
                }`}
                onClick={() => setLayoutId(layout.id)}
              >
                {layout.id}
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {sourceNode?.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sourceNode.mediaUrl} alt="source storyboard" className="max-h-[54vh] w-full object-contain" />
            ) : null}
            {sourceNode?.mediaUrl && previewGridStyle ? (
              <div className="pointer-events-none absolute inset-0 grid" style={previewGridStyle}>
                {cells.map((cell) => (
                  <div key={cell.index} className="border border-cyan-300/55 bg-cyan-300/[0.035]">
                    <span className="m-1 inline-flex rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-cyan-100">{cell.index + 1}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {loadingImage ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[12px] text-white/50">读取图片...</div>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-[11px] leading-relaxed text-white/45">
            {imageError ? <span className="text-amber-300/80">{imageError}</span> : detectMessage || '可自动识别，也可手动切换布局。'}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
            <div>
              <p className="text-[11px] font-medium text-white/72">{activeItems.length} 个分镜格</p>
              <p className="mt-0.5 text-[10px] text-white/30">上传并入库后可放入画布</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hasProjectId || !canUseSource || loadingImage || activeItems.length === 0}
                onClick={uploadAll}
                className="rounded-lg border border-cyan-300/25 bg-cyan-300/12 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                裁切并入库
              </button>
              <button
                type="button"
                disabled={uploadedCells.length === 0}
                onClick={createAll}
                className="rounded-lg border border-emerald-300/25 bg-emerald-300/12 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                全部放入画布
              </button>
            </div>
          </div>

          {!hasProjectId ? (
            <div className="mx-5 mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/80">请先保存项目后再拆格入库。</div>
          ) : batchError ? (
            <div className="mx-5 mt-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/80">{batchError}</div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-5">
            {items.map((item) => (
              <div key={item.cell.index} className={`overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] ${item.deleted ? 'opacity-35' : ''}`}>
                <div className="aspect-video bg-black/50">
                  {item.assetUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.assetUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[12px] text-white/30">
                      {item.cell.row + 1}-{item.cell.col + 1}
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-white/78">{item.title}</span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/38">{statusLabel(item)}</span>
                  </div>
                  {item.error ? <p className="text-[10px] leading-relaxed text-amber-300/75">{item.error}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {item.status === 'uploaded' && item.assetId && item.assetUrl && !item.deleted && !item.createdNodeId ? (
                      <button
                        type="button"
                        className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] text-emerald-100"
                        onClick={() => handleCreateOne(item, item.cell.index, activeItems.length)}
                      >
                        放入画布
                      </button>
                    ) : null}
                    {item.status === 'error' && !item.deleted ? (
                      <button
                        type="button"
                        className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100"
                        onClick={() => { void uploadOne(item) }}
                      >
                        重试
                      </button>
                    ) : null}
                    {!item.deleted ? (
                      <button
                        type="button"
                        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/45 hover:text-white/75"
                        onClick={() => patchItem(item.cell.index, { deleted: true })}
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
