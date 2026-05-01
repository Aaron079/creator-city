'use client'

export interface AuthUserPublic {
  id: string
  email: string
  displayName: string
  username: string | null
  role: string
  avatarUrl: string | null
  profile: {
    username: string | null
    bio: string | null
    city: string | null
    company: string | null
    websiteUrl: string | null
  } | null
}

export interface MeResponse {
  authenticated: boolean
  user: AuthUserPublic | null
  profile: AuthUserPublic['profile']
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (!res.ok) return { authenticated: false, user: null, profile: null }
  return res.json() as Promise<MeResponse>
}

export async function clientLogin(email: string, password: string): Promise<AuthUserPublic> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  const data = await res.json() as { user?: AuthUserPublic; message?: string }
  if (!res.ok) throw new Error(data.message ?? '登录失败')
  if (!data.user) throw new Error('登录失败')
  return data.user
}

export async function clientRegister(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthUserPublic> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
    credentials: 'include',
  })
  const data = await res.json() as { user?: AuthUserPublic; message?: string }
  if (!res.ok) throw new Error(data.message ?? '注册失败')
  if (!data.user) throw new Error('注册失败')
  return data.user
}

export async function clientLogout(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}
