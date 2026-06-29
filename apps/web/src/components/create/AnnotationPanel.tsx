'use client'

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  CANVAS_ANNOTATION_VERSION,
  normalizeAnnotationItem,
  normalizeAnnotationState,
  normalizePoint,
  readAnnotationMetadata,
  type CanvasAnnotationItem,
  type CanvasAnnotationPoint,
  type CanvasAnnotationState,
  type CanvasAnnotationType,
} from '@/lib/canvas/annotationMetadata'

type AnnotationTool = CanvasAnnotationType

type AnnotationPanelNode = {
  id: string
  title?: string
  prompt?: string
  mediaUrl: string
  metadataJson?: unknown
}

type AnnotationPanelProps = {
  sourceNode: AnnotationPanelNode
  onSave: (annotations: CanvasAnnotationState) => void
  onClose: () => void
}

const TOOLS: Array<{ id: AnnotationTool; label: string; icon: string }> = [
  { id: 'pen', label: '画笔', icon: '✎' },
  { id: 'arrow', label: '箭头', icon: '↗' },
  { id: 'rect', label: '矩形', icon: '□' },
  { id: 'ellipse', label: '椭圆', icon: '○' },
  { id: 'text', label: '文字', icon: 'T' },
  { id: 'path', label: '行动线', icon: '⌁' },
]

const COLORS = ['#ffcc00', '#ff5a5a', '#00d2ff', '#65d46e', '#ffffff', '#111827']
const SVG_SIZE = 1000

function stopPanelEvent(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function svgPoint(point: CanvasAnnotationPoint) {
  return `${point.x * SVG_SIZE},${point.y * SVG_SIZE}`
}

function pointsAttribute(points: CanvasAnnotationPoint[]) {
  return points.map(svgPoint).join(' ')
}

function rectAttrs(points: CanvasAnnotationPoint[]) {
  const [start, end] = points
  const x1 = Math.min(start?.x ?? 0, end?.x ?? 0)
  const y1 = Math.min(start?.y ?? 0, end?.y ?? 0)
  const x2 = Math.max(start?.x ?? 0, end?.x ?? 0)
  const y2 = Math.max(start?.y ?? 0, end?.y ?? 0)
  return {
    x: x1 * SVG_SIZE,
    y: y1 * SVG_SIZE,
    width: Math.max(1, (x2 - x1) * SVG_SIZE),
    height: Math.max(1, (y2 - y1) * SVG_SIZE),
  }
}

function arrowHeadPoints(item: CanvasAnnotationItem) {
  const start = item.points[item.points.length - 2]
  const end = item.points[item.points.length - 1]
  if (!start || !end) return ''
  const x1 = start.x * SVG_SIZE
  const y1 = start.y * SVG_SIZE
  const x2 = end.x * SVG_SIZE
  const y2 = end.y * SVG_SIZE
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const size = 12 + item.strokeWidth * 2
  const left = {
    x: x2 - size * Math.cos(angle - Math.PI / 6),
    y: y2 - size * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: x2 - size * Math.cos(angle + Math.PI / 6),
    y: y2 - size * Math.sin(angle + Math.PI / 6),
  }
  return `${x2},${y2} ${left.x},${left.y} ${right.x},${right.y}`
}

function renderAnnotationItem(item: CanvasAnnotationItem, draft = false) {
  const stroke = item.color
  const strokeWidth = item.strokeWidth
  const opacity = draft ? 0.72 : 1
  if (item.type === 'pen') {
    return (
      <polyline
        key={item.id}
        points={pointsAttribute(item.points)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  if (item.type === 'path') {
    return (
      <g key={item.id} opacity={opacity}>
        <polyline
          points={pointsAttribute(item.points)}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray="10 8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={arrowHeadPoints(item)} fill={stroke} />
      </g>
    )
  }
  if (item.type === 'arrow') {
    const [start, end] = item.points
    if (!start || !end) return null
    return (
      <g key={item.id} opacity={opacity}>
        <line
          x1={start.x * SVG_SIZE}
          y1={start.y * SVG_SIZE}
          x2={end.x * SVG_SIZE}
          y2={end.y * SVG_SIZE}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <polygon points={arrowHeadPoints(item)} fill={stroke} />
      </g>
    )
  }
  if (item.type === 'rect') {
    return (
      <rect
        key={item.id}
        {...rectAttrs(item.points)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  if (item.type === 'ellipse') {
    const attrs = rectAttrs(item.points)
    return (
      <ellipse
        key={item.id}
        cx={attrs.x + attrs.width / 2}
        cy={attrs.y + attrs.height / 2}
        rx={attrs.width / 2}
        ry={attrs.height / 2}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        vectorEffect="non-scaling-stroke"
      />
    )
  }
  if (item.type === 'text') {
    const point = item.points[0]
    if (!point) return null
    return (
      <text
        key={item.id}
        x={point.x * SVG_SIZE}
        y={point.y * SVG_SIZE}
        fill={stroke}
        fontSize="34"
        fontWeight="700"
        paintOrder="stroke"
        stroke="rgba(0,0,0,0.72)"
        strokeWidth="6"
        strokeLinejoin="round"
        opacity={opacity}
      >
        {item.text}
      </text>
    )
  }
  return null
}

function makeAnnotationId(type: AnnotationTool, point: CanvasAnnotationPoint) {
  return `annotation-${type}-${Date.now()}-${Math.round(point.x * 1000)}-${Math.round(point.y * 1000)}`
}

export function AnnotationPanel({ sourceNode, onSave, onClose }: AnnotationPanelProps) {
  const initialAnnotations = useMemo(() => readAnnotationMetadata(sourceNode.metadataJson), [sourceNode.metadataJson])
  const [items, setItems] = useState<CanvasAnnotationItem[]>(initialAnnotations.items)
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [textDraft, setTextDraft] = useState('标注')
  const [draftItem, setDraftItem] = useState<CanvasAnnotationItem | null>(null)
  const [imageSize, setImageSize] = useState<CanvasAnnotationState['imageSize']>(initialAnnotations.imageSize)
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    setItems(initialAnnotations.items)
    setImageSize(initialAnnotations.imageSize)
    setDraftItem(null)
  }, [initialAnnotations])

  const pointerToPoint = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return normalizePoint({ clientX: event.clientX, clientY: event.clientY }, rect)
  }, [])

  const buildItem = useCallback((type: AnnotationTool, points: CanvasAnnotationPoint[]) => {
    const first = points[0] ?? { x: 0, y: 0 }
    return normalizeAnnotationItem({
      id: makeAnnotationId(type, first),
      type,
      color,
      strokeWidth,
      points,
      text: type === 'text' ? textDraft : undefined,
      createdAt: new Date().toISOString(),
    })
  }, [color, strokeWidth, textDraft])

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const point = pointerToPoint(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'text') {
      const item = buildItem(tool, [point])
      if (item) setItems((current) => [...current, item])
      return
    }
    const points = [point, point]
    const item = buildItem(tool, points)
    setDraftItem(item)
  }, [buildItem, pointerToPoint, tool])

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!draftItem) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointerToPoint(event)
    if (!point) return
    setDraftItem((current) => {
      if (!current) return current
      if (current.type === 'pen' || current.type === 'path') {
        const previous = current.points[current.points.length - 1]
        if (previous && Math.abs(previous.x - point.x) + Math.abs(previous.y - point.y) < 0.004) return current
        return { ...current, points: [...current.points, point] }
      }
      return { ...current, points: [current.points[0] ?? point, point] }
    })
  }, [draftItem, pointerToPoint])

  const finishDraft = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!draftItem) return
    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can already be released when the pointer leaves the SVG.
    }
    const item = normalizeAnnotationItem(draftItem)
    if (item) setItems((current) => [...current, item])
    setDraftItem(null)
  }, [draftItem])

  const annotationState = useMemo<CanvasAnnotationState>(() => normalizeAnnotationState({
    version: CANVAS_ANNOTATION_VERSION,
    updatedAt: new Date().toISOString(),
    ...(imageSize ? { imageSize } : {}),
    items,
  }), [imageSize, items])

  return (
    <aside
      className="fixed inset-y-5 right-5 z-[1200] flex w-[min(860px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#090b10]/95 text-white shadow-2xl backdrop-blur-xl"
      data-testid="annotation-panel"
      data-no-node-drag="true"
      onPointerDown={stopPanelEvent}
      onMouseDown={stopPanelEvent}
      onClick={stopPanelEvent}
      onWheel={stopPanelEvent}
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">画面标注</p>
          <h2 className="truncate text-sm font-semibold text-white/88">{sourceNode.title || 'Image Node'}</h2>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          aria-label="关闭画面标注"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2">
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition ${
                  tool === entry.id
                    ? 'border-cyan-300/45 bg-cyan-300/14 text-cyan-100'
                    : 'border-white/10 bg-black/20 text-white/58 hover:bg-white/[0.06] hover:text-white/82'
                }`}
                data-testid={`annotation-tool-${entry.id}`}
                aria-pressed={tool === entry.id}
                title={entry.label}
                onClick={() => setTool(entry.id)}
              >
                <span aria-hidden="true">{entry.icon}</span>
                {entry.label}
              </button>
            ))}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/45">
            <div className="absolute inset-0 overflow-auto p-4">
              <div className="relative mx-auto inline-block max-w-full align-top">
                <img
                  src={sourceNode.mediaUrl}
                  alt=""
                  draggable={false}
                  className="block h-auto max-h-[calc(100vh-250px)] max-w-full select-none rounded-lg"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                      setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
                    }
                  }}
                />
                <svg
                  ref={svgRef}
                  className="absolute inset-0 h-full w-full touch-none"
                  data-testid="annotation-canvas"
                  viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="图片标注绘制层"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishDraft}
                  onPointerCancel={finishDraft}
                >
                  <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="transparent" />
                  {items.map((item) => renderAnnotationItem(item))}
                  {draftItem ? renderAnnotationItem(draftItem, true) : null}
                </svg>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex w-[210px] shrink-0 flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div>
            <div className="mb-2 text-[11px] font-semibold text-white/46">颜色</div>
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={`h-7 rounded-md border transition ${color === entry ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.18)]' : 'border-white/12'}`}
                  style={{ background: entry }}
                  aria-label={`颜色 ${entry}`}
                  aria-pressed={color === entry}
                  onClick={() => setColor(entry)}
                />
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-white/46">线宽 {strokeWidth}px</span>
            <input
              type="range"
              min={1}
              max={12}
              value={strokeWidth}
              onChange={(event) => setStrokeWidth(Number(event.target.value))}
              className="w-full accent-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold text-white/46">文字内容</span>
            <input
              type="text"
              value={textDraft}
              maxLength={80}
              onChange={(event) => setTextDraft(event.target.value)}
              className="h-8 w-full rounded-md border border-white/10 bg-black/35 px-2 text-[12px] text-white/82 outline-none transition placeholder:text-white/25 focus:border-cyan-300/55"
              placeholder="输入标注文字"
            />
          </label>

          <div className="mt-auto rounded-lg border border-white/8 bg-black/24 p-2 text-[11px] leading-relaxed text-white/45">
            <div>{items.length} 条标注</div>
            <div>保存后请点击画布顶部保存到云端同步。</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-8 rounded-md border border-white/10 bg-white/[0.04] text-[12px] text-white/58 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={items.length === 0}
              onClick={() => setItems((current) => current.slice(0, -1))}
            >
              撤销
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-white/10 bg-white/[0.04] text-[12px] text-white/58 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              disabled={items.length === 0}
              onClick={() => setItems([])}
            >
              清空
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-8 rounded-md border border-white/10 bg-white/[0.04] text-[12px] text-white/58 transition hover:bg-white/[0.08]"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="h-8 rounded-md border border-cyan-300/35 bg-cyan-300/16 text-[12px] font-semibold text-cyan-100 transition hover:bg-cyan-300/24"
              data-testid="annotation-save"
              onClick={() => onSave(annotationState)}
            >
              保存
            </button>
          </div>
        </aside>
      </div>
    </aside>
  )
}
