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

export interface GeneratedReferenceItem {
  key: string
  label: string
  slotDescription: string
  prompt: string
  assetId: string | undefined
  imageUrl: string
}

export interface GenerateCharacterReferenceResult {
  sourceNodeId: string
  mode: CharacterReferenceMode
  sourceImageUrl: string
  sourceAssetId: string | null
  cropBox: CharacterReferenceCropBox | null
  references: GeneratedReferenceItem[]
}

interface CharacterReferenceGridPanelProps {
  nodes: CharacterSourceNode[]
  projectId?: string
  workflowId?: string
  onReferenceGenerated: (result: GenerateCharacterReferenceResult) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CROP: CharacterReferenceCropBox = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }
const FULL_IMAGE_CROP: CharacterReferenceCropBox = { x: 0, y: 0, width: 1, height: 1 }

const HANDLE_ZONE = 0.08

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
    gridLabel: '4 张真实参考图（2×2）',
    slots: TURNAROUND_SLOTS,
  },
  {
    id: 'grid5',
    label: '九宫格',
    sub: '全身 · 表情 · 服装 · 动作',
    nodeCount: 5,
    gridLabel: '5 张真实参考图（3+2）',
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
  projectId,
  workflowId,
  onReferenceGenerated,
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
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationSuccess, setGenerationSuccess] = useState(false)
  const [generatedCount, setGeneratedCount] = useState(0)

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const activeMode = (MODES.find((m) => m.id === mode) ?? MODES[0])!

  // Asset detection
  const sourceImageUrl = primaryNode?.resultImageUrl ?? null
  const sourceVideoUrl = primaryNode?.resultVideoUrl ?? null
  const sourceAssetId = primaryNode?.assetId ?? null
  const proxiedImage = sourceImageUrl ? getProxiedMediaUrl(sourceImageUrl) : null

  const effectiveCropBox: CharacterReferenceCropBox | null = proxiedImage
    ? (isFullImage ? FULL_IMAGE_CROP : cropBox)
    : null

  // Generate is only enabled when there is a real image asset
  const canGenerate = !!primaryNode && !!sourceImageUrl && !generating

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

  // ─── Generate handler ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!primaryNode || !sourceImageUrl || generating) return

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
      videoUrl: null,
      cropBox: effectiveCropBox,
    })

    console.log('[CharacterRef] handleGenerate called', {
      nodeId: primaryNode.id,
      sourceImageUrlExcerpt: sourceImageUrl.slice(0, 60),
      mode,
      slotCount: slotPrompts.length,
      slots: slotPrompts.map((s) => ({ key: s.key, label: s.label, promptExcerpt: s.prompt.slice(0, 120) })),
    })

    setGenerating(true)
    setGenerationError(null)
    setGenerationProgress('正在生成人物参考图，可能需要 30–60 秒...')

    try {
      const requestPayload = {
        sourceImageUrl,
        characterId: sourceAssetId ?? primaryNode.id,
        items: slotPrompts.map((s) => ({ kind: s.key, label: s.label, prompt: s.prompt })),
        providerId: 'volcengine-seedream-image',
        projectId,
        workflowId,
        nodeId: primaryNode.id,
      }
      console.log('[CharacterRef] POSTing to /api/generate/character-reference', {
        itemCount: requestPayload.items.length,
        providerId: requestPayload.providerId,
        projectId: requestPayload.projectId,
      })

      const res = await fetch('/api/generate/character-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      })

      console.log('[CharacterRef] response status', res.status)

      if (res.status === 401) {
        setGenerationError('请先登录后再生成参考图。')
        return
      }

      const data = await res.json() as {
        success: boolean
        partialSuccess?: boolean
        references?: Array<{
          id: string
          kind: string
          label: string
          imageUrl: string
          assetId?: string
          sourceImageUrl: string
        }>
        errors?: Array<{ kind: string; label: string; errorCode?: string; message: string }>
        message?: string
        errorCode?: string
      }

      console.log('[CharacterRef] response data', {
        success: data.success,
        partialSuccess: data.partialSuccess,
        referencesCount: data.references?.length ?? 0,
        errorsCount: data.errors?.length ?? 0,
        errorCode: data.errorCode,
        message: data.message,
        references: data.references?.map((r) => ({
          kind: r.kind,
          hasAssetId: Boolean(r.assetId),
          imageUrlExcerpt: r.imageUrl?.slice(0, 70),
          isSameAsSource: r.imageUrl === sourceImageUrl,
        })),
        errors: data.errors,
      })

      if (!data.success && !data.partialSuccess) {
        setGenerationError(data.message ?? '生成失败，请重试。')
        return
      }

      const references: GeneratedReferenceItem[] = (data.references ?? []).map((ref) => {
        const slot = slotPrompts.find((s) => s.key === ref.kind)
        return {
          key: ref.kind,
          label: ref.label ?? slot?.label ?? ref.kind,
          slotDescription: slot?.slotDescription ?? '',
          prompt: slot?.prompt ?? '',
          assetId: ref.assetId,
          imageUrl: ref.imageUrl,
        }
      })

      if (references.length === 0) {
        setGenerationError('生成失败：API 未返回任何参考图。')
        return
      }

      // Warn if provider returned duplicate URLs (model may have cloned the source)
      const uniqueUrls = new Set(references.map((r) => r.imageUrl))
      if (uniqueUrls.size === 1 && references.length > 1) {
        console.warn('[CharacterRef] WARNING: all references have the same imageUrl — provider may have returned duplicate images', {
          sharedUrl: references[0]?.imageUrl?.slice(0, 70),
        })
      }
      const duplicateSources = references.filter((r) => r.imageUrl === sourceImageUrl)
      if (duplicateSources.length > 0) {
        console.warn('[CharacterRef] WARNING: some references have imageUrl === sourceImageUrl — these are NOT new images', {
          count: duplicateSources.length,
        })
      }

      console.log('[CharacterRef] calling onReferenceGenerated with', references.length, 'references')
      setGenerationSuccess(true)
      setGeneratedCount(references.length)
      onReferenceGenerated({
        sourceNodeId: primaryNode.id,
        mode,
        sourceImageUrl,
        sourceAssetId,
        cropBox: effectiveCropBox,
        references,
      })
    } catch (err) {
      console.error('[CharacterRef] fetch error', err)
      setGenerationError(err instanceof Error ? err.message : '生成请求失败，请检查网络后重试。')
    } finally {
      setGenerating(false)
      setGenerationProgress(null)
    }
  }

  function handleReset() {
    setGenerationSuccess(false)
    setGenerationError(null)
    setGeneratedCount(0)
  }

  // ─── Crop box visual values ───────────────────────────────────────────────

  const cb = isFullImage ? FULL_IMAGE_CROP : cropBox
  const svgMaskPath = `M0,0 H1 V1 H0 Z M${cb.x},${cb.y} V${cb.y + cb.height} H${cb.x + cb.width} V${cb.y} Z`

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
            <p className="text-[13px] font-semibold text-white/90">人物参考生成 / Character Reference</p>
            <p className="text-[10px] text-white/35">从已有资产中提取人物，直接生成四视图或九宫格真实参考图</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/8 hover:text-white/70" aria-label="关闭">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* ── Source asset ── */}
          {primaryNode ? (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-semibold text-white/55">
                    {sourceImageUrl ? '来源图片资产（人物参考）' : sourceVideoUrl ? '来源视频' : '当前节点暂无图片资产'}
                  </p>
                  {sourceImageUrl && (
                    <p className="text-[9px] text-white/25 mt-0.5">可框选人物主体区域作为参考来源</p>
                  )}
                </div>
                <span className="text-[9px] text-white/30 truncate max-w-[120px]">{primaryNode.title ?? '未命名节点'}</span>
              </div>

              {/* Image source with crop tool */}
              {sourceImageUrl && proxiedImage ? (
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proxiedImage}
                      alt="来源资产"
                      className="absolute inset-0 h-full w-full object-cover"
                      draggable={false}
                    />

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
                          <line x1={cb.x + cb.width / 3} y1={cb.y} x2={cb.x + cb.width / 3} y2={cb.y + cb.height} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x + (cb.width * 2) / 3} y1={cb.y} x2={cb.x + (cb.width * 2) / 3} y2={cb.y + cb.height} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x} y1={cb.y + cb.height / 3} x2={cb.x + cb.width} y2={cb.y + cb.height / 3} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                          <line x1={cb.x} y1={cb.y + (cb.height * 2) / 3} x2={cb.x + cb.width} y2={cb.y + (cb.height * 2) / 3} stroke="rgba(255,255,255,0.18)" strokeWidth="0.002" />
                        </>
                      ) : (
                        <rect x={0} y={0} width={1} height={1} fill="rgba(99,102,241,0.12)" />
                      )}
                    </svg>

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

                    {isFullImage && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                        <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
                          使用整张图作为参考
                        </span>
                      </div>
                    )}
                  </div>

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
                    <span className="ml-auto text-[9px] font-semibold text-emerald-400/80">
                      图片资产已就绪 ✓
                    </span>
                  </div>
                  <p className="mt-1.5 text-[8px] text-white/20 leading-relaxed">
                    框选区域仅供视觉参考；生成时 Seedream API 使用完整来源图片作为人物参考。
                  </p>
                </>
              ) : sourceVideoUrl ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5">
                  <span className="mt-0.5 text-[14px]">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400/80">视频来源暂不支持直接人物参考生成</p>
                    <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">
                      请先从视频中生成/选择关键帧图片，再使用图片节点进行人物参考提取。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5">
                  <span className="mt-0.5 text-[14px]">⚠</span>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-400/80">当前节点没有可用图片资产</p>
                    <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">
                      无法生成资产参考图。请先生成或选择一个已有图片节点，再打开人物参考 Skill。
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="shrink-0 border-b border-white/6 px-4 py-3">
              <p className="text-[10px] text-amber-400/70">请从画布节点顶部资产菜单打开人物参考 Skill</p>
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
                  onClick={() => { setMode(m.id); handleReset() }}
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

          {/* ── Slot preview ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/40">生成视角</p>
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] text-white/25">
                {activeMode.nodeCount} 张真实参考图
              </span>
            </div>
            <div className={`grid gap-1.5 ${activeMode.id === 'turnaround4' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {activeMode.slots.map((slot) => (
                <div
                  key={slot.key}
                  className="relative overflow-hidden rounded-lg border border-white/8"
                  style={{ aspectRatio: '1/1' }}
                >
                  {proxiedImage && effectiveCropBox ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                    {!proxiedImage && (
                      <span className="text-[14px] text-white/15 mb-1">{slot.icon}</span>
                    )}
                    <span className="text-[10px] font-semibold text-white/85">{slot.label}</span>
                    <span className="text-[8px] text-white/35">{slot.sub}</span>
                    {sourceImageUrl && (
                      <span className="mt-1 text-[7px] font-semibold text-emerald-400/70">资产参考已绑定</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-white/20 leading-relaxed">
              每个视角调用 Seedream 参考图 API，生成真实图片并直接保存为画布节点（status: done）。
            </p>
          </div>

          {/* ── Character brief ── */}
          <div className="shrink-0 border-b border-white/6 px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold text-white/40">角色描述 / Character Brief（可选）</p>
            <p className="mb-2 text-[9px] text-white/25">
              与来源图片共同约束角色一致性。若为空则仅使用来源图片作为参考。
            </p>
            <textarea
              value={characterBrief}
              onChange={(e) => { setCharacterBrief(e.target.value) }}
              placeholder="例：20岁亚裔女性，短黑发，穿红色旗袍，身材纤细，手持折扇"
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-white/85 placeholder-white/25 outline-none resize-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20"
              style={{ fontFamily: 'inherit' }}
            />
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
                  onClick={() => set(!value)}
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
                    onChange={(e) => setStyle(e.target.value as CharacterReferenceStyle)}
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
                    onChange={(e) => setLayout(e.target.value as CharacterReferenceLayout)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70 outline-none focus:border-indigo-500/40"
                  >
                    {LAYOUTS.map((l) => (
                      <option key={l.id} value={l.id} style={{ background: '#0f1117' }}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 px-4 py-3">
          {generationSuccess ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                  已生成真实人物参考图 {generatedCount} 张 ✓
                </p>
                <p className="text-[10px] leading-relaxed text-white/50">
                  已保存为画布节点，每张参考图均含真实 assetId 与 resultImageUrl。
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl py-2 text-[11px] text-white/40 hover:text-white/60 transition"
              >
                生成另一组参考图
              </button>
            </div>
          ) : generationError ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-red-500/25 bg-red-500/6 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-red-400/80 mb-0.5">生成失败</p>
                <p className="text-[9px] text-white/40 leading-relaxed">{generationError}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating || !canGenerate}
                className="w-full rounded-xl bg-red-500/15 py-2.5 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                重试
              </button>
            </div>
          ) : generating ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/6 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-indigo-400/60 border-t-indigo-400" />
                  <p className="text-[10px] text-indigo-300">{generationProgress ?? '生成中...'}</p>
                </div>
              </div>
              <p className="text-center text-[9px] text-white/20">请勿关闭，生成完成后自动更新画布</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              className={`w-full rounded-xl py-2.5 text-[11px] font-semibold transition ${
                canGenerate
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-white/6 text-white/25 cursor-not-allowed'
              }`}
            >
              {!primaryNode
                ? '请从节点顶部资产菜单打开'
                : !sourceImageUrl
                  ? (sourceVideoUrl
                      ? '视频来源暂不支持，请先生成关键帧'
                      : '当前节点无图片资产，无法生成')
                  : `生成 ${activeMode.nodeCount} 张${activeMode.label}参考图`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
