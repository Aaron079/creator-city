'use client'

import { useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  imageEditLayerIcon,
  type ImageEditLayer,
  type ImageEditLayerMark,
} from '@/lib/scenes'

export type ImageEditTool =
  | 'select'
  | 'color'
  | 'weather'
  | 'light'
  | 'fog'
  | 'mask'
  | 'person'
  | 'architecture'
  | 'prop'
  | 'camera'

interface ImageEditCanvasProps {
  imageUrl: string
  imageAlt: string
  layers: ImageEditLayer[]
  activeTool: ImageEditTool
  selectedLayerId?: string
  selectedMarkId?: string
  onCanvasCommit: (input: { tool: ImageEditTool; x: number; y: number; width?: number; height?: number }) => void
  onSelectLayer: (layerId: string, markId?: string) => void
  onMoveMark: (layerId: string, markId: string, x: number, y: number) => void
}

type DraftRect = {
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
}

type DraggingMark = {
  layerId: string
  markId: string
}

function ratioFromPointer(event: PointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

function cursorForTool(tool: ImageEditTool) {
  if (tool === 'select') return 'default'
  if (tool === 'color') return 'cell'
  if (tool === 'person' || tool === 'prop') return 'copy'
  return 'crosshair'
}

function layerColorFilter(layers: ImageEditLayer[]) {
  const colorLayers = layers.filter((layer) => layer.visible && layer.type === 'color-adjustment')
  if (!colorLayers.length) return 'none'
  const merged = colorLayers.reduce((acc, layer) => {
    const params = layer.params ?? {}
    return {
      brightness: acc.brightness + (Number(params.brightness ?? 100) - 100) * (layer.opacity ?? 1),
      contrast: acc.contrast + (Number(params.contrast ?? 100) - 100) * (layer.opacity ?? 1),
      saturation: acc.saturation + (Number(params.saturation ?? 100) - 100) * (layer.opacity ?? 1),
      hueRotate: acc.hueRotate + Number(params.hueRotate ?? 0) * (layer.opacity ?? 1),
      warmth: acc.warmth + Number(params.warmth ?? 0) * (layer.opacity ?? 1),
    }
  }, { brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, warmth: 0 })
  return [
    `brightness(${merged.brightness}%)`,
    `contrast(${merged.contrast}%)`,
    `saturate(${merged.saturation}%)`,
    `hue-rotate(${merged.hueRotate + merged.warmth * 0.35}deg)`,
    `sepia(${Math.max(0, Math.min(0.28, merged.warmth / 100))})`,
  ].join(' ')
}

function markStyle(mark: ImageEditLayerMark) {
  return {
    left: `${mark.x * 100}%`,
    top: `${mark.y * 100}%`,
    width: mark.width ? `${mark.width * 100}%` : undefined,
    height: mark.height ? `${mark.height * 100}%` : undefined,
  }
}

function draftStyle(rect: DraftRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

export function ImageEditCanvas({
  imageUrl,
  imageAlt,
  layers,
  activeTool,
  selectedLayerId,
  selectedMarkId,
  onCanvasCommit,
  onSelectLayer,
  onMoveMark,
}: ImageEditCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const [draggingMark, setDraggingMark] = useState<DraggingMark | null>(null)
  const visibleLayers = layers.filter((layer) => layer.visible)
  const filter = useMemo(() => layerColorFilter(layers), [layers])
  const weatherLayers = visibleLayers.filter((layer) => layer.type === 'weather-overlay')
  const lightLayers = visibleLayers.filter((layer) => layer.type === 'light-overlay')
  const fogLayers = visibleLayers.filter((layer) => layer.type === 'fog-overlay')
  const maskLayers = visibleLayers.filter((layer) => layer.type === 'mask')
  const markerLayers = visibleLayers.filter((layer) => [
    'person-marker',
    'architecture-marker',
    'prop-marker',
    'camera-guide',
    'mask',
    'light-overlay',
  ].includes(layer.type))

  const beginCanvasAction = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || activeTool === 'select') return
    const element = stageRef.current
    if (!element) return
    const point = ratioFromPointer(event, element)
    setDraftRect({ startX: point.x, startY: point.y, x: point.x, y: point.y, width: 0, height: 0 })
    element.setPointerCapture(event.pointerId)
  }

  const moveCanvasAction = (event: PointerEvent<HTMLDivElement>) => {
    const element = stageRef.current
    if (!element) return
    const point = ratioFromPointer(event, element)
    if (draggingMark) {
      onMoveMark(draggingMark.layerId, draggingMark.markId, point.x, point.y)
      return
    }
    if (!draftRect) return
    const x = Math.min(point.x, draftRect.startX)
    const y = Math.min(point.y, draftRect.startY)
    setDraftRect({ ...draftRect, x, y, width: Math.abs(point.x - draftRect.startX), height: Math.abs(point.y - draftRect.startY) })
  }

  const commitCanvasAction = (event: PointerEvent<HTMLDivElement>) => {
    const element = stageRef.current
    if (!element) return
    if (draggingMark) {
      setDraggingMark(null)
      return
    }
    if (!draftRect) return
    const point = ratioFromPointer(event, element)
    const width = Math.abs(point.x - draftRect.startX)
    const height = Math.abs(point.y - draftRect.startY)
    const useArea = activeTool === 'mask' || width > 0.025 || height > 0.025
    onCanvasCommit({
      tool: activeTool,
      x: useArea ? Math.min(point.x, draftRect.startX) : point.x,
      y: useArea ? Math.min(point.y, draftRect.startY) : point.y,
      width: useArea ? width : undefined,
      height: useArea ? height : undefined,
    })
    setDraftRect(null)
  }

  return (
    <div className="image-edit-canvas-shell" data-no-node-drag="true">
      <div
        ref={stageRef}
        className="image-edit-canvas-stage"
        style={{ cursor: cursorForTool(activeTool) }}
        onPointerDown={beginCanvasAction}
        onPointerMove={moveCanvasAction}
        onPointerUp={commitCanvasAction}
        onPointerCancel={() => {
          setDraftRect(null)
          setDraggingMark(null)
        }}
      >
        <img src={imageUrl} alt={imageAlt} draggable={false} style={{ filter }} />

        {weatherLayers.map((layer) => {
          const params = layer.params ?? {}
          const weatherType = String(params.weatherType ?? 'rain')
          const intensity = Number(params.intensity ?? 60)
          return (
            <div
              key={layer.id}
              className={`image-edit-weather is-${weatherType}`}
              style={{ opacity: Math.min(0.9, (layer.opacity ?? 0.7) * intensity / 70) }}
            />
          )
        })}

        {fogLayers.map((layer) => {
          const params = layer.params ?? {}
          return (
            <div
              key={layer.id}
              className="image-edit-fog"
              style={{
                opacity: Math.min(0.85, Number(params.density ?? 42) / 100 * (layer.opacity ?? 0.7)),
                backgroundColor: String(params.color ?? '#d7e7ff'),
              }}
            />
          )
        })}

        {lightLayers.map((layer) => {
          const mark = layer.marks?.[0] ?? { x: 0.72, y: 0.22 }
          const params = layer.params ?? {}
          return (
            <div
              key={layer.id}
              className="image-edit-light"
              style={{
                left: `${mark.x * 100}%`,
                top: `${mark.y * 100}%`,
                width: `${Number(params.radius ?? 36)}%`,
                height: `${Number(params.radius ?? 36)}%`,
                background: `radial-gradient(circle, ${String(params.color ?? '#ffd28a')} 0%, rgba(255,255,255,0.26) 28%, transparent 68%)`,
                opacity: Math.min(0.95, Number(params.intensity ?? 68) / 100 * (layer.opacity ?? 0.75)),
              }}
            />
          )
        })}

        {maskLayers.flatMap((layer) => (layer.marks ?? []).map((mark) => (
          <button
            key={`${layer.id}:${mark.id}`}
            type="button"
            className={`image-edit-mark is-mask ${selectedLayerId === layer.id && selectedMarkId === mark.id ? 'is-selected' : ''}`}
            style={markStyle(mark)}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelectLayer(layer.id, mark.id)
              setDraggingMark({ layerId: layer.id, markId: mark.id })
            }}
            title={mark.instruction || layer.instruction}
          >
            <span>{imageEditLayerIcon(layer.type)}</span>
          </button>
        )))}

        {markerLayers.flatMap((layer) => layer.type === 'mask' ? [] : (layer.marks ?? []).map((mark, index) => (
          <button
            key={`${layer.id}:${mark.id}`}
            type="button"
            className={`image-edit-mark is-${layer.type} ${selectedLayerId === layer.id && selectedMarkId === mark.id ? 'is-selected' : ''}`}
            style={markStyle(mark)}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelectLayer(layer.id, mark.id)
              setDraggingMark({ layerId: layer.id, markId: mark.id })
            }}
            title={mark.instruction || layer.instruction}
          >
            <span>{imageEditLayerIcon(layer.type)}</span>
            <small>{index + 1}</small>
          </button>
        )))}

        {draftRect && (draftRect.width > 0.01 || draftRect.height > 0.01) ? (
          <div className="image-edit-draft-rect" style={draftStyle(draftRect)} />
        ) : null}

        <div className="image-edit-tool-hint">
          {activeTool === 'select' ? '选择/移动：拖动标记调整位置。' : '点击添加图层或标记，拖拽可框选区域。'}
        </div>
      </div>
    </div>
  )
}
