import { NextResponse } from 'next/server'
import { normalizeTemplateAssetSearch, searchTemplateAssets } from '@/lib/template-assets/asset-search'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const input = normalizeTemplateAssetSearch({
    q: url.searchParams.get('q'),
    type: url.searchParams.get('type'),
    source: url.searchParams.get('source'),
    limit: url.searchParams.get('limit'),
  })

  const response = await searchTemplateAssets(input)
  return NextResponse.json(response)
}
