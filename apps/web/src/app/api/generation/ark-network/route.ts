import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED' }, { status: 401 })
  }

  const baseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim()
  if (!baseUrl) {
    return NextResponse.json({
      success: false,
      errorCode: 'cn_executor_not_configured',
      message: 'CREATOR_CN_API_BASE_URL is not set — cn-executor not configured.',
    }, { status: 200 })
  }

  const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
  let response: Response
  try {
    response = await fetch(`${baseUrl}/debug/ark-network`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(secret ? { 'x-creator-executor-secret': secret } : {}),
      },
      signal: AbortSignal.timeout(25_000),
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      errorCode: 'cn_executor_unreachable',
      message: `Cannot reach cn-executor: ${err instanceof Error ? err.message : String(err)}`,
      cnExecutorBaseUrl: baseUrl,
    }, { status: 200 })
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return NextResponse.json({
      success: false,
      errorCode: 'cn_executor_invalid_response',
      message: `cn-executor returned HTTP ${response.status} with non-JSON body`,
    }, { status: 200 })
  }

  return NextResponse.json({ success: response.ok, ...((body && typeof body === 'object') ? body as Record<string, unknown> : { raw: body }) }, { status: 200 })
}
