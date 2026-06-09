'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  buildAssetSlotPrompts,
  STYLE_LABELS,
  LAYOUT_LABELS,
  type CharacterReferenceMode,
  type CharacterReferenceStyle,
  type CharacterReferenceLayout,
  type CharacterReferenceOptions,
  type CharacterReferenceCropBox,
} from '@/lib/canvas/character-reference-grid'
import { getProxiedMediaUrl } from '@/lib/media/getProxiedMediaUrl'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CharacterSourceNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  resultText?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  assetId?: string | null
  status?: string | null
}

export interface CharacterReferenceSlotRequest {
  key: string
  label: string
  slotDescription: string
  prompt: string
}

export interface CreateCharacterReferenceRequest {
  sourceNodeId: string
  mode: CharacterReferenceMode
  referenceMode: 'asset-crop-reference' | 'asset-full-image' | 'video-reference' | 'text-only'
  sourceAssetId: string | null
  sourceImageUrl: string | null
  sourceVideoUrl: string | null
  cropBox: CharacterReferenceCropBox | null
  slots: CharacterReferenceSlotRequest[]
  consistencyOptions: {
    keepFace: boolean
    keepHair: boolean
    keepOutfit: boolean
    keepBody: boolean
    keepColorScheme: boolean
  }
  style: CharacterReferenceStyle
  layout: CharacterReferenceLayout
}

interface CharacterReferenceGridPanelProps {
  nodes: CharacterSourceNode[]
  onCreateReferenceNode: (req: CreateCharacterReferenceRequest) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CROP: CharacterReferenceCropBox = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }
const FULL_IMAGE_CROP: CharacterReferenceCropBox = { x: 0, y: 0, width: 1, height: 1 }

const HANDLE_ZONE = 0.08 // normalized distance to detect corner handle click

const TURNAROUND_SLOTS = [
  { key: 'front',    label: '正面',      sub: 'Front',     icon: '◈' },
  { key: '3quarter', label: '四分之三',  sub: 'Three-qtr', icon: '◇' },
  { key: 'side',     label: '侧面',      sub: 'Side',      icon: '▷' },
  { key: 'back',     label: '背面',      sub: 'Back',      icon: '◁' },
]

const GRID5_SLOTS = [
  { key: 'full-front', label: '全身正面',    sub: 'Full Front',    icon: '⊞' },
  { key: 'full-3q',    label: '全身四分之三', sub: 'Full 3/4',      icon: '⊟' },
  { key: 'expression', label: '表情组',      sub: 'Expressions',   icon: '◎' },
  { key: 'outfit',     label: '服装细节',    sub: 'Outfit Detail', icon: '◉' },
  { key: 'action',     label: '动作姿态',    sub: 'Action Pose',   icon: '◐' },
]

const MODES: Array<{
  id: CharacterReferenceMode
  label: string
  sub: string
  nodeCount: number
  gridLabel: string
  slots: typeof TURNAROUND_SLOTS
}> = [
  {
    id: 'turnaround4',
    label: '四视图',
    sub: '正面 · 四分之三 · 侧面 · 背面',
    nodeCount: 4,
    gridLabel: '4 个独立参考节点（2×2）',
    slots: TURNAROUND_SLOTS,
  },
  {
    id: 'grid5',
    label: '九宫格',
    sub: '全身 · 表情 · 服装 · 动作',
    nodeCount: 5,
    gridLabel: '5 个独立参考节点（3+2）',
    slots: GRID5_SLOTS,
  },
]

const STYLES: Array<{ id: CharacterReferenceStyle; label: string }> = Object.entries(STYLE_LABELS).map(
  ([id, label]) => ({ id: id as CharacterReferenceStyle, label }),
)
const LAYOUTS: Array<{ id: CharacterReferenceLayout; label: string }> = Object.entries(LAYOUT_LABELS).map(
  ([id, label]) => ({ id: id as CharacterReferenceLayout, label }),
)

// ─── Drag helpers ─────────────────────────────────────────────────────────────

type DragAction = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'

interface DragState {
  action: DragAction
  startNorm: { x: number; y: number }
  startBox: CharacterReferenceCropBox
}

function clampCropBox(box: CharacterReferenceCropBox): CharacterReferenceCropBox {
  const width = Math.max(0.1, Math.min(1, box.width))
  const height = Math.max(0.1, Math.min(1, box.height))
  const x = Math.max(0, Math.min(1 - width, box.x))
  const y = Math.max(0, Math.min(1 - height, box.y))
  return { x, y, width, height }
}

function getDragAction(norm: { x: number; y: number }, box: CharacterReferenceCropBox): DragAction | null {
  const { x, y, width, height } = box
  const inX = norm.x >= x && norm.x <= x + width
  const inY = norm.y >= y && norm.y <= y + height
  if (!inX || !inY) return null
  const nearL = norm.x - x < HANDLE_ZONE
  const nearR = x + width - norm.x < HANDLE_ZONE
  const nearT = norm.y - y < HANDLE_ZONE
  const nearB = y + height - norm.y < HANDLE_ZONE
  if (nearL && nearT) return 'resize-nw'
  if (nearR && nearT) return 'resize-ne'
  if (nearL && nearB) return 'resize-sw'
  if (nearR && nearB) return 'resize-se'
  return 'move'
}

function actionCursor(action: DragAction | null): string {
  if (action === 'move') return 'move'
  if (action === 'resize-nw' || action === 'resize-se') return 'nwse-resize'
  if (action === 'resize-ne' || action === 'resize-sw') return 'nesw-resize'
  return 'crosshair'
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CharacterReferenceGridPanel({
  nodes,
  onCreateReferenceNode,
  onClose,
  defaultSelectedNodeId,
}: CharacterReferenceGridPanelProps) {
  const primaryNode =
    nodes.find((n) => n.id === defaultSelectedNodeId) ??
    nodes.find((n) => n.kind === 'image' || n.kind === 'video' || n.kind === 'text') ??
    null

  // Crop box state
  const [cropBox, setCropBox] = useState<CharacterReferenceCropBox>(DEFAULT_CROP)
  const [isFullImage, setIsFullImage] = useState(false)
  const [cursor, setCursor] = useState<string>('crosshair')
  const cropContainerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)

  // Panel state
  const [mode, setMode] = useState<CharacterReferenceMode>('turnaround4')
  const [characterBrief, setCharacterBrief] = useState<string>(
    (primaryNode?.prompt ?? primaryNode?.resultText ?? '').trim(),
  )
  const [style, setStyle] = useState<CharacterReferenceStyle>('film-character-design')
  const [layout, setLayout] = useState<CharacterReferenceLayout>('clean-white')
  const [keepFace, setKeepFace] = useState(true)
  const [keepHair, setKeepHair] = useState(true)
  const [keepOutfit, setKeepOutfit] = useState(true)
  const [keepBody, setKeepBody] = useState(true)
  const [keepColorScheme, setKeepColorScheme] = useState(true)
  const [created, setCreated] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const activeMode = (MODES.find((m) => m.id === mode) ?? MODES[0])!

  // Asset detection
  const sourceImageUrl = primaryNode?.resultImageUrl ?? null
  const sourceVideoUrl = primaryNode?.resultVideoUrl ?? null
  const sourceAssetId = primaryNode?.assetId ?? null
  const proxiedImage = sourceImageUrl ? getProxiedMediaUrl(sourceImageUrl) : null
  const proxiedVideo = sourceVideoUrl ? getProxiedMediaUrl(sourceVideoUrl) : null

  const referenceMode: 'asset-crop-reference' | 'asset-full-image' | 'video-reference' | 'text-only' =
    proxiedImage
      ? isFullImage ? 'asset-full-image' : 'asset-crop-reference'
      : proxiedVideo ? 'video-reference'
      : 'text-only'

  const effectiveCropBox: CharacterReferenceCropBox | null = proxiedImage
    ? (isFullImage ? FULL_IMAGE_CROP : cropBox)
    : null

  const canCreate = !!primaryNode && characterBrief.trim().length > 0

  // ─── Crop pointer handlers ────────────────────────────────────────────────

  function getContainerNorm(e: React.PointerEvent): { x: number; y: number } | null {
    const rect = cropContainerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }

  function handleCropPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (isFullImage) return
    const norm = getContainerNorm(e)
    if (!norm) return
    const action = getDragAction(norm, cropBox)
    if (!action) return
    e.preventDefault()
    dragRef.current = { action, startNorm: norm, startBox: { ...cropBox } }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleCropPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const norm = getContainerNorm(e)
    if (!norm) return

    // Cursor preview when not dragging
    if (!dragRef.current) {
      if (!isFullImage) {
        const action = getDragAction(norm, cropBox)
        setCursor(actionCursor(action))
      }
      return
    }

    const { action, startNorm, startBox } = dragRef.current
    const dx = norm.x - startNorm.x
    const dy = norm.y - startNorm.y
    const right = startBox.x + startBox.width
    const bottom = startBox.y + startBox.height
    let next: CharacterReferenceCropBox

    if (action === 'move') {
      next = clampCropBox({ ...startBox, x: startBox.x + dx, y: startBox.y + dy })
    } else if (action === 'resize-nw') {
      next = clampCropBox({ x: startBox.x + dx, y: startBox.y + dy, width: right - (startBox.x + dx), height: bottom - (startBox.y + dy) })
    } else if (action === 'resize-ne') {
      next = clampCropBox({ ...startBox, y: startBox.y + dy, width: startBox.width + dx, height: bottom - (startBox.y + dy) })
    } else if (action === 'resize-sw') {
      next = clampCropBox({ ...startBox, x: startBox.x + dx, width: right - (startBox.x + dx), height: startBox.height + dy })
    } else {
      next = clampCropBox({ ...startBox, width: startBox.width + dx, height: startBox.height + dy })
    }
    setCropBox(next)
  }

  function handleCropPointerUp() {
    dragRef.current = null
  }

  // ─── Create handler ───────────────────────────────────────────────────────

  function handleCreate() {
    if (!primaryNode || !canCreate) return
    const opts: CharacterReferenceOptions = {
      mode,
      sourcePrompt: characterBrief,
      style,
      layout,
      keepFace,
      keepHair,
      keepOutfit,
      keepBody,
      keepColorScheme,
    }
    const slotPrompts = buildAssetSlotPrompts(opts, {
      assetId: sourceAssetId,
      imageUrl: sourceImageUrl,
      videoUrl: sourceVideoUrl,
      cropBox: effectiveCropBox,
    })
    onCreateReferenceNode({
      sourceNodeId: primaryNode.id,
      mode,
      referenceMode,
      sourceAssetId,
      sourceImageUrl,
      sourceVideoUrl,
      cropBox: effectiveCropBox,
      slots: slotPrompts.map((item) => ({
        key: item.key,
        label: item.label,
        slotDescription: item.slotDescription ?? item.titleSuffix,
        prompt: item.prompt,
      })),
      consistencyOptions: { keepFace, keepHair, keepOutfit, keepBody, keepColorScheme },
      style,
      layout,
    })
    setCreated(true)
  }

  function handleReset() {
    setCreated(false)
    setCharacterBrief((primaryNode?.prompt ?? primaryNode?.resultText ?? '').trim())
  }

  // ─── Crop box visual values ───────────────────────────────────────────────

  const cb = isFullImage ? FULL_IMAGE_CROP : cropBox
  // SVG path: full rect minus crop box = darkened exterior
  const svgMaskPath = `M0,0 H1 V1 H0 Z M${cb.x},${cb.y} V${cb.y + cb.height} H${cb.x + cb.width} V${cb.y} Z`

  // Corner handle positions (as %)
  const corners = [
    { key: 'nw', top: `${cb.y * 100}%`, left: `${cb.x * 100}%` },
    { key: 'ne', top: `${cb.y * 100}%`, left: `${(cb.x + cb.width) * 100}%` },
    { key: 'sw', top: `${(cb.y + cb.height) * 100}%`, left: `${cb.x * 100}%` },
    { key: 'se', top: `${(cb.y + cb.height) * 100}%`, left: `${(cb.x + cb.width) * 100}%` },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] -translate-y-1/2 flex"
      style={{ maxHeight: 'calc(100vh - 48px)' }}
      data-no-node-drag="true"
    >
      <div
        className="flex w-[480px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f1117]/97 shadow-2xl backdrop-blur-xl"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-white/90">人物参考提取 / Character Extract</p>
            <p className="text-[10px] text-white/35">从已有资产中提取人物参考，创建四视图或九宫格槽位节点</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70" aria-label="关闭">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* ── Source asset + crop extraction ── */}
          {primaryNode ? (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-semibold text-white/55">
                    {proxiedImage ? '人物参考提取区域' : proxiedVideo ? '来源视频参考' : '当前节点暂无可提取资产'}
                  </p>
                  <p className="text-[9px] text-white/25 mt-0.5">
                    {proxiedImage ? '拖动框选人物主体区域作为参考来源' : ''}
                  </p>
                </div>
                <span className="text-[9px] text-white/30 truncate max-w-[120px]">{primaryNode.title ?? '未命名节点'}</span>
              </div>

              {/* Image crop extraction */}
              {proxiedImage ? (
                <>
                  <div
                    ref={cropContainerRef}
                    className="relative overflow-hidden rounded-xl border border-white/12 select-none"
                    style={{
                      height: 190,
                      cursor: isFullImage ? 'default' : cursor,
                      touchAction: 'none',
                    }}
                    onPointerDown={handleCropPointerDown}
                    onPointerMove={handleCropPointerMove}
                    onPointerUp={handleCropPointerUp}
                    onPointerLeave={handleCropPointerUp}
                  >
                    {/* Source image — fills container */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proxiedImage}
                      alt="来源资产"
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />

                    {/* SVG overlay: darkened exterior + crop border */}
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 1 1"
                      preserveAspectRatio="none"
                      style={{ pointerEvents: 'none' }}
                    >
                      {!isFullImage ? (
                        <>
                          <path d={svgMaskPath} fill="rgba(0,0,0,0.58)" fillRule="evenodd" />
                          <rect x={cb.x} y={cb.y} width={cb.width} height={cb.height} fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="0.0045" />
                          {/* Rule-of-thirds subtle grid */}
                          <line x1={cb.x + cb.width / 3} y1={cb.y} x2={cb.x + cb.width / 3} y2={cb.y + cb.height} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x + (cb.width * 2) / 3} y1={cb.y} x2={cb.x + (cb.width * 2) / 3} y2={cb.y + cb.height} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x} y1={cb.y + cb.height / 3} x2={cb.x + cb.width} y2={cb.y + cb.height / 3} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x} y1={cb.y + (cb.height * 2) / 3} x2={cb.x + cb.width} y2={cb.y + (cb.height * 2) / 3} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                        </>
                      ) : (
                        <rect x={0} y={0} width={1} height={1} fill="rgba(99,102,241,0.12)" />
                      )}
                    </svg>

                    {/* Corner handles (visual, pointer-events: none) */}
                    {!isFullImage && corners.map((c) => (
                      <div
                        key={c.key}
                        style={{
                          position: 'absolute',
                          width: 10,
                          height: 10,
                          background: 'white',
                          border: '2px solid rgba(99,102,241,0.9)',
                          borderRadius: 2,
                          transform: 'translate(-50%, -50%)',
                          pointerEvents: 'none',
                          top: c.top,
                          left: c.left,
                          zIndex: 2,
                        }}
                      />
                    ))}

                    {/* Full-image overlay label */}
                    {isFullImage && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                        <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                          使用整张图作为参考
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Crop controls */}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setCropBox(DEFAULT_CROP); setIsFullImage(false) }}
                      className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1 text-[9px] text-white/50 transition hover:bg-white/8 hover:text-white/70"
                    >
                      重置中心区域
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFullImage((v) => !v)}
                      className={`rounded-lg border px-2.5 py-1 text-[9px] transition ${
                        isFullImage
                          ? 'border-indigo-500/40 bg-indigo-500/12 text-indigo-300 hover:bg-indigo-500/20'
                          : 'border-white/10 bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/70'
                      }`}
                    >
                      {isFullImage ? '✓ 整图参考' : '使用整张图'}
                    </button>
                    <span className={`ml-auto text-[9px] font-semibold ${
                      referenceMode === 'asset-crop-reference' ? 'text-emerald-400/80' : 'text-indigo-400/80'
                    }`}>
                      {referenceMode === 'asset-crop-reference' ? '框选人物参考' : '整图人物参考'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[8px] text-white/20 leading-relaxed">
                    框选区域会保存为各槽位的来源参考坐标。当前版本保存 cropBox 数据与来源链接；正式参考图由用户在槽位节点中手动生成。
                  </p>
                </>
              ) : proxiedVideo ? (
                <div>
                  <video
                    src={proxiedVideo}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[120px] rounded-xl border border-white/10 bg-black"
                  />
                  <p className="mt-1.5 text-[9px] text-sky-400/60 leading-relaxed">
                    视频人物提取暂按整段视频资产引用保存，后续可扩展关键帧提取。
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-sky-500/12 px-2 py-0.5 text-[8px] font-semibold text-sky-400">
                    视频参考模式
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5">
                  <span className="mt-0.5 text-[14px]">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400/80">当前节点暂无可提取资产</p>
                    <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">
                      将仅使用角色描述创建参考槽位（文字一致性模式）。若需要资产参考，请先在源节点生成图片。
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考提取 Skill</p>
            </div>
          )}

          {/* ── Board type ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">参考类型</p>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMode(m.id); setCreated(false) }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                    mode === m.id
                      ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
                      : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/6'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-white/85">{m.label}</p>
                  <p className="mt-0.5 text-[9px] text-white/35">{m.sub}</p>
                  <p className="mt-0.5 text-[8px] text-white/20">{m.gridLabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Slot preview with crop region ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/40">槽位预览</p>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] text-white/25">
                创建 {activeMode.nodeCount} 个节点
              </span>
            </div>
            <div className={`grid gap-1.5 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {activeMode.slots.map((slot) => (
                <div
                  key={slot.key}
                  className="relative overflow-hidden rounded-lg border border-white/8"
                  style={{ aspectRatio: '1/1' }}
                >
                  {/* Crop preview: show only the selected crop region */}
                  {proxiedImage && effectiveCropBox ? (
                    <img
                      src={proxiedImage}
                      alt={slot.label}
                      style={{
                        position: 'absolute',
                        width: `${100 / effectiveCropBox.width}%`,
                        height: `${100 / effectiveCropBox.height}%`,
                        left: `-${(effectiveCropBox.x / effectiveCropBox.width) * 100}%`,
                        top: `-${(effectiveCropBox.y / effectiveCropBox.height) * 100}%`,
                        opacity: 0.40,
                        objectFit: 'cover',
                      }}
                    />
                  ) : null}
                  {/* Labels overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    {!proxiedImage && (
                      <span className="text-[14px] text-white/15 mb-1">{slot.icon}</span>
                    )}
                    <span className="text-[10px] font-semibold text-white/85">{slot.label}</span>
                    <span className="text-[8px] text-white/35">{slot.sub}</span>
                    {referenceMode !== 'text-only' && (
                      <span className="mt-1 text-[7px] font-semibold text-emerald-400/70">人物参考已绑定</span>
                    )}
                    {referenceMode === 'text-only' && (
                      <span className="mt-1 text-[7px] text-amber-400/50">仅文字参考</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-white/20 leading-relaxed">
              每个槽位创建独立 image 节点（idle），请在各节点中手动选择 Provider 并生成参考图。
            </p>
          </div>

          {/* ── Character brief ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold text-white/40">角色描述 / Character Brief</p>
            <p className="mb-2 text-[9px] text-white/25">
              {referenceMode !== 'text-only'
                ? '角色描述与来源资产引用共同嵌入各槽位生成指令，双重约束角色一致性。'
                : '仅文字模式：请详细描述外貌、服装、发型等。'}
            </p>
            <textarea
              value={characterBrief}
              onChange={(e) => { setCharacterBrief(e.target.value); setCreated(false) }}
              placeholder="例：20岁亚裔女性，短黑发，穿红色旗袍，身材纤细，手持折扇"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-white/85 placeholder-white/25 outline-none resize-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
              style={{ fontFamily: 'inherit' }}
            />
            {characterBrief.trim().length === 0 && (
              <p className="mt-1 text-[9px] text-amber-400/60">请填写角色描述</p>
            )}
          </div>

          {/* ── Consistency locks ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold text-white/40">一致性锁定</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'keepFace' as const, label: '🔒 脸型', value: keepFace, set: setKeepFace },
                { key: 'keepHair' as const, label: '🔒 发型', value: keepHair, set: setKeepHair },
                { key: 'keepOutfit' as const, label: '🔒 服装', value: keepOutfit, set: setKeepOutfit },
                { key: 'keepBody' as const, label: '🔒 体型', value: keepBody, set: setKeepBody },
                { key: 'keepColorScheme' as const, label: '🔒 色彩', value: keepColorScheme, set: setKeepColorScheme },
              ].map(({ key, label, value, set }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { set(!value); setCreated(false) }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                    value
                      ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/35'
                      : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Advanced ── */}
          <div className="shrink-0 px-4 py-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between py-1 text-[10px] text-white/30 hover:text-white/50 transition"
            >
              <span>高级选项（风格 / 构图）</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-2 space-y-2.5 pb-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold text-white/30">参考稿风格</label>
                  <select
                    value={style}
                    onChange={(e) => { setStyle(e.target.value as CharacterReferenceStyle); setCreated(false) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {STYLES.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: '#0f1117' }}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold text-white/30">构图要求</label>
                  <select
                    value={layout}
                    onChange={(e) => { setLayout(e.target.value as CharacterReferenceLayout); setCreated(false) }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {LAYOUTS.map((l) => (
                      <option key={l.id} value={l.id} style={{ background: '#0f1117' }}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2">
                  <p className="text-[8px] leading-relaxed text-white/20">
                    该槽位已绑定来源人物参考。当前版本会保存人物参考区域与一致性指令；正式生成由用户在槽位节点中手动触发。
                    若当前模型暂不支持参考图，则会使用文字一致性约束。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {created ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                  {activeMode.nodeCount} 个人物参考节点已创建 ✓
                </p>
                <p className="text-[10px] leading-relaxed text-white/50">
                  节点已出现在画布中，状态为 idle。
                  {referenceMode === 'asset-crop-reference'
                    ? '人物框选区域已绑定到各槽位 metadata。'
                    : referenceMode === 'asset-full-image'
                      ? '整图参考已绑定到各槽位 metadata。'
                      : referenceMode === 'video-reference'
                        ? '视频资产引用已绑定。'
                        : '已使用文字描述模式。'}
                  请在各节点中选择 Provider 并手动生成参考图。
                </p>
              </div>
              <button type="button" onClick={handleReset} className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition">
                创建另一组参考节点
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className={`w-full rounded-xl py-2.5 text-[11px] font-semibold transition ${
                canCreate
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-white/6 text-white/25 cursor-not-allowed'
              }`}
            >
              {!primaryNode
                ? '请从节点顶部资产菜单打开'
                : characterBrief.trim().length === 0
                  ? '请先填写角色描述'
                  : `提取人物参考 · 创建 ${activeMode.nodeCount} 个${activeMode.label}节点`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
