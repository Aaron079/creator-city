// Provider Gateway — in-code default pricing rules (credits + estimated USD cost per call)
// These can be overridden by ProviderPricingRule rows in the DB in the future.

export interface GatewayPricingRule {
  providerId: string
  modelId: string    // '*' means all models
  nodeType: string
  creditsPerCall: number
  estimatedCostUsd: number
}

const DEFAULT_PRICING: GatewayPricingRule[] = [
  // OpenAI
  { providerId: 'openai',       modelId: '*', nodeType: 'text',  creditsPerCall: 10,  estimatedCostUsd: 0.001 },
  { providerId: 'openai',       modelId: '*', nodeType: 'image', creditsPerCall: 50,  estimatedCostUsd: 0.011 },
  { providerId: 'openai-text',  modelId: '*', nodeType: 'text',  creditsPerCall: 10,  estimatedCostUsd: 0.001 },
  { providerId: 'openai-image', modelId: '*', nodeType: 'image', creditsPerCall: 50,  estimatedCostUsd: 0.011 },
  // OpenRouter
  { providerId: 'openrouter',   modelId: '*', nodeType: 'text',  creditsPerCall: 15,  estimatedCostUsd: 0.002 },
  { providerId: 'openrouter-text', modelId: '*', nodeType: 'text', creditsPerCall: 15, estimatedCostUsd: 0.002 },
  // fal.ai
  { providerId: 'fal',          modelId: '*', nodeType: 'image', creditsPerCall: 30,  estimatedCostUsd: 0.005 },
  { providerId: 'fal',          modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  { providerId: 'fal-image',    modelId: '*', nodeType: 'image', creditsPerCall: 30,  estimatedCostUsd: 0.005 },
  { providerId: 'fal-video',    modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  // Replicate
  { providerId: 'replicate',    modelId: '*', nodeType: 'image', creditsPerCall: 30,  estimatedCostUsd: 0.005 },
  { providerId: 'replicate',    modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  { providerId: 'replicate-image', modelId: '*', nodeType: 'image', creditsPerCall: 30, estimatedCostUsd: 0.005 },
  { providerId: 'replicate-video', modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  // Creator City gateways and infrastructure
  { providerId: 'creator-video-gateway', modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  { providerId: 'custom-video-gateway',  modelId: '*', nodeType: 'video', creditsPerCall: 200, estimatedCostUsd: 0.050 },
  { providerId: 'elevenlabs',            modelId: '*', nodeType: 'audio', creditsPerCall: 20, estimatedCostUsd: 0.005 },
  { providerId: 'aliyun-oss',            modelId: '*', nodeType: 'storage', creditsPerCall: 0, estimatedCostUsd: 0 },
  { providerId: 'alipay',                modelId: '*', nodeType: 'payment', creditsPerCall: 0, estimatedCostUsd: 0 },
  { providerId: 'wechatpay',             modelId: '*', nodeType: 'payment', creditsPerCall: 0, estimatedCostUsd: 0 },
]

export function getGatewayPricing(providerId: string, nodeType: string): GatewayPricingRule {
  const exact = DEFAULT_PRICING.find((p) => p.providerId === providerId && p.nodeType === nodeType)
  if (exact) return exact

  // Fallback by nodeType
  const fallbackCosts: Record<string, { credits: number; usd: number }> = {
    text:  { credits: 10,  usd: 0.001 },
    image: { credits: 50,  usd: 0.011 },
    video: { credits: 200, usd: 0.050 },
    audio: { credits: 20,  usd: 0.005 },
    music: { credits: 20,  usd: 0.005 },
  }
  const fallback = fallbackCosts[nodeType] ?? { credits: 10, usd: 0.001 }
  return { providerId, modelId: '*', nodeType, creditsPerCall: fallback.credits, estimatedCostUsd: fallback.usd }
}

export function getAllGatewayPricing(): GatewayPricingRule[] {
  return DEFAULT_PRICING
}
