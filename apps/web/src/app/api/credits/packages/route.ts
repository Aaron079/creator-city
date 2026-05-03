import { NextResponse } from 'next/server'
import { listCreditPackages } from '@/lib/billing/packages'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ packages: listCreditPackages() })
}
