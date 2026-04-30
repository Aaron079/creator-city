import { NextResponse } from 'next/server'
import { listCreditPackages } from '@/lib/billing/packages'
import { getProviderStatuses } from '@/lib/billing/payment-router'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    packages: listCreditPackages(),
    providerStatuses: getProviderStatuses(),
    terms: {
      creditsAreCashOutable: false,
      creditsAreTransferable: false,
      creditsAreTradable: false,
    },
  })
}
