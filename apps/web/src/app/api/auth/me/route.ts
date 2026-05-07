import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'

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
    return jsonError('AUTH_ME_FAILED', safeErrorMessage(error, '读取登录状态失败。'), 500)
  }
}
