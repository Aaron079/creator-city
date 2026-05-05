import { NextResponse } from 'next/server'
import { getAllGatewayPricing } from '@/lib/gateway/pricing'
import { db } from '@/lib/db'
import {
  PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
  PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
  isProviderGatewaySchemaMissing,
} from '@/lib/gateway/schema-errors'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await db.providerPricingRule.findMany({
      where: { isActive: true },
      orderBy: [{ providerId: 'asc' }, { nodeType: 'asc' }, { modelId: 'asc' }],
    })

    if (rows.length === 0) {
      return NextResponse.json({ pricing: getAllGatewayPricing(), source: 'default' })
    }

    return NextResponse.json({
      pricing: rows.map((row) => ({
        providerId: row.providerId,
        modelId: row.modelId,
        nodeType: row.nodeType,
        creditsPerCall: row.creditsPerCall,
        estimatedCostUsd: Number(row.costUsdPerCall),
      })),
      source: 'database',
    })
  } catch (error) {
    if (isProviderGatewaySchemaMissing(error)) {
      return NextResponse.json({
        pricing: getAllGatewayPricing(),
        source: 'default',
        errorCode: PROVIDER_GATEWAY_SCHEMA_MISSING_CODE,
        message: PROVIDER_GATEWAY_SCHEMA_MISSING_MESSAGE,
      })
    }
    console.error('[provider-gateway] failed to load provider pricing', error)
    return NextResponse.json({ message: '加载 Provider Gateway 定价规则失败。' }, { status: 500 })
  }
}
