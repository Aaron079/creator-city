export type ToolProviderCategory =
  | 'video-generation'
  | 'image-generation'
  | 'text-script'
  | 'voice-dubbing'
  | 'music-ost'

export type ToolProviderNodeType = 'text' | 'image' | 'video' | 'audio' | 'music'
export type ToolProviderStatus = 'available' | 'mock' | 'bridge-only' | 'not-configured' | 'coming-soon'
export type ToolProviderBadge = 'new' | '4K' | 'discount' | 'pro'
export type ToolProviderRecommendation =
  | 'canvas-text'
  | 'canvas-image'
  | 'canvas-video'
  | 'canvas-audio'
  | 'script'
  | 'voice'
  | 'ost'
  | 'delivery'

export interface ToolProvider {
  id: string
  name: string
  displayName: string
  category: ToolProviderCategory
  nodeTypes: ToolProviderNodeType[]
  status: ToolProviderStatus
  estimatedTime: string
  badge?: ToolProviderBadge
  description: string
  requiresApiKey: boolean
  envKeys: string[]
  adapterId: string
}

export const PROVIDER_CATEGORY_LABELS: Record<ToolProviderCategory, string> = {
  'video-generation': '视频生成',
  'image-generation': '图片生成',
  'text-script': '文本 / 剧本',
  'voice-dubbing': '声音 / 配音',
  'music-ost': '音乐 / OST',
}

export const PROVIDER_CATEGORY_ORDER: ToolProviderCategory[] = [
  'video-generation',
  'image-generation',
  'text-script',
  'voice-dubbing',
  'music-ost',
]

const RECOMMENDATION_NODE_TYPES: Record<ToolProviderRecommendation, ToolProviderNodeType[]> = {
  'canvas-text': ['text'],
  'canvas-image': ['image'],
  'canvas-video': ['video'],
  'canvas-audio': ['audio', 'music'],
  script: ['text'],
  voice: ['audio'],
  ost: ['music'],
  delivery: ['text'],
}

const ENV_KEYS: Record<ToolProviderCategory, string[]> = {
  'video-generation': ['VIDEO_PROVIDER_API_KEY'],
  'image-generation': ['IMAGE_PROVIDER_API_KEY'],
  'text-script': ['TEXT_PROVIDER_API_KEY'],
  'voice-dubbing': ['VOICE_PROVIDER_API_KEY'],
  'music-ost': ['MUSIC_PROVIDER_API_KEY'],
}

const NODE_TYPES: Record<ToolProviderCategory, ToolProviderNodeType[]> = {
  'video-generation': ['video'],
  'image-generation': ['image'],
  'text-script': ['text'],
  'voice-dubbing': ['audio'],
  'music-ost': ['music', 'audio'],
}

const DESCRIPTION: Record<ToolProviderCategory, string> = {
  'video-generation': '视频生成 provider。当前未接真实后端时只允许 mock 或显示未配置。',
  'image-generation': '图片生成 provider。真实调用需要对应 adapter 与 API key。',
  'text-script': '文本、剧本和创意写作 provider。真实调用需要安全后端 adapter。',
  'voice-dubbing': '声音、配音、翻译或音频处理 provider。真实调用需要 adapter 与 key。',
  'music-ost': '音乐、OST 和配乐 provider。当前只做目录与状态展示。',
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
}

function catalogItem(
  name: string,
  category: ToolProviderCategory,
  options: Partial<Pick<ToolProvider, 'id' | 'status' | 'estimatedTime' | 'badge' | 'description' | 'requiresApiKey' | 'envKeys' | 'adapterId' | 'nodeTypes'>> = {},
): ToolProvider {
  const id = options.id ?? slugify(name)
  const requiresApiKey = options.requiresApiKey ?? true
  return {
    id,
    name,
    displayName: name,
    category,
    nodeTypes: options.nodeTypes ?? NODE_TYPES[category],
    status: options.status ?? 'not-configured',
    estimatedTime: options.estimatedTime ?? '2 min',
    badge: options.badge,
    description: options.description ?? DESCRIPTION[category],
    requiresApiKey,
    envKeys: options.envKeys ?? (requiresApiKey ? ENV_KEYS[category] : []),
    adapterId: options.adapterId ?? id,
  }
}

const videoProviders: ToolProvider[] = [
  // Creator City 自有视频网关 — 配置 CUSTOM_VIDEO_PROVIDER_ENDPOINT 即 available
  catalogItem('Creator Video Gateway', 'video-generation', {
    id: 'custom-video-gateway',
    badge: 'new',
    estimatedTime: '1~3 min',
    adapterId: 'custom-video-gateway',
    envKeys: ['CUSTOM_VIDEO_PROVIDER_ENDPOINT'],
    description: '自有视频生成网关。配置 CUSTOM_VIDEO_PROVIDER_ENDPOINT 后标记 available，CUSTOM_VIDEO_PROVIDER_API_KEY 可选。',
  }),
  // Runway: has official API + gateway adapter — status determined at runtime by env var check
  catalogItem('Runway', 'video-generation', { id: 'runway', badge: 'new', estimatedTime: '30~90s', adapterId: 'runway', envKeys: ['RUNWAY_API_KEY'], description: '官方 API 支持 text-to-video 和 image-to-video（Gen-4 Turbo）。配置 RUNWAY_API_KEY 后标记 available。' }),
  catalogItem('Seedance 1.5 Pro', 'video-generation', { id: 'seedance-1-5-pro', status: 'not-configured', estimatedTime: '1.5 min', adapterId: 'seedance', envKeys: ['SEEDANCE_API_KEY', 'SEEDANCE_API_ENDPOINT'] }),
  catalogItem('Wan 2.6', 'video-generation', { status: 'coming-soon', estimatedTime: '2 min' }),
  catalogItem('Hailuo-O2', 'video-generation', { status: 'not-configured', estimatedTime: '3 min', envKeys: ['HAILUO_API_KEY', 'HAILUO_API_ENDPOINT'] }),
  catalogItem('Wan 2.2', 'video-generation', { status: 'coming-soon', estimatedTime: '2 min' }),
  catalogItem('Wan 2.5', 'video-generation', { status: 'coming-soon', estimatedTime: '2 min' }),
  catalogItem('Seedance 2.0', 'video-generation', { badge: 'new', status: 'not-configured', estimatedTime: '5~10 min', adapterId: 'seedance', envKeys: ['SEEDANCE_API_KEY', 'SEEDANCE_API_ENDPOINT'] }),
  catalogItem('Seedance 2.0 Fast', 'video-generation', { badge: 'new', status: 'not-configured', estimatedTime: '2~5 min', adapterId: 'seedance', envKeys: ['SEEDANCE_API_KEY', 'SEEDANCE_API_ENDPOINT'] }),
  catalogItem('Kling 3.0 Omni', 'video-generation', { id: 'kling-3-0-omni', status: 'not-configured', badge: 'pro', estimatedTime: '18/s', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('Kling 3.0', 'video-generation', { status: 'not-configured', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('Kling O1', 'video-generation', { status: 'not-configured', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('VEO3.1-Lite', 'video-generation', { status: 'not-configured', adapterId: 'veo', envKeys: ['VEO_API_KEY', 'VEO_API_ENDPOINT'] }),
  catalogItem('VEO3.1-Fast', 'video-generation', { status: 'not-configured', adapterId: 'veo', envKeys: ['VEO_API_KEY', 'VEO_API_ENDPOINT'] }),
  catalogItem('VEO3.1', 'video-generation', { badge: '4K', status: 'not-configured', adapterId: 'veo', envKeys: ['VEO_API_KEY', 'VEO_API_ENDPOINT'] }),
  catalogItem('Kling 2.6', 'video-generation', { status: 'not-configured', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('Hailuo-2.3', 'video-generation', { status: 'not-configured', envKeys: ['HAILUO_API_KEY', 'HAILUO_API_ENDPOINT'] }),
  catalogItem('Seedance 1.0 Pro', 'video-generation', { status: 'not-configured', adapterId: 'seedance', envKeys: ['SEEDANCE_API_KEY', 'SEEDANCE_API_ENDPOINT'] }),
  catalogItem('Seedance 1.0 Lite', 'video-generation', { status: 'not-configured', adapterId: 'seedance', envKeys: ['SEEDANCE_API_KEY', 'SEEDANCE_API_ENDPOINT'] }),
  catalogItem('Vidu Q2', 'video-generation', { status: 'not-configured', adapterId: 'vidu', envKeys: ['VIDU_API_KEY', 'VIDU_API_ENDPOINT'] }),
  catalogItem('Vidu Q3', 'video-generation', { badge: 'new', status: 'not-configured', adapterId: 'vidu', envKeys: ['VIDU_API_KEY', 'VIDU_API_ENDPOINT'] }),
  catalogItem('Kling 2.1', 'video-generation', { status: 'not-configured', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('Kling 2.5', 'video-generation', { status: 'not-configured', adapterId: 'kling', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('PixVerse 5.5', 'video-generation', { status: 'not-configured', envKeys: ['PIXVERSE_API_KEY', 'PIXVERSE_API_ENDPOINT'] }),
  catalogItem('PixVerse 5.0', 'video-generation', { status: 'not-configured', envKeys: ['PIXVERSE_API_KEY', 'PIXVERSE_API_ENDPOINT'] }),
  catalogItem('VEO3', 'video-generation', { status: 'not-configured', adapterId: 'veo', envKeys: ['VEO_API_KEY', 'VEO_API_ENDPOINT'] }),
  catalogItem('VEO3-Fast', 'video-generation', { status: 'not-configured', adapterId: 'veo', envKeys: ['VEO_API_KEY', 'VEO_API_ENDPOINT'] }),
  catalogItem('Sora 2', 'video-generation', { id: 'sora-2', status: 'not-configured', adapterId: 'sora', envKeys: ['SORA_API_KEY', 'SORA_API_ENDPOINT'] }),
  catalogItem('Sora 2 Pro', 'video-generation', { badge: 'pro', status: 'not-configured', adapterId: 'sora', envKeys: ['SORA_API_KEY', 'SORA_API_ENDPOINT'] }),
  catalogItem('Wan 2.2 Flash', 'video-generation', { badge: 'discount', status: 'coming-soon' }),
  catalogItem('Kling 3.0 Omni 视频编辑', 'video-generation', { status: 'not-configured', adapterId: 'kling-edit', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('Kling O1 视频编辑', 'video-generation', { status: 'not-configured', adapterId: 'kling-edit', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('MJ Video', 'video-generation', { status: 'bridge-only', adapterId: 'midjourney-video' }),
  catalogItem('Hailuo-2.3 Fast', 'video-generation', { status: 'not-configured', envKeys: ['HAILUO_API_KEY', 'HAILUO_API_ENDPOINT'] }),
  catalogItem('Vidu Q2 Pro', 'video-generation', { badge: 'pro', status: 'not-configured', adapterId: 'vidu', envKeys: ['VIDU_API_KEY', 'VIDU_API_ENDPOINT'] }),
  catalogItem('Vidu Q2 Turbo', 'video-generation', { status: 'not-configured', adapterId: 'vidu', envKeys: ['VIDU_API_KEY', 'VIDU_API_ENDPOINT'] }),
  catalogItem('Kling 2.6 动作迁移', 'video-generation', { status: 'not-configured', adapterId: 'kling-motion-transfer', envKeys: ['KLING_API_KEY', 'KLING_API_ENDPOINT'] }),
  catalogItem('OmniHuman 1.5', 'video-generation', { status: 'bridge-only', adapterId: 'omnihuman' }),
  catalogItem('Luma Dream Machine', 'video-generation', { id: 'luma', status: 'not-configured', estimatedTime: '2 min', envKeys: ['LUMA_API_KEY', 'LUMA_API_ENDPOINT'] }),
  catalogItem('Pika', 'video-generation', { id: 'pika', status: 'not-configured', estimatedTime: '1 min', envKeys: ['PIKA_API_KEY', 'PIKA_API_ENDPOINT'] }),
]

const imageProviders: ToolProvider[] = [
  // nano banana: mock-only demo provider
  catalogItem('nano banana', 'image-generation', { id: 'nano-banana', status: 'mock', adapterId: 'nano-banana' }),
  // OpenAI Image: has gateway adapter — status at runtime by OPENAI_API_KEY check
  catalogItem('OpenAI Image', 'image-generation', { id: 'openai-image', adapterId: 'openai-images', envKeys: ['OPENAI_API_KEY'], description: '官方 API 支持 gpt-image-1 图片生成。配置 OPENAI_API_KEY 后标记 available。' }),
  catalogItem('Flux Pro', 'image-generation', { badge: 'pro', status: 'not-configured', envKeys: ['REPLICATE_API_TOKEN'] }),
  catalogItem('Midjourney V7', 'image-generation', { status: 'bridge-only', adapterId: 'midjourney' }),
  catalogItem('Adobe Firefly', 'image-generation', { status: 'bridge-only', adapterId: 'firefly' }),
  catalogItem('Recraft', 'image-generation', { status: 'not-configured' }),
  catalogItem('Ideogram', 'image-generation', { status: 'not-configured' }),
]

const textProviders: ToolProvider[] = [
  // Claude: has gateway adapter — status at runtime by ANTHROPIC_API_KEY check
  catalogItem('Claude', 'text-script', { id: 'anthropic-claude', adapterId: 'anthropic', envKeys: ['ANTHROPIC_API_KEY'], description: 'Anthropic Claude。配置 ANTHROPIC_API_KEY 后标记 available。' }),
  // OpenAI Text: has gateway adapter — status at runtime by OPENAI_API_KEY check
  catalogItem('OpenAI Text', 'text-script', { id: 'openai-text', adapterId: 'openai-text', envKeys: ['OPENAI_API_KEY'], description: 'OpenAI gpt-4.1-mini 文本生成。配置 OPENAI_API_KEY 后标记 available。' }),
  catalogItem('DeepSeek', 'text-script', { status: 'not-configured' }),
  catalogItem('豆包', 'text-script', { status: 'not-configured' }),
  catalogItem('Sudowrite', 'text-script', { status: 'bridge-only' }),
  catalogItem('Arc Studio', 'text-script', { status: 'bridge-only' }),
  catalogItem('Squibler', 'text-script', { status: 'coming-soon' }),
]

const voiceProviders: ToolProvider[] = [
  // ElevenLabs: has gateway adapter — status at runtime by ELEVENLABS_API_KEY check
  catalogItem('ElevenLabs', 'voice-dubbing', { id: 'elevenlabs', adapterId: 'elevenlabs', envKeys: ['ELEVENLABS_API_KEY'], description: '官方 API TTS。配置 ELEVENLABS_API_KEY 后标记 available。' }),
  catalogItem('Resemble AI', 'voice-dubbing', { status: 'not-configured' }),
  catalogItem('Azure Speech', 'voice-dubbing', { status: 'not-configured', envKeys: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'] }),
  catalogItem('HeyGen', 'voice-dubbing', { status: 'not-configured' }),
  catalogItem('Rask AI', 'voice-dubbing', { status: 'not-configured' }),
  catalogItem('Dubverse', 'voice-dubbing', { status: 'not-configured' }),
  catalogItem('Adobe Podcast', 'voice-dubbing', { status: 'bridge-only' }),
  catalogItem('iZotope RX', 'voice-dubbing', { status: 'bridge-only' }),
  catalogItem('LALAL.AI', 'voice-dubbing', { status: 'not-configured' }),
  catalogItem('Voice.ai', 'voice-dubbing', { status: 'not-configured' }),
]

const musicProviders: ToolProvider[] = [
  catalogItem('Udio', 'music-ost', { id: 'udio', status: 'not-configured', envKeys: ['UDIO_API_KEY', 'UDIO_API_ENDPOINT'] }),
  catalogItem('Suno', 'music-ost', { id: 'suno', status: 'not-configured', envKeys: ['SUNO_API_KEY', 'SUNO_API_ENDPOINT'] }),
  catalogItem('AIVA', 'music-ost', { status: 'bridge-only' }),
  catalogItem('Stable Audio', 'music-ost', { status: 'not-configured', envKeys: ['STABILITY_API_KEY'] }),
  catalogItem('Google Lyria', 'music-ost', { status: 'not-configured', adapterId: 'lyria', envKeys: ['GOOGLE_AI_API_KEY'] }),
]

export const TOOL_PROVIDERS: ToolProvider[] = [
  ...videoProviders,
  ...imageProviders,
  ...textProviders,
  ...voiceProviders,
  ...musicProviders,
]

export function getAllToolProviders() {
  return TOOL_PROVIDERS
}

export function getToolProviderById(id: string) {
  return TOOL_PROVIDERS.find((provider) => provider.id === id) ?? null
}

export function getToolProvidersByCategory(category: ToolProviderCategory) {
  return TOOL_PROVIDERS.filter((provider) => provider.category === category)
}

export function getToolProvidersForNodeType(nodeType: ToolProviderNodeType) {
  return TOOL_PROVIDERS.filter((provider) => provider.nodeTypes.includes(nodeType))
}

export function getToolProvidersForRecommendation(recommendation: ToolProviderRecommendation) {
  const nodeTypes = RECOMMENDATION_NODE_TYPES[recommendation] ?? []
  return TOOL_PROVIDERS.filter((provider) => provider.nodeTypes.some((nodeType) => nodeTypes.includes(nodeType)))
}
