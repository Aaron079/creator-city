export interface DerivedToolVisual {
  icon: string
  accentClass: string
  borderClass: string
  bgClass: string
}

const DERIVED_TOOL_VISUALS: Record<string, DerivedToolVisual> = {
  'camera-lexicon': {
    icon: '🎬',
    accentClass: 'text-cyan-300/80',
    borderClass: 'border-cyan-400/20',
    bgClass: 'bg-cyan-950/40',
  },
  'camera-control': {
    icon: '🎥',
    accentClass: 'text-violet-300/80',
    borderClass: 'border-violet-400/20',
    bgClass: 'bg-violet-950/40',
  },
  'scene-lighting': {
    icon: '💡',
    accentClass: 'text-amber-300/80',
    borderClass: 'border-amber-400/20',
    bgClass: 'bg-amber-950/40',
  },
  'prompt-booster': {
    icon: '✨',
    accentClass: 'text-indigo-300/80',
    borderClass: 'border-indigo-400/20',
    bgClass: 'bg-indigo-950/40',
  },
  'look-package': {
    icon: '🎨',
    accentClass: 'text-pink-300/80',
    borderClass: 'border-pink-400/20',
    bgClass: 'bg-pink-950/40',
  },
}

const DEFAULT_VISUAL: DerivedToolVisual = {
  icon: '↳',
  accentClass: 'text-violet-300/60',
  borderClass: 'border-violet-400/15',
  bgClass: 'bg-violet-950/30',
}

export function getDerivedToolVisual(toolId: string | undefined): DerivedToolVisual {
  if (!toolId) return DEFAULT_VISUAL
  return DERIVED_TOOL_VISUALS[toolId] ?? DEFAULT_VISUAL
}
