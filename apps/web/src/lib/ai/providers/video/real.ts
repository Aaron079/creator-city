import type { VideoRequest, VideoResponse } from '../../prompts'

// ─── Seedance (字节) ──────────────────────────────────────────────────────────
//
// 启用步骤：
//   1. 设置 SEEDANCE_API_KEY
//   2. 取消下方注释并实现轮询逻辑（视频生成通常为异步任务）
//
// POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
// Header: Authorization: Bearer ${SEEDANCE_API_KEY}
// Body:   { model: 'seedance-1-lite', content: [{ type: 'text', text: prompt }] }
// → 返回 task_id → 轮询 GET .../tasks/{task_id} 直到 status=succeeded

// ─── fal.ai / Kling ───────────────────────────────────────────────────────────
//
// POST https://fal.run/fal-ai/kling-video/v1.6/standard/text-to-video
// Header: Authorization: Key ${FAL_API_KEY}
// Body:   { prompt, duration: '5', aspect_ratio: '16:9' }
// 支持 image-to-video: 传入 image_url 字段

// ─── Runway Gen-3 ────────────────────────────────────────────────────────────
//
// POST https://api.dev.runwayml.com/v1/image_to_video
// Header: Authorization: Bearer ${RUNWAY_API_KEY}, X-Runway-Version: 2024-11-06
// Body:   { model: 'gen3a_turbo', promptImage: imageUrl, promptText: prompt, duration: 5 }

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function realGenerateVideo({ prompt, imageUrl }: VideoRequest): Promise<VideoResponse> {
  // TODO: 选择并接入上方任一 provider
  void prompt
  void imageUrl
  throw new Error(
    'Video real provider not yet enabled. 接入方式见 providers/video/real.ts 注释（Seedance / fal / Runway）。'
  )
}
