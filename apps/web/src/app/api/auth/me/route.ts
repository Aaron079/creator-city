import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonOk } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonOk({ authenticated: false, user: null, profile: null })
    }
    return jsonOk({
      authenticated: true,
      user,
      profile: user.profile,
    })
  } catch (error) {
    console.error('[auth/me] failed', error)
    // Return HTTP 200 so the frontend can handle this gracefully instead of crashing.
    // The DB session lookup may fail transiently; treat it as "not authenticated for now".
    return NextResponse.json({
      success: false,
      authenticated: false,
      user: null,
      profile: null,
      errorCode: 'auth_me_db_error',
      message: '读取登录状态失败，请稍后重试。',
    }, { status: 200 })
  }
}
