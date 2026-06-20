'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { DEFAULT_CAMERA_SETTINGS, buildCameraSummaryText, type CameraSettings } from '@/lib/canvas/cameraPromptContext'
import { CAMERA_DATABASE, getCameraVisualProfile, type CameraVisualProfile } from '@/lib/canvas/cameraModelDatabase'
import { DirectorToolPanelFrame, type DirectorSourceNode } from '@/components/canvas/tools/DirectorToolPanelFrame'

// ─── Camera body SVG visuals by profile ─────────────────────────────────────

function CinemaBoxSvg() {
  return (
    <svg viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Main box body */}
      <rect x="4" y="16" width="58" height="34" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {/* Top handle / rail system */}
      <rect x="8" y="8" width="50" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="16" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="48" y1="8" x2="48" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Lens port (large ring) */}
      <circle cx="28" cy="33" r="14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="28" cy="33" r="8" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="28" cy="33" r="3" fill="currentColor" opacity="0.4" />
      {/* External viewfinder bracket */}
      <rect x="62" y="12" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <line x1="62" y1="20" x2="66" y2="20" stroke="currentColor" strokeWidth="0.8" />
      {/* Recording button */}
      <circle cx="75" cy="34" r="3" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.3" />
      {/* Body detail lines */}
      <line x1="4" y1="22" x2="62" y2="22" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
    </svg>
  )
}

function CinemaCompactSvg() {
  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Compact body */}
      <rect x="5" y="14" width="54" height="34" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Integrated top handle */}
      <rect x="9" y="7" width="30" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="14" y1="14" x2="14" y2="7" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      {/* Lens mount */}
      <circle cx="30" cy="31" r="13" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="30" cy="31" r="6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="30" cy="31" r="2" fill="currentColor" opacity="0.4" />
      {/* Viewfinder bump */}
      <rect x="40" y="7" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" />
      {/* Side grip */}
      <rect x="55" y="16" width="8" height="18" rx="3" stroke="currentColor" strokeWidth="1.2" />
      {/* Record indicator */}
      <circle cx="61" cy="12" r="2" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

function MirrorlessSvg() {
  return (
    <svg viewBox="0 0 72 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Main body */}
      <rect x="6" y="16" width="48" height="32" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {/* EVF hump (left side) */}
      <rect x="8" y="9" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
      {/* Hot shoe */}
      <rect x="28" y="13" width="10" height="3" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      {/* Lens mount (centered) */}
      <circle cx="30" cy="32" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="30" cy="32" r="6" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
      <circle cx="30" cy="32" r="2" fill="currentColor" opacity="0.35" />
      {/* Right grip */}
      <rect x="52" y="17" width="7" height="20" rx="3" stroke="currentColor" strokeWidth="1.2" />
      {/* Shutter button */}
      <circle cx="55" cy="15" r="2" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

function PhoneSvg() {
  return (
    <svg viewBox="0 0 48 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Phone body */}
      <rect x="4" y="2" width="40" height="76" rx="6" stroke="currentColor" strokeWidth="1.5" />
      {/* Dynamic island / notch */}
      <rect x="16" y="6" width="16" height="5" rx="2.5" fill="currentColor" opacity="0.4" />
      {/* Camera island (large square) */}
      <rect x="8" y="18" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.05" />
      {/* Triple camera circles */}
      <circle cx="17" cy="25" r="5" stroke="currentColor" strokeWidth="1" />
      <circle cx="17" cy="25" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="25" cy="25" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="17" cy="33" r="4" stroke="currentColor" strokeWidth="1" />
      {/* LiDAR dot */}
      <circle cx="25" cy="33" r="2" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.2" />
      {/* Home indicator */}
      <rect x="17" y="72" width="14" height="2.5" rx="1.25" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

function ActionCamSvg() {
  return (
    <svg viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Cube body */}
      <rect x="8" y="10" width="38" height="36" rx="6" stroke="currentColor" strokeWidth="1.5" />
      {/* Wide-angle front lens */}
      <circle cx="27" cy="28" r="14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="27" cy="28" r="9" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="27" cy="28" r="4" fill="currentColor" opacity="0.3" />
      {/* Top button */}
      <rect x="14" y="6" width="14" height="5" rx="2" stroke="currentColor" strokeWidth="1" />
      {/* Side button */}
      <rect x="44" y="20" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* LED indicator */}
      <circle cx="46" cy="14" r="2" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

function DroneSvg() {
  return (
    <svg viewBox="0 0 96 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Center gimbal housing */}
      <rect x="34" y="20" width="28" height="22" rx="5" stroke="currentColor" strokeWidth="1.5" />
      {/* Gimbal suspension arc */}
      <path d="M38 20 Q48 10 58 20" stroke="currentColor" strokeWidth="1.3" fill="none" />
      {/* Camera pod */}
      <rect x="40" y="30" width="16" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.06" />
      {/* Lens */}
      <circle cx="48" cy="35" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="48" cy="35" r="1.5" fill="currentColor" opacity="0.4" />
      {/* Left arm */}
      <line x1="34" y1="24" x2="14" y2="18" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="17" r="5" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Right arm */}
      <line x1="62" y1="24" x2="82" y2="18" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="84" cy="17" r="5" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Landing struts */}
      <line x1="40" y1="42" x2="36" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="56" y1="42" x2="60" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="33" y1="50" x2="39" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="57" y1="50" x2="63" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  )
}

function BroadcastSvg() {
  return (
    <svg viewBox="0 0 100 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Long body */}
      <rect x="4" y="18" width="60" height="28" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {/* Top handle */}
      <rect x="8" y="10" width="40" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      {/* Long lens barrel */}
      <rect x="64" y="22" width="28" height="20" rx="4" stroke="currentColor" strokeWidth="1.4" />
      {/* Zoom rings */}
      <line x1="72" y1="22" x2="72" y2="42" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      <line x1="80" y1="22" x2="80" y2="42" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      {/* Lens end */}
      <circle cx="92" cy="32" r="7" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="92" cy="32" r="3" fill="currentColor" opacity="0.35" />
      {/* Viewfinder tube (side) */}
      <rect x="42" y="9" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="56" y1="10" x2="56" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      {/* Shoulder pad indent */}
      <path d="M6 46 Q20 54 34 46" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
    </svg>
  )
}

function CamcorderSvg() {
  return (
    <svg viewBox="0 0 88 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Body */}
      <rect x="4" y="14" width="50" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Integral zoom lens */}
      <rect x="54" y="20" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <line x1="62" y1="20" x2="62" y2="38" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      {/* Lens cap ring */}
      <circle cx="78" cy="29" r="6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="78" cy="29" r="2.5" fill="currentColor" opacity="0.3" />
      {/* Flip screen arm */}
      <rect x="4" y="26" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      {/* Handgrip strap bar */}
      <rect x="32" y="43" width="20" height="4" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      {/* Top mic mount */}
      <rect x="14" y="8" width="20" height="6" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      {/* Record button */}
      <circle cx="50" cy="12" r="2.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  )
}

function ThreeSixtySvg() {
  return (
    <svg viewBox="0 0 48 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      {/* Slim vertical body */}
      <rect x="14" y="12" width="20" height="56" rx="4" stroke="currentColor" strokeWidth="1.5" />
      {/* Front fish-eye lens */}
      <circle cx="24" cy="26" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="26" r="5.5" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
      <circle cx="24" cy="26" r="2" fill="currentColor" opacity="0.35" />
      {/* Back fish-eye lens (smaller, visible at bottom) */}
      <circle cx="24" cy="54" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="54" r="4.5" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
      <circle cx="24" cy="54" r="2" fill="currentColor" opacity="0.35" />
      {/* 360° arc indicator */}
      <path d="M10 40 A14 14 0 0 1 38 40" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.35" />
      {/* Power / mode button */}
      <rect x="16" y="6" width="16" height="5" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

function CameraBodyByProfile({ profile }: { profile: CameraVisualProfile }) {
  switch (profile) {
    case 'cinema-box': return <CinemaBoxSvg />
    case 'cinema-compact': return <CinemaCompactSvg />
    case 'mirrorless': return <MirrorlessSvg />
    case 'phone': return <PhoneSvg />
    case 'action-cam': return <ActionCamSvg />
    case 'drone': return <DroneSvg />
    case 'broadcast': return <BroadcastSvg />
    case 'camcorder': return <CamcorderSvg />
    case 'three-sixty': return <ThreeSixtySvg />
    default: return <CinemaCompactSvg />
  }
}

function CameraBodyIcon({ selected }: { selected: string }) {
  const profile = getCameraVisualProfile(selected)
  return <CameraBodyByProfile profile={profile} />
}

// ─── Lens / Aperture / Focus icons (unchanged) ───────────────────────────────

const LENS_SPREAD: Record<string, number> = {
  '18mm': 25, '24mm': 21, '35mm': 16, '50mm': 12, '85mm': 7, '135mm': 4,
}

function LensIcon({ selected }: { selected: string }) {
  const spread = LENS_SPREAD[selected] ?? 14
  const cy = 28; const lensX = 12; const frameX = 70
  const topY = cy - spread; const botY = cy + spread
  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      <line x1={lensX} y1={cy} x2={frameX} y2={topY} stroke="currentColor" strokeWidth="1.5" />
      <line x1={lensX} y1={cy} x2={frameX} y2={botY} stroke="currentColor" strokeWidth="1.5" />
      <line x1={frameX} y1={topY} x2={frameX} y2={botY} stroke="currentColor" strokeWidth="1.8" />
      <line x1={frameX} y1={topY} x2={frameX - 5} y2={topY} stroke="currentColor" strokeWidth="1.2" />
      <line x1={frameX} y1={botY} x2={frameX - 5} y2={botY} stroke="currentColor" strokeWidth="1.2" />
      <circle cx={lensX} cy={cy} r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={lensX} cy={cy} r="2.5" fill="currentColor" opacity="0.5" />
      <line x1={lensX + 7} y1={cy} x2={frameX - 1} y2={cy} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.3" />
    </svg>
  )
}

const APERTURE_HOLE: Record<string, number> = {
  'f/1.4': 17, 'f/2.0': 14, 'f/2.8': 10, 'f/5.6': 7, 'f/8': 4,
}

function ApertureIcon({ selected }: { selected: string }) {
  const holeR = APERTURE_HOLE[selected] ?? 10
  const cx = 30; const cy = 28; const outerR = 22
  const bladeR = Math.max(holeR + 2, outerR - 2)
  const hexPoints = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${(cx + bladeR * Math.cos(angle)).toFixed(1)},${(cy + bladeR * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      <circle cx={cx} cy={cy} r={outerR} stroke="currentColor" strokeWidth="1.5" />
      <polygon points={hexPoints} stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.08" opacity="0.6" />
      <circle cx={cx} cy={cy} r={holeR} stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.12" />
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i
        const x2 = cx + outerR * Math.cos(angle); const y2 = cy + outerR * Math.sin(angle)
        const x1 = cx + holeR * Math.cos(angle); const y1 = cy + holeR * Math.sin(angle)
        return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
      })}
    </svg>
  )
}

type FocusLayer = 'front' | 'mid' | 'mid-tight' | 'back' | 'rack' | 'soft'
const FOCUS_LAYER: Record<string, FocusLayer> = {
  'Face Focus': 'mid', 'Eye Focus': 'mid-tight', 'Foreground Focus': 'front',
  'Background Focus': 'back', 'Rack Focus': 'rack', 'Soft Focus': 'soft',
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
      <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="40" y1="44" x2="10" y2="18" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      <line x1="40" y1="44" x2="70" y2="18" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
      {plane(6, 14, 30, frontActive)}
      {plane(31, 18, 38, midActive)}
      {plane(60, 14, 24, backActive)}
      {mode === 'rack' && (
        <>
          <line x1="20" y1="28" x2="60" y2="28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
          <polygon points="58,25 62,28 58,31" fill="currentColor" opacity="0.8" />
        </>
      )}
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

const CAMERA_BODY_OPTIONS: WheelOption[] = CAMERA_DATABASE.map((m) => ({
  value: m.id,
  label: `${m.brand} ${m.model}`,
  sublabel: m.category,
  note: m.directorNote,
}))

const CAMERA_SLOTS: SlotDef[] = [
  {
    key: 'cameraBody',
    title: '摄影机型号',
    titleEn: 'Camera Body',
    renderVisual: (v) => <CameraBodyIcon selected={v} />,
    options: CAMERA_BODY_OPTIONS,
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
  const rawIdx = slotDef.options.findIndex((o) => o.value === value)
  const idx = rawIdx >= 0 ? rawIdx : 0
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

      {/* Visual model */}
      <div className="flex items-center justify-center px-6 pt-4 pb-2 text-violet-300/50 min-h-[68px]">
        {slotDef.renderVisual(value)}
      </div>

      {/* Drum wheel */}
      <div className="flex flex-col items-center px-4 pb-3 pt-1 gap-0.5">
        <button
          type="button"
          onClick={() => prev && onChange(prev.value)}
          disabled={!prev}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/8 hover:text-white/70 disabled:opacity-15"
          aria-label="上一项"
        >
          <ChevronUp size={14} strokeWidth={2.5} />
        </button>

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

        <div className="w-full rounded-xl border border-violet-400/20 bg-violet-500/[0.09] px-3 py-2 text-center">
          <div className="text-[12px] font-bold text-white leading-tight truncate">{curr?.label ?? '—'}</div>
          {curr?.sublabel ? (
            <div className="text-[9px] text-violet-300/55 mt-0.5 truncate">{curr.sublabel}</div>
          ) : null}
        </div>

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

// ─── Active count ──────────────────────────────────────────────────────────────

function activeCount(settings: CameraSettings): number {
  return [settings.cameraBody, settings.lens, settings.aperture, settings.focus].filter(Boolean).length
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface CinematicCameraControlPanelProps {
  open: boolean
  value: CameraSettings
  onChange: (value: CameraSettings) => void
  onClose: () => void
  onCreateDerived?: (settings: CameraSettings) => void
  sourceNode?: DirectorSourceNode | null
}

export function CinematicCameraControlPanel({
  open,
  value,
  onChange,
  onClose,
  onCreateDerived,
  sourceNode,
}: CinematicCameraControlPanelProps) {
  if (!open) return null

  const patch = (key: keyof CameraSettings, v: string) => onChange({ ...value, [key]: v })
  const clearAll = () => onChange({ ...DEFAULT_CAMERA_SETTINGS })
  const count = activeCount(value)
  const summary = buildCameraSummaryText(value)

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/25 sm:items-center"
      role="presentation"
      data-no-node-drag="true"
      data-camera-control="true"
      onPointerDown={(event) => { event.stopPropagation(); onClose() }}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <DirectorToolPanelFrame
        title="摄影机控制"
        titleEn="Camera Control"
        icon="🎥"
        accentColor="violet"
        count={count}
        summary={summary || undefined}
        sourceNode={sourceNode}
        primaryLabel="创建摄影版本"
        primaryDisabled={!onCreateDerived}
        onPrimary={() => onCreateDerived?.(value)}
        onClear={count > 0 ? clearAll : undefined}
        onClose={onClose}
        ariaLabel="摄影机控制 / Camera Control"
      >
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

        <div className="mt-4 rounded-xl border border-violet-500/[0.12] bg-violet-500/[0.04] px-4 py-3">
          <p className="text-[10px] leading-relaxed text-violet-200/40">
            <strong className="text-violet-200/60">提示：</strong>
            摄影机设定以「导演注释」形式附加在生成提示词末尾。当前机型库包含 {CAMERA_DATABASE.length} 款主流摄影机，涵盖电影、广播、无人机、手机等类别。
            {count === 0 ? '请在上方四个滚轮中至少选择一项以激活摄影机控制。' : `当前已激活 ${count} 项，生成时将自动应用。`}
          </p>
        </div>
      </DirectorToolPanelFrame>
    </div>
  )
}
