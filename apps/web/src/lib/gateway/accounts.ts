// Provider Gateway — upstream account status (env-based, no API key exposed to client)

export type GatewayProviderId = 'openai' | 'openrouter' | 'fal' | 'replicate'

export interface ProviderAccountInfo {
  providerId: GatewayProviderId
  displayName: string
  status: 'available' | 'not-configured'
  nodeTypes: string[]
  envKey: string
}

const GATEWAY_PROVIDER_REGISTRY: Omit<ProviderAccountInfo, 'status'>[] = [
  { providerId: 'openai',     displayName: 'OpenAI',     envKey: 'OPENAI_API_KEY',       nodeTypes: ['text', 'image'] },
  { providerId: 'openrouter', displayName: 'OpenRouter', envKey: 'OPENROUTER_API_KEY',   nodeTypes: ['text'] },
  { providerId: 'fal',        displayName: 'fal.ai',     envKey: 'FAL_KEY',              nodeTypes: ['image', 'video'] },
  { providerId: 'replicate',  displayName: 'Replicate',  envKey: 'REPLICATE_API_TOKEN',  nodeTypes: ['image', 'video'] },
]

export function getGatewayAccountStatuses(): ProviderAccountInfo[] {
  return GATEWAY_PROVIDER_REGISTRY.map((p) => ({
    ...p,
    status: process.env[p.envKey] ? 'available' : 'not-configured',
  }))
}

export function getGatewayAccountStatus(providerId: string): 'available' | 'not-configured' {
  const canonical = toCanonicalGatewayId(providerId)
  const entry = GATEWAY_PROVIDER_REGISTRY.find((p) => p.providerId === canonical)
  if (!entry) return 'not-configured'
  return process.env[entry.envKey] ? 'available' : 'not-configured'
}

export function toCanonicalGatewayId(providerId: string): GatewayProviderId {
  if (providerId === 'openai' || providerId.startsWith('openai-')) return 'openai'
  if (providerId === 'openrouter') return 'openrouter'
  if (providerId === 'fal') return 'fal'
  if (providerId === 'replicate') return 'replicate'
  return 'openai'
}
