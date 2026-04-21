import { NextRequest, NextResponse } from 'next/server'
import { generateVideo } from '@/lib/ai'

interface RequestBody {
  prompt?: string
  imageUrl?: string
  style?: string
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody
  const { prompt = '', imageUrl, style } = body

  if (!prompt.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  try {
    const result = await generateVideo({ prompt, imageUrl, style })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'video generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
