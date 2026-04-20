import type { VideoRequest, VideoResponse } from '../../prompts'

// ─── Luma AI (Dream Machine) ───────────────────────────────────────────────────
//
// Luma Dream Machine — photorealistic video generation with strong motion quality.
//
// 启用步骤：
//   1. 申请 Luma API 访问：https://lumalabs.ai/dream-machine/api
//   2. 设置 LUMA_API_KEY
//   3. 取消下方注释并替换真实 endpoint
//
// 参考接口结构：
//   POST https://api.lumalabs.ai/dream-machine/v1/generations
//   Header: Authorization: Bearer ${LUMA_API_KEY}
//   Body: {
//     prompt: prompt,
//     model: 'ray-2',
//     duration: '9s',  // '5s' | '9s'
//     aspect_ratio: '16:9',
//     // Image-to-video:
//     keyframes: imageUrl ? { frame0: { type: 'image', url: imageUrl } } : undefined,
//   }
//   Response: { id: string, state: 'queued' }
//   → Poll GET /dream-machine/v1/generations/{id} until state=completed
//   → Response: { assets: { video: string } }

export async function lumaGenerateVideo({ prompt, imageUrl, duration }: VideoRequest): Promise<VideoResponse> {
  void prompt
  void imageUrl
  void duration

  throw new Error('Luma provider not yet enabled. Set LUMA_API_KEY and uncomment providers/video/luma.ts.')
}
