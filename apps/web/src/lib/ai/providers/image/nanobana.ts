import type { ImageRequest, ImageResponse } from '../../prompts'

// ─── Nano Banana (角色一致性图像生成) ────────────────────────────────────────
//
// 支持两种模型：
//   nano-banana-2    标准质量，速度快，适合概念验证
//   nano-banana-pro  高质量，角色一致性更强，适合正式输出
//
// 启用步骤：
//   1. 设置 NANO_BANANA_API_KEY
//   2. 取消下方注释并替换真实 endpoint（以官方文档为准）
//   3. 实现角色一致性参数传递（consistencyKey / characterName）
//
// 参考接口结构：
//   POST https://api.nanobanana.ai/v1/generate
//   Header: Authorization: Bearer ${NANO_BANANA_API_KEY}
//   Body: {
//     model,         // 'nano-banana-v2' | 'nano-banana-pro-v1'
//     prompt,
//     style,
//     character_name,
//     consistency_key,
//     aspect_ratio,  // '2:3' for portrait, '16:9' for landscape
//     num_outputs: 1,
//   }
//
// 角色一致性使用说明：
//   - consistencyKey 用于跨镜头保持同一角色外观
//   - 同一 project 内同一 characterName + consistencyKey 可复现角色
//   - 后续视频节点可传入同一 consistencyKey 保持视觉一致性

export async function nanoBananaGenerateImage({
  prompt,
  style,
  provider,
  characterName,
  consistencyKey,
}: ImageRequest): Promise<ImageResponse> {
  void prompt
  void style
  void provider
  void characterName
  void consistencyKey

  // TODO: 取消下方注释以启用真实调用
  //
  // const apiKey = process.env.NANO_BANANA_API_KEY
  // if (!apiKey) throw new Error('NANO_BANANA_API_KEY not set')
  //
  // const model = provider === 'nano-banana-pro' ? 'nano-banana-pro-v1' : 'nano-banana-v2'
  //
  // const res = await fetch('https://api.nanobanana.ai/v1/generate', {
  //   method: 'POST',
  //   headers: {
  //     Authorization: `Bearer ${apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     model,
  //     prompt,
  //     style: style ?? 'cinematic',
  //     character_name: characterName,
  //     consistency_key: consistencyKey,
  //     aspect_ratio: '2:3',
  //     num_outputs: 1,
  //   }),
  // })
  // if (!res.ok) {
  //   const body = await res.text()
  //   throw new Error(`NanoBanana ${res.status}: ${body.slice(0, 300)}`)
  // }
  // const data = (await res.json()) as { image_url: string }
  // return { imageUrl: data.image_url, source: 'real' }

  throw new Error(
    'Nano Banana provider not yet enabled. Set NANO_BANANA_API_KEY and uncomment providers/image/nanobana.ts.'
  )
}
