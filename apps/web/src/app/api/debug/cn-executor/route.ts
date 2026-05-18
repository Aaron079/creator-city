import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

export async function GET() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const secretConfigured = Boolean(process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim())
  const secretLength = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim().length ?? 0

  if (!cnBaseUrl) {
    return NextResponse.json({
      ok: false,
      error: 'CREATOR_CN_API_BASE_URL not set',
      cnBaseUrlConfigured: false,
      secretConfigured,
      secretLength,
    })
  }

  // Test /health (no auth required)
  let healthResult: unknown = null
  let healthStatus: number | null = null
  let healthError: string | null = null
  try {
    const resp = await fetch(`${cnBaseUrl}/health`, { signal: AbortSignal.timeout(8_000) })
    healthStatus = resp.status
    const text = await resp.text()
    try { healthResult = JSON.parse(text) } catch { healthResult = text.slice(0, 300) }
  } catch (err) {
    healthError = err instanceof Error ? err.message : String(err)
  }

  // Test auth: POST with empty body — expect 400 (bad request), NOT 401
  let authStatus: number | null = null
  let authResult: unknown = null
  let authError: string | null = null
  try {
    const resp = await fetch(`${cnBaseUrl}/api/jobs/run-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CREATOR_EXECUTOR_SHARED_SECRET ?? ''}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8_000),
    })
    authStatus = resp.status
    const text = await resp.text()
    try { authResult = JSON.parse(text) } catch { authResult = text.slice(0, 300) }
  } catch (err) {
    authError = err instanceof Error ? err.message : String(err)
  }

  const authOk = authStatus !== null && authStatus !== 401
  return NextResponse.json({
    ok: true,
    cnBaseUrlConfigured: true,
    cnBaseUrlLength: cnBaseUrl.length,
    secretConfigured,
    secretLength,
    health: { status: healthStatus, result: healthResult, error: healthError },
    authTest: {
      status: authStatus,
      result: authResult,
      error: authError,
      authOk,
      interpretation: authStatus === 401
        ? 'AUTH FAILED — secret mismatch or old cn-executor code without Bearer support'
        : authStatus === 400
          ? 'AUTH OK — cn-executor accepted Bearer token (400=missing generationJobId is expected)'
          : authStatus === 200
            ? 'AUTH OK — cn-executor processed request'
            : authStatus === null
              ? `NETWORK ERROR: ${authError}`
              : `unexpected HTTP ${authStatus}`,
    },
  })
}
