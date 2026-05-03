interface EstimateInput {
  nodeType: string
  providerId: string
  params?: Record<string, string | number | boolean | undefined>
}

// Pricing rules v1:
// text: 5 credits
// image: 20 credits
// video (standard 5s): 120, (standard 10s): 240, (HQ 5s): 300, (HQ 10s): 600
// audio/music: 20 credits/minute (default 1 min = 20)
const HQ_PROVIDERS = new Set(['runway', 'sora', 'kling-pro', 'pika-pro'])

export function estimateGenerationCredits({ nodeType, providerId, params }: EstimateInput): number {
  switch (nodeType) {
    case 'text':
      return 5

    case 'image':
      return 20

    case 'video': {
      const isHQ =
        HQ_PROVIDERS.has(providerId) ||
        providerId.includes('pro') ||
        params?.quality === 'high' ||
        params?.quality === '4k'
      const is10s = params?.duration === '10s'
      if (isHQ) return is10s ? 600 : 300
      return is10s ? 240 : 120
    }

    case 'audio':
    case 'music': {
      const durStr = typeof params?.duration === 'string' ? params.duration : ''
      const secs = durStr ? parseInt(durStr, 10) : 60
      const mins = Math.max(1, Math.ceil((isNaN(secs) ? 60 : secs) / 60))
      return mins * 20
    }

    default:
      return 5
  }
}
