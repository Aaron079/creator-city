// ─── Types ────────────────────────────────────────────────────────────────────

export interface SplitMember {
  userId: string
  name:   string
  split:  number   // percentage weight — e.g. 50, 30, 20
}

export interface SplitPayout {
  userId: string
  name:   string
  weight: number   // original split weight
  amount: number   // final CNY amount
}

export interface SplitResult {
  platformFee:  number
  remaining:    number
  payouts:      SplitPayout[]
  platformRate: number   // always 0.3 — stored for display
}

// ─── Engine ───────────────────────────────────────────────────────────────────

const PLATFORM_RATE = 0.3

/**
 * Pure mock split calculation — no network calls.
 * Distributes (totalPrice × 0.7) among members pro-rata by their split weights.
 * Falls back to equal distribution when total weight is zero.
 */
export function generateSplit({
  totalPrice,
  members,
}: {
  totalPrice: number
  members:    SplitMember[]
}): SplitResult {
  const platformFee = Math.round(totalPrice * PLATFORM_RATE)
  const remaining   = totalPrice - platformFee

  const totalWeight = members.reduce((sum, m) => sum + m.split, 0)
  const equalShare  = members.length > 0 ? Math.round(remaining / members.length) : 0

  const payouts: SplitPayout[] = members.map((m) => ({
    userId: m.userId,
    name:   m.name,
    weight: m.split,
    amount: totalWeight > 0
      ? Math.round(remaining * (m.split / totalWeight))
      : equalShare,
  }))

  return {
    platformFee,
    remaining,
    payouts,
    platformRate: PLATFORM_RATE,
  }
}
