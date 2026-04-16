// ─── User & Identity ──────────────────────────────────────────────────────────

export type UserRole = 'CREATOR' | 'PRODUCER' | 'DIRECTOR' | 'INVESTOR' | 'ADMIN'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BANNED' | 'PENDING_VERIFICATION'

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl?: string
  role: UserRole
  status: UserStatus
  reputation: number
  level: number
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile extends User {
  bio?: string
  portfolioUrl?: string
  skills: string[]
  socialLinks: SocialLinks
  stats: UserStats
}

export interface SocialLinks {
  twitter?: string
  instagram?: string
  youtube?: string
  website?: string
}

export interface UserStats {
  projectsCompleted: number
  collaborations: number
  followers: number
  following: number
  totalEarnings: number
}

export interface AuthTokenPayload {
  sub: string
  username: string
  role: UserRole
  iat?: number
  exp?: number
}
