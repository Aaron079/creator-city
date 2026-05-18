import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

// Public proxy to cn-executor /health (no secrets returned — health only checks env presence)
export async function GET() {
  const cnBaseUrl = process.env.CREATOR_CN_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
  if (!cnBaseUrl) {
    return NextResponse.json({ ok: false, error: 'CREATOR_CN_API_BASE_URL not set on Vercel' })
  }
  try {
    const resp = await fetch(`${cnBaseUrl}/health`, { signal: AbortSignal.timeout(8_000) })
    const data = await resp.json()
    return NextResponse.json({ ok: true, httpStatus: resp.status, cnHealth: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
