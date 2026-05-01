import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, profile: null })
  }
  return NextResponse.json({
    authenticated: true,
    user,
    profile: user.profile,
  })
}
