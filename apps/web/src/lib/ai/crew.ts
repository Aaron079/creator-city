import type { DirectorTask } from './director'
import type { CreatorUser } from '@/lib/data/creators'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrewMember {
  userId:   string
  name:     string
  role:     string
  roleIcon: string
  rating:   number
  score:    number
  avatar:   string
  accent:   string
}

export interface GenerateCrewParams {
  idea:          string
  tasks:         DirectorTask[]
  users:         CreatorUser[]
  collaborated?: string[]   // userIds with existing relationship history
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreCandidate(user: CreatorUser, collaborated: string[]): number {
  let score = 50                                        // base: role already matched by filter
  score += user.rating * 10                             // max +49
  score += Math.min(user.casesCount / 10, 5)            // max +5
  if (collaborated.includes(user.id)) score += 30      // prior collaboration bonus
  return Math.round(score)
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Pure keyword/score matching — no network calls.
 * Returns one best-matched member per unique role found in tasks.
 */
export function generateCrew({ tasks, users, collaborated = [] }: GenerateCrewParams): CrewMember[] {
  const rolesNeeded = [...new Set(tasks.map((t) => t.role))]
  const members: CrewMember[] = []
  const usedIds = new Set<string>()

  for (const role of rolesNeeded) {
    const ranked = users
      .filter((u) => u.role === role && !usedIds.has(u.id))
      .map((u) => ({ user: u, score: scoreCandidate(u, collaborated) }))
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]
    if (!best) continue

    usedIds.add(best.user.id)
    members.push({
      userId:   best.user.id,
      name:     best.user.name,
      role,
      roleIcon: best.user.roleIcon,
      rating:   best.user.rating,
      score:    best.score,
      avatar:   best.user.avatar,
      accent:   best.user.accent,
    })
  }

  return members
}

/**
 * Returns the next-best candidate for a given role, excluding all already-used userIds.
 */
export function findReplacement(
  role:          string,
  users:         CreatorUser[],
  excludeIds:    string[],
  collaborated:  string[] = [],
): CrewMember | null {
  const ranked = users
    .filter((u) => u.role === role && !excludeIds.includes(u.id))
    .map((u) => ({ user: u, score: scoreCandidate(u, collaborated) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best) return null

  return {
    userId:   best.user.id,
    name:     best.user.name,
    role,
    roleIcon: best.user.roleIcon,
    rating:   best.user.rating,
    score:    best.score,
    avatar:   best.user.avatar,
    accent:   best.user.accent,
  }
}
