// Credit cost per generation by provider + node type.
// Must match the server-side values in apps/server/src/modules/credits/credits.service.ts

const PROVIDER_COST: Record<string, number> = {
  'custom-video-gateway': 100,
  runway: 150,
  'openai-images': 20,
  'openai-text': 5,
  'anthropic-claude': 5,
  elevenlabs: 30,
  udio: 40,
  suno: 40,
}

const NODE_TYPE_DEFAULT: Record<string, number> = {
  video: 100,
  image: 20,
  audio: 30,
  music: 40,
  text: 5,
}

export function estimateCreditCost(providerId: string, nodeType: string): number {
  return PROVIDER_COST[providerId] ?? NODE_TYPE_DEFAULT[nodeType] ?? 50
}
