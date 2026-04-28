import { NextResponse } from 'next/server'
import { searchTemplateAssets } from '@/lib/template-assets/asset-search'
import { PUBLIC_TEMPLATE_CATALOG } from '@/lib/templates/public-template-catalog'
import { PUBLIC_TEMPLATE_CATEGORIES } from '@/lib/templates/public-template-categories'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '1', 10) || 1, 1), 4)

  const entries = await Promise.all(PUBLIC_TEMPLATE_CATEGORIES.map(async (category) => {
    const template = PUBLIC_TEMPLATE_CATALOG.find((item) => item.category === category)
    if (!template) return [category, []] as const

    const result = await searchTemplateAssets({
      q: template.mediaQuery,
      type: template.nodeType === 'image' ? 'image' : 'video',
      source: 'all',
      limit,
    })

    return [
      category,
      result.results.length > 0
        ? result.results
        : [{
          id: `placeholder-${template.id}`,
          title: `${category} 本地占位`,
          type: 'image' as const,
          thumbnailUrl: '',
          sourceUrl: 'creator-city://local-placeholder',
          sourceName: 'Creator City' as const,
          licenseType: 'original' as const,
          attribution: 'Creator City local gradient placeholder; no external media asset is embedded.',
        }],
    ] as const
  }))

  return NextResponse.json({
    configured: Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY),
    categories: Object.fromEntries(entries),
  })
}
