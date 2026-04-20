import type { Creator } from '@/lib/user/creator'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendInput {
  style: string  // free-form text — job title + description keywords
}

export interface RankedCreator extends Creator {
  score:       number   // 0-1, higher is better
  styleMatch:  boolean  // whether a creator tag matched the job style text
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function computeStyleMatch(creator: Creator, style: string): 0 | 1 {
  const lower = style.toLowerCase()
  return creator.tags.some((tag) => lower.includes(tag.toLowerCase())) ? 1 : 0
}

function normalise(value: number, max: number): number {
  return max > 0 ? Math.min(1, value / max) : 0
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Rank creators for a job and return the top N candidates.
 *
 * Score formula (all components normalised to [0, 1]):
 *   score = styleMatch × 0.4  + successRate × 0.2 + rating × 0.2 + earnings × 0.2
 */
export function recommendCreators(
  input:    RecommendInput,
  creators: Creator[],
  top       = 3,
): RankedCreator[] {
  if (creators.length === 0) return []

  const maxEarnings = Math.max(...creators.map((c) => c.totalEarnings), 1)

  const ranked: RankedCreator[] = creators.map((creator) => {
    const styleMatch   = computeStyleMatch(creator, input.style)
    const ratingNorm   = normalise(creator.rating, 5)
    const successNorm  = normalise(creator.successRate, 100)
    const earningsNorm = normalise(creator.totalEarnings, maxEarnings)

    const score =
      styleMatch   * 0.4 +
      successNorm  * 0.2 +
      ratingNorm   * 0.2 +
      earningsNorm * 0.2

    return { ...creator, score, styleMatch: styleMatch === 1 }
  })

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, top)
}
