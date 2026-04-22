import type { DirectorTask } from './director'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QualityLevel = 'standard' | 'premium'

export interface PriceBreakdown {
  role:      string
  roleIcon:  string
  dayRate:   number   // per-day base rate before quality multiplier
  days:      number
  price:     number   // final: dayRate × days × qualityMultiplier
}

export interface PricingResult {
  totalPrice: number
  breakdown:  PriceBreakdown[]
  duration:   number
  quality:    QualityLevel
}

export interface PricingParams {
  tasks:    DirectorTask[]
  duration: number        // working days
  quality:  QualityLevel
}

// ─── Base rates (per day, CNY) ────────────────────────────────────────────────

const DAY_RATES: Record<string, number> = {
  '导演':   2000,
  '摄影师': 1500,
  '剪辑师': 1200,
  '配乐':    800,
}

const ROLE_ICONS: Record<string, string> = {
  '导演':   '🎬',
  '摄影师': '📷',
  '剪辑师': '✂️',
  '配乐':   '🎵',
}

const QUALITY_MULTIPLIER: Record<QualityLevel, number> = {
  standard: 1.0,
  premium:  1.5,
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Pure mock price estimation — no network calls.
 * Aggregates unique roles from tasks, applies day-rate × duration × quality.
 */
export function generatePrice({ tasks, duration, quality }: PricingParams): PricingResult {
  const multiplier = QUALITY_MULTIPLIER[quality]
  const uniqueRoles = [...new Set(tasks.map((t) => t.role))]

  const breakdown: PriceBreakdown[] = uniqueRoles.map((role) => {
    const dayRate = DAY_RATES[role] ?? 1000
    const price   = Math.round(dayRate * duration * multiplier)
    return {
      role,
      roleIcon: ROLE_ICONS[role] ?? '👤',
      dayRate,
      days:     duration,
      price,
    }
  })

  const totalPrice = breakdown.reduce((sum, b) => sum + b.price, 0)

  return { totalPrice, breakdown, duration, quality }
}
