import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Proxies to cn-executor /debug/seedream-real-probe which calls Volcengine with
// VALID params (size=2048x2048) and returns the raw Volcengine HTTP response.
// This exposes auth errors that only appear during actual inference, not param validation.
export async function GET() {
  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
  if (!cnBaseUrl) {
    return NextResponse.json({ ok: false, error: 'CREATOR_CN_API_BASE_URL not set' })
  }
  try {
    const resp = await fetch(`${cnBaseUrl}/debug/seedream-real-probe`, {
      headers: {
        'x-creator-executor-secret': secret,
        Authorization: `Bearer ${secret}`,
      },
      signal: AbortSignal.timeout(55_000),
    })
    const data = await resp.json()
    return NextResponse.json({ ok: true, httpStatus: resp.status, probe: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
