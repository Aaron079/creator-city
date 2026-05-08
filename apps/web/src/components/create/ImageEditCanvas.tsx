'use client'

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  getSceneEditTaskOption,
  type SceneEditTask,
  type SceneEditTaskType,
} from '@/lib/scenes'

export type ImageEditTool = 'select' | SceneEditTaskType

interface ImageEditCanvasProps {
  imageUrl: string
  imageAlt: string
  tasks: SceneEditTask[]
  activeTool: ImageEditTool
  selectedTaskId?: string
  onCanvasCommit: (input: { type: SceneEditTaskType; x: number; y: number; width: number; height: number }) => void
  onSelectTask: (taskId: string) => void
  onMoveTask: (taskId: string, x: number, y: number) => void
}

type DraftRect = {
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
}

type DraggingTask = {
  taskId: string
  offsetX: number
  offsetY: number
}

function ratioFromPointer(event: PointerEvent<HTMLElement>, element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

function cursorForTool(tool: ImageEditTool) {
  return tool === 'select' ? 'default' : 'crosshair'
}

function rectStyle(rect: { x: number; y: number; width: number; height: number }) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

function taskFrameStyle(task: SceneEditTask, color: string, selected: boolean): CSSProperties {
  return {
    ...rectStyle(task),
    position: 'absolute',
    display: 'block',
    overflow: 'visible',
    borderRadius: 10,
    border: `2px solid ${color}`,
    background: selected ? `${color}2b` : 'rgba(0,0,0,0.035)',
    boxShadow: selected
      ? `0 0 0 4px ${color}3d, 0 14px 34px rgba(0,0,0,0.3)`
      : 'inset 0 0 0 1px rgba(255,255,255,0.16), 0 10px 28px rgba(0,0,0,0.22)',
    color: 'white',
    textAlign: 'left',
    touchAction: 'none',
  }
}

const numberStyle: CSSProperties = {
  position: 'absolute',
  top: -12,
  left: -12,
  display: 'inline-grid',
  width: 24,
  height: 24,
  placeItems: 'center',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.58)',
  color: '#061018',
  fontSize: 12,
  fontWeight: 900,
}

const labelStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 6,
  maxWidth: 'calc(100% - 12px)',
  overflow: 'hidden',
  borderRadius: 999,
  background: 'rgba(0,0,0,0.62)',
  padding: '3px 7px',
  color: 'rgba(255,255,255,0.92)',
  fontSize: 11,
  fontWeight: 820,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const noteStyle: CSSProperties = {
  position: 'absolute',
  left: 6,
  right: 6,
  bottom: 6,
  overflow: 'hidden',
  borderRadius: 8,
  background: 'rgba(0,0,0,0.56)',
  padding: '5px 7px',
  color: 'rgba(255,255,255,0.78)',
  fontSize: 11,
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
}

export function ImageEditCanvas({
  imageUrl,
  imageAlt,
  tasks,
  activeTool,
  selectedTaskId,
  onCanvasCommit,
  onSelectTask,
  onMoveTask,
}: ImageEditCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null)
  const [draggingTask, setDraggingTask] = useState<DraggingTask | null>(null)

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
    if (draggingTask) {
      const task = tasks.find((item) => item.id === draggingTask.taskId)
      if (!task) return
      onMoveTask(
        task.id,
        Math.min(1 - task.width, Math.max(0, point.x - draggingTask.offsetX)),
        Math.min(1 - task.height, Math.max(0, point.y - draggingTask.offsetY)),
      )
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
    if (draggingTask) {
      setDraggingTask(null)
      return
    }
    if (!draftRect || activeTool === 'select') return
    const point = ratioFromPointer(event, element)
    const width = Math.abs(point.x - draftRect.startX)
    const height = Math.abs(point.y - draftRect.startY)
    const useArea = width > 0.025 || height > 0.025
    const defaultWidth = 0.16
    const defaultHeight = 0.12
    onCanvasCommit({
      type: activeTool,
      x: useArea ? Math.min(point.x, draftRect.startX) : Math.min(1 - defaultWidth, Math.max(0, point.x - defaultWidth / 2)),
      y: useArea ? Math.min(point.y, draftRect.startY) : Math.min(1 - defaultHeight, Math.max(0, point.y - defaultHeight / 2)),
      width: useArea ? Math.max(0.05, width) : defaultWidth,
      height: useArea ? Math.max(0.05, height) : defaultHeight,
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
          setDraggingTask(null)
        }}
      >
        <img src={imageUrl} alt={imageAlt} draggable={false} />

        {tasks.map((task, index) => {
          const option = getSceneEditTaskOption(task.type)
          const selected = selectedTaskId === task.id
          return (
            <button
              key={task.id}
              type="button"
              className={`image-edit-region-task ${selected ? 'is-selected' : ''}`}
              style={taskFrameStyle(task, option.color, selected)}
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                const element = stageRef.current
                if (!element) return
                const point = ratioFromPointer(event, element)
                onSelectTask(task.id)
                setDraggingTask({ taskId: task.id, offsetX: point.x - task.x, offsetY: point.y - task.y })
              }}
              title={`${option.label}: ${task.instruction}`}
            >
              <span className="image-edit-region-number" style={{ ...numberStyle, background: option.color }}>{index + 1}</span>
              <span className="image-edit-region-label" style={labelStyle}>{option.icon} {option.label}</span>
              <span className="image-edit-region-note" style={noteStyle}>{task.instruction}</span>
            </button>
          )
        })}

        {draftRect && (draftRect.width > 0.01 || draftRect.height > 0.01) ? (
          <div className="image-edit-draft-rect" style={rectStyle(draftRect)} />
        ) : null}

        <div className="image-edit-tool-hint">
          {activeTool === 'select' ? '选择区域：拖动任务框调整位置。' : '拖拽框选场景区域；单击会创建一个小区域。'}
        </div>
      </div>
    </div>
  )
}
