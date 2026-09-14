import { getSessionToken } from '@/lib/auth/cookies'
import { getSession } from '@/lib/auth/session'

export async function getGenerationAccess() {
  try {
    // Generation spends provider funds: never authorize from the UI identity cache.
    const token = getSessionToken()
    const session = token ? await getSession(token) : null
    const user = session?.user
    if (!user) return { ok: false as const, status: 401, errorCode: 'UNAUTHENTICATED', message: '请先登录。' }
    if (user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
      return { ok: false as const, status: 403, errorCode: 'ADMIN_GENERATION_ONLY', message: '当前为管理员内测阶段，暂未开放生成权限。' }
    }
    return { ok: true as const, user: { id: user.id, role: user.role, status: user.status } }
  } catch {
    return { ok: false as const, status: 503, errorCode: 'GENERATION_AUTH_UNAVAILABLE', message: '登录权限暂时无法确认，请稍后重试。' }
  }
}

export async function generationAccessResponse(): Promise<Response | null> {
  const access = await getGenerationAccess()
  if (access.ok) return null
  return Response.json({ success: false, errorCode: access.errorCode, message: access.message }, { status: access.status })
}
