'use client'

import { useMemo, useRef, useState, type PointerEvent } from 'react'
import type { SceneEditMark, SceneEditTool } from '@/lib/scenes'
import { createSceneEditMark, getSceneEditToolOption } from '@/lib/scenes'

interface SceneToolLayerProps {
  imageUrl: string
  imageAlt: string
  activeTool: SceneEditTool
  sceneEdits: SceneEditMark[]
  selectedEditId?: string
  onSceneEditsChange: (sceneEdits: SceneEditMark[]) => void
  onSelectEdit: (editId: string) => void
}

type DraftRect = {
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
}

function ratioFromPointer(event: PointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

function rectStyle(rect: DraftRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

export function SceneToolLayer({
  imageUrl,
  imageAlt,
  activeTool,
  sceneEdits,
  selectedEditId,
  onSceneEditsChange,
  onSelectEdit,
}: SceneToolLayerProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const activeOption = getSceneEditToolOption(activeTool)
  const cursor = useMemo(() => activeOption.cursor || 'crosshair', [activeOption.cursor])

  const beginMark = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const element = overlayRef.current
    if (!element) return
    const point = ratioFromPointer(event, element)
    setDraftRect({
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })
    element.setPointerCapture(event.pointerId)
  }

  const moveMark = (event: PointerEvent<HTMLDivElement>) => {
    const element = overlayRef.current
    if (!element || !draftRect) return
    const point = ratioFromPointer(event, element)
    const x = Math.min(point.x, draftRect.startX)
    const y = Math.min(point.y, draftRect.startY)
    setDraftRect({
      ...draftRect,
      x,
      y,
      width: Math.abs(point.x - draftRect.startX),
      height: Math.abs(point.y - draftRect.startY),
    })
  }

  const commitMark = (event: PointerEvent<HTMLDivElement>) => {
    const element = overlayRef.current
    if (!element || !draftRect) return
    try {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }
    const point = ratioFromPointer(event, element)
    const width = Math.abs(point.x - draftRect.startX)
    const height = Math.abs(point.y - draftRect.startY)
    const shouldUseArea = width > 0.025 || height > 0.025
    const defaultWidth = 0.16
    const defaultHeight = 0.12
    const mark = createSceneEditMark({
      tool: activeTool,
      x: shouldUseArea ? Math.min(point.x, draftRect.startX) : Math.min(1 - defaultWidth, Math.max(0, point.x - defaultWidth / 2)),
      y: shouldUseArea ? Math.min(point.y, draftRect.startY) : Math.min(1 - defaultHeight, Math.max(0, point.y - defaultHeight / 2)),
      width: shouldUseArea ? width : defaultWidth,
      height: shouldUseArea ? height : defaultHeight,
    })
    onSceneEditsChange([...sceneEdits, mark])
    onSelectEdit(mark.id)
    setDraftRect(null)
  }

  return (
    <div className="scene-tool-layer-frame" data-no-node-drag="true">
      <img src={imageUrl} alt={imageAlt} className="canvas-image-preview-media" draggable={false} />
      <div
        ref={overlayRef}
        className="scene-tool-layer-overlay"
        style={{ cursor }}
        role="application"
        aria-label="场景可视化编辑层"
        onPointerDown={beginMark}
        onPointerMove={moveMark}
        onPointerUp={commitMark}
        onPointerCancel={() => setDraftRect(null)}
      >
        <div className="scene-tool-hint">
          当前工具：{activeOption.label}。拖拽框选场景修改区域；单击会创建一个小区域。
        </div>
        {sceneEdits.map((edit, index) => {
          const option = getSceneEditToolOption(edit.tool)
          const selected = edit.id === selectedEditId
          const hasArea = Boolean(edit.width && edit.height)
          return (
            <button
              key={edit.id}
              type="button"
              className={`scene-edit-marker ${selected ? 'is-selected' : ''} ${hasArea ? 'has-area' : ''}`}
              style={{
                left: `${edit.x * 100}%`,
                top: `${edit.y * 100}%`,
                ...(hasArea ? { width: `${(edit.width ?? 0) * 100}%`, height: `${(edit.height ?? 0) * 100}%` } : {}),
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSelectEdit(edit.id)
              }}
              title={`${edit.label}: ${edit.instruction}`}
            >
              <span aria-hidden="true">{option.icon}</span>
              <small>{index + 1}</small>
            </button>
          )
        })}
        {draftRect && (draftRect.width > 0.01 || draftRect.height > 0.01) ? (
          <div className="scene-edit-draft-rect" style={rectStyle(draftRect)} />
        ) : null}
      </div>
    </div>
  )
}
