import type { ImageRequest, ImageResponse } from '../../prompts'

// Vary placeholder by style keyword so different runs look distinct
const PALETTE: Array<[string, string]> = [
  ['0d1117', '818cf8'],
  ['0d1117', '60a5fa'],
  ['0d1117', 'f43f5e'],
  ['0d1117', '34d399'],
  ['0d1117', 'f59e0b'],
]

let _idx = 0

export async function mockGenerateImage({ style, characterName }: ImageRequest): Promise<ImageResponse> {
  await new Promise<void>((r) => setTimeout(r, 800 + Math.random() * 400))

  const [bg, fg] = PALETTE[_idx % PALETTE.length] ?? ['0d1117', '818cf8']
  _idx++

  const label = encodeURIComponent(
    characterName ? `${characterName} · ${style ?? '角色'}` : `AI Frame · ${style ?? '概念'}`
  )
  const imageUrl = `https://placehold.co/1792x1024/${bg}/${fg}?text=${label}`

  return { imageUrl, source: 'mock' }
}
