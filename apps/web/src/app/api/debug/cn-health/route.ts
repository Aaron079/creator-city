import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

// Public proxy to cn-executor /health (no secrets returned — health only checks env presence)
export async function GET(request: NextRequest) {
  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  const secret = process.env.CREATOR_EXECUTOR_SHARED_SECRET?.trim() ?? ''
  if (!cnBaseUrl) {
    return NextResponse.json({ ok: false, error: 'CREATOR_CN_API_BASE_URL not set on Vercel' })
  }

  const { searchParams } = new URL(request.url)
  const includeSeedreamDebug = searchParams.get('seedream') === '1'

  try {
    const [healthResp, seedreamResp] = await Promise.all([
      fetch(`${cnBaseUrl}/health`, { signal: AbortSignal.timeout(8_000) }),
      includeSeedreamDebug
        ? fetch(`${cnBaseUrl}/debug/seedream-config`, {
            headers: { 'x-creator-executor-secret': secret, Authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(8_000),
          })
        : Promise.resolve(null),
    ])
    const healthData = await healthResp.json()
    const seedreamData = seedreamResp ? await seedreamResp.json().catch(() => null) : null
    return NextResponse.json({
      ok: true,
      httpStatus: healthResp.status,
      cnHealth: healthData,
      ...(seedreamData ? { seedreamConfig: seedreamData } : {}),
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
