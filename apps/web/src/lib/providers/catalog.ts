// Server-side gateway catalog: only providers that have a real adapter implemented.
// Providers not listed here fall back to the tool catalog's static status.

export interface GatewayProviderEntry {
  id: string
  adapterId: string
  envKeys: string[]
  setupHint: string
  canTest: boolean
}

export const GATEWAY_PROVIDERS: GatewayProviderEntry[] = [
  {
    id: 'gpt-5',
    adapterId: 'openai-text',
    envKeys: ['OPENAI_API_KEY'],
    setupHint: '配置 OPENAI_API_KEY；可选配置 OPENAI_TEXT_MODEL（默认 gpt-4o）',
    canTest: true,
  },
  {
    id: 'anthropic-claude',
    adapterId: 'openai-text',
    envKeys: ['ANTHROPIC_API_KEY'],
    setupHint: '配置 ANTHROPIC_API_KEY；通过 OpenAI 兼容格式调用，或接自有 Claude endpoint。',
    canTest: false,
  },
  {
    id: 'openai-gpt-images',
    adapterId: 'openai-images',
    envKeys: ['OPENAI_API_KEY'],
    setupHint: '配置 OPENAI_API_KEY；可选配置 OPENAI_IMAGE_MODEL（默认 dall-e-3）',
    canTest: true,
  },
  {
    id: 'runway',
    adapterId: 'runway',
    envKeys: ['RUNWAY_API_KEY'],
    setupHint: '配置 RUNWAY_API_KEY（https://app.runwayml.com → Settings → API）',
    canTest: true,
  },
  {
    id: 'elevenlabs',
    adapterId: 'elevenlabs',
    envKeys: ['ELEVENLABS_API_KEY'],
    setupHint: '配置 ELEVENLABS_API_KEY（https://elevenlabs.io → Profile → API Key）',
    canTest: true,
  },
  {
    id: 'custom-video-gateway',
    adapterId: 'custom-video-gateway',
    envKeys: ['CUSTOM_VIDEO_PROVIDER_ENDPOINT'],
    setupHint: '配置 CUSTOM_VIDEO_PROVIDER_ENDPOINT（你自己的视频生成网关地址）和 CUSTOM_VIDEO_PROVIDER_API_KEY。',
    canTest: true,
  },
]

export function getGatewayProvider(id: string): GatewayProviderEntry | null {
  return GATEWAY_PROVIDERS.find((p) => p.id === id) ?? null
}
