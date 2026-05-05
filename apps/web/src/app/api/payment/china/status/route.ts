import { NextResponse } from 'next/server'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'
import { getChinaStorageConfigurations, getConfiguredChinaStorageProvider } from '@/lib/storage/china/gateway'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    success: true,
    payments: getChinaPaymentConfigurations(),
    storage: {
      activeProvider: getConfiguredChinaStorageProvider(),
      providers: getChinaStorageConfigurations(),
    },
    database: {
      active: 'DATABASE_URL',
      chinaReady: Boolean(process.env.DATABASE_URL_CN),
      migrationStatus: 'not-started',
    },
  })
}
