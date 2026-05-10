import { NextResponse } from 'next/server'
import { OPEN_SOURCE_TOOL_REGISTRY } from '@/lib/open-source-tools/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tools = OPEN_SOURCE_TOOL_REGISTRY.map((t) => ({
    id: t.id,
    name: t.name,
    tier: t.tier,
    category: t.category,
    description: t.description,
    license: t.license,
    risk: t.risk,
    featureFlag: t.featureFlag,
    // envKeys intentionally omitted — never expose key names to client
    productSurface: t.productSurface,
    userVisibleCapability: t.userVisibleCapability,
    stars: t.stars,
    homepage: t.homepage,
    notes: t.notes,
    enabled: process.env[t.featureFlag] === 'true',
  }))

  const summary = {
    total: tools.length,
    enabled: tools.filter((t) => t.enabled).length,
    byTier: {
      P0: tools.filter((t) => t.tier === 'P0').length,
      P1: tools.filter((t) => t.tier === 'P1').length,
      P2: tools.filter((t) => t.tier === 'P2').length,
      deferred: tools.filter((t) => t.tier === 'deferred').length,
    },
    byRisk: {
      safe: tools.filter((t) => t.risk === 'safe').length,
      license_review: tools.filter((t) => t.risk === 'license_review').length,
      service_isolation_required: tools.filter((t) => t.risk === 'service_isolation_required').length,
      reference_only: tools.filter((t) => t.risk === 'reference_only').length,
    },
  }

  return NextResponse.json({ success: true, tools, summary })
}
