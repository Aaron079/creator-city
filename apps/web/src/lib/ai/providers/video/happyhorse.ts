import type { VideoRequest, VideoResponse } from '../../prompts'

// ─── Happy Horse ──────────────────────────────────────────────────────────────
//
// 启用步骤：
//   1. 设置 HAPPYHORSE_API_KEY
//   2. 取消下方注释并替换为真实 endpoint（以官方文档为准）
//   3. 实现异步轮询逻辑（视频生成通常为异步任务）
//
// 参考结构：
//   POST https://api.happyhorse.ai/v1/video/generate
//   Header: Authorization: Bearer ${HAPPYHORSE_API_KEY}
//   Body:   { prompt, image_url?, duration?, aspect_ratio?, shot_type?, framing? }
//   → 返回 task_id → 轮询 GET .../tasks/{task_id} 直到 status === 'completed'

export async function happyhorseGenerateVideo({
  prompt,
  imageUrl,
  duration,
  shotType,
  framing,
}: VideoRequest): Promise<VideoResponse> {
  void prompt
  void imageUrl
  void duration
  void shotType
  void framing

  // TODO: 取消下方注释以启用真实调用
  //
  // const apiKey = process.env.HAPPYHORSE_API_KEY
  // if (!apiKey) throw new Error('HAPPYHORSE_API_KEY not set')
  //
  // const createRes = await fetch('https://api.happyhorse.ai/v1/video/generate', {
  //   method: 'POST',
  //   headers: {
  //     Authorization: `Bearer ${apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     prompt,
  //     image_url: imageUrl,
  //     duration: duration ?? 5,
  //     aspect_ratio: '16:9',
  //     shot_type: shotType,
  //     framing,
  //   }),
  // })
  // if (!createRes.ok) {
  //   const body = await createRes.text()
  //   throw new Error(`HappyHorse create ${createRes.status}: ${body.slice(0, 300)}`)
  // }
  // const { task_id } = (await createRes.json()) as { task_id: string }
  //
  // // Poll until completed (max 5 min)
  // for (let i = 0; i < 60; i++) {
  //   await new Promise<void>((r) => setTimeout(r, 5000))
  //   const pollRes = await fetch(`https://api.happyhorse.ai/v1/tasks/${task_id}`, {
  //     headers: { Authorization: `Bearer ${apiKey}` },
  //   })
  //   const task = (await pollRes.json()) as { status: string; video_url?: string }
  //   if (task.status === 'completed' && task.video_url) {
  //     return { videoUrl: task.video_url, source: 'real' }
  //   }
  //   if (task.status === 'failed') throw new Error('HappyHorse task failed')
  // }
  // throw new Error('HappyHorse task timed out')

  throw new Error(
    'Happy Horse video provider not yet enabled. Set HAPPYHORSE_API_KEY and implement the stub in providers/video/happyhorse.ts.'
  )
}
