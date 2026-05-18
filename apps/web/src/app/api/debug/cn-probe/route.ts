import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Proxy to cn-executor /debug/seedream-model-probe — tests a real tiny generation call
export async function GET() {
  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
  if (!cnBaseUrl) {
    return NextResponse.json({ ok: false, error: 'CREATOR_CN_API_BASE_URL not set' })
  }
  try {
    const resp = await fetch(`${cnBaseUrl}/debug/seedream-model-probe`, {
      headers: {
        'x-creator-executor-secret': secret,
        Authorization: `Bearer ${secret}`,
      },
      signal: AbortSignal.timeout(25_000),
    })
    const data = await resp.json()
    return NextResponse.json({ ok: true, httpStatus: resp.status, probe: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
