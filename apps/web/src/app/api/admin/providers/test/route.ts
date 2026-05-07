import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { testProviderConnection } from '@/lib/admin/provider-management'

export const dynamic = 'force-dynamic'

type ProviderTestBody = {
  providerId?: string
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限：仅管理员可访问。' }, { status: 403 })

  let body: ProviderTestBody
  try {
    body = await request.json() as ProviderTestBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.providerId) {
    return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT', message: 'providerId is required' }, { status: 400 })
  }

  try {
    const result = await testProviderConnection(body.providerId)
    return NextResponse.json({
      success: true,
      providerId: body.providerId,
      ok: result.ok,
      status: result.status,
      message: result.message,
      missingEnvKeys: result.missingEnvKeys,
    })
  } catch (error) {
    console.error('[admin/providers/test]', error)
    return NextResponse.json({
      success: false,
      providerId: body.providerId,
      ok: false,
      status: 'error',
      errorCode: 'PROVIDER_TEST_FAILED',
      message: error instanceof Error ? error.message : '测试连接失败。',
    }, { status: 500 })
  }
}
