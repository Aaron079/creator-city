import type { VideoRequest, VideoResponse } from '../../prompts'
import { mockGenerateVideo }       from './mock'
import { happyhorseGenerateVideo } from './happyhorse'
import { pikaGenerateVideo }       from './pika'
import { lumaGenerateVideo }       from './luma'

// ─── Per-provider stubs (runway / seedance / kling) ──────────────────────────
//
// 当 provider 指定为这些值但 API key 未配置时，函数抛出错误，
// lib/ai/index.ts 的 generateVideo 会自动 fallback 到 mock。

async function runwayGenerateVideo({ prompt, imageUrl }: VideoRequest): Promise<VideoResponse> {
  void prompt; void imageUrl
  // POST https://api.dev.runwayml.com/v1/image_to_video
  // Header: Authorization: Bearer ${RUNWAY_API_KEY}, X-Runway-Version: 2024-11-06
  // Body:   { model: 'gen3a_turbo', promptImage: imageUrl, promptText: prompt, duration: 5 }
  throw new Error('Runway provider not yet enabled. Set RUNWAY_API_KEY and implement providers/video/index.ts runwayGenerateVideo.')
}

async function seedanceGenerateVideo({ prompt }: VideoRequest): Promise<VideoResponse> {
  void prompt
  // POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
  // Header: Authorization: Bearer ${SEEDANCE_API_KEY}
  // Body:   { model: 'seedance-1-lite', content: [{ type: 'text', text: prompt }] }
  // → 返回 task_id → 轮询直到 status=succeeded
  throw new Error('Seedance provider not yet enabled. Set SEEDANCE_API_KEY and implement providers/video/index.ts seedanceGenerateVideo.')
}

async function klingGenerateVideo({ prompt, imageUrl }: VideoRequest): Promise<VideoResponse> {
  void prompt; void imageUrl
  // POST https://fal.run/fal-ai/kling-video/v1.6/standard/text-to-video
  // Header: Authorization: Key ${FAL_API_KEY}
  // Body:   { prompt, duration: '5', aspect_ratio: '16:9', image_url? }
  throw new Error('Kling provider not yet enabled. Set FAL_API_KEY and implement providers/video/index.ts klingGenerateVideo.')
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/** Route to the correct video provider based on req.provider. */
export async function dispatchVideo(req: VideoRequest): Promise<VideoResponse> {
  switch (req.provider) {
    case 'mock':       return mockGenerateVideo(req)
    case 'happyhorse': return happyhorseGenerateVideo(req)
    case 'runway':     return runwayGenerateVideo(req)
    case 'seedance':   return seedanceGenerateVideo(req)
    case 'kling':      return klingGenerateVideo(req)
    case 'pika':       return pikaGenerateVideo(req)
    case 'luma':       return lumaGenerateVideo(req)
    default:
      // No provider specified — caller decides between mock and real
      return mockGenerateVideo(req)
  }
}

// Re-exports for convenience
export { mockGenerateVideo } from './mock'
export { happyhorseGenerateVideo } from './happyhorse'
