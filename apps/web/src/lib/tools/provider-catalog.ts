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
  catalogItem('Seedance 1.5 Pro', 'video-generation', { id: 'seedance-1-5-pro', status: 'mock', estimatedTime: '1.5 min', adapterId: 'seedance' }),
  catalogItem('Wan 2.6', 'video-generation', { estimatedTime: '2 min' }),
  catalogItem('Hailuo-O2', 'video-generation', { estimatedTime: '3 min' }),
  catalogItem('Wan 2.2', 'video-generation', { estimatedTime: '2 min' }),
  catalogItem('Wan 2.5', 'video-generation', { estimatedTime: '2 min' }),
  catalogItem('Seedance 2.0', 'video-generation', { badge: 'new', estimatedTime: '5~10 min', adapterId: 'seedance' }),
  catalogItem('Seedance 2.0 Fast', 'video-generation', { badge: 'new', estimatedTime: '2~5 min', adapterId: 'seedance' }),
  catalogItem('Kling 3.0 Omni', 'video-generation', { id: 'kling-3-0-omni', status: 'mock', badge: 'pro', estimatedTime: '18/s', adapterId: 'kling' }),
  catalogItem('Kling 3.0', 'video-generation', { status: 'mock', adapterId: 'kling' }),
  catalogItem('Kling O1', 'video-generation', { adapterId: 'kling' }),
  catalogItem('VEO3.1-Lite', 'video-generation', { adapterId: 'veo' }),
  catalogItem('VEO3.1-Fast', 'video-generation', { adapterId: 'veo' }),
  catalogItem('VEO3.1', 'video-generation', { badge: '4K', adapterId: 'veo' }),
  catalogItem('Kling 2.6', 'video-generation', { adapterId: 'kling' }),
  catalogItem('Hailuo-2.3', 'video-generation'),
  catalogItem('Seedance 1.0 Pro', 'video-generation', { adapterId: 'seedance' }),
  catalogItem('Seedance 1.0 Lite', 'video-generation', { adapterId: 'seedance' }),
  catalogItem('Vidu Q2', 'video-generation', { adapterId: 'vidu' }),
  catalogItem('Vidu Q3', 'video-generation', { badge: 'new', adapterId: 'vidu' }),
  catalogItem('Kling 2.1', 'video-generation', { adapterId: 'kling' }),
  catalogItem('Kling 2.5', 'video-generation', { adapterId: 'kling' }),
  catalogItem('PixVerse 5.5', 'video-generation'),
  catalogItem('PixVerse 5.0', 'video-generation'),
  catalogItem('VEO3', 'video-generation', { adapterId: 'veo' }),
  catalogItem('VEO3-Fast', 'video-generation', { adapterId: 'veo' }),
  catalogItem('Sora 2', 'video-generation', { id: 'sora-2', status: 'mock', adapterId: 'sora' }),
  catalogItem('Sora 2 Pro', 'video-generation', { badge: 'pro', adapterId: 'sora' }),
  catalogItem('Wan 2.2 Flash', 'video-generation', { badge: 'discount' }),
  catalogItem('Kling 3.0 Omni 视频编辑', 'video-generation', { adapterId: 'kling-edit' }),
  catalogItem('Kling O1 视频编辑', 'video-generation', { adapterId: 'kling-edit' }),
  catalogItem('MJ Video', 'video-generation', { adapterId: 'midjourney-video' }),
  catalogItem('Hailuo-2.3 Fast', 'video-generation'),
  catalogItem('Vidu Q2 Pro', 'video-generation', { badge: 'pro', adapterId: 'vidu' }),
  catalogItem('Vidu Q2 Turbo', 'video-generation', { adapterId: 'vidu' }),
  catalogItem('Kling 2.6 动作迁移', 'video-generation', { adapterId: 'kling-motion-transfer' }),
  catalogItem('OmniHuman 1.5', 'video-generation', { status: 'bridge-only', adapterId: 'omnihuman' }),
]

const imageProviders: ToolProvider[] = [
  catalogItem('nano banana', 'image-generation', { id: 'nano-banana', status: 'mock', adapterId: 'nano-banana' }),
  catalogItem('OpenAI GPT Images', 'image-generation', { id: 'openai-gpt-images', adapterId: 'openai-images', envKeys: ['OPENAI_API_KEY'] }),
  catalogItem('Flux Pro', 'image-generation', { badge: 'pro' }),
  catalogItem('Midjourney V7', 'image-generation', { adapterId: 'midjourney' }),
  catalogItem('Adobe Firefly', 'image-generation', { status: 'bridge-only', adapterId: 'firefly' }),
  catalogItem('Recraft', 'image-generation'),
  catalogItem('Ideogram', 'image-generation'),
]

const textProviders: ToolProvider[] = [
  catalogItem('Claude', 'text-script', { id: 'anthropic-claude', status: 'mock', adapterId: 'anthropic', envKeys: ['ANTHROPIC_API_KEY'] }),
  catalogItem('GPT-5', 'text-script', { id: 'gpt-5', adapterId: 'openai-text', envKeys: ['OPENAI_API_KEY'] }),
  catalogItem('DeepSeek', 'text-script'),
  catalogItem('豆包', 'text-script'),
  catalogItem('Sudowrite', 'text-script', { status: 'bridge-only' }),
  catalogItem('Arc Studio', 'text-script', { status: 'bridge-only' }),
]

const voiceProviders: ToolProvider[] = [
  catalogItem('ElevenLabs', 'voice-dubbing', { id: 'elevenlabs', status: 'mock', envKeys: ['ELEVENLABS_API_KEY'] }),
  catalogItem('Resemble AI', 'voice-dubbing'),
  catalogItem('Azure Speech', 'voice-dubbing', { envKeys: ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'] }),
  catalogItem('HeyGen', 'voice-dubbing'),
  catalogItem('Rask AI', 'voice-dubbing'),
  catalogItem('Dubverse', 'voice-dubbing'),
  catalogItem('Adobe Podcast', 'voice-dubbing', { status: 'bridge-only' }),
  catalogItem('iZotope RX', 'voice-dubbing', { status: 'bridge-only' }),
  catalogItem('LALAL.AI', 'voice-dubbing'),
  catalogItem('Voice.ai', 'voice-dubbing'),
]

const musicProviders: ToolProvider[] = [
  catalogItem('Udio', 'music-ost', { id: 'udio', status: 'mock' }),
  catalogItem('Suno', 'music-ost', { id: 'suno', status: 'mock' }),
  catalogItem('AIVA', 'music-ost', { status: 'bridge-only' }),
  catalogItem('Stable Audio', 'music-ost'),
  catalogItem('Google Lyria', 'music-ost', { adapterId: 'lyria', envKeys: ['GOOGLE_AI_API_KEY'] }),
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
