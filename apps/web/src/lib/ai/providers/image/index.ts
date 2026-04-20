import type { ImageRequest, ImageResponse } from '../../prompts'
import { mockGenerateImage }          from './mock'
import { nanoBananaGenerateImage }    from './nanobana'
import { realGenerateImage }          from './real'
import { sdxlGenerateImage }          from './sdxl'
import { midjourneyGenerateImage }    from './midjourney'

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Route to the correct image provider based on req.provider.
 * Unrecognised or undefined providers fall through to realGenerateImage,
 * which throws → lib/ai/index.ts catches and falls back to mock.
 */
export async function dispatchImage(req: ImageRequest): Promise<ImageResponse> {
  switch (req.provider) {
    case 'mock':            return mockGenerateImage(req)
    case 'nano-banana-2':
    case 'nano-banana-pro': return nanoBananaGenerateImage(req)
    case 'sdxl':            return sdxlGenerateImage(req)
    case 'midjourney':      return midjourneyGenerateImage(req)
    case 'dall-e-3':
    case 'flux-dev':
    default:                return realGenerateImage(req)
  }
}

// Re-exports for lib/ai/index.ts
export { mockGenerateImage } from './mock'
export { nanoBananaGenerateImage } from './nanobana'
