import { NextRequest, NextResponse } from 'next/server'
import { getSessionToken, clearSessionCookie } from '@/lib/auth/cookies'
import { deleteSession } from '@/lib/auth/session'
import { evictSessionCache } from '@/lib/auth/current-user'

export async function POST(_req: NextRequest) {
  const token = getSessionToken()
  if (token) {
    evictSessionCache(token)
    await deleteSession(token)
  }
  clearSessionCookie()
  return NextResponse.json({ ok: true })
}
