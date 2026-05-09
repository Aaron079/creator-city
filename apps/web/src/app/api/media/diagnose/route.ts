import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'

export const dynamic = 'force-dynamic'

type DiagnoseBody = {
  url?: unknown
  type?: unknown
  nodeId?: unknown
  metadataJson?: unknown
}

export async function POST(request: NextRequest) {
  let body: DiagnoseBody
  try {
    body = await request.json() as DiagnoseBody
  } catch {
    return NextResponse.json({
      success: false,
      errorCode: 'INVALID_JSON',
      message: '请求体不是合法 JSON。',
    }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return NextResponse.json({
      success: false,
      errorCode: 'MEDIA_URL_EMPTY',
      message: '当前节点没有可诊断的媒体 URL。',
    }, { status: 400 })
  }

  const diagnostic = await diagnoseMediaUrl(url)
  return NextResponse.json({
    success: true,
    ...diagnostic,
  }, { status: 200 })
}
