import {
  getToolProviderById,
  getToolProvidersForNodeType,
  type ToolProvider,
  type ToolProviderNodeType,
  type ToolProviderStatus,
} from '@/lib/tools/provider-catalog'

export type CanvasProviderKind = 'text' | 'image' | 'video' | 'audio' | 'delivery' | 'world' | 'upload'

const CANVAS_PROVIDER_NODE_TYPE: Record<CanvasProviderKind, ToolProviderNodeType | null> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  delivery: 'text',
  world: null,
  upload: null,
}

export const CANVAS_PROVIDER_FALLBACKS: Record<CanvasProviderKind, string> = {
  text: 'anthropic-claude',
  image: 'nano-banana',
  video: 'custom-video-gateway',
  audio: 'elevenlabs',
  delivery: 'anthropic-claude',
  world: 'anthropic-claude',
  upload: 'nano-banana',
}

export function getCanvasProviders(kind: CanvasProviderKind): ToolProvider[] {
  const nodeType = CANVAS_PROVIDER_NODE_TYPE[kind]
  if (!nodeType) return []

  return getToolProvidersForNodeType(nodeType)
}

export function getCanvasProvider(kind: CanvasProviderKind, providerId: string) {
  return getCanvasProviders(kind).find((provider) => provider.id === providerId)
    ?? getToolProviderById(providerId)
}

export function getCanvasProviderLabel(kind: CanvasProviderKind, providerId: string) {
  return getCanvasProvider(kind, providerId)?.name ?? providerId
}

export function getCanvasProviderStatus(kind: CanvasProviderKind, providerId: string): ToolProviderStatus | null {
  return getCanvasProvider(kind, providerId)?.status ?? null
}

export function getCanvasProviderNotice(provider: ToolProvider | null) {
  if (!provider) return ''
  if (provider.status === 'available') return ''
  if (provider.status === 'mock') return '模拟生成，不会调用第三方 API'
  if (provider.status === 'bridge-only') return '仅生成桥接请求，不会真实调用'
  if (provider.status === 'not-configured') return '未配置 API key、endpoint 或 adapter'
  if (provider.status === 'coming-soon') return '即将接入，当前不可真实调用'
  return ''
}
