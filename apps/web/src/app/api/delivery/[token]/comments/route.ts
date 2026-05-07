import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getPublicDelivery } from '@/lib/delivery/service'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  try {
    const share = await getPublicDelivery(params.token)
    if (!share) return jsonError('DELIVERY_NOT_FOUND', '交付链接不存在。', 404)
    if (share === 'DISABLED') return jsonError('DELIVERY_DISABLED', '交付链接已停用。', 403)
    if (share === 'EXPIRED') return jsonError('DELIVERY_EXPIRED', '交付链接已过期。', 410)

    let body: CommentBody
    try {
      body = await request.json() as CommentBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const text = body.body?.trim()
    if (!text) return jsonError('VALIDATION_FAILED', '请填写反馈内容。', 400)

    const status = body.status && STATUSES.has(body.status) ? body.status : 'comment'
    const item = body.itemId ? share.items.find((deliveryItem) => deliveryItem.id === body.itemId) ?? null : null
    const itemId = item?.id ?? null

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

    return jsonOk({
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        item: item ? { id: item.id, title: item.title } : null,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[delivery] failed to create comment', error)
    return jsonError('DELIVERY_COMMENT_FAILED', safeErrorMessage(error, '保存反馈失败。'), 500)
  }
}
