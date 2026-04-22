import type { ImageRequest, ImageResponse } from '../../prompts'

// ─── Midjourney (via Imagine API) ─────────────────────────────────────────────
//
// Midjourney is accessible through unofficial proxy APIs (e.g. useapi.net / imagine.art).
// Official API is currently in closed beta.
//
// 启用步骤：
//   1. 注册 useapi.net 或其他 Midjourney 代理服务
//   2. 设置 MIDJOURNEY_API_KEY
//   3. 取消下方注释并替换真实 endpoint
//
// 参考接口结构（useapi.net 示例）：
//   POST https://api.useapi.net/v2/jobs/imagine
//   Header: Authorization: Bearer ${MIDJOURNEY_API_KEY}
//   Body: {
//     prompt: `${prompt} --ar 16:9 --v 6.1 --style raw`,
//     replyUrl: 'https://your-webhook.com/mj-callback',  // or poll
//   }
//   Response: { jobid: string }
//   → Poll GET /v2/jobs/?jobid={jobid} until status=completed
//   → Response: { attachments: [{ url: string }] }

export async function midjourneyGenerateImage({ prompt, style }: ImageRequest): Promise<ImageResponse> {
  void prompt
  void style

  // TODO: 取消下方注释以启用真实调用
  //
  // const apiKey = process.env.MIDJOURNEY_API_KEY
  // if (!apiKey) throw new Error('MIDJOURNEY_API_KEY not set')
  //
  // const initRes = await fetch('https://api.useapi.net/v2/jobs/imagine', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ prompt: `${prompt} --ar 16:9 --v 6.1 --style raw` }),
  // })
  // const { jobid } = (await initRes.json()) as { jobid: string }
  //
  // // Poll until done (max 60s)
  // for (let i = 0; i < 12; i++) {
  //   await new Promise(r => setTimeout(r, 5000))
  //   const poll = await fetch(`https://api.useapi.net/v2/jobs/?jobid=${jobid}`, {
  //     headers: { Authorization: `Bearer ${apiKey}` },
  //   })
  //   const job = (await poll.json()) as { status: string; attachments?: Array<{ url: string }> }
  //   if (job.status === 'completed' && job.attachments?.[0]) {
  //     return { imageUrl: job.attachments[0].url, source: 'real' }
  //   }
  //   if (job.status === 'failed') throw new Error('Midjourney job failed')
  // }
  // throw new Error('Midjourney job timed out')

  throw new Error('Midjourney provider not yet enabled. Set MIDJOURNEY_API_KEY and uncomment providers/image/midjourney.ts.')
}
