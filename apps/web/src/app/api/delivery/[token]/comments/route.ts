import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPublicDelivery } from '@/lib/delivery/service'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { token: string }
}

type CommentBody = {
  itemId?: string | null
  authorName?: string
  authorEmail?: string
  body?: string
  status?: 'comment' | 'approved' | 'change_requested'
}

const STATUSES = new Set(['comment', 'approved', 'change_requested'])

export async function POST(request: NextRequest, { params }: RouteContext) {
  const share = await getPublicDelivery(params.token)
  if (!share) return NextResponse.json({ success: false, errorCode: 'DELIVERY_NOT_FOUND', message: '交付链接不存在。' }, { status: 404 })
  if (share === 'DISABLED') return NextResponse.json({ success: false, errorCode: 'DELIVERY_DISABLED', message: '交付链接已停用。' }, { status: 403 })
  if (share === 'EXPIRED') return NextResponse.json({ success: false, errorCode: 'DELIVERY_EXPIRED', message: '交付链接已过期。' }, { status: 410 })

  let body: CommentBody
  try {
    body = await request.json() as CommentBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: 'Invalid JSON' }, { status: 400 })
  }

  const text = body.body?.trim()
  if (!text) return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: '请填写反馈内容。' }, { status: 400 })

  const status = body.status && STATUSES.has(body.status) ? body.status : 'comment'
  const itemId = body.itemId
    ? share.items.some((item) => item.id === body.itemId)
      ? body.itemId
      : null
    : null

  const comment = await db.deliveryComment.create({
    data: {
      shareId: share.id,
      itemId,
      authorName: body.authorName?.trim() || null,
      authorEmail: body.authorEmail?.trim() || null,
      body: text,
      status,
    },
  })

  return NextResponse.json({
    success: true,
    comment: {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    },
  }, { status: 201 })
}
