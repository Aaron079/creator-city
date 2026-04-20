import type { ImageRequest, ImageResponse } from '../../prompts'

// ─── SDXL (Stability AI SDXL) ─────────────────────────────────────────────────
//
// Stability AI's Stable Diffusion XL — high-quality open-source image generation.
//
// 启用步骤：
//   1. 设置 STABILITY_API_KEY（从 platform.stability.ai 获取）
//   2. 取消下方注释，替换为真实调用
//
// 参考接口结构：
//   POST https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image
//   Header: Authorization: Bearer ${STABILITY_API_KEY}
//           Accept: application/json
//   Body: {
//     text_prompts: [{ text: prompt, weight: 1 }, { text: "blurry, bad quality", weight: -1 }],
//     cfg_scale: 7,
//     height: 1024,
//     width: 1024,
//     samples: 1,
//     steps: 30,
//   }
//   Response: { artifacts: [{ base64: string }] }
//   → convert base64 to data URL or upload to storage

export async function sdxlGenerateImage({ prompt, style }: ImageRequest): Promise<ImageResponse> {
  void prompt
  void style

  // TODO: 取消下方注释以启用真实调用
  //
  // const apiKey = process.env.STABILITY_API_KEY
  // if (!apiKey) throw new Error('STABILITY_API_KEY not set')
  //
  // const res = await fetch(
  //   'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
  //   {
  //     method: 'POST',
  //     headers: {
  //       Authorization: `Bearer ${apiKey}`,
  //       'Content-Type': 'application/json',
  //       Accept: 'application/json',
  //     },
  //     body: JSON.stringify({
  //       text_prompts: [
  //         { text: prompt, weight: 1 },
  //         { text: 'blurry, bad quality, worst quality', weight: -1 },
  //       ],
  //       cfg_scale: 7,
  //       height: 1024,
  //       width: 1024,
  //       samples: 1,
  //       steps: 30,
  //     }),
  //   }
  // )
  // if (!res.ok) {
  //   const body = await res.text()
  //   throw new Error(`SDXL ${res.status}: ${body.slice(0, 300)}`)
  // }
  // const data = (await res.json()) as { artifacts: Array<{ base64: string; finishReason: string }> }
  // const b64 = data.artifacts[0]?.base64
  // if (!b64) throw new Error('SDXL returned no image')
  // return { imageUrl: `data:image/png;base64,${b64}`, source: 'real' }

  throw new Error('SDXL provider not yet enabled. Set STABILITY_API_KEY and uncomment providers/image/sdxl.ts.')
}
