import { NextResponse } from 'next/server'
import { getAllGatewayPricing } from '@/lib/gateway/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ pricing: getAllGatewayPricing() })
}
