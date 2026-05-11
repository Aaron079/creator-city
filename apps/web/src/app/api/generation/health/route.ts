import { NextResponse } from 'next/server'
import { getGenerationHealth } from '@/lib/generation/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getGenerationHealth(), { status: 200 })
}
