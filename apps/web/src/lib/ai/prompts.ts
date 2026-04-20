// ─── Shared types ────────────────────────────────────────────────────────────

export type AgentRole = 'writer' | 'director' | 'actor' | 'camera' | 'editor'

export type GenerateSource = 'mock' | 'real' | 'fallback-mock'

/** Pro Mode director parameters — passed through from UI to prompts */
export interface ProParams {
  // Legacy / compat
  shotType:   string   // close-up | medium | wide | aerial | over-the-shoulder
  colorGrade: string   // cinematic | teal-orange | noir | soft-pastel | natural | commercial-clean
  lighting:   string   // soft | hard | moody | daylight | neon-night

  // ── Camera geometry ──────────────────────────────────────────────────────────
  framing:    string   // ShotFrame: ECU | CU | MCU | MS | WS | EWS | OTS | POV
  angle:      string   // CameraAngle: Eye Level | Low Angle | High Angle | Bird's Eye ...
  movement:   string   // Movement: Static | Dolly In | Handheld | Bullet Time ...
  focalLength: number  // mm: 14 | 18 | 24 | 28 | 35 | 50 | 85 | 100 | 135 | 200
  aperture:   string   // f/1.2 | f/1.4 | f/1.8 | f/2.0 | f/2.8 | f/4 | f/5.6 | f/8 | f/11 | f/16
  speed:      string   // 0.1× | 0.25× | 0.5× | 1× | 2× | 4× | Reverse

  // ── Lighting ─────────────────────────────────────────────────────────────────
  lightingType:      string   // Natural | Key Light | Three Point | Chiaroscuro | Neon ...
  lightingPosition:  string   // Front | 45° Side | Side | Backlight | Overhead | Rim
  lightingIntensity: number   // 0–100

  // ── Color ────────────────────────────────────────────────────────────────────
  colorLUT:    string   // Rec.709 | Kodak Vision3 | Fuji Provia | Teal & Orange | Cyberpunk Neon ...
  colorTemp:   number   // 2000–8000 K
  contrast:    number   // 0–100
  saturation:  number   // 0–100
  highlights:  number   // 0–100
  shadows:     number   // 0–100

  // ── Model selection ──────────────────────────────────────────────────────────
  textModel:  string   // claude | gpt-4o
  imageModel: string   // mock | nano-banana-2 | nano-banana-pro | dall-e-3 | flux-dev
  videoModel: string   // mock | runway | seedance | happyhorse | kling
  duration:   string   // 5s | 10s | 15s
  aiStrength: number   // 0-100
}

/** Global model routing — which provider to use for image and video generation */
export interface ModelConfig {
  imageModel: string  // ImageProvider value
  videoModel: string  // VideoProvider value
}

/** Global quality-control parameters — applied across all shots as prompt modifiers */
export interface GlobalPro {
  styleConsistency: number  // 0-100  → consistent visual language across shots
  creativity:       number  // 0-100  → experimental vs. conventional composition
  realism:          number  // 0-100  → photorealistic vs. stylized
  detailLevel:      number  // 0-100  → ultra-detailed vs. clean/minimal
  modelConfig: ModelConfig
}

export const DEFAULT_GLOBAL_PRO: GlobalPro = {
  styleConsistency: 50,
  creativity:       50,
  realism:          50,
  detailLevel:      50,
  modelConfig: {
    imageModel: 'nano-banana-2',
    videoModel: 'runway',
  },
}

/**
 * Convert GlobalPro sliders into English prompt modifier phrases.
 * Only emits terms for values that meaningfully depart from neutral (50).
 */
export function globalProToKeywords(g: GlobalPro): string[] {
  const terms: string[] = []

  if (g.styleConsistency >= 70)      terms.push('consistent style, same visual language throughout')
  else if (g.styleConsistency <= 30) terms.push('varied visual style')

  if (g.creativity >= 70)            terms.push('highly creative, experimental composition')
  else if (g.creativity >= 50)       terms.push('creative framing')
  // low creativity: no modifier — keeps prompts clean

  if (g.realism >= 70)               terms.push('photorealistic, cinematic realism')
  else if (g.realism <= 30)          terms.push('stylized, artistic interpretation')

  if (g.detailLevel >= 70)           terms.push('ultra detailed, high resolution')
  else if (g.detailLevel >= 50)      terms.push('detailed')
  else if (g.detailLevel <= 30)      terms.push('clean minimal detail')

  return terms
}

export interface GenerateRequest {
  idea: string
  role: AgentRole
  style?: string
  context?: string
  params?: Record<string, unknown>  // carries ProParams when pro mode is active
}

export interface GenerateResponse {
  content: string
  source: GenerateSource
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const s = (style?: string) => style ?? '商业广告'

const ctx = (context?: string) =>
  context ? `\n\n---\n【上游创作参考】\n${context}\n---` : ''

const pro = (params?: Record<string, unknown>) => params as ProParams | undefined

const strengthNote = (strength?: number) => {
  if (strength == null) return ''
  if (strength < 35) return '\n\n【AI 介入强度：低】请以选项和可能性为主，保留大量创作空间，不要给出唯一答案。'
  if (strength > 80) return '\n\n【AI 介入强度：高】请主导生成，输出完整可用方案，直接指定最优选择。'
  return ''
}

// ─── Role prompt builders ─────────────────────────────────────────────────────

export interface RolePrompt {
  systemPrompt: string
  buildUserPrompt: (idea: string, style?: string, context?: string, params?: Record<string, unknown>) => string
}

export const ROLE_PROMPTS: Record<AgentRole, RolePrompt> = {
  writer: {
    systemPrompt: `你是一位专业商业视频编剧。请用中文输出结构化剧情梗概，语言克制精准，便于导演和摄影师直接使用。控制在 400 字以内。`,
    buildUserPrompt: (idea, style, _ctx, params) => {
      const p = pro(params)
      return `\
视频风格：${s(style)}
创意描述：${idea}${strengthNote(p?.aiStrength)}

请输出以下三部分，每部分简短有力：

【剧情梗概】
（三幕结构，每幕 1-2 句）

【核心冲突】
（主角面临的内外矛盾，1 句）

【视觉关键词】
（3-5 个词，用于摄影和美术参考）`
    },
  },

  director: {
    systemPrompt: `你是一位顶级广告导演。请用中文输出可执行的导演方案，聚焦镜头设计与情绪推进，语言简洁直接。控制在 400 字以内。`,
    buildUserPrompt: (idea, style, context, params) => {
      const p = pro(params)
      const constraints = p?.shotType
        ? `\n\n【导演参数约束】\n镜头类型：${p.shotType}  景别：${p.framing}  运镜：${p.movement}\n→ 分镜请严格遵循以上参数`
        : ''
      return `\
视频风格：${s(style)}
创意描述：${idea}${ctx(context)}${constraints}${strengthNote(p?.aiStrength)}

请输出以下三部分：

【导演思路】
（整体基调与情绪策略，2-3 句）

【分镜语言】
· 开场：景别 / 运动方式 / 情绪目标
· 核心场景：景别 / 运动方式 / 情绪目标
· 高潮：景别 / 运动方式 / 情绪目标
· 结尾：景别 / 运动方式 / 情绪目标

【情绪推进方式】
（节奏曲线描述，1-2 句）`
    },
  },

  actor: {
    systemPrompt: `你是一位专业选角导演。请严格以纯 JSON 格式输出角色设定卡，不要输出任何 JSON 以外的内容，不使用 markdown 代码块。`,
    buildUserPrompt: (idea, style, context, params) => {
      const p = pro(params)
      const constraints = (p?.lighting || p?.colorGrade)
        ? `\n\n【视觉参数约束】\n灯光方案：${p?.lighting ?? ''}  调色风格：${p?.colorGrade ?? ''}  景别：${p?.framing ?? ''}\n→ 角色外形与造型请与以上视觉参数保持统一`
        : ''
      return `\
视频风格：${s(style)}
创意描述：${idea}${ctx(context)}${constraints}${strengthNote(p?.aiStrength)}

请以如下 JSON 格式输出角色设定卡，不要输出其他任何内容：
{
  "characterName": "角色名（简短，1-6字）",
  "personality": "性格特征与内在驱动（20字以内）",
  "lookSummary": "外形气质摘要（20字以内）",
  "wardrobe": "服装造型方向（20字以内）"
}`
    },
  },

  camera: {
    systemPrompt: `你是一位顶级电影摄影指导（Director of Photography）。请严格以纯 JSON 格式输出摄影方案，不要输出任何 JSON 以外的内容，不使用 markdown 代码块。`,
    buildUserPrompt: (idea, style, context, params) => {
      const p = pro(params)
      const constraints = p?.framing
        ? `\n\n【摄影参数约束】\n景别：${p.framing}  角度：${p.angle ?? ''}  运镜：${p.movement}\n焦距：${p.focalLength ?? ''}mm  光圈：${p.aperture ?? ''}  速度：${p.speed ?? ''}\n灯光：${p.lightingType ?? p.lighting}  位置：${p.lightingPosition ?? ''}  色温：${p.colorTemp ?? ''}K\nLUT：${p.colorLUT ?? p.colorGrade}${p.imageModel ? `  关键帧模型：${p.imageModel}` : ''}\n→ 以上参数必须体现在 shotDescription 和 keyframePrompt 中`
        : ''
      return `\
视频风格：${s(style)}
创意描述：${idea}${ctx(context)}${constraints}${strengthNote(p?.aiStrength)}

请以如下 JSON 格式输出摄影方案，不要输出其他任何内容：
{
  "shotDescription": "中文镜头描述（25字以内，含景别/光影/运镜/情绪）",
  "keyframePrompt": "English cinematic image generation prompt, 40-60 words, include shot type, framing, lighting style, color grade, mood, visual style, lens character",
  "photographyNotes": "摄影技术备注（25字以内，含器材/镜头/稳定方案）"
}`
    },
  },

  editor: {
    systemPrompt: `你是一位资深后期剪辑师。请用中文输出可执行的剪辑节奏方案，语言精准，便于剪辑团队直接使用。控制在 400 字以内。`,
    buildUserPrompt: (idea, style, context, params) => {
      const p = pro(params)
      const modelNote = p?.videoModel ? `\n\n【视频生成模型】${p.videoModel}` : ''
      return `\
视频风格：${s(style)}
创意描述：${idea}${ctx(context)}${modelNote}${strengthNote(p?.aiStrength)}

请输出以下三部分：

【剪辑节奏】
整体节奏曲线：  平均镜头长度：  转场方式：

【音乐方向】
风格参考：  节拍与画面关系：  情绪节点处理：

【最终成片气质】
（2-3 句话描述观众看完后的整体感受）`
    },
  },
}

export const VALID_ROLES = Object.keys(ROLE_PROMPTS) as AgentRole[]

// ─── Image types ──────────────────────────────────────────────────────────────

export type ImageProvider = 'mock' | 'nano-banana-2' | 'nano-banana-pro' | 'dall-e-3' | 'flux-dev' | 'sdxl' | 'midjourney'

export interface ImageRequest {
  prompt: string
  style?: string
  provider?: ImageProvider
  /** Character name — used by actor skill for consistency tracking and better mock labels */
  characterName?: string
  /** Consistency key — forwarded to providers that support cross-shot character consistency */
  consistencyKey?: string
}

export interface ImageResponse {
  imageUrl: string
  source: GenerateSource
}

// ─── Video types ──────────────────────────────────────────────────────────────

export type VideoProvider = 'mock' | 'runway' | 'seedance' | 'happyhorse' | 'kling' | 'pika' | 'luma'

export interface VideoRequest {
  prompt: string
  imageUrl?: string
  style?: string
  provider?: VideoProvider
  shotType?: string
  framing?: string
  movement?: string
  colorGrade?: string
  duration?: number
}

export interface VideoResponse {
  videoUrl: string
  source: GenerateSource
}
