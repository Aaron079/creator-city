import type { GenerateRequest, GenerateResponse, ImageRequest, ImageResponse, VideoRequest, VideoResponse } from './prompts'
import { mockGenerate }        from './providers/mock'
import { realGenerate }        from './providers/real'
import { dispatchImage, mockGenerateImage } from './providers/image/index'
import { mockGenerateVideo }   from './providers/video/mock'
import { realGenerateVideo }   from './providers/video/real'
import { dispatchVideo }       from './providers/video/index'

export type { AgentRole, GenerateRequest, GenerateResponse, GenerateSource, ImageRequest, ImageResponse, ImageProvider, VideoRequest, VideoResponse, VideoProvider } from './prompts'
export { VALID_ROLES } from './prompts'

// ─── Provider selection helpers ───────────────────────────────────────────────

function shouldTryReal(): boolean {
  const provider = process.env.AI_PROVIDER
  const hasKey   = !!(process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY)
  return provider === 'real' || (provider !== 'mock' && hasKey)
}

// ─── Text ─────────────────────────────────────────────────────────────────────

export async function generate(req: GenerateRequest): Promise<GenerateResponse> {
  if (!shouldTryReal()) return mockGenerate(req)
  try {
    return await realGenerate(req)
  } catch (err) {
    console.error(`[AI:text] ${req.role} failed — falling back to mock:`, err instanceof Error ? err.message : err)
    const fallback = await mockGenerate(req)
    return { ...fallback, source: 'fallback-mock' }
  }
}

// ─── Image ────────────────────────────────────────────────────────────────────

/**
 * Image provider selection:
 *  - provider==='mock'    → always mock
 *  - provider specified   → dispatchImage (stub throws → fallback-mock)
 *  - no provider + mock   → mock
 *  - no provider + real   → dispatchImage default → realGenerateImage (throws → fallback-mock)
 */
export async function generateImage(req: ImageRequest): Promise<ImageResponse> {
  // Explicit mock or env forces mock
  if (req.provider === 'mock' || (!req.provider && !shouldTryReal())) {
    return mockGenerateImage(req)
  }
  // Dispatch (handles named providers + env-based real as default)
  try {
    return await dispatchImage(req)
  } catch (err) {
    const label = req.provider ?? 'real'
    console.error(`[AI:image] ${label} failed — falling back to mock:`, err instanceof Error ? err.message : err)
    const fallback = await mockGenerateImage(req)
    return { ...fallback, source: 'fallback-mock' }
  }
}

// ─── Video ────────────────────────────────────────────────────────────────────

/**
 * Video provider selection:
 *  - provider==='mock'    → always mock
 *  - provider specified   → dispatchVideo (stub throws → fallback-mock)
 *  - no provider + mock   → mock
 *  - no provider + real   → realGenerateVideo (throws → fallback-mock)
 */
export async function generateVideo(req: VideoRequest): Promise<VideoResponse> {
  if (req.provider === 'mock' || (!req.provider && !shouldTryReal())) {
    return mockGenerateVideo(req)
  }
  if (req.provider) {
    try {
      return await dispatchVideo(req)
    } catch (err) {
      console.error(`[AI:video] ${req.provider} failed — falling back to mock:`, err instanceof Error ? err.message : err)
      const fallback = await mockGenerateVideo(req)
      return { ...fallback, source: 'fallback-mock' }
    }
  }
  try {
    return await realGenerateVideo(req)
  } catch (err) {
    console.error('[AI:video] real failed — falling back to mock:', err instanceof Error ? err.message : err)
    const fallback = await mockGenerateVideo(req)
    return { ...fallback, source: 'fallback-mock' }
  }
}
