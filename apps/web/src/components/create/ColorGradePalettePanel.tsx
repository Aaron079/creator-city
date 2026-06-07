'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Check, Copy, X, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import {
  COLOR_GRADE_PRESETS,
  createDefaultColorGradeSetting,
  applyColorGradePreset,
  buildColorGradePrompt,
  previewColorGradeApply,
  summarizeColorGradeSetting,
  hasColorGradePrompt,
  type ColorGradePresetId,
  type ColorGradeSetting,
  type WheelSetting,
  type CurveShape,
  type RgbBias,
  type RangeIntent,
  type LumIntent,
  type GrainType,
  type EffectLevel,
} from '@/lib/canvas/color-grade-palette'

interface GradeNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  status?: string | null
}

interface ColorGradePalettePanelProps {
  nodes: GradeNode[]
  onApplyGrade: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

type ActiveTab = 'wheels' | 'curves' | 'qualifier' | 'texture' | 'output'

// ─── Color Wheel Visual (Interactive — drag to set temperature/tint) ──────────
// Axes: right=warm (+temp), left=cool (−temp), top=magenta (+tint), bottom=green (−tint)
// Matches DaVinci Resolve primary wheel orientation.

function ColorWheel({
  wheel,
  size = 88,
  onChange,
}: {
  wheel: WheelSetting
  size?: number
  onChange: (patch: Partial<WheelSetting>) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const updateFromPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = divRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)   // −1 to +1
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)  // −1 to +1
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy))
    const angle = Math.atan2(dy, dx)  // clockwise from right
    onChange({
      temperature: Math.round(Math.cos(angle) * dist * 100),   // right = +warm
      tint: Math.round(-Math.sin(angle) * dist * 100),          // up = +magenta (y inverted)
    })
  }, [onChange])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPointer(e)
  }, [updateFromPointer])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    updateFromPointer(e)
  }, [updateFromPointer])

  const handlePointerUp = useCallback(() => { isDragging.current = false }, [])

  // Dot position clamped to 38% radius
  const dotX = 50 + (wheel.temperature / 100) * 38
  const dotY = 50 - (wheel.tint / 100) * 38
  const isNeutral = wheel.temperature === 0 && wheel.tint === 0

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Wheel disc — drag to set temp/tint */}
      <div
        ref={divRef}
        className="relative flex-shrink-0 cursor-crosshair select-none rounded-full border border-white/12"
        style={{
          width: size,
          height: size,
          // Layered: dark center reference → white fade → full color spectrum ring
          // Warm (orange) anchored at 3 o'clock, magenta at 12, cool (blue) at 9, green at 6
          background: `
            radial-gradient(circle, rgba(8,10,16,0.6) 0%, transparent 24%),
            radial-gradient(circle, white 0%, transparent 56%),
            conic-gradient(
              hsl(300,80%,52%) 0deg,
              hsl(345,82%,55%) 45deg,
              hsl(30,88%,55%)  90deg,
              hsl(75,80%,50%)  135deg,
              hsl(120,75%,46%) 180deg,
              hsl(165,78%,46%) 225deg,
              hsl(210,82%,52%) 270deg,
              hsl(255,80%,55%) 315deg,
              hsl(300,80%,52%) 360deg
            )
          `,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Subtle crosshair */}
        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100">
          <line x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
        </svg>
        {/* Bias dot */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 10, height: 10,
            left: `${dotX}%`, top: `${dotY}%`,
            transform: 'translate(-50%, -50%)',
            background: isNeutral ? 'rgba(255,255,255,0.45)' : 'white',
            border: '1.5px solid rgba(0,0,0,0.55)',
            boxShadow: isNeutral ? '0 0 3px rgba(0,0,0,0.5)' : '0 0 0 1px rgba(255,255,255,0.25), 0 1px 6px rgba(0,0,0,0.9)',
            transition: isDragging.current ? 'none' : 'left 0.05s, top 0.05s',
          }}
        />
        {/* Reset — shows when not neutral */}
        {!isNeutral && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange({ temperature: 0, tint: 0 }) }}
            className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white/60 hover:bg-black hover:text-white/90 transition"
          >
            ↺
          </button>
        )}
      </div>
      {/* Axis labels */}
      <div className="flex w-full items-center justify-between px-0.5 text-[6.5px] text-white/18">
        <span>◀ Cool</span>
        <span className="text-white/12">· Drag ·</span>
        <span>Warm ▶</span>
      </div>
    </div>
  )
}

// ─── Wheel Card ───────────────────────────────────────────────────────────────

function WheelCard({
  label,
  labelZh,
  wheel,
  onChange,
}: {
  label: string
  labelZh: string
  wheel: WheelSetting
  onChange: (patch: Partial<WheelSetting>) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/2 p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</span>
        <span className="text-[9px] text-white/30">{labelZh}</span>
      </div>

      <ColorWheel wheel={wheel} size={88} onChange={onChange} />

      {/* Temperature slider */}
      <SliderRow
        label="Temp"
        value={wheel.temperature}
        min={-100} max={100} step={5}
        leftLabel="Cool" rightLabel="Warm"
        trackColor="linear-gradient(90deg, #4488ff, #888, #ff8833)"
        onChange={(v) => onChange({ temperature: v })}
      />
      {/* Tint slider */}
      <SliderRow
        label="Tint"
        value={wheel.tint}
        min={-100} max={100} step={5}
        leftLabel="Green" rightLabel="Mag"
        trackColor="linear-gradient(90deg, #22cc44, #888, #cc44aa)"
        onChange={(v) => onChange({ tint: v })}
      />
      {/* Luminance slider */}
      <SliderRow
        label="Lum"
        value={wheel.luminance}
        min={-100} max={100} step={5}
        leftLabel="Dark" rightLabel="Bright"
        trackColor="linear-gradient(90deg, #111, #888, #fff)"
        onChange={(v) => onChange({ luminance: v })}
      />
      {/* Saturation slider */}
      <SliderRow
        label="Sat"
        value={wheel.saturation}
        min={-100} max={100} step={5}
        leftLabel="Desat" rightLabel="Sat"
        trackColor="linear-gradient(90deg, #444, #888, #f55)"
        onChange={(v) => onChange({ saturation: v })}
      />
    </div>
  )
}

// ─── Slider Row ───────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step,
  leftLabel, rightLabel, trackColor, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  leftLabel: string
  rightLabel: string
  trackColor: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8.5px] font-medium text-white/40">{label}</span>
        <span className={`text-[8.5px] font-mono ${value === 0 ? 'text-white/25' : 'text-indigo-300'}`}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div className="relative flex items-center gap-1">
        <span className="w-6 text-[7px] text-white/20 text-right">{leftLabel}</span>
        <div className="relative flex-1">
          <div
            className="absolute inset-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full opacity-40"
            style={{ background: trackColor }}
          />
          <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
          />
        </div>
        <span className="w-6 text-[7px] text-white/20">{rightLabel}</span>
      </div>
    </div>
  )
}

// ─── Curve SVG ────────────────────────────────────────────────────────────────

const CURVE_PATHS: Record<CurveShape, string> = {
  neutral: 'M 0 100 L 100 0',
  'gentle-s': 'M 0 100 C 20 90, 30 60, 50 50 C 70 40, 80 10, 100 0',
  'standard-s': 'M 0 100 C 15 95, 25 70, 50 50 C 75 30, 85 5, 100 0',
  'steep-s': 'M 0 100 C 10 98, 20 80, 50 50 C 80 20, 90 2, 100 0',
  'lifted-blacks': 'M 0 85 C 15 80, 30 65, 50 48 C 70 32, 85 5, 100 0',
}

const RGB_BIAS_COLORS: Record<RgbBias, { shadow: string; highlight: string }> = {
  'neutral': { shadow: '#888', highlight: '#888' },
  'warm-hi-cool-sh': { shadow: '#4488ff', highlight: '#ff8833' },
  'cool-hi-warm-sh': { shadow: '#ff8833', highlight: '#44aaff' },
  'green-sh-mag-hi': { shadow: '#44cc66', highlight: '#cc44aa' },
  'teal-orange': { shadow: '#00aaaa', highlight: '#ff6600' },
}

function CurveSVG({ shape, rgbBias }: { shape: CurveShape; rgbBias: RgbBias }) {
  const path = CURVE_PATHS[shape]
  const bias = RGB_BIAS_COLORS[rgbBias]
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      {/* Grid */}
      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.3" />
      {/* Shadow color indicator */}
      <circle cx="8" cy="92" r="4" fill={bias.shadow} opacity="0.7" />
      {/* Highlight color indicator */}
      <circle cx="92" cy="8" r="4" fill={bias.highlight} opacity="0.7" />
      {/* Curve */}
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Reference diagonal (neutral) */}
      {shape !== 'neutral' && (
        <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="3,3" />
      )}
    </svg>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ToggleRow({ label, checked, onChange, locked = false }: { label: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {locked && <Lock size={9} className="text-emerald-400/60" />}
        <span className="text-[10px] text-white/60">{label}</span>
      </div>
      <button
        type="button"
        disabled={locked}
        onClick={() => onChange?.(!checked)}
        className={`relative h-4 w-7 rounded-full transition ${checked ? 'bg-emerald-500/70' : 'bg-white/10'} ${locked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '14px' : '2px' }}
        />
      </button>
    </div>
  )
}

function RangeBar({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-white/50">{label}</span>
    </div>
  )
}

function ThreeWayControl<T extends string>({
  label, value,
  options,
  onChange,
}: { label: string; value: T; options: [T, string, T, string, T, string]; onChange: (v: T) => void }) {
  const [lo, loLabel, mid, midLabel, hi, hiLabel] = options
  return (
    <div className="space-y-0.5">
      <span className="text-[8.5px] text-white/40">{label}</span>
      <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-white/8 p-0.5">
        {([lo, loLabel, mid, midLabel, hi, hiLabel] as [T, string, T, string, T, string]).reduce<[T, string][]>(
          (acc, _, i) => { if (i % 2 === 0) acc.push([options[i] as T, options[i + 1] as string]); return acc },
          [],
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded py-1 text-[9px] transition ${value === v ? 'bg-indigo-500/30 text-indigo-200 font-medium' : 'text-white/35 hover:bg-white/5 hover:text-white/60'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ColorGradePalettePanel({
  nodes,
  onApplyGrade,
  onClose,
  defaultSelectedNodeId,
}: ColorGradePalettePanelProps) {
  const [setting, setSetting] = useState<ColorGradeSetting>(createDefaultColorGradeSetting)
  const [activeTab, setActiveTab] = useState<ActiveTab>('wheels')
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewResults, setPreviewResults] = useState<ReturnType<typeof previewColorGradeApply> | null>(null)
  const [applySuccess, setApplySuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPromptPreview, setShowPromptPreview] = useState(false)

  const eligibleNodes = useMemo(
    () => nodes.filter((n) => n.kind === 'image' || n.kind === 'video'),
    [nodes],
  )

  // Initialize selection once
  const defaultSelected = useMemo(() => {
    if (defaultSelectedNodeId) {
      const found = eligibleNodes.find((n) => n.id === defaultSelectedNodeId)
      if (found) return [found.id]
    }
    const first = eligibleNodes[0]
    if (first) return [first.id]
    return []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [initDone, setInitDone] = useState(false)
  if (!initDone && defaultSelected.length > 0) {
    setSelectedNodeIds(defaultSelected)
    setInitDone(true)
  }

  const patchSetting = useCallback((patch: Partial<ColorGradeSetting>) => {
    setSetting((prev) => ({ ...prev, ...patch, presetId: 'none' }))
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }, [])

  const patchWheel = useCallback((wheel: 'lift' | 'gamma' | 'gain' | 'offset', patch: Partial<WheelSetting>) => {
    setSetting((prev) => ({ ...prev, presetId: 'none', [wheel]: { ...prev[wheel], ...patch } }))
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }, [])

  const applyPreset = (presetId: ColorGradePresetId) => {
    setSetting(applyColorGradePreset(presetId))
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const toggleNode = (id: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const handlePreview = () => {
    const results = previewColorGradeApply(eligibleNodes, selectedNodeIds, setting)
    setPreviewResults(results)
    const firstActive = results.find((r) => !r.skipped)
    if (firstActive) {
      setPreviewText(buildColorGradePrompt(setting, 'image'))
      setShowPromptPreview(true)
    }
  }

  const handleApply = () => {
    if (!previewResults) return
    const updates = previewResults
      .filter((r) => !r.skipped)
      .map((r) => ({ nodeId: r.nodeId, prompt: r.newPrompt }))
    if (updates.length > 0) {
      onApplyGrade(updates)
      setApplySuccess(true)
    }
  }

  const handleCopyReport = async () => {
    const nodesSummary = selectedNodeIds
      .map((id) => eligibleNodes.find((n) => n.id === id)?.title ?? id)
      .join(', ')
    const reportText = [
      '=== Color Grade Palette / 调色盘 ===',
      `目标节点：${nodesSummary}`,
      '',
      summarizeColorGradeSetting(setting),
      '',
      buildColorGradePrompt(setting, 'image'),
    ].join('\n')
    try { await navigator.clipboard.writeText(reportText) } catch { /* noop */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const skippedNodes = previewResults?.filter((r) => r.skipped && r.skipReason === 'already-has-grade') ?? []
  const activeResults = previewResults?.filter((r) => !r.skipped) ?? []
  const canApply = previewResults !== null && activeResults.length > 0 && !applySuccess
  const canPreview = selectedNodeIds.length > 0

  const TABS: { id: ActiveTab; label: string; zh: string }[] = [
    { id: 'wheels', label: 'Wheels', zh: '色轮' },
    { id: 'curves', label: 'Curves', zh: '曲线' },
    { id: 'qualifier', label: 'Qualifier', zh: 'HSL' },
    { id: 'texture', label: 'Texture', zh: '纹理' },
    { id: 'output', label: 'Output', zh: '输出' },
  ]

  return (
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[92vh] w-[680px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14]/97 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-white/8 px-4 pb-2.5 pt-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">Editing · 剪辑</p>
          <h2 className="mt-0.5 text-[14px] font-bold tracking-tight text-white/90">Color Grade Palette</h2>
          <p className="text-[9px] text-white/35">调色盘 · Prompt-level grading · 非像素级调色</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 rounded-lg p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white/70"
          aria-label="关闭"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Gallery Strip (preset chips) ── */}
      <div className="border-b border-white/6 px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => applyPreset('none')}
            className={`flex-shrink-0 rounded-lg border px-2.5 py-1 text-[9px] font-medium transition ${setting.presetId === 'none' ? 'border-white/30 bg-white/10 text-white/80' : 'border-white/8 text-white/35 hover:border-white/16 hover:text-white/60'}`}
          >
            Manual
          </button>
          {COLOR_GRADE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`flex-shrink-0 overflow-hidden rounded-lg border px-2.5 py-1 transition ${setting.presetId === p.id ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200' : 'border-white/8 text-white/40 hover:border-white/16 hover:text-white/65'}`}
            >
              <div className="mb-0.5 h-0.5 w-full rounded-full" style={{ background: p.accentColor }} />
              <span className="text-[9px] font-medium leading-none">{p.nameZh}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: 3-column ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Left: Clip Strip ── */}
        <div className="flex w-[140px] flex-shrink-0 flex-col border-r border-white/6">
          <div className="border-b border-white/6 px-2.5 py-2">
            <p className="text-[8px] font-semibold uppercase tracking-widest text-white/25">Clip Strip</p>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {eligibleNodes.length === 0 && (
              <p className="text-[9px] leading-relaxed text-white/30">无图片/视频节点</p>
            )}
            {eligibleNodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id)
              const hasGrade = hasColorGradePrompt(node.prompt ?? '')
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => toggleNode(node.id)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${isSelected ? 'border-indigo-500/50 bg-indigo-500/12' : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'}`}
                >
                  {/* Thumbnail placeholder */}
                  <div className={`mb-1 h-10 w-full rounded border ${isSelected ? 'border-indigo-500/30 bg-indigo-500/8' : 'border-white/6 bg-white/4'} flex items-center justify-center`}>
                    <span className={`text-[9px] font-bold ${node.kind === 'image' ? 'text-sky-400/60' : 'text-violet-400/60'}`}>
                      {node.kind === 'image' ? 'IMG' : 'VID'}
                    </span>
                  </div>
                  <p className="truncate text-[9px] font-medium text-white/70">
                    {node.title ?? (node.kind === 'image' ? '图片' : '视频')}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    {isSelected && <span className="text-[7px] text-indigo-400">●</span>}
                    {hasGrade && <span className="text-[7px] text-amber-400">已调</span>}
                  </div>
                </button>
              )
            })}
            {eligibleNodes.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedNodeIds(eligibleNodes.map((n) => n.id))}
                className="w-full rounded-lg border border-white/6 py-1 text-[8px] text-white/30 hover:border-white/14 hover:text-white/55 transition"
              >
                全选
              </button>
            )}
          </div>
        </div>

        {/* ── Center: Main Area ── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Intent Monitor strip */}
          <div className="border-b border-white/6 bg-[#0a0c10] px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-[7.5px] font-semibold uppercase tracking-widest text-white/20">Intent Monitor — no pixel analysis</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className={`h-1.5 w-8 rounded-full ${
                    setting.lift.luminance < -20 || setting.gamma.luminance < -15 ? 'bg-zinc-600' :
                    setting.lift.luminance > 20 || setting.gamma.luminance > 15 ? 'bg-zinc-200' : 'bg-zinc-400'
                  }`} />
                  <span className="text-[7.5px] text-white/25">Wave</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{
                    background: setting.lift.temperature < -20 ? '#4488ff' :
                      setting.gain.temperature > 20 ? '#ff8833' : '#888',
                  }} />
                  <span className="text-[7.5px] text-white/25">Vect</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[7.5px] font-medium ${setting.qualifier.protectSkin ? 'text-emerald-400/70' : 'text-white/20'}`}>
                    Skin {setting.qualifier.protectSkin ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[7.5px] text-white/25">
                    {[setting.lift, setting.gamma, setting.gain, setting.offset].filter(
                      w => w.temperature !== 0 || w.tint !== 0 || w.luminance !== 0 || w.saturation !== 0,
                    ).length}/4 wheels active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-center transition ${activeTab === tab.id ? 'border-b-2 border-indigo-400 text-indigo-300' : 'text-white/35 hover:text-white/60'}`}
              >
                <span className="block text-[9.5px] font-semibold">{tab.label}</span>
                <span className="block text-[7.5px] text-current/60">{tab.zh}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">

            {/* ── Wheels Tab ── */}
            {activeTab === 'wheels' && (
              <div className="space-y-3">
                <p className="text-[8.5px] text-white/25">
                  Primary color correction · Lift / Gamma / Gain / Offset
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <WheelCard label="LIFT" labelZh="暗部" wheel={setting.lift} onChange={(p) => patchWheel('lift', p)} />
                  <WheelCard label="GAMMA" labelZh="中间调" wheel={setting.gamma} onChange={(p) => patchWheel('gamma', p)} />
                  <WheelCard label="GAIN" labelZh="高光" wheel={setting.gain} onChange={(p) => patchWheel('gain', p)} />
                  <WheelCard label="OFFSET" labelZh="全局" wheel={setting.offset} onChange={(p) => patchWheel('offset', p)} />
                </div>
              </div>
            )}

            {/* ── Curves Tab ── */}
            {activeTab === 'curves' && (
              <div className="space-y-4">
                {/* SVG Curve display */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">Tone Curve</p>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ background: RGB_BIAS_COLORS[setting.curve.rgbBias].shadow }} />
                      <span className="text-[7.5px] text-white/30">Shadow</span>
                      <div className="ml-1 h-2 w-2 rounded-full" style={{ background: RGB_BIAS_COLORS[setting.curve.rgbBias].highlight }} />
                      <span className="text-[7.5px] text-white/30">Highlight</span>
                    </div>
                  </div>
                  <div className="h-32 w-full rounded-xl border border-white/8 bg-[#080a0e] p-2">
                    <CurveSVG shape={setting.curve.shape} rgbBias={setting.curve.rgbBias} />
                  </div>
                </div>

                {/* Curve shape selector */}
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">Curve Shape</p>
                  {(
                    [
                      ['neutral', '线性 Neutral', '无S曲线，线性输出'],
                      ['gentle-s', 'Gentle S-Curve', '轻柔S曲线，自然对比'],
                      ['standard-s', 'Standard S-Curve', '电影感S曲线，标准调性'],
                      ['steep-s', 'Steep S-Curve', '陡峭S曲线，戏剧高对比'],
                      ['lifted-blacks', 'Lifted Blacks Film', '黑位提升+胶片S'],
                    ] as [CurveShape, string, string][]
                  ).map(([v, l, d]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchSetting({ curve: { ...setting.curve, shape: v } })}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${setting.curve.shape === v ? 'border-indigo-500/50 bg-indigo-500/12' : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/5'}`}
                    >
                      <div className={`h-3.5 w-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${setting.curve.shape === v ? 'border-indigo-400 bg-indigo-500/30' : 'border-white/20'}`}>
                        {setting.curve.shape === v && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-white/80">{l}</p>
                        <p className="text-[8px] text-white/35">{d}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* RGB Bias */}
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">RGB Bias / 色彩偏向</p>
                  {(
                    [
                      ['neutral', 'Neutral', '无色彩偏向'],
                      ['warm-hi-cool-sh', 'Warm High / Cool Shadow', '暖色高光 + 冷色阴影'],
                      ['cool-hi-warm-sh', 'Cool High / Warm Shadow', '冷色高光 + 暖色阴影'],
                      ['green-sh-mag-hi', 'Green Shadow / Magenta High', '绿色阴影 + 洋红高光'],
                      ['teal-orange', 'Teal Shadow / Orange High', '青色阴影 + 橙色高光'],
                    ] as [RgbBias, string, string][]
                  ).map(([v, l, d]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchSetting({ curve: { ...setting.curve, rgbBias: v } })}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${setting.curve.rgbBias === v ? 'border-indigo-500/50 bg-indigo-500/12' : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/5'}`}
                    >
                      <div className="flex flex-shrink-0 gap-0.5">
                        <div className="h-3 w-3 rounded-sm" style={{ background: RGB_BIAS_COLORS[v].shadow }} />
                        <div className="h-3 w-3 rounded-sm" style={{ background: RGB_BIAS_COLORS[v].highlight }} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-white/80">{l}</p>
                        <p className="text-[8px] text-white/35">{d}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Qualifier Tab ── */}
            {activeTab === 'qualifier' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">HSL Qualifier Intent</p>
                  <p className="mt-0.5 text-[8px] italic text-white/20">Prompt-level only — not a real pixel qualifier</p>
                </div>

                {/* Color range bars */}
                <div className="space-y-1">
                  <p className="text-[8px] text-white/25">Color Range Reference</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <RangeBar color="#cc2222" label="Reds" />
                    <RangeBar color="#dd7722" label="Oranges / Skin" />
                    <RangeBar color="#cccc22" label="Yellows" />
                    <RangeBar color="#22aa44" label="Greens" />
                    <RangeBar color="#22aacc" label="Cyans" />
                    <RangeBar color="#2244cc" label="Blues" />
                    <RangeBar color="#aa44cc" label="Magentas" />
                  </div>
                </div>

                {/* Skin */}
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-orange-400" />
                    <p className="text-[9px] font-semibold text-orange-300/80">Skin / Oranges</p>
                  </div>
                  <ToggleRow label="Protect Skin Tones" checked={setting.qualifier.protectSkin} onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, protectSkin: v } })} />
                  <ThreeWayControl<RangeIntent>
                    label="Saturation"
                    value={setting.qualifier.skinSat}
                    options={['cut', '降', 'neutral', '中', 'boost', '升']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, skinSat: v } })}
                  />
                  <ThreeWayControl<LumIntent>
                    label="Luminance"
                    value={setting.qualifier.skinLum}
                    options={['darken', '压暗', 'neutral', '中', 'brighten', '提亮']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, skinLum: v } })}
                  />
                </div>

                {/* Blues */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-blue-400" />
                    <p className="text-[9px] font-semibold text-blue-300/80">Blues / Sky</p>
                  </div>
                  <ThreeWayControl<RangeIntent>
                    label="Saturation"
                    value={setting.qualifier.bluesSat}
                    options={['cut', '降', 'neutral', '中', 'boost', '升']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, bluesSat: v } })}
                  />
                  <ThreeWayControl<LumIntent>
                    label="Luminance"
                    value={setting.qualifier.bluesLum}
                    options={['darken', '压暗', 'neutral', '中', 'brighten', '提亮']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, bluesLum: v } })}
                  />
                </div>

                {/* Greens */}
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-green-400" />
                    <p className="text-[9px] font-semibold text-green-300/80">Greens / Foliage</p>
                  </div>
                  <ThreeWayControl<RangeIntent>
                    label="Saturation"
                    value={setting.qualifier.greensSat}
                    options={['cut', '降', 'neutral', '中', 'boost', '升']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, greensSat: v } })}
                  />
                  <ThreeWayControl<LumIntent>
                    label="Luminance"
                    value={setting.qualifier.greensLum}
                    options={['darken', '压暗', 'neutral', '中', 'brighten', '提亮']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, greensLum: v } })}
                  />
                </div>

                {/* Neon */}
                <ToggleRow
                  label="Neon Accent Isolation"
                  checked={setting.qualifier.neonAccent}
                  onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, neonAccent: v } })}
                />
              </div>
            )}

            {/* ── Texture Tab ── */}
            {activeTab === 'texture' && (
              <div className="space-y-4">
                <p className="text-[8.5px] text-white/25">Texture · Grain · Optical FX · prompt-level only</p>

                {/* Sharpness */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-medium text-white/50">Sharpness 锐度</span>
                    <span className={`text-[9px] font-mono ${setting.texture.sharpness === 0 ? 'text-white/20' : 'text-indigo-300'}`}>
                      {setting.texture.sharpness > 0 ? `+${setting.texture.sharpness}` : setting.texture.sharpness}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-2} max={2} step={1}
                    value={setting.texture.sharpness}
                    onChange={(e) => patchSetting({ texture: { ...setting.texture, sharpness: Number(e.target.value) } })}
                    className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
                  />
                  <div className="flex justify-between text-[7.5px] text-white/20">
                    <span>Soft</span><span>Neutral</span><span>Sharp</span>
                  </div>
                </div>

                {/* Grain */}
                <div className="space-y-1.5">
                  <p className="text-[9px] font-medium text-white/50">Grain 颗粒感</p>
                  <div className="grid grid-cols-4 gap-1">
                    {(['none', 'fine', 'medium', 'heavy'] as GrainType[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => patchSetting({ texture: { ...setting.texture, grain: g } })}
                        className={`rounded-lg border py-1.5 text-[9px] transition ${setting.texture.grain === g ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200' : 'border-white/8 text-white/35 hover:border-white/16 hover:text-white/60'}`}
                      >
                        {g === 'none' ? '无' : g === 'fine' ? '细腻' : g === 'medium' ? '中等' : '重'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Effect rows */}
                {(
                  [
                    ['halation', 'Halation 光晕', setting.texture.halation],
                    ['glow', 'Glow 辉光', setting.texture.glow],
                    ['vignette', 'Vignette 暗角', setting.texture.vignette],
                  ] as [keyof typeof setting.texture, string, EffectLevel][]
                ).map(([key, label, val]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-[9px] font-medium text-white/50">{label}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(['none', 'subtle', 'strong'] as EffectLevel[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => patchSetting({ texture: { ...setting.texture, [key]: lv } })}
                          className={`rounded-lg border py-1.5 text-[9px] transition ${val === lv ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200' : 'border-white/8 text-white/35 hover:border-white/16 hover:text-white/60'}`}
                        >
                          {lv === 'none' ? '无' : lv === 'subtle' ? '轻微' : '强'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <ToggleRow
                  label="Clean Shadows 清洁暗部"
                  checked={setting.texture.cleanShadows}
                  onChange={(v) => patchSetting({ texture: { ...setting.texture, cleanShadows: v } })}
                />
              </div>
            )}

            {/* ── Output Tab ── */}
            {activeTab === 'output' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">Output Protection</p>
                  <p className="mt-0.5 text-[8px] italic text-white/20">All subject/composition locks are always on — cannot be disabled</p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2.5">
                  <p className="text-[9px] font-semibold text-emerald-400/80">Locked Safety Constraints</p>
                  <ToggleRow label="Subject Preservation" checked={true} locked />
                  <ToggleRow label="Face / Clothing Preservation" checked={true} locked />
                  <ToggleRow label="Product Shape Preservation" checked={true} locked />
                  <ToggleRow label="Composition Preservation" checked={true} locked />
                  <ToggleRow label="Avoid Overprocessed HDR" checked={true} locked />
                  <ToggleRow label="Avoid Plastic AI Texture" checked={true} locked />
                </div>

                <div className="rounded-xl border border-white/6 bg-white/2 p-3 space-y-1">
                  <p className="text-[9px] font-semibold text-white/40">Negative Constraints (always active)</p>
                  <p className="text-[8.5px] leading-relaxed text-white/25">
                    No face change · No product redesign · No scene replacement ·
                    No lighting direction change · No new unrelated colors ·
                    No composition change
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Prompt Preview (collapsible) */}
          <div className="border-t border-white/6">
            <button
              type="button"
              onClick={() => setShowPromptPreview((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/3 transition"
            >
              <span className="text-[8.5px] font-semibold uppercase tracking-widest text-white/30">Prompt Preview</span>
              {showPromptPreview ? <ChevronUp size={12} className="text-white/25" /> : <ChevronDown size={12} className="text-white/25" />}
            </button>
            {showPromptPreview && (
              <div className="border-t border-white/6 px-3 pb-3 pt-2">
                {skippedNodes.length > 0 && (
                  <div className="mb-2 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                    <p className="text-[9px] font-semibold text-amber-400/90">部分节点已有调色段落，MVP 跳过</p>
                    <p className="text-[8px] text-amber-300/60">手动删除旧 [Color Grade Palette] 后再应用</p>
                  </div>
                )}
                {previewText ? (
                  <textarea
                    readOnly
                    value={previewText}
                    className="w-full resize-none rounded-xl border border-white/8 bg-white/3 p-2.5 font-mono text-[8.5px] leading-relaxed text-white/50 focus:outline-none"
                    rows={10}
                  />
                ) : (
                  <p className="text-[9px] text-white/25">先点击【生成调色预览】查看 Prompt 内容</p>
                )}
              </div>
            )}
          </div>

          {/* Apply success */}
          {applySuccess && (
            <div className="mx-3 mb-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-400">✅ 已追加调色描述 — 请重新生成查看效果</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer Apply Bar ── */}
      <div className="border-t border-white/8 px-3 py-2.5 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview}
            className="flex-1 rounded-xl border border-indigo-500/40 bg-indigo-500/15 py-2 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            生成调色预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            追加到 Prompt
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setSetting(createDefaultColorGradeSetting()); setPreviewText(null); setPreviewResults(null); setApplySuccess(false) }}
            className="flex-1 rounded-xl border border-white/8 bg-white/3 py-1.5 text-[10px] text-white/40 transition hover:bg-white/6 hover:text-white/60"
          >
            重置调色
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/3 py-1.5 text-[10px] text-white/40 transition hover:bg-white/6 hover:text-white/60"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            {copied ? '已复制' : '复制报告'}
          </button>
        </div>
      </div>
    </div>
  )
}
