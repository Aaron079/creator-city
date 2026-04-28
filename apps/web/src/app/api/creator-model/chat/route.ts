import { NextResponse } from 'next/server'
import { runCreatorModel } from '@/lib/creator-model/runtime'
import type { CreatorModelRequest, CreatorModelResponse } from '@/lib/creator-model/types'

function json(data: CreatorModelResponse, status = 200) {
  return NextResponse.json(data, { status })
}

function errorResponse(message: string, errorCode: string, status = 400): NextResponse {
  const body: CreatorModelResponse = {
    id: `cmr_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    mode: 'error',
    provider: 'creator-city',
    model: process.env.CREATOR_MODEL_NAME || 'creator-city-local',
    configured: false,
    content: message,
    error: errorCode,
  }
  return NextResponse.json(body, { status })
}

export async function POST(request: Request) {
  let body: CreatorModelRequest

  try {
    body = await request.json()
  } catch {
    return errorResponse('请求格式无效，需要 JSON body。', 'invalid-json', 400)
  }

  if (!Array.isArray(body.messages)) {
    return errorResponse('messages 字段必须是数组。', 'invalid-messages', 400)
  }

  try {
    const result = await runCreatorModel(body)
    return json(result, result.mode === 'error' ? 502 : 200)
  } catch (error) {
    console.error('[creator-model/chat] unhandled error', error)
    return errorResponse('内部错误，请稍后重试。', 'internal-error', 500)
  }
}
