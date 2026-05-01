import { getSessionToken } from './cookies'
import { getSession } from './session'

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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = getSessionToken()
  if (!token) return null

  const session = await getSession(token)
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

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.AUTH_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}
