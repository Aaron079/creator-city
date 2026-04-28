import { NextResponse } from 'next/server'
import { getPublicTemplateById } from '@/lib/templates/public-template-catalog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: { templateId?: string }
  try {
    body = await request.json() as { templateId?: string }
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const template = getPublicTemplateById(body.templateId)
  if (!template) {
    return NextResponse.json({ success: false, message: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    template,
    nodeGraph: template.nodeGraph,
    message: 'Template workflow ready.',
  })
}
