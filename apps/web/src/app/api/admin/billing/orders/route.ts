import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken, decodeJwtPayload } from '@/lib/credits/jwt-decode'
import { getApiBase, readJson } from '@/lib/billing/server-api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (decodeJwtPayload(token)?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const res = await fetch(`${getApiBase()}/api/v1/credits/admin/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch orders' }, { status: res.status })
    return NextResponse.json({ orders: await readJson<unknown>(res) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing backend unavailable'
    return NextResponse.json({ error: 'BILLING_BACKEND_UNAVAILABLE', message }, { status: 503 })
  }
}
