import {
  getToolProvidersForRecommendation,
  type ToolProvider,
  type ToolProviderRecommendation,
  type ToolProviderStatus,
} from '@/lib/tools/provider-catalog'

export type CanvasProviderKind = 'text' | 'image' | 'video' | 'audio' | 'delivery' | 'world' | 'upload'

const CANVAS_PROVIDER_RECOMMENDATION: Record<CanvasProviderKind, ToolProviderRecommendation | null> = {
  text: 'canvas-text',
  image: 'canvas-image',
  video: 'canvas-video',
  audio: 'canvas-audio',
  delivery: 'delivery',
  world: null,
  upload: null,
}

export const CANVAS_PROVIDER_FALLBACKS: Record<CanvasProviderKind, string> = {
  text: 'anthropic-claude',
  image: 'nano-banana',
  video: 'runway',
  audio: 'elevenlabs',
  delivery: 'delivery-agent',
  world: 'world-creator-bridge',
  upload: 'asset-drop',
}

export function getCanvasProviders(kind: CanvasProviderKind): ToolProvider[] {
  const recommendation = CANVAS_PROVIDER_RECOMMENDATION[kind]
  if (!recommendation) return []

  return getToolProvidersForRecommendation(recommendation)
}

export function getCanvasProvider(kind: CanvasProviderKind, providerId: string) {
  return getCanvasProviders(kind).find((provider) => provider.id === providerId) ?? null
}

export function getCanvasProviderLabel(kind: CanvasProviderKind, providerId: string) {
  return getCanvasProvider(kind, providerId)?.displayName ?? providerId
}

export function getCanvasProviderStatus(kind: CanvasProviderKind, providerId: string): ToolProviderStatus | null {
  return getCanvasProvider(kind, providerId)?.status ?? null
}

export function getCanvasProviderNotice(provider: ToolProvider | null) {
  if (!provider) return ''
  if (provider.status === 'not-configured') return '当前为模拟生成，API 未配置'
  if (provider.status === 'bridge-only') return '当前仅生成桥接请求，不会真实调用'
  if (provider.status === 'mock') return '模拟测试'
  if (provider.status === 'coming-soon') return '即将支持，当前仅模拟'
  return ''
}
