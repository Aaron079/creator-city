import { NextRequest, NextResponse } from 'next/server'
import { getSessionToken, clearSessionCookie } from '@/lib/auth/cookies'
import { deleteSession } from '@/lib/auth/session'

export async function POST(_req: NextRequest) {
  const token = getSessionToken()
  if (token) {
    await deleteSession(token)
  }
  clearSessionCookie()
  return NextResponse.json({ ok: true })
}
