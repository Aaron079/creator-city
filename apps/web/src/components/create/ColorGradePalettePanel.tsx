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
  buildPreviewCssFilter,
  type ColorGradePresetId,
  type ColorGradeSetting,
  type WheelSetting,
  type ContrastCurve,
  type RgbBias,
  type GreensIntent,
  type BluesIntent,
  type NeonAccent,
} from '@/lib/canvas/color-grade-palette'

interface GradeNode {
  id: string
  kind: string
  title?: string | null
  prompt?: string | null
  status?: string | null
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
}

interface ColorGradePalettePanelProps {
  nodes: GradeNode[]
  onApplyGrade: (updates: Array<{ nodeId: string; prompt: string }>) => void
  onClose: () => void
  defaultSelectedNodeId?: string
}

type ActiveTab = 'wheels' | 'curves' | 'qualifier' | 'texture' | 'output'

// ─── Color Wheel Visual ───────────────────────────────────────────────────────
// Axes: right = warm (+temp), left = cool (−temp), top = magenta (+tint), bottom = green (−tint)
// Units: temperature/tint are -1 to +1 (ASC CDL-aligned)

function ColorWheel({
  wheel,
  size = 92,
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
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
    const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
    // Non-linear sensitivity: gentler near center, more precise at edges
    const rawDist = Math.sqrt(dx * dx + dy * dy)
    const dist = Math.min(1, Math.pow(rawDist, 0.8))
    const angle = Math.atan2(dy, dx)
    const temperature = parseFloat((Math.cos(angle) * dist).toFixed(2))
    const tint = parseFloat((-Math.sin(angle) * dist).toFixed(2))
    onChange({ temperature, tint })
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

  // Puck position: temperature drives x, tint drives y (inverted — up = +magenta)
  const dotX = 50 + wheel.temperature * 38
  const dotY = 50 - wheel.tint * 38
  const isNeutral = Math.abs(wheel.temperature) < 0.01 && Math.abs(wheel.tint) < 0.01

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={divRef}
        className="relative flex-shrink-0 cursor-crosshair select-none rounded-full border border-white/10"
        style={{
          width: size,
          height: size,
          background: `
            radial-gradient(circle, rgba(6,8,14,0.55) 0%, transparent 22%),
            radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 52%),
            conic-gradient(
              hsl(300,78%,52%) 0deg,
              hsl(345,80%,55%) 45deg,
              hsl(30,86%,54%)  90deg,
              hsl(75,78%,49%)  135deg,
              hsl(120,73%,44%) 180deg,
              hsl(165,76%,45%) 225deg,
              hsl(210,80%,52%) 270deg,
              hsl(255,78%,54%) 315deg,
              hsl(300,78%,52%) 360deg
            )
          `,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Crosshair guides */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
        </svg>

        {/* Puck */}
        <div
          className="pointer-events-none absolute rounded-full ring-[1.5px] ring-black/60"
          style={{
            width: 11, height: 11,
            left: `${dotX}%`, top: `${dotY}%`,
            transform: 'translate(-50%, -50%)',
            background: isNeutral ? 'rgba(255,255,255,0.5)' : 'white',
            boxShadow: isNeutral
              ? '0 0 4px rgba(0,0,0,0.5)'
              : '0 0 0 1px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.95)',
          }}
        />

        {/* Reset button — visible only when off-center */}
        {!isNeutral && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange({ temperature: 0, tint: 0 }) }}
            className="absolute bottom-0.5 right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-black/75 text-[8px] text-white/55 transition hover:bg-black hover:text-white/90"
          >
            ↺
          </button>
        )}
      </div>

      {/* Axis legend */}
      <div className="flex w-full items-center justify-between px-0.5 text-[6px] text-white/18">
        <span>◀ Cool</span>
        <span className="text-white/10">Drag</span>
        <span>Warm ▶</span>
      </div>
    </div>
  )
}

// ─── Slider Row ───────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step,
  leftLabel, rightLabel, trackColor, onChange,
  valueText, isActive,
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
  valueText: string
  isActive: boolean
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-medium text-white/35">{label}</span>
        <span className={`text-[8px] font-mono ${isActive ? 'text-indigo-300' : 'text-white/20'}`}>
          {valueText}
        </span>
      </div>
      <div className="relative flex items-center gap-1">
        <span className="w-5 text-[6.5px] text-white/18 text-right leading-none">{leftLabel}</span>
        <div className="relative flex-1">
          <div
            className="absolute top-1/2 h-[2.5px] w-full -translate-y-1/2 rounded-full opacity-35"
            style={{ background: trackColor }}
          />
          <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="relative w-full cursor-pointer appearance-none bg-transparent
              [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:w-2.5
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:border
              [&::-webkit-slider-thumb]:border-white/25
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:shadow-sm"
          />
        </div>
        <span className="w-5 text-[6.5px] text-white/18 leading-none">{rightLabel}</span>
      </div>
    </div>
  )
}

// ─── Wheel Card ───────────────────────────────────────────────────────────────

function WheelCard({
  label, labelZh, wheel, onChange,
}: {
  label: string
  labelZh: string
  wheel: WheelSetting
  onChange: (patch: Partial<WheelSetting>) => void
}) {
  const fmtAxis = (v: number) => v === 0 ? '0.00' : (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/7 bg-white/[0.02] p-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-widest text-white/55">{label}</span>
        <span className="text-[8px] text-white/28">{labelZh}</span>
      </div>

      <ColorWheel wheel={wheel} size={92} onChange={onChange} />

      <SliderRow
        label="Temp"
        value={wheel.temperature} min={-1} max={1} step={0.05}
        leftLabel="Cool" rightLabel="Warm"
        trackColor="linear-gradient(90deg, #4488ff, #555, #ff8833)"
        onChange={(v) => onChange({ temperature: v })}
        valueText={fmtAxis(wheel.temperature)}
        isActive={wheel.temperature !== 0}
      />
      <SliderRow
        label="Tint"
        value={wheel.tint} min={-1} max={1} step={0.05}
        leftLabel="Green" rightLabel="Mag"
        trackColor="linear-gradient(90deg, #22cc44, #555, #cc44aa)"
        onChange={(v) => onChange({ tint: v })}
        valueText={fmtAxis(wheel.tint)}
        isActive={wheel.tint !== 0}
      />
      <SliderRow
        label="Lum"
        value={wheel.luminance} min={-1} max={1} step={0.05}
        leftLabel="Dark" rightLabel="Bright"
        trackColor="linear-gradient(90deg, #111, #555, #eee)"
        onChange={(v) => onChange({ luminance: v })}
        valueText={fmtAxis(wheel.luminance)}
        isActive={wheel.luminance !== 0}
      />
      <SliderRow
        label="Sat"
        value={wheel.saturation} min={0} max={4} step={0.05}
        leftLabel="0.0" rightLabel="4.0"
        trackColor="linear-gradient(90deg, #333, #999 25%, #ff5533)"
        onChange={(v) => onChange({ saturation: parseFloat(v.toFixed(2)) })}
        valueText={`${wheel.saturation.toFixed(2)}×`}
        isActive={Math.abs(wheel.saturation - 1.0) > 0.01}
      />
    </div>
  )
}

// ─── Curve SVG ────────────────────────────────────────────────────────────────

const CURVE_PATHS: Record<ContrastCurve, string> = {
  'neutral': 'M 0 100 L 100 0',
  'gentle-s-curve': 'M 0 100 C 20 90, 30 60, 50 50 C 70 40, 80 10, 100 0',
  'standard-s-curve': 'M 0 100 C 15 95, 25 70, 50 50 C 75 30, 85 5, 100 0',
  'steep-s-curve': 'M 0 100 C 10 98, 20 80, 50 50 C 80 20, 90 2, 100 0',
  'lifted-blacks-film-curve': 'M 0 84 C 15 80, 30 64, 50 47 C 70 30, 85 5, 100 0',
}

const RGB_BIAS_COLORS: Record<RgbBias, { shadow: string; highlight: string }> = {
  'neutral': { shadow: '#777', highlight: '#777' },
  'warm-highlights-cool-shadows': { shadow: '#4488ff', highlight: '#ff8833' },
  'cool-highlights-warm-shadows': { shadow: '#ff8833', highlight: '#44aaff' },
  'green-shadows-magenta-highlights': { shadow: '#44cc66', highlight: '#cc44aa' },
}

function CurveSVG({ contrastCurve, rgbBias }: { contrastCurve: ContrastCurve; rgbBias: RgbBias }) {
  const path = CURVE_PATHS[contrastCurve]
  const bias = RGB_BIAS_COLORS[rgbBias]
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      <line x1="25" y1="0" x2="25" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      <line x1="75" y1="0" x2="75" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
      <circle cx="7" cy="93" r="4.5" fill={bias.shadow} opacity="0.75" />
      <circle cx="93" cy="7" r="4.5" fill={bias.highlight} opacity="0.75" />
      {contrastCurve !== 'neutral' && (
        <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8" strokeDasharray="3,3" />
      )}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ToggleRow({
  label, checked, onChange, locked = false,
}: { label: string; checked: boolean; onChange?: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {locked && <Lock size={9} className="text-emerald-400/55" />}
        <span className="text-[9.5px] text-white/55">{label}</span>
      </div>
      <button
        type="button"
        disabled={locked}
        onClick={() => onChange?.(!checked)}
        className={`relative h-4 w-7 rounded-full transition ${checked ? 'bg-emerald-500/65' : 'bg-white/10'} ${locked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '14px' : '2px' }}
        />
      </button>
    </div>
  )
}

function ThreeWayControl<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: readonly [T, string, T, string, T, string]; onChange: (v: T) => void }) {
  const pairs: [T, string][] = [
    [options[0], options[1]],
    [options[2], options[3]],
    [options[4], options[5]],
  ]
  return (
    <div className="space-y-0.5">
      <span className="text-[8.5px] text-white/38">{label}</span>
      <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-white/7 p-0.5">
        {pairs.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded py-1 text-[8.5px] transition ${value === v ? 'bg-indigo-500/28 text-indigo-200 font-medium' : 'text-white/32 hover:bg-white/5 hover:text-white/58'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextureSlider({
  label, value, min, max, trackColor, onChange,
}: { label: string; value: number; min: number; max: number; trackColor: string; onChange: (v: number) => void }) {
  const isActive = value !== 0
  const displayVal = min < 0
    ? (value > 0 ? `+${value}` : String(value))
    : String(value)
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium text-white/45">{label}</span>
        <span className={`text-[8.5px] font-mono ${isActive ? 'text-indigo-300' : 'text-white/20'}`}>{displayVal}</span>
      </div>
      <div className="relative">
        <div
          className="absolute top-1/2 h-[2.5px] w-full -translate-y-1/2 rounded-full opacity-30"
          style={{ background: trackColor }}
        />
        <input
          type="range" min={min} max={max} step={min < 0 ? 5 : 5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border
            [&::-webkit-slider-thumb]:border-white/25
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>
    </div>
  )
}

// ─── Preview Monitor ─────────────────────────────────────────────────────────
// Large side monitor with CSS-filter-based live preview.
// Applies CSS filter to img/video for instant visual feedback while dragging.
// Preview-only: does NOT modify original assets, no pixel output, no API.

function PreviewMonitor({
  node,
  cssFilter,
  onClose,
}: {
  node: GradeNode | null
  cssFilter: string
  onClose: () => void
}) {
  const hasImage = Boolean(node?.resultImageUrl?.trim())
  const hasVideo = Boolean(node?.resultVideoUrl?.trim())
  const hasMedia = hasImage || hasVideo
  const filterActive = cssFilter !== 'none'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#06080d]">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-3 py-2">
        <div>
          <p className="text-[8px] font-bold uppercase tracking-widest text-white/35">Preview Monitor</p>
          <p className="text-[6.5px] text-white/18">CSS filter approx · 非最终输出 · 不修改原资产</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-white/28 transition hover:bg-white/8 hover:text-white/65"
        >
          <X size={12} strokeWidth={2.2} />
        </button>
      </div>

      {/* Media area — flex-1 so it fills the resizable panel */}
      <div className="relative flex-1 overflow-hidden bg-black" style={{ minHeight: 200 }}>
        {hasImage && (
          <img
            src={node!.resultImageUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{ filter: filterActive ? cssFilter : undefined, transition: 'filter 80ms ease' }}
          />
        )}
        {hasVideo && !hasImage && (
          <video
            src={node!.resultVideoUrl!}
            controls
            muted
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain"
            style={{ filter: filterActive ? cssFilter : undefined, transition: 'filter 80ms ease' }}
          />
        )}
        {!hasMedia && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <span className={`text-[18px] font-bold opacity-25 ${node?.kind === 'image' ? 'text-sky-400' : node?.kind === 'video' ? 'text-violet-400' : 'text-white'}`}>
              {node?.kind === 'image' ? 'IMG' : node?.kind === 'video' ? 'VID' : '—'}
            </span>
            <p className="text-[9px] leading-relaxed text-white/35">
              当前节点暂无可预览资产<br />
              仍可追加调色 Prompt<br />
              重新生成后生效
            </p>
          </div>
        )}

        {/* Overlay: filter value + safety label */}
        {hasMedia && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-end gap-1">
            <span className="rounded bg-black/80 px-2 py-[3px] text-[6.5px] font-semibold text-amber-300/90">
              Preview filter only · 非最终输出
            </span>
            {filterActive ? (
              <span className="max-w-full truncate rounded bg-indigo-950/85 px-1.5 py-[3px] font-mono text-[6px] text-indigo-300/80">
                {cssFilter}
              </span>
            ) : (
              <span className="rounded bg-white/5 px-1.5 py-[3px] text-[6px] text-white/25">
                neutral (no filter)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex-shrink-0 space-y-1 border-t border-white/5 px-3 py-2">
        {node && (
          <div className="flex items-center gap-1.5">
            <span className={`flex-shrink-0 rounded px-1 py-[1px] text-[6px] font-bold ${node.kind === 'image' ? 'bg-sky-900/80 text-sky-300' : 'bg-violet-900/80 text-violet-300'}`}>
              {node.kind === 'image' ? 'IMG' : 'VID'}
            </span>
            {node.status && (
              <span className={`flex-shrink-0 text-[7px] ${node.status === 'done' ? 'text-emerald-400/65' : node.status === 'error' || node.status === 'failed' ? 'text-red-400/55' : 'text-white/22'}`}>
                {node.status}
              </span>
            )}
            <span className="min-w-0 truncate text-[8px] font-medium text-white/55">
              {node.title ?? (node.kind === 'image' ? '图片节点' : '视频节点')}
            </span>
          </div>
        )}
        <p className={`text-[6.5px] ${filterActive ? 'text-indigo-300/50' : 'text-white/18'}`}>
          拖动色轮 / slider 即时刷新预览，不会修改原资产，追加 Prompt 后需重新生成才生效。
        </p>
        <p className="text-[6px] italic text-white/15">
          Preview Mode: CSS filter approximation · Intent monitor only — no pixel analysis<br />
          右侧画面仅为浏览器近似预览，真实生成效果以重新生成后的模型输出为准。
        </p>
        <p className="text-[6px] text-white/18">
          ↘ 可拖拽右下角调整预览大小
        </p>
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
  const [showPreview, setShowPreview] = useState(true)

  const eligibleNodes = useMemo(
    () => nodes.filter((n) => n.kind === 'image' || n.kind === 'video'),
    [nodes],
  )

  // Initialize selection once on mount
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

  // The primary node is the first selected node (or the defaultSelectedNodeId fallback).
  // This drives the NodeTargetBanner and the intent monitor.
  const primaryNode = useMemo(
    () => eligibleNodes.find((n) => n.id === (selectedNodeIds[0] ?? defaultSelectedNodeId)) ?? null,
    [eligibleNodes, selectedNodeIds, defaultSelectedNodeId],
  )

  // CSS filter for live preview — recomputed on every setting change (wheel drag / slider)
  const cssFilter = useMemo(() => buildPreviewCssFilter(setting), [setting])

  const resetPreview = () => {
    setPreviewText(null)
    setPreviewResults(null)
    setApplySuccess(false)
  }

  const patchSetting = useCallback((patch: Partial<ColorGradeSetting>) => {
    setSetting((prev) => ({ ...prev, ...patch, presetId: 'none' }))
    resetPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchWheel = useCallback((wheel: 'lift' | 'gamma' | 'gain' | 'offset', patch: Partial<WheelSetting>) => {
    setSetting((prev) => ({ ...prev, presetId: 'none', [wheel]: { ...prev[wheel], ...patch } }))
    resetPreview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPreset = (presetId: ColorGradePresetId) => {
    setSetting(applyColorGradePreset(presetId))
    resetPreview()
  }

  const toggleNode = (id: string) => {
    setSelectedNodeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
    resetPreview()
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

  // Intent Monitor derived values
  const avgLum = (setting.lift.luminance + setting.gamma.luminance + setting.gain.luminance) / 3
  const avgTemp = (setting.lift.temperature + setting.gamma.temperature + setting.gain.temperature) / 3
  const avgSat = (setting.lift.saturation + setting.gamma.saturation + setting.gain.saturation) / 3
  const activeWheels = (['lift', 'gamma', 'gain', 'offset'] as const).filter((w) => {
    const wh = setting[w]
    return wh.temperature !== 0 || wh.tint !== 0 || wh.luminance !== 0 || Math.abs(wh.saturation - 1) > 0.01
  }).length

  const TABS: { id: ActiveTab; label: string; zh: string }[] = [
    { id: 'wheels', label: 'Wheels', zh: '色轮' },
    { id: 'curves', label: 'Curves', zh: '曲线' },
    { id: 'qualifier', label: 'Qualifier', zh: 'HSL' },
    { id: 'texture', label: 'Texture', zh: '纹理' },
    { id: 'output', label: 'Output', zh: '输出' },
  ]

  return (
    <>
    <div
      className="fixed left-[80px] top-1/2 z-[1200] flex max-h-[92vh] w-[720px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e13]/98 shadow-2xl backdrop-blur-xl"
      data-no-node-drag="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-white/7 px-4 pb-2.5 pt-3">
        <div>
          <p className="text-[8.5px] font-semibold uppercase tracking-widest text-white/22">后期套件 · Color Page</p>
          <h2 className="mt-0.5 text-[13px] font-bold tracking-tight text-white/90">Color Grade Palette</h2>
          {primaryNode ? (
            <p className="text-[8.5px] text-indigo-300/65">
              正在为当前节点创建调色指令：<span className="font-semibold">{primaryNode.title ?? (primaryNode.kind === 'image' ? '图片节点' : '视频节点')}</span>
            </p>
          ) : (
            <p className="text-[8.5px] text-white/30">调色盘 · Prompt-level grading · 非像素级调色</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`rounded-lg px-2 py-1 text-[9px] font-semibold transition ${showPreview ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-white/35 hover:bg-white/10 hover:text-white/60'}`}
          >
            {showPreview ? '关闭预览' : '打开预览'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-lg p-1.5 text-white/28 transition hover:bg-white/8 hover:text-white/68"
          >
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* ── Gallery Strip (preset chips) ── */}
      <div className="border-b border-white/5 px-3 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <span className="mr-1 flex-shrink-0 text-[7.5px] font-semibold uppercase tracking-widest text-white/20">Stills</span>
          <button
            type="button"
            onClick={() => applyPreset('none')}
            className={`flex-shrink-0 rounded-md border px-2 py-0.5 text-[8.5px] font-medium transition ${setting.presetId === 'none' ? 'border-white/28 bg-white/9 text-white/75' : 'border-white/7 text-white/30 hover:border-white/15 hover:text-white/55'}`}
          >
            Manual
          </button>
          {COLOR_GRADE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`flex-shrink-0 overflow-hidden rounded-md border px-2 py-0.5 transition ${setting.presetId === p.id ? 'border-indigo-500/55 bg-indigo-500/13 text-indigo-200' : 'border-white/7 text-white/35 hover:border-white/14 hover:text-white/60'}`}
            >
              <div className="mb-0.5 h-[2px] w-full rounded-full" style={{ background: p.accentColor }} />
              <span className="block text-[8.5px] font-medium leading-none">{p.nameZh}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: 2-column (Left: Clip Strip / Right: Controls) ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Left: Clip Strip (secondary — for switching target) ── */}
        <div className="flex w-[132px] flex-shrink-0 flex-col border-r border-white/5">
          <div className="border-b border-white/5 px-2.5 py-1.5">
            <p className="text-[7px] font-bold uppercase tracking-widest text-white/22">项目素材 / 切换</p>
            <p className="mt-0.5 text-[6px] text-white/16">可切换调色目标</p>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-1.5 py-1.5">
            {eligibleNodes.length === 0 && (
              <p className="px-1 text-[8.5px] leading-relaxed text-white/28">无图片/视频节点</p>
            )}
            {eligibleNodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id)
              const isDefault = node.id === defaultSelectedNodeId
              const hasGrade = hasColorGradePrompt(node.prompt ?? '')
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => toggleNode(node.id)}
                  className={`w-full rounded-lg border px-1.5 py-1.5 text-left transition ${isSelected ? 'border-indigo-500/45 bg-indigo-500/10' : 'border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]'}`}
                >
                  <div className={`mb-1 flex h-9 w-full items-center justify-center rounded border ${isSelected ? 'border-indigo-500/28 bg-indigo-500/7' : 'border-white/5 bg-white/3'}`}>
                    <span className={`text-[8px] font-bold ${node.kind === 'image' ? 'text-sky-400/55' : 'text-violet-400/55'}`}>
                      {node.kind === 'image' ? 'IMG' : 'VID'}
                    </span>
                  </div>
                  <p className="truncate text-[8.5px] font-medium text-white/65">
                    {node.title ?? (node.kind === 'image' ? '图片节点' : '视频节点')}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {isDefault && <span className="text-[6px] font-semibold text-indigo-400/80">当前目标</span>}
                    {!isDefault && isSelected && <span className="text-[6px] text-indigo-400/60">● 已选</span>}
                    {hasGrade && <span className="text-[6px] text-amber-400/70">已调色</span>}
                  </div>
                </button>
              )
            })}
            {eligibleNodes.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedNodeIds(eligibleNodes.map((n) => n.id))}
                className="w-full rounded-lg border border-white/5 py-1 text-[7.5px] text-white/28 transition hover:border-white/12 hover:text-white/50"
              >
                批量全选 {eligibleNodes.length} 个
              </button>
            )}
          </div>
        </div>

        {/* ── Center + Right ── */}
        <div className="flex min-w-0 flex-1 flex-col">

          {/* Intent Monitor strip */}
          <div className="border-b border-white/5 bg-[#09090d] px-3 py-1.5">
            <div className="flex items-center justify-between gap-4">
              <p className="flex-shrink-0 text-[6.5px] font-bold uppercase tracking-widest text-white/18">
                Intent Monitor — no pixel analysis · Preview: CSS filter approx
              </p>
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Waveform intent bar */}
                <div className="flex items-center gap-1">
                  <div className="flex h-3 w-12 items-end gap-px overflow-hidden rounded-sm bg-black/40 px-0.5 py-0.5">
                    {[0.2, 0.4, 0.6, 0.3, 0.7, 0.5, 0.8, 0.4].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${h * 100}%`,
                          background: avgLum < -0.15 ? '#4a5568' : avgLum > 0.15 ? '#e2e8f0' : '#718096',
                          opacity: 0.7 + h * 0.3,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[6.5px] text-white/20">
                    {avgLum < -0.15 ? 'Dark' : avgLum > 0.15 ? 'Bright' : 'Balanced'}
                  </span>
                </div>

                {/* Vectorscope dot */}
                <div className="flex items-center gap-1">
                  <div
                    className="h-3 w-3 rounded-full border border-white/10"
                    style={{
                      background: avgTemp < -0.15 ? '#4488ff' : avgTemp > 0.15 ? '#ff8833' : '#666',
                    }}
                  />
                  <span className="text-[6.5px] text-white/20">
                    {avgTemp < -0.15 ? 'Cool' : avgTemp > 0.15 ? 'Warm' : 'Neutral'}
                  </span>
                </div>

                {/* Saturation meter */}
                <div className="flex items-center gap-1">
                  <div className="h-2 w-10 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (avgSat / 2) * 100)}%`,
                        background: avgSat < 0.8 ? '#6366f1' : avgSat > 1.4 ? '#f87171' : '#818cf8',
                      }}
                    />
                  </div>
                  <span className="text-[6.5px] text-white/20">
                    {avgSat < 0.8 ? 'Muted' : avgSat > 1.4 ? 'Vivid' : 'Neutral Sat'}
                  </span>
                </div>

                {/* Skin + wheels */}
                <div className="flex items-center gap-2">
                  <span className={`text-[6.5px] font-semibold ${setting.qualifier.protectSkin ? 'text-emerald-400/65' : 'text-white/18'}`}>
                    Skin {setting.qualifier.protectSkin ? 'ON' : 'OFF'}
                  </span>
                  <span className="text-[6.5px] text-white/18">{activeWheels}/4 wheels</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-1.5 text-center transition ${activeTab === tab.id ? 'border-b-2 border-indigo-400 text-indigo-300' : 'text-white/30 hover:text-white/55'}`}
              >
                <span className="block text-[9px] font-semibold">{tab.label}</span>
                <span className="block text-[7px] text-current opacity-60">{tab.zh}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3">

            {/* ── Wheels Tab ── */}
            {activeTab === 'wheels' && (
              <div className="space-y-3">
                <p className="text-[8px] text-white/22">
                  Primary correction · ASC CDL-aligned · Lift (shadows) / Gamma (midtones) / Gain (highlights) / Offset (global)
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
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-white/28">Tone Curve</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-sm" style={{ background: RGB_BIAS_COLORS[setting.curves.rgbBias].shadow }} />
                        <span className="text-[7px] text-white/25">Shadow</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-sm" style={{ background: RGB_BIAS_COLORS[setting.curves.rgbBias].highlight }} />
                        <span className="text-[7px] text-white/25">Highlight</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-36 w-full rounded-xl border border-white/7 bg-[#070810] p-2">
                    <CurveSVG contrastCurve={setting.curves.contrastCurve} rgbBias={setting.curves.rgbBias} />
                  </div>
                </div>

                {/* Curve shape selector */}
                <div className="space-y-1.5">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-white/28">Contrast Curve</p>
                  {(
                    [
                      ['neutral', '线性 Neutral', '无曲线，线性输出'],
                      ['gentle-s-curve', 'Gentle S-Curve', '轻柔对比，自然层次'],
                      ['standard-s-curve', 'Standard S-Curve', '电影感S曲线，标准调性'],
                      ['steep-s-curve', 'Steep S-Curve', '陡峭高对比，戏剧结构'],
                      ['lifted-blacks-film-curve', 'Lifted Blacks Film Curve', '黑位提升+胶片S，开放阴影'],
                    ] as [ContrastCurve, string, string][]
                  ).map(([v, l, d]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchSetting({ curves: { ...setting.curves, contrastCurve: v } })}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${setting.curves.contrastCurve === v ? 'border-indigo-500/45 bg-indigo-500/10' : 'border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/4'}`}
                    >
                      <div className={`h-3 w-3 flex-shrink-0 rounded-full border flex items-center justify-center ${setting.curves.contrastCurve === v ? 'border-indigo-400 bg-indigo-500/28' : 'border-white/18'}`}>
                        {setting.curves.contrastCurve === v && <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />}
                      </div>
                      <div>
                        <p className="text-[9.5px] font-medium text-white/75">{l}</p>
                        <p className="text-[7.5px] text-white/30">{d}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* RGB Bias */}
                <div className="space-y-1.5">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-white/28">RGB Bias / 色彩偏向</p>
                  {(
                    [
                      ['neutral', 'Neutral', '无色彩偏向'],
                      ['warm-highlights-cool-shadows', 'Warm Highlights / Cool Shadows', '暖色高光 + 冷色阴影'],
                      ['cool-highlights-warm-shadows', 'Cool Highlights / Warm Shadows', '冷色高光 + 暖色阴影'],
                      ['green-shadows-magenta-highlights', 'Green Shadows / Magenta Highlights', '绿色阴影 + 洋红高光'],
                    ] as [RgbBias, string, string][]
                  ).map(([v, l, d]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => patchSetting({ curves: { ...setting.curves, rgbBias: v } })}
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${setting.curves.rgbBias === v ? 'border-indigo-500/45 bg-indigo-500/10' : 'border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/4'}`}
                    >
                      <div className="flex flex-shrink-0 gap-0.5">
                        <div className="h-3 w-3 rounded-sm" style={{ background: RGB_BIAS_COLORS[v].shadow }} />
                        <div className="h-3 w-3 rounded-sm" style={{ background: RGB_BIAS_COLORS[v].highlight }} />
                      </div>
                      <div>
                        <p className="text-[9.5px] font-medium text-white/75">{l}</p>
                        <p className="text-[7.5px] text-white/30">{d}</p>
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
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-white/28">HSL Qualifier Intent</p>
                  <p className="mt-0.5 text-[7.5px] italic text-white/18">Prompt-level only — not a real pixel qualifier</p>
                </div>

                {/* Color range reference bars */}
                <div className="space-y-1">
                  <p className="text-[7.5px] text-white/22">Color Range Reference</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {[
                      { color: '#cc2222', label: 'Reds' },
                      { color: '#dd7722', label: 'Oranges / Skin' },
                      { color: '#cccc22', label: 'Yellows' },
                      { color: '#22aa44', label: 'Greens' },
                      { color: '#22aacc', label: 'Cyans' },
                      { color: '#2244cc', label: 'Blues' },
                      { color: '#aa44cc', label: 'Magentas' },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-[8px] text-white/40">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skin protection */}
                <div className="rounded-xl border border-orange-500/18 bg-orange-500/[0.04] p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-orange-400" />
                    <p className="text-[8.5px] font-semibold text-orange-300/75">Skin / Oranges</p>
                  </div>
                  <ToggleRow
                    label="Protect Skin Tones"
                    checked={setting.qualifier.protectSkin}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, protectSkin: v } })}
                  />
                </div>

                {/* Greens */}
                <div className="rounded-xl border border-green-500/18 bg-green-500/[0.04] p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-green-400" />
                    <p className="text-[8.5px] font-semibold text-green-300/75">Greens / Foliage</p>
                  </div>
                  <ThreeWayControl<GreensIntent>
                    label="Treatment"
                    value={setting.qualifier.greens}
                    options={['reduce', '减饱和', 'neutral', '自然', 'boost', '增饱和']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, greens: v } })}
                  />
                </div>

                {/* Blues */}
                <div className="rounded-xl border border-blue-500/18 bg-blue-500/[0.04] p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-sm bg-blue-400" />
                    <p className="text-[8.5px] font-semibold text-blue-300/75">Blues / Sky</p>
                  </div>
                  <ThreeWayControl<BluesIntent>
                    label="Treatment"
                    value={setting.qualifier.blues}
                    options={['deepen', '加深', 'neutral', '自然', 'brighten', '提亮']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, blues: v } })}
                  />
                </div>

                {/* Neon accent */}
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-semibold text-white/38">Neon Accent</p>
                  <ThreeWayControl<NeonAccent>
                    label="Mode"
                    value={setting.qualifier.neonAccent}
                    options={['off', '关', 'isolate', '隔离', 'boost', '增强']}
                    onChange={(v) => patchSetting({ qualifier: { ...setting.qualifier, neonAccent: v } })}
                  />
                </div>
              </div>
            )}

            {/* ── Texture Tab ── */}
            {activeTab === 'texture' && (
              <div className="space-y-3.5">
                <p className="text-[8px] text-white/22">Texture · Grain · Optical FX — prompt-level, no pixel processing</p>

                <div className="space-y-3 rounded-xl border border-white/7 bg-white/[0.015] p-3">
                  <p className="text-[7.5px] font-semibold uppercase tracking-widest text-white/25">Clarity</p>
                  <TextureSlider
                    label="Sharpness 锐度" value={setting.texture.sharpness} min={-100} max={100}
                    trackColor="linear-gradient(90deg, #6366f1, #555, #e2e8f0)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, sharpness: v } })}
                  />
                  <TextureSlider
                    label="Midtone Detail 中调细节" value={setting.texture.midtoneDetail} min={-100} max={100}
                    trackColor="linear-gradient(90deg, #818cf8, #555, #c7d2fe)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, midtoneDetail: v } })}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-white/7 bg-white/[0.015] p-3">
                  <p className="text-[7.5px] font-semibold uppercase tracking-widest text-white/25">Optical FX</p>
                  <TextureSlider
                    label="Grain 颗粒感" value={setting.texture.grain} min={0} max={100}
                    trackColor="linear-gradient(90deg, #333, #aaa)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, grain: v } })}
                  />
                  <TextureSlider
                    label="Halation 光晕" value={setting.texture.halation} min={0} max={100}
                    trackColor="linear-gradient(90deg, #333, #ff8833)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, halation: v } })}
                  />
                  <TextureSlider
                    label="Glow 辉光" value={setting.texture.glow} min={0} max={100}
                    trackColor="linear-gradient(90deg, #333, #ede9fe)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, glow: v } })}
                  />
                  <TextureSlider
                    label="Vignette 暗角" value={setting.texture.vignette} min={0} max={100}
                    trackColor="linear-gradient(90deg, #111, #444)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, vignette: v } })}
                  />
                  <TextureSlider
                    label="Clean Shadows 净化暗部" value={setting.texture.cleanShadows} min={0} max={100}
                    trackColor="linear-gradient(90deg, #1a1a2e, #4a4a6a)"
                    onChange={(v) => patchSetting({ texture: { ...setting.texture, cleanShadows: v } })}
                  />
                </div>
              </div>
            )}

            {/* ── Output Tab ── */}
            {activeTab === 'output' && (
              <div className="space-y-4">
                <div>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-white/28">Output Protection</p>
                  <p className="mt-0.5 text-[7.5px] italic text-white/18">All subject/composition locks are always active — cannot be disabled</p>
                </div>

                <div className="rounded-xl border border-emerald-500/18 bg-emerald-500/[0.04] p-3 space-y-2.5">
                  <p className="text-[8.5px] font-semibold text-emerald-400/75">Locked Safety Constraints</p>
                  <ToggleRow label="Subject Preservation" checked={true} locked />
                  <ToggleRow label="Face / Clothing Preservation" checked={true} locked />
                  <ToggleRow label="Product Shape Preservation" checked={true} locked />
                  <ToggleRow label="Composition Preservation" checked={true} locked />
                  <ToggleRow label="Avoid Overprocessed HDR" checked={true} locked />
                  <ToggleRow label="Avoid Plastic AI Texture" checked={true} locked />
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3 space-y-1">
                  <p className="text-[8.5px] font-semibold text-white/38">Negative Constraints (always active)</p>
                  <p className="text-[8px] leading-relaxed text-white/22">
                    No face change · No product redesign · No scene replacement ·
                    No lighting direction change · No new unrelated colors ·
                    No composition change
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3 space-y-1">
                  <p className="text-[8.5px] font-semibold text-white/38">Future Engine Path</p>
                  <p className="text-[8px] leading-relaxed text-white/22">
                    Current: Prompt-level grading only<br />
                    Tool 12.5: WebGL / LUT preview<br />
                    Tool 13: FFmpeg worker + LUT3D<br />
                    Long-term: OpenColorIO / AI LUT generation
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Prompt Preview (collapsible) */}
          <div className="border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowPromptPreview((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-1.5 transition hover:bg-white/[0.02]"
            >
              <span className="text-[7.5px] font-semibold uppercase tracking-widest text-white/25">Prompt Preview</span>
              {showPromptPreview ? <ChevronUp size={11} className="text-white/22" /> : <ChevronDown size={11} className="text-white/22" />}
            </button>
            {showPromptPreview && (
              <div className="border-t border-white/5 px-3 pb-3 pt-2">
                {skippedNodes.length > 0 && (
                  <div className="mb-2 rounded-xl border border-amber-500/18 bg-amber-500/7 px-3 py-2">
                    <p className="text-[8.5px] font-semibold text-amber-400/85">部分节点已有调色段落，将跳过</p>
                    <p className="text-[7.5px] text-amber-300/55">手动删除旧 [Color Grade Palette] 后再应用</p>
                  </div>
                )}
                {previewText ? (
                  <textarea
                    readOnly
                    value={previewText}
                    className="w-full resize-none rounded-xl border border-white/7 bg-white/[0.025] p-2.5 font-mono text-[8px] leading-relaxed text-white/45 focus:outline-none"
                    rows={10}
                  />
                ) : (
                  <p className="text-[8.5px] text-white/22">先点击【生成调色预览】查看 Prompt 内容</p>
                )}
              </div>
            )}
          </div>

          {/* Apply success */}
          {applySuccess && (
            <div className="mx-3 mb-2 rounded-xl border border-emerald-500/22 bg-emerald-500/7 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-400">✅ 已追加调色描述 — 请重新生成查看效果</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer Apply Bar ── */}
      <div className="border-t border-white/7 px-3 py-2.5 space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!canPreview}
            className="flex-1 rounded-xl border border-indigo-500/38 bg-indigo-500/13 py-2 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/22 disabled:cursor-not-allowed disabled:opacity-38"
          >
            生成调色预览
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="flex-1 rounded-xl border border-emerald-500/38 bg-emerald-500/13 py-2 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/22 disabled:cursor-not-allowed disabled:opacity-38"
          >
            追加到 Prompt
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setSetting(createDefaultColorGradeSetting()); setPreviewText(null); setPreviewResults(null); setApplySuccess(false) }}
            className="flex-1 rounded-xl border border-white/7 bg-white/[0.025] py-1.5 text-[9.5px] text-white/38 transition hover:bg-white/5 hover:text-white/58"
          >
            重置调色
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/7 bg-white/[0.025] py-1.5 text-[9.5px] text-white/38 transition hover:bg-white/5 hover:text-white/58"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            {copied ? '已复制' : '复制报告'}
          </button>
        </div>
      </div>
    </div>

    {/* ── Floating Preview Monitor — independent resizable overlay ── */}
    {showPreview && (
      <div
        className="fixed z-[1201] flex flex-col overflow-auto rounded-xl border border-white/10 bg-[#06080d]/98 shadow-2xl backdrop-blur-xl"
        style={{
          top: '8vh',
          left: 810,
          width: 440,
          minWidth: 320,
          minHeight: 280,
          maxHeight: '84vh',
          resize: 'both',
        }}
        data-no-node-drag="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <PreviewMonitor
          node={primaryNode}
          cssFilter={cssFilter}
          onClose={() => setShowPreview(false)}
        />
      </div>
    )}
    </>
  )
}
