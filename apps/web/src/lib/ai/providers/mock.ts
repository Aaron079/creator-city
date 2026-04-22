import type { GenerateRequest, GenerateResponse } from '../prompts'

const MOCK_CONTENT: Record<string, (idea: string) => string> = {
  writer: (idea) => `【剧情梗概】
第一幕：${idea}的世界中，主角在日常表象下感受到一种无法言说的内在张力。
第二幕：一个意外事件打破了原有平衡，主角被迫在两种选择间做出决定。
第三幕：在最意想不到的时刻，一切归于平静，但世界已然不同。

【核心冲突】
主角内心对「真实自我」的渴望与外部世界期待之间的拉锯。

【视觉关键词】
克制 · 留白 · 低饱和 · 自然光 · 长焦压缩`,

  director: (idea) => `【导演思路】
以「${idea}」为情绪锚点，整体基调冷峻中带温度。用沉默和等待制造张力，避免过度解释。

【分镜语言】
· 开场：固定全景 / 无运动 / 建立孤独感
· 核心场景：肩扛跟拍 / 跟随运动 / 压迫感与亲密感并存
· 高潮：极端特写 / 静止 / 情绪决堤的边缘
· 结尾：缓慢拉远 / 焦点虚化 / 留白给观众

【情绪推进方式】
从压抑到临界，不在高潮处爆发，而是选择在最安静的时刻转折。`,

  actor: (_idea) => `{"characterName":"林野","personality":"表面平静，内心高度警觉，情感由压抑的渴望驱动","lookSummary":"干净疏离，有故事感，去偶像化气质","wardrobe":"深灰布料感外套，低调无标志，轻微做旧处理"}`,

  camera: (_idea) => `{"shotDescription":"主角独处，窗口逆光，长焦压缩空间感，静止单镜，低饱和蓝灰冷调","keyframePrompt":"cinematic medium shot, lone figure by window, soft natural backlight, teal-orange color grading, 85mm anamorphic lens, shallow depth of field, film grain, moody melancholic atmosphere, muted desaturated palette, 35mm cinematic","photographyNotes":"主镜头：85-135mm长焦 / 固定三脚架 / 蓝灰冷调主色，橙暖光点缀"}`,

  editor: (_idea) => `【剪辑节奏】
整体节奏曲线：慢 → 稍快 → 静止
平均镜头长度：3-8 秒，高潮前缩短至 1-2 秒
转场方式：声音先行转场为主，偶用硬切制造断裂感

【音乐方向】
风格参考：Nils Frahm / Ólafur Arnalds 风格极简钢琴
节拍与画面关系：不强 beat sync，音乐气息引导画面
情绪节点音乐处理：关键转折前静音 0.5 秒，落差制造冲击

【最终成片气质】
看完后感觉像一次深呼吸——沉重但不压抑，安静但有回响。观众会在脑海里自己补完故事的结尾。`,
}

export async function mockGenerate({ idea, role }: GenerateRequest): Promise<GenerateResponse> {
  await new Promise<void>((r) => setTimeout(r, 700 + Math.random() * 400))
  const fn = MOCK_CONTENT[role]
  return {
    content: fn ? fn(idea) : `[mock] 角色 ${role} 暂无内容`,
    source: 'mock',
  }
}
