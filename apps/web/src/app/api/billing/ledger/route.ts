import { NextRequest, NextResponse } from 'next/server'
import { extractBearerToken } from '@/lib/credits/jwt-decode'
import { listLedger } from '@/lib/billing/ledger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized', message: '请先登录查看账本' }, { status: 401 })
  try {
    return NextResponse.json(await listLedger(token))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ledger backend unavailable'
    return NextResponse.json({ error: 'BILLING_BACKEND_UNAVAILABLE', message }, { status: 503 })
  }
}
