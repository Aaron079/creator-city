'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { DEFAULT_CAMERA_SETTINGS, type CameraSettings } from '@/lib/canvas/cameraPromptContext'

// ─── Visual SVG models ────────────────────────────────────────────────────────

function CameraBodyIcon({ selected }: { selected: string }) {
  // Cinema camera silhouette — body changes color only; shape is universal
  const hasSelection = Boolean(selected)
  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Body */}
      <rect x="5" y="14" width="54" height="34" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Lens mount ring */}
      <circle cx="30" cy="31" r="13" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner glass */}
      <circle cx="30" cy="31" r="6" stroke="currentColor" strokeWidth="1" opacity={hasSelection ? 0.7 : 0.3} />
      <circle cx="30" cy="31" r="2" fill="currentColor" opacity={hasSelection ? 0.5 : 0.2} />
      {/* Viewfinder bump */}
      <rect x="40" y="6" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      {/* Grip / handle */}
      <rect x="54" y="16" width="8" height="18" rx="3" stroke="currentColor" strokeWidth="1.2" />
      {/* Record indicator */}
      <circle cx="61" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity={hasSelection ? 0.5 : 0.15} />
      {/* Top rail */}
      <line x1="5" y1="18" x2="59" y2="18" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
    </svg>
  )
}

// Pre-computed FOV half-spreads in SVG units (viewBox height=56, center y=28, lens at x=12, frame at x=70)
const LENS_SPREAD: Record<string, number> = {
  '18mm': 25,
  '24mm': 21,
  '35mm': 16,
  '50mm': 12,
  '85mm': 7,
  '135mm': 4,
}

function LensIcon({ selected }: { selected: string }) {
  const spread = LENS_SPREAD[selected] ?? 14
  const cy = 28
  const lensX = 12
  const frameX = 70
  const topY = cy - spread
  const botY = cy + spread
  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* FOV lines */}
      <line x1={lensX} y1={cy} x2={frameX} y2={topY} stroke="currentColor" strokeWidth="1.5" />
      <line x1={lensX} y1={cy} x2={frameX} y2={botY} stroke="currentColor" strokeWidth="1.5" />
      {/* Frame edge */}
      <line x1={frameX} y1={topY} x2={frameX} y2={botY} stroke="currentColor" strokeWidth="1.8" />
      {/* Frame corners */}
      <line x1={frameX} y1={topY} x2={frameX - 5} y2={topY} stroke="currentColor" strokeWidth="1.2" />
      <line x1={frameX} y1={botY} x2={frameX - 5} y2={botY} stroke="currentColor" strokeWidth="1.2" />
      {/* Lens barrel */}
      <circle cx={lensX} cy={cy} r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={lensX} cy={cy} r="2.5" fill="currentColor" opacity="0.5" />
      {/* Center axis */}
      <line x1={lensX + 7} y1={cy} x2={frameX - 1} y2={cy} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.3" />
    </svg>
  )
}

// Pre-computed aperture hole radii (in SVG units, outer ring r=22)
const APERTURE_HOLE: Record<string, number> = {
  'f/1.4': 17,
  'f/2.0': 14,
  'f/2.8': 10,
  'f/5.6': 7,
  'f/8': 4,
}

function ApertureIcon({ selected }: { selected: string }) {
  const holeR = APERTURE_HOLE[selected] ?? 10
  const cx = 30
  const cy = 28
  const outerR = 22
  // Blade points (6-blade iris): inscribed hexagon at a slightly larger radius than hole
  const bladeR = Math.max(holeR + 2, outerR - 2)
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + bladeR * Math.cos(angle)).toFixed(1)},${(cy + bladeR * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={outerR} stroke="currentColor" strokeWidth="1.5" />
      {/* Blade fill (hexagonal iris) */}
      <polygon points={hexPoints} stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.08" opacity="0.6" />
      {/* Aperture opening */}
      <circle cx={cx} cy={cy} r={holeR} stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.12" />
      {/* Blade dividers at 60° */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i
        const x2 = cx + outerR * Math.cos(angle)
        const y2 = cy + outerR * Math.sin(angle)
        const x1 = cx + holeR * Math.cos(angle)
        const y1 = cy + holeR * Math.sin(angle)
        return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      })}
    </svg>
  )
}

type FocusLayer = 'front' | 'mid' | 'mid-tight' | 'back' | 'rack' | 'soft'
const FOCUS_LAYER: Record<string, FocusLayer> = {
  'Face Focus': 'mid',
  'Eye Focus': 'mid-tight',
  'Foreground Focus': 'front',
  'Background Focus': 'back',
  'Rack Focus': 'rack',
  'Soft Focus': 'soft',
}

function FocusIcon({ selected }: { selected: string }) {
  const mode = FOCUS_LAYER[selected] ?? 'mid'
  const frontActive = mode === 'front' || mode === 'rack'
  const midActive = mode === 'mid' || mode === 'mid-tight' || mode === 'rack'
  const backActive = mode === 'back' || mode === 'rack'
  const allSoft = mode === 'soft'
  const dash = allSoft ? '3 2' : undefined

  const plane = (x: number, w: number, h: number, active: boolean) => {
    const y = 28 - h / 2
    const opacity = allSoft ? 0.5 : active ? 1 : 0.25
    const sw = active && !allSoft ? 2 : 1
    return (
      <g opacity={opacity} key={x}>
        <rect x={x} y={y} width={w} height={h} rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={active ? 0.12 : 0.04} strokeDasharray={dash} />
        {active && !allSoft && <line x1={x + w / 2} y1={y - 3} x2={x + w / 2} y2={y} stroke="currentColor" strokeWidth="1" opacity="0.4" />}
      </g>
    )
  }

  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Ground line */}
      <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      {/* Perspective lines */}
      <line x1="40" y1="44" x2="10" y2="18" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <line x1="40" y1="44" x2="70" y2="18" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      {/* Three depth planes */}
      {plane(6, 14, 30, frontActive)}
      {plane(31, 18, 38, midActive)}
      {plane(60, 14, 24, backActive)}
      {/* Rack focus arrow */}
      {mode === 'rack' && (
        <>
          <line x1="20" y1="28" x2="60" y2="28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <polygon points="58,25 62,28 58,31" fill="currentColor" opacity="0.8" />
        </>
      )}
      {/* Focus reticle on active plane */}
      {(mode === 'mid' || mode === 'mid-tight') && (
        <>
          <line x1="34" y1="20" x2="37" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <line x1="34" y1="20" x2="34" y2="23" stroke="currentColor" strokeWidth="1.2" />
          <line x1="45" y1="20" x2="48" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <line x1="48" y1="20" x2="48" y2="23" stroke="currentColor" strokeWidth="1.2" />
          <line x1="34" y1="38" x2="37" y2="38" stroke="currentColor" strokeWidth="1.2" />
          <line x1="34" y1="35" x2="34" y2="38" stroke="currentColor" strokeWidth="1.2" />
          <line x1="45" y1="38" x2="48" y2="38" stroke="currentColor" strokeWidth="1.2" />
          <line x1="48" y1="35" x2="48" y2="38" stroke="currentColor" strokeWidth="1.2" />
        </>
      )}
    </svg>
  )
}

// ─── Slot definitions ──────────────────────────────────────────────────────────

interface WheelOption {
  value: string
  label: string
  sublabel?: string
  note: string
}

interface SlotDef {
  key: keyof CameraSettings
  title: string
  titleEn: string
  options: WheelOption[]
  renderVisual: (value: string) => React.ReactNode
}

const CAMERA_SLOTS: SlotDef[] = [
  {
    key: 'cameraBody',
    title: '摄影机型号',
    titleEn: 'Camera Body',
    renderVisual: (v) => <CameraBodyIcon selected={v} />,
    options: [
      { value: 'ARRI Alexa 35', label: 'ARRI Alexa 35', sublabel: '电影旗舰', note: '高宽容度 · 电影级质感 · 工业标准机型' },
      { value: 'RED V-Raptor', label: 'RED V-Raptor', sublabel: '商业大片', note: '超高分辨率 · 商业广告 · 4K+ 画面' },
      { value: 'Sony Venice 2', label: 'Sony Venice 2', sublabel: '肤色自然', note: '变形宽银幕 · 肤色精准 · 叙事电影常用' },
      { value: 'Blackmagic URSA', label: 'Blackmagic URSA', sublabel: '独立电影', note: '柔和质感 · 独立制片 · 有机色彩科学' },
      { value: 'iPhone Cinematic', label: 'iPhone Cinematic', sublabel: '手持纪录', note: '手持自然 · 浅景深模式 · 纪录片感' },
    ],
  },
  {
    key: 'lens',
    title: '焦距',
    titleEn: 'Focal Length',
    renderVisual: (v) => <LensIcon selected={v} />,
    options: [
      { value: '18mm', label: '18mm', sublabel: '超广角', note: '强烈透视 · 空间压迫 · 环境为主角' },
      { value: '24mm', label: '24mm', sublabel: '广角', note: '电影经典广角 · 叙事环境镜头' },
      { value: '35mm', label: '35mm', sublabel: '人文视角', note: '自然叙事 · 微广角 · 人文纪实常用' },
      { value: '50mm', label: '50mm', sublabel: '标准', note: '最接近人眼 · 中性无偏见 · 真实感' },
      { value: '85mm', label: '85mm', sublabel: '人像', note: '背景压缩 · 主体突出 · 情绪集中' },
      { value: '135mm', label: '135mm', sublabel: '长焦', note: '强压缩感 · 偷窥视角 · 背景虚化夸张' },
    ],
  },
  {
    key: 'aperture',
    title: '光圈',
    titleEn: 'Aperture',
    renderVisual: (v) => <ApertureIcon selected={v} />,
    options: [
      { value: 'f/1.4', label: 'f/1.4', sublabel: '梦幻虚化', note: '极浅景深 · 背景完全虚化 · 梦幻感' },
      { value: 'f/2.0', label: 'f/2.0', sublabel: '浅景深', note: '主体突出 · 背景柔化 · 情绪集中' },
      { value: 'f/2.8', label: 'f/2.8', sublabel: '电影常用', note: '浅景深甜蜜点 · 背景柔和但可辨' },
      { value: 'f/5.6', label: 'f/5.6', sublabel: '环境清晰', note: '中等景深 · 人物与环境并重' },
      { value: 'f/8', label: 'f/8', sublabel: '深景深', note: '前后皆清晰 · 纪实感 · 风景/建筑' },
    ],
  },
  {
    key: 'focus',
    title: '焦点',
    titleEn: 'Focus',
    renderVisual: (v) => <FocusIcon selected={v} />,
    options: [
      { value: 'Face Focus', label: '人脸跟焦', sublabel: 'Face Focus', note: '锁定人脸 · 角色为视觉中心' },
      { value: 'Eye Focus', label: '眼睛跟焦', sublabel: 'Eye Focus', note: '极精准跟焦眼睛 · 最具代入感' },
      { value: 'Foreground Focus', label: '前景焦点', sublabel: 'Foreground', note: '前景清晰 · 背景梦幻 · 强调近处主体' },
      { value: 'Background Focus', label: '背景焦点', sublabel: 'Background', note: '背景清晰 · 前景模糊 · 神秘与深度' },
      { value: 'Rack Focus', label: '拉焦', sublabel: 'Rack Focus', note: '焦点切换 · 前后景转移 · 戏剧化揭示' },
      { value: 'Soft Focus', label: '柔焦', sublabel: 'Soft Focus', note: '整体柔焦 · 梦幻质感 · 散射光晕' },
    ],
  },
]

// ─── Single slot card ──────────────────────────────────────────────────────────

function CinematicWheelSlot({
  slotDef,
  value,
  onChange,
}: {
  slotDef: SlotDef
  value: string
  onChange: (v: string) => void
}) {
  const idx = Math.max(0, slotDef.options.findIndex((o) => o.value === value))
  const curr = slotDef.options[idx]
  const prev = idx > 0 ? slotDef.options[idx - 1] : null
  const next = idx < slotDef.options.length - 1 ? slotDef.options[idx + 1] : null

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
      {/* Slot header */}
      <div className="flex items-baseline gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">{slotDef.titleEn}</span>
        <span className="text-[11px] font-semibold text-white/60">{slotDef.title}</span>
      </div>

      {/* Visual model area */}
      <div className="flex items-center justify-center px-6 pt-4 pb-2 text-violet-300/50 min-h-[68px]">
        {slotDef.renderVisual(value)}
      </div>

      {/* Drum wheel */}
      <div className="flex flex-col items-center px-4 pb-3 pt-1 gap-0.5">
        {/* Up arrow */}
        <button
          type="button"
          onClick={() => prev && onChange(prev.value)}
          disabled={!prev}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-15"
          aria-label="上一项"
        >
          <ChevronUp size={14} strokeWidth={2.5} />
        </button>

        {/* Prev option (dimmed) */}
        <div className="h-5 flex items-center">
          {prev ? (
            <button
              type="button"
              onClick={() => onChange(prev.value)}
              className="text-[10px] text-white/22 hover:text-white/45 transition truncate max-w-[140px]"
            >
              {prev.label}
            </button>
          ) : null}
        </div>

        {/* Current option (highlighted) */}
        <div className="w-full rounded-xl border border-violet-400/20 bg-violet-500/[0.09] px-3 py-2 text-center">
          <div className="text-[13px] font-bold text-white leading-tight">{curr?.label ?? '—'}</div>
          {curr?.sublabel ? (
            <div className="text-[9px] text-violet-300/55 mt-0.5">{curr.sublabel}</div>
          ) : null}
        </div>

        {/* Next option (dimmed) */}
        <div className="h-5 flex items-center">
          {next ? (
            <button
              type="button"
              onClick={() => onChange(next.value)}
              className="text-[10px] text-white/22 hover:text-white/45 transition truncate max-w-[140px]"
            >
              {next.label}
            </button>
          ) : null}
        </div>

        {/* Down arrow */}
        <button
          type="button"
          onClick={() => next && onChange(next.value)}
          disabled={!next}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-15"
          aria-label="下一项"
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Director note */}
      <div className="border-t border-white/[0.05] px-4 py-2.5 min-h-[44px] flex items-center">
        <p className="text-[10px] leading-[1.4] text-white/35 text-center w-full">
          {curr?.note ?? ''}
        </p>
      </div>
    </div>
  )
}

// ─── Active setting count helper ──────────────────────────────────────────────

function activeCount(settings: CameraSettings): number {
  return [settings.cameraBody, settings.lens, settings.aperture, settings.focus].filter(Boolean).length
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface CinematicCameraControlPanelProps {
  open: boolean
  value: CameraSettings
  onChange: (value: CameraSettings) => void
  onClose: () => void
}

export function CinematicCameraControlPanel({
  open,
  value,
  onChange,
  onClose,
}: CinematicCameraControlPanelProps) {
  if (!open) return null

  const patch = (key: keyof CameraSettings, v: string) => {
    onChange({ ...value, [key]: v })
  }

  const clearAll = () => onChange({ ...DEFAULT_CAMERA_SETTINGS })
  const count = activeCount(value)

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/25 sm:items-center"
      role="presentation"
      data-no-node-drag="true"
      data-camera-control="true"
      onPointerDown={(event) => {
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <aside
        className="m-4 flex max-h-[92vh] w-[min(840px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0d0f12]/96 text-white shadow-2xl backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="摄影机控制 / Camera Control"
        data-no-node-drag="true"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-violet-300/40">Camera Control</p>
            <h2 className="mt-0.5 text-lg font-semibold text-white">摄影机控制</h2>
            <p className="mt-1.5 max-w-[400px] text-[11px] leading-relaxed text-white/40">
              用导演语言设置当前镜头的摄影机、焦距、光圈和焦点。选择结果自动注入生成提示词，保持镜头语言一致。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {count > 0 ? (
              <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-violet-300/70">
                🎥 {count} 项已设定
              </span>
            ) : null}
            {count > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.08] hover:text-white/70"
              >
                清除设定
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/10"
            >
              关闭
            </button>
          </div>
        </header>

        {/* 4-slot grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {CAMERA_SLOTS.map((slotDef) => (
              <CinematicWheelSlot
                key={slotDef.key}
                slotDef={slotDef}
                value={value[slotDef.key]}
                onChange={(v) => patch(slotDef.key, v)}
              />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-4 rounded-xl border border-violet-500/[0.12] bg-violet-500/[0.04] px-4 py-3">
            <p className="text-[10px] leading-relaxed text-violet-200/40">
              <strong className="text-violet-200/60">提示：</strong>
              摄影机设定以「导演注释」形式附加在生成提示词末尾，不影响原有 prompt 内容，也不修改 Bible 或其他节点。
              {count === 0 ? '请在上方四个滚轮中至少选择一项以激活摄影机控制。' : `当前已激活 ${count} 项，生成时将自动应用。`}
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
