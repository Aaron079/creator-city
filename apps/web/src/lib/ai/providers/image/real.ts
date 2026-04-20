import type { ImageRequest, ImageResponse } from '../../prompts'

// ─── OpenAI DALL·E 3 ─────────────────────────────────────────────────────────
//
// 启用步骤：
//   1. 确保 OPENAI_API_KEY 已配置
//   2. 取消下方函数体注释
//   3. 在 realGenerateImage 中调用 callDalle 替换 throw

interface DalleResponse {
  data: Array<{ url: string }>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callDalle(prompt: string): Promise<string> {
  // const res = await fetch('https://api.openai.com/v1/images/generations', {
  //   method: 'POST',
  //   headers: {
  //     Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model: 'dall-e-3',
  //     prompt,
  //     size: '1792x1024',
  //     quality: 'standard',
  //     n: 1,
  //   }),
  // })
  // if (!res.ok) {
  //   const body = await res.text()
  //   throw new Error(`DALL·E ${res.status}: ${body.slice(0, 300)}`)
  // }
  // const data = (await res.json()) as DalleResponse
  // return data.data[0]?.url ?? ''

  void (null as unknown as DalleResponse)
  throw new Error('Image provider not yet enabled')
}

// ─── fal.ai / Flux (alternative) ─────────────────────────────────────────────
//
// 启用步骤：
//   1. 设置 FAL_API_KEY
//   2. POST https://fal.run/fal-ai/flux/dev
//      Body: { prompt, image_size: 'landscape_16_9' }
//      Header: Authorization: Key ${FAL_API_KEY}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function realGenerateImage({ prompt }: ImageRequest): Promise<ImageResponse> {
  // TODO: 取消 callDalle 注释或接入 fal.ai
  void prompt
  throw new Error(
    'Image real provider not yet enabled. 接入方式见 providers/image/real.ts 注释。'
  )
}
