import { NextResponse } from 'next/server'
import { listCreditPackages } from '@/lib/billing/packages'

export const dynamic = 'force-dynamic'

const PACKAGE_LABELS: Record<string, string> = {
  starter_500: '轻量体验',
  creator_1500: '日常创作',
  studio_5500: '视频创作',
  team_15000: '团队生产',
  enterprise_50000: '工作室规模',
}

export async function GET() {
  const all = listCreditPackages()
  const packages = all.map((pkg) => {
    const usdPrice = pkg.prices.find((p) => p.currency === 'USD')
    return {
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits + pkg.bonusCredits,
      baseCredits: pkg.credits,
      bonusCredits: pkg.bonusCredits,
      priceUsd: usdPrice ? usdPrice.amount / 100 : null,
      label: PACKAGE_LABELS[pkg.id] ?? '',
      description: pkg.description,
      status: 'soon' as const,
    }
  })
  return NextResponse.json({ success: true, packages })
}
