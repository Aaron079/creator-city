import type { VideoRequest, VideoResponse } from '../../prompts'

// ─── Pika Labs ─────────────────────────────────────────────────────────────────
//
// Pika 1.5 / 2.1 — high-quality text-to-video and image-to-video generation.
//
// 启用步骤：
//   1. 申请 Pika API 访问：https://pika.art/api
//   2. 设置 PIKA_API_KEY
//   3. 取消下方注释并替换真实 endpoint
//
// 参考接口结构：
//   POST https://api.pika.art/v1/generate
//   Header: Authorization: Bearer ${PIKA_API_KEY}
//   Body: {
//     promptText: prompt,
//     model: 'pike-2.1',
//     options: {
//       frameRate: 24,
//       duration: duration ?? 5,
//       aspectRatio: '16:9',
//       camera: { pan: movement === 'pan' ? 'right' : undefined },
//     },
//     // Image-to-video:
//     pikaffect: imageUrl ? { type: 'image_to_video', sourceImageUrl: imageUrl } : undefined,
//   }
//   Response: { id: string, status: 'queued' }
//   → Poll GET /v1/generations/{id} until status=completed

export async function pikaGenerateVideo({ prompt, imageUrl, duration }: VideoRequest): Promise<VideoResponse> {
  void prompt
  void imageUrl
  void duration

  throw new Error('Pika provider not yet enabled. Set PIKA_API_KEY and uncomment providers/video/pika.ts.')
}
