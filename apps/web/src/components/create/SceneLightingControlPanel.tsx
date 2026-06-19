'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { DEFAULT_SCENE_LIGHTING, type SceneLightingSettings } from '@/lib/canvas/sceneLightingPromptContext'

// ─── Visual SVG models ────────────────────────────────────────────────────────

function LightingSetupIcon({ selected }: { selected: string }) {
  switch (selected) {
    case 'Key Light':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Figure */}
          <rect x="28" y="18" width="16" height="26" rx="2" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
          {/* Ground */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          {/* Light source top-right */}
          <circle cx="68" cy="8" r="4" fill="currentColor" opacity="0.8" />
          {/* Rays from light to figure */}
          <line x1="65" y1="11" x2="44" y2="22" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          <line x1="66" y1="11" x2="42" y2="30" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          <line x1="64" y1="10" x2="46" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          {/* Shadow to lower-left */}
          <polygon points="28,44 8,44 10,40" fill="currentColor" opacity="0.12" />
          <line x1="28" y1="44" x2="8" y2="44" stroke="currentColor" strokeWidth="1" opacity="0.25" />
        </svg>
      )
    case 'Backlight':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Figure (dark silhouette — backlit) */}
          <rect x="28" y="18" width="16" height="26" rx="2" fill="currentColor" fillOpacity="0.55" />
          {/* Light source behind (bottom glow) */}
          <ellipse cx="36" cy="52" rx="16" ry="5" fill="currentColor" opacity="0.25" />
          {/* Rim light on left edge */}
          <line x1="28" y1="18" x2="24" y2="44" stroke="currentColor" strokeWidth="2.5" opacity="0.7" />
          {/* Rim light on right edge */}
          <line x1="44" y1="18" x2="48" y2="44" stroke="currentColor" strokeWidth="2.5" opacity="0.7" />
          {/* Glow halo */}
          <rect x="26" y="16" width="20" height="30" rx="3" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
          {/* Ground */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
    case 'Neon Light':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Vertical neon bars from left */}
          <rect x="4" y="10" width="3" height="36" rx="1.5" fill="currentColor" opacity="0.75" />
          <rect x="10" y="16" width="2" height="24" rx="1" fill="currentColor" opacity="0.45" />
          <rect x="15" y="20" width="1.5" height="16" rx="0.75" fill="currentColor" opacity="0.25" />
          {/* Vertical neon bars from right */}
          <rect x="73" y="10" width="3" height="36" rx="1.5" fill="currentColor" opacity="0.75" />
          <rect x="68" y="16" width="2" height="24" rx="1" fill="currentColor" opacity="0.45" />
          <rect x="63.5" y="20" width="1.5" height="16" rx="0.75" fill="currentColor" opacity="0.25" />
          {/* Figure in center */}
          <rect x="30" y="18" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08" />
          {/* Neon glow on figure edges */}
          <rect x="30" y="18" width="3" height="26" rx="1" fill="currentColor" opacity="0.4" />
          <rect x="47" y="18" width="3" height="26" rx="1" fill="currentColor" opacity="0.4" />
          {/* Floor reflection */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
    case 'Low Key':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Large dark area */}
          <rect x="4" y="10" width="72" height="38" rx="2" fill="currentColor" opacity="0.14" />
          {/* Thin diagonal light stripe */}
          <polygon points="0,26 80,12 80,19 0,33" fill="currentColor" opacity="0.38" />
          {/* Figure mostly in shadow */}
          <rect x="30" y="18" width="18" height="26" rx="2" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1" />
          {/* Illuminated slice on figure */}
          <rect x="30" y="25" width="18" height="5" rx="0.5" fill="currentColor" opacity="0.55" />
          {/* Ground */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
    case 'Soft Window Light':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Window frame */}
          <rect x="4" y="12" width="18" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="13" y1="12" x2="13" y2="40" stroke="currentColor" strokeWidth="0.8" />
          <line x1="4" y1="26" x2="22" y2="26" stroke="currentColor" strokeWidth="0.8" />
          {/* Soft parallel rays */}
          <line x1="22" y1="15" x2="76" y2="15" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <line x1="22" y1="21" x2="76" y2="21" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <line x1="22" y1="27" x2="76" y2="27" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <line x1="22" y1="33" x2="76" y2="33" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <line x1="22" y1="39" x2="76" y2="39" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
          {/* Figure */}
          <rect x="50" y="18" width="16" height="26" rx="2" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.12" />
          {/* Soft shadow to right */}
          <line x1="66" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
          {/* Ground */}
          <line x1="22" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
    default: // Top Light
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Light source directly overhead */}
          <circle cx="40" cy="6" r="4.5" fill="currentColor" opacity="0.8" />
          {/* Straight down rays */}
          <line x1="40" y1="11" x2="40" y2="18" stroke="currentColor" strokeWidth="1.8" />
          <line x1="35" y1="11" x2="33" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          <line x1="45" y1="11" x2="47" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
          {/* Figure */}
          <rect x="30" y="18" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
          {/* Heavy shadow below figure */}
          <ellipse cx="40" cy="44" rx="16" ry="3" fill="currentColor" opacity="0.3" />
          {/* Underlit dramatic line on face area */}
          <line x1="34" y1="26" x2="46" y2="26" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          {/* Ground */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
  }
}

function TimeWeatherIcon({ selected }: { selected: string }) {
  switch (selected) {
    case 'Dawn Mist':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Horizon */}
          <line x1="4" y1="36" x2="76" y2="36" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          {/* Sun rising (semicircle) */}
          <path d="M 26 36 A 14 14 0 0 1 54 36" stroke="currentColor" strokeWidth="1.8" fill="none" />
          {/* Pale rays from horizon */}
          <line x1="40" y1="36" x2="20" y2="16" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <line x1="40" y1="36" x2="40" y2="10" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <line x1="40" y1="36" x2="60" y2="16" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          {/* Fog layers */}
          <line x1="4" y1="40" x2="76" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" opacity="0.55" />
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" opacity="0.35" />
          <line x1="4" y1="48" x2="76" y2="48" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 8" opacity="0.2" />
        </svg>
      )
    case 'Golden Hour':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Sun above horizon */}
          <circle cx="62" cy="24" r="7" fill="currentColor" opacity="0.65" />
          {/* Sun rays */}
          <line x1="62" y1="13" x2="62" y2="17" stroke="currentColor" strokeWidth="1.2" />
          <line x1="71" y1="17" x2="68" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <line x1="72" y1="26" x2="69" y2="26" stroke="currentColor" strokeWidth="1.2" />
          <line x1="53" y1="17" x2="56" y2="20" stroke="currentColor" strokeWidth="1.2" />
          <line x1="52" y1="26" x2="55" y2="26" stroke="currentColor" strokeWidth="1.2" />
          {/* Horizon */}
          <line x1="4" y1="38" x2="76" y2="38" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          {/* Warm haze bands near horizon */}
          <line x1="4" y1="33" x2="76" y2="33" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
          <line x1="4" y1="35" x2="76" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
          {/* Long shadow on ground */}
          <line x1="4" y1="38" x2="46" y2="38" stroke="currentColor" strokeWidth="2.5" opacity="0.15" />
        </svg>
      )
    case 'Midnight Rain':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Moon crescent */}
          <path d="M58,10 A10,10 0 1,1 58,26 A6,6 0 1,0 58,10" fill="currentColor" opacity="0.6" />
          {/* Rain streaks */}
          {([8,14,20,26,32,38,44,50,58,64,70,76] as number[]).map((x, i) => (
            <line key={x} x1={x} y1={14 + (i % 3) * 4} x2={x - 3} y2={26 + (i % 3) * 4} stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
          ))}
          {([12,22,34,46,60,72] as number[]).map((x, i) => (
            <line key={x} x1={x} y1={28 + (i % 2) * 4} x2={x - 3} y2={38 + (i % 2) * 4} stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
          ))}
          {/* Ground (wet surface) */}
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          {/* Puddle reflections */}
          <ellipse cx="22" cy="46" rx="9" ry="1.5" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.3" />
          <ellipse cx="54" cy="47" rx="7" ry="1.5" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.25" />
        </svg>
      )
    case 'Snow Night':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Moon */}
          <circle cx="64" cy="14" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.8" />
          {/* Snowflakes */}
          {([14,26,38,52,66,20,44,60,10,34,56,72,28,48] as number[]).map((x, i) => (
            <circle key={i} cx={x} cy={[18,24,14,20,16,32,28,22,36,30,34,26,10,38][i] ?? 20} r="1" fill="currentColor" opacity="0.6" />
          ))}
          {/* Snowy ground (curved) */}
          <path d="M4,44 Q20,40 40,44 Q60,40 76,44" stroke="currentColor" strokeWidth="1.5" fill="none" />
          {/* Distant tree silhouette */}
          <polygon points="12,44 18,28 24,44" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.35" />
          <polygon points="58,44 64,30 70,44" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.35" />
        </svg>
      )
    case 'Overcast Day':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Cloud mass 1 */}
          <path d="M6,22 Q16,10 28,18 Q34,8 46,16 Q56,8 64,18 Q74,12 76,22 L6,22" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
          {/* Cloud mass 2 (lower) */}
          <path d="M4,30 Q14,22 24,28 Q30,20 42,26 Q50,18 60,26 Q68,20 76,28 L76,36 L4,36" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06" />
          {/* Flat diffuse light lines */}
          <line x1="4" y1="40" x2="76" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <line x1="4" y1="44" x2="76" y2="44" stroke="currentColor" strokeWidth="0.5" opacity="0.18" />
          <line x1="4" y1="48" x2="76" y2="48" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
        </svg>
      )
    default: // Dust Storm
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Horizontal wind streaks */}
          <line x1="4" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
          <line x1="10" y1="20" x2="54" y2="20" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          <line x1="4" y1="26" x2="62" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.55" />
          <line x1="6" y1="32" x2="72" y2="32" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
          <line x1="4" y1="38" x2="76" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
          {/* Obscured horizon */}
          <line x1="4" y1="36" x2="76" y2="36" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.2" />
          {/* Dust particles */}
          <circle cx="22" cy="18" r="1" fill="currentColor" opacity="0.5" />
          <circle cx="48" cy="12" r="0.8" fill="currentColor" opacity="0.4" />
          <circle cx="66" cy="24" r="1" fill="currentColor" opacity="0.4" />
          <circle cx="34" cy="28" r="0.8" fill="currentColor" opacity="0.35" />
          <circle cx="56" cy="16" r="0.7" fill="currentColor" opacity="0.3" />
        </svg>
      )
  }
}

function AtmosphereIcon({ selected }: { selected: string }) {
  switch (selected) {
    case 'Tense':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Converging lines to right vanishing point */}
          <line x1="4" y1="28" x2="76" y2="28" stroke="currentColor" strokeWidth="1.8" />
          <line x1="4" y1="22" x2="76" y2="27" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
          <line x1="4" y1="34" x2="76" y2="29" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
          <line x1="4" y1="16" x2="76" y2="26" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <line x1="4" y1="40" x2="76" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <line x1="4" y1="10" x2="76" y2="25" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
          <line x1="4" y1="46" x2="76" y2="31" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
          {/* Vanishing point dot */}
          <circle cx="76" cy="28" r="2.5" fill="currentColor" opacity="0.6" />
        </svg>
      )
    case 'Dreamlike':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Soft wavy lines */}
          <path d="M4,28 C18,20 32,36 46,28 C60,20 72,32 76,28" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path d="M4,20 C18,14 32,26 46,20 C60,14 72,22 76,20" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.5" />
          <path d="M4,36 C18,30 32,42 46,36 C60,30 72,38 76,36" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.5" />
          <path d="M4,14 C18,10 32,18 46,14 C60,10 72,16 76,14" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M4,42 C18,38 32,46 46,42 C60,38 72,44 76,42" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.3" />
        </svg>
      )
    case 'Lonely':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Large empty bounding space */}
          <rect x="4" y="10" width="72" height="40" rx="3" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.18" />
          {/* Single isolated element at bottom-center */}
          <circle cx="40" cy="38" r="3.5" fill="currentColor" opacity="0.85" />
          {/* Thin horizon line */}
          <line x1="4" y1="42" x2="76" y2="42" stroke="currentColor" strokeWidth="0.4" opacity="0.18" />
          {/* Empty sky space indicated by corner dots */}
          <circle cx="12" cy="18" r="0.8" fill="currentColor" opacity="0.12" />
          <circle cx="68" cy="18" r="0.8" fill="currentColor" opacity="0.12" />
        </svg>
      )
    case 'Epic':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Radiating lines from center */}
          {(Array.from({ length: 12 }, (_, i) => {
            const angle = (Math.PI * 2 / 12) * i
            const x2 = 40 + 34 * Math.cos(angle)
            const y2 = 28 + 22 * Math.sin(angle)
            return (
              <line key={i} x1="40" y1="28" x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.4 : 0.6} opacity={i % 3 === 0 ? 0.8 : 0.4} />
            )
          }))}
          {/* Center source */}
          <circle cx="40" cy="28" r="5" fill="currentColor" opacity="0.9" />
          <circle cx="40" cy="28" r="9" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4" />
        </svg>
      )
    case 'Romantic':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Gentle S-curves */}
          <path d="M6,28 C22,16 38,40 54,28 C62,22 70,30 76,28" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path d="M6,20 C22,10 38,30 54,20 C62,15 70,22 76,20" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.45" />
          <path d="M6,36 C22,26 38,46 54,36 C62,31 70,38 76,36" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.45" />
          {/* Soft glow spots */}
          <circle cx="22" cy="26" r="6" stroke="currentColor" strokeWidth="0.4" fill="none" opacity="0.2" />
          <circle cx="56" cy="30" r="5" stroke="currentColor" strokeWidth="0.4" fill="none" opacity="0.2" />
        </svg>
      )
    case 'Oppressive':
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Dense horizontal bars, heavy at top */}
          {(Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x="4" y={10 + i * 6} width="72" height={5 - i * 0.3} rx="0.5" fill="currentColor" opacity={0.62 - i * 0.06} />
          )))}
          {/* Thin breathing room at bottom */}
          <line x1="4" y1="50" x2="76" y2="50" stroke="currentColor" strokeWidth="0.4" opacity="0.15" />
        </svg>
      )
    default: // Suspense
      return (
        <svg viewBox="0 0 80 56" fill="none" className="w-full max-h-[52px]">
          {/* Irregular asymmetric lines */}
          <line x1="4" y1="22" x2="34" y2="22" stroke="currentColor" strokeWidth="1.6" />
          <line x1="44" y1="22" x2="76" y2="22" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
          <line x1="4" y1="30" x2="20" y2="30" stroke="currentColor" strokeWidth="0.8" opacity="0.45" />
          <line x1="34" y1="30" x2="68" y2="30" stroke="currentColor" strokeWidth="1.6" />
          <line x1="4" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
          <line x1="4" y1="38" x2="50" y2="38" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
          {/* Asymmetric shadow block */}
          <rect x="52" y="16" width="7" height="22" rx="1" fill="currentColor" opacity="0.18" />
          {/* Isolated element in corner */}
          <circle cx="70" cy="42" r="2" fill="currentColor" opacity="0.5" />
        </svg>
      )
  }
}

const COLOR_SWATCHES: Record<string, [string, string, string]> = {
  'Teal & Orange': ['#0f766e', '#14b8a6', '#f97316'],
  'Cold Blue': ['#1e3a5f', '#2563eb', '#93c5fd'],
  'Warm Amber': ['#78350f', '#d97706', '#fcd34d'],
  'Black & Gold': ['#0a0805', '#92400e', '#d4af37'],
  'Neon Purple': ['#3b0764', '#7c3aed', '#f0abfc'],
  'Desaturated': ['#1f2937', '#6b7280', '#d1d5db'],
  'Monochrome': ['#030712', '#4b5563', '#f9fafb'],
}

function ColorMoodIcon({ selected }: { selected: string }) {
  const colors = COLOR_SWATCHES[selected] ?? ['#1e293b', '#475569', '#cbd5e1']
  return (
    <svg viewBox="0 0 80 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-h-[52px]">
      <rect x="4" y="12" width="22" height="32" rx="2" fill={colors[0]} />
      <rect x="28" y="12" width="24" height="32" rx="2" fill={colors[1]} />
      <rect x="54" y="12" width="22" height="32" rx="2" fill={colors[2]} />
      {/* Border overlay */}
      <rect x="4" y="12" width="72" height="32" rx="2" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.25" />
      {/* Division lines */}
      <line x1="26" y1="12" x2="26" y2="44" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
      <line x1="52" y1="12" x2="52" y2="44" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
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
  key: keyof SceneLightingSettings
  title: string
  titleEn: string
  options: WheelOption[]
  renderVisual: (value: string) => React.ReactNode
}

const LIGHTING_SLOTS: SlotDef[] = [
  {
    key: 'lightingSetup',
    title: '光线类型',
    titleEn: 'Lighting Setup',
    renderVisual: (v) => <LightingSetupIcon selected={v} />,
    options: [
      { value: 'Key Light', label: '主光', sublabel: 'Key Light', note: '主光明确 · 人物轮廓清晰 · 标准电影布光' },
      { value: 'Backlight', label: '逆光', sublabel: 'Backlight', note: '从背后打光 · 边缘发光 · 神秘轮廓感' },
      { value: 'Neon Light', label: '霓虹光', sublabel: 'Neon Light', note: '彩色霓虹反射 · 赛博城市感 · 彩色混光' },
      { value: 'Low Key', label: '低调光', sublabel: 'Low Key', note: '高对比 · 大面积暗部 · 悬疑压迫感' },
      { value: 'Soft Window Light', label: '窗光', sublabel: 'Window Light', note: '柔和侧面窗光 · 自然真实 · 情感温暖' },
      { value: 'Top Light', label: '顶光', sublabel: 'Top Light', note: '从正上方打光 · 压迫审讯感 · 眼窝深陷' },
    ],
  },
  {
    key: 'timeWeather',
    title: '时间/天气',
    titleEn: 'Time & Weather',
    renderVisual: (v) => <TimeWeatherIcon selected={v} />,
    options: [
      { value: 'Dawn Mist', label: '黎明薄雾', sublabel: 'Dawn Mist', note: '黎明前蓝灰光 · 地面雾层 · 静谧空灵' },
      { value: 'Golden Hour', label: '黄金时刻', sublabel: 'Golden Hour', note: '日落黄金光 · 暖橙色调 · 长影拖地' },
      { value: 'Midnight Rain', label: '午夜暴雨', sublabel: 'Midnight Rain', note: '雨夜湿地反光 · 雨丝划过 · 城市暗夜' },
      { value: 'Snow Night', label: '雪夜', sublabel: 'Snow Night', note: '月光雪地 · 飘落雪花 · 冷静孤独感' },
      { value: 'Overcast Day', label: '阴天', sublabel: 'Overcast Day', note: '平均漫射光 · 无硬影 · 低饱和灰调' },
      { value: 'Dust Storm', label: '沙尘风暴', sublabel: 'Dust Storm', note: '橙黄雾霾 · 视线受阻 · 荒漠戏剧感' },
    ],
  },
  {
    key: 'atmosphere',
    title: '场景氛围',
    titleEn: 'Atmosphere',
    renderVisual: (v) => <AtmosphereIcon selected={v} />,
    options: [
      { value: 'Tense', label: '紧张', sublabel: 'Tense', note: '压缩画面 · 一触即发 · 克制的危险感' },
      { value: 'Dreamlike', label: '梦幻', sublabel: 'Dreamlike', note: '边界柔化 · 超现实安静 · 梦与现实模糊' },
      { value: 'Lonely', label: '孤独', sublabel: 'Lonely', note: '巨大留白 · 孤立主体 · 深沉的寂静' },
      { value: 'Epic', label: '史诗', sublabel: 'Epic', note: '宏大尺度 · 英雄光线 · 传奇与壮丽' },
      { value: 'Romantic', label: '浪漫', sublabel: 'Romantic', note: '温柔近光 · 情感亲密 · 轻柔虚化' },
      { value: 'Oppressive', label: '压迫', sublabel: 'Oppressive', note: '沉重视觉 · 密不透气 · 无处逃脱感' },
      { value: 'Suspense', label: '悬疑', sublabel: 'Suspense', note: '不对称阴影 · 隐藏威胁 · 静默中的恐惧' },
    ],
  },
  {
    key: 'colorMood',
    title: '色彩基调',
    titleEn: 'Color Mood',
    renderVisual: (v) => <ColorMoodIcon selected={v} />,
    options: [
      { value: 'Teal & Orange', label: '青橙', sublabel: 'Teal & Orange', note: '互补色对比 · 好莱坞电影感 · 冷暖冲突' },
      { value: 'Cold Blue', label: '冷蓝', sublabel: 'Cold Blue', note: '钢铁蓝灰 · 情感距离 · 惊悚冷静' },
      { value: 'Warm Amber', label: '暖琥珀', sublabel: 'Warm Amber', note: '金色怀旧 · 温暖亲切 · 阳光记忆' },
      { value: 'Black & Gold', label: '黑金', sublabel: 'Black & Gold', note: '深邃黑暗 · 奢华金调 · 权力与魅力' },
      { value: 'Neon Purple', label: '霓虹紫', sublabel: 'Neon Purple', note: '电气紫霓 · 赛博梦境 · 超饱和夜景' },
      { value: 'Desaturated', label: '低饱和', sublabel: 'Desaturated', note: '接近单色 · 纪录片真实 · 克制审美' },
      { value: 'Monochrome', label: '黑白', sublabel: 'Monochrome', note: '纯粹黑白 · 经典永恒 · 图形化视觉' },
    ],
  },
]

// ─── Single slot card (same drum-wheel pattern as CinematicCameraControlPanel) ─

function LightingWheelSlot({
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
          <div className="text-[13px] font-bold text-white leading-tight">{curr?.label ?? '—'}</div>
          {curr?.sublabel ? (
            <div className="text-[9px] text-violet-300/55 mt-0.5">{curr.sublabel}</div>
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

// ─── Active setting count ──────────────────────────────────────────────────────

function activeCount(settings: SceneLightingSettings): number {
  return [settings.lightingSetup, settings.timeWeather, settings.atmosphere, settings.colorMood].filter(Boolean).length
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SceneLightingControlPanelProps {
  open: boolean
  value: SceneLightingSettings
  onChange: (value: SceneLightingSettings) => void
  onClose: () => void
  onCreateDerived?: (settings: SceneLightingSettings) => void
}

export function SceneLightingControlPanel({
  open,
  value,
  onChange,
  onClose,
  onCreateDerived,
}: SceneLightingControlPanelProps) {
  if (!open) return null

  const patch = (key: keyof SceneLightingSettings, v: string) => {
    onChange({ ...value, [key]: v })
  }

  const clearAll = () => onChange({ ...DEFAULT_SCENE_LIGHTING })
  const count = activeCount(value)

  return (
    <div
      className="fixed inset-0 z-[92] flex items-end justify-center bg-black/25 sm:items-center"
      role="presentation"
      data-no-node-drag="true"
      data-scene-lighting-control="true"
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
        aria-label="场景光线控制 / Lighting & Atmosphere"
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
            <p className="text-[9px] uppercase tracking-[0.2em] text-amber-300/40">Lighting & Atmosphere</p>
            <h2 className="mt-0.5 text-lg font-semibold text-white">场景光线控制</h2>
            <p className="mt-1.5 max-w-[400px] text-[11px] leading-relaxed text-white/40">
              用导演语言设置当前场景的光线、时间天气、氛围和色彩基调。选择结果自动注入生成提示词，保持场景一致性。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {count > 0 ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-2.5 py-0.5 text-[10px] font-semibold text-amber-300/70">
                💡 {count} 项已设定
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
            {onCreateDerived ? (
              <button
                type="button"
                onClick={() => onCreateDerived(value)}
                className="rounded-md border border-amber-500/30 bg-amber-500/[0.08] px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/[0.15]"
              >
                创建光线版本
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
            {LIGHTING_SLOTS.map((slotDef) => (
              <LightingWheelSlot
                key={slotDef.key}
                slotDef={slotDef}
                value={value[slotDef.key]}
                onChange={(v) => patch(slotDef.key, v)}
              />
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-4 rounded-xl border border-amber-500/[0.12] bg-amber-500/[0.04] px-4 py-3">
            <p className="text-[10px] leading-relaxed text-amber-200/40">
              <strong className="text-amber-200/60">提示：</strong>
              场景光线设定以「导演注释」形式附加在生成提示词末尾，紧随摄影机控制之后。不影响角色/场景圣经、不修改原有 prompt。
              {count === 0 ? '请在上方四个滚轮中至少选择一项以激活场景光线控制。' : `当前已激活 ${count} 项，生成时将自动应用。`}
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
