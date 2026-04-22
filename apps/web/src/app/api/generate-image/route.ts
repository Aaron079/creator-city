import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from '@/lib/ai'

interface RequestBody {
  prompt?: string
  style?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody
  const { prompt = '', style } = body

  if (!prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    const result = await generateImage({ prompt, style })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'image generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
