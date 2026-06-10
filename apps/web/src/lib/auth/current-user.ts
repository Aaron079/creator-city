import { getSessionToken } from './cookies'
import { getSession, hashToken } from './session'

export interface CurrentUser {
  id: string
  email: string
  displayName: string
  username: string | null
  role: string
  status: string
  avatarUrl: string | null
  profile: {
    username: string | null
    bio: string | null
    city: string | null
    company: string | null
    websiteUrl: string | null
  } | null
}

// In-memory session cache to avoid redundant DB round-trips within the same
// function instance and to survive brief DB blips (Supabase cold start / pool
// exhaustion). TTL is intentionally short (90 s) so revoked sessions still
// expire quickly. The cache is keyed by tokenHash (never the raw token).
const SESSION_CACHE_TTL_MS = 90_000
const sessionCache = new Map<string, { user: CurrentUser; expiresAt: number }>()

function mapSessionToUser(session: Awaited<ReturnType<typeof getSession>>): CurrentUser | null {
  if (!session) return null
  const { user } = session
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username ?? null,
    role: user.role,
    status: user.status,
    avatarUrl: user.profile?.avatarUrl ?? null,
    profile: user.profile
      ? {
          username: user.profile.username ?? null,
          bio: user.profile.bio ?? null,
          city: user.profile.city ?? null,
          company: user.profile.company ?? null,
          websiteUrl: user.profile.websiteUrl ?? null,
        }
      : null,
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getSessionToken()
  if (!token) return null

  const tokenHash = hashToken(token)
  const now = Date.now()

  // Return a fresh cache hit immediately (avoids DB on every request when warm).
  const cached = sessionCache.get(tokenHash)
  if (cached && cached.expiresAt > now) {
    return cached.user
  }

  try {
    const session = await getSession(token)
    if (!session) {
      sessionCache.delete(tokenHash)
      return null
    }
    const currentUser = mapSessionToUser(session)
    if (currentUser) {
      sessionCache.set(tokenHash, { user: currentUser, expiresAt: now + SESSION_CACHE_TTL_MS })
    }
    return currentUser
  } catch (error) {
    const code = (error as Error & { code?: string })?.code
    if (code === 'SESSION_DB_UNAVAILABLE' && cached) {
      // DB is temporarily unavailable but we have a recent cached identity.
      // Use the stale entry so protected routes can still serve the user.
      console.warn('[auth/current-user] DB unavailable — using stale session cache for', tokenHash.slice(0, 8))
      return cached.user
    }
    throw error
  }
}

export function evictSessionCache(token: string): void {
  sessionCache.delete(hashToken(token))
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.AUTH_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}
