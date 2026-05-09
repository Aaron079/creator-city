import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { analyzeAssetIntelligence } from '@/lib/asset-intelligence'

export const dynamic = 'force-dynamic'

function metadataRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      mediaType?: unknown
      prompt?: unknown
      compiledPrompt?: unknown
      providerId?: unknown
      metadata?: unknown
    } | null
    if (!body || (body.mediaType !== 'image' && body.mediaType !== 'video')) {
      return NextResponse.json({
        success: false,
        errorCode: 'ASSET_INTELLIGENCE_MEDIA_TYPE_REQUIRED',
        message: 'mediaType must be image or video.',
      }, { status: 400 })
    }

    const assetIntelligence = analyzeAssetIntelligence({
      mediaType: body.mediaType,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
      compiledPrompt: typeof body.compiledPrompt === 'string' ? body.compiledPrompt : undefined,
      providerId: typeof body.providerId === 'string' ? body.providerId : undefined,
      metadata: metadataRecord(body.metadata),
    })

    return NextResponse.json({
      success: true,
      assetIntelligence,
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      errorCode: 'ASSET_INTELLIGENCE_FAILED',
      message: error instanceof Error ? error.message : '资产智能分析失败。',
    }, { status: 200 })
  }
}
