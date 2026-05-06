import { NextRequest, NextResponse } from 'next/server'
import { getPublicDelivery, serializeDeliveryShare } from '@/lib/delivery/service'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { token: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const share = await getPublicDelivery(params.token)
  if (!share) return NextResponse.json({ success: false, errorCode: 'DELIVERY_NOT_FOUND', message: '交付链接不存在。' }, { status: 404 })
  if (share === 'DISABLED') return NextResponse.json({ success: false, errorCode: 'DELIVERY_DISABLED', message: '交付链接已停用。' }, { status: 403 })
  if (share === 'EXPIRED') return NextResponse.json({ success: false, errorCode: 'DELIVERY_EXPIRED', message: '交付链接已过期。' }, { status: 410 })

  return NextResponse.json({ success: true, share: serializeDeliveryShare(share) })
}
